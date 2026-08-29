import { simpleGit, type SimpleGit } from 'simple-git';
import { getRepoRoot } from '../config.js';
import { ensureGitRepo } from '../default-site.js';
import { getGitEnv, isRemoteConfigured } from '../remote/config.js';

const GIT_TIMEOUT_MS = 15_000;

let gitInstance: SimpleGit | undefined;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} 超时（${ms / 1000}s），请检查网络或 Setting 中的远程连接配置`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function resetGit(): void {
  gitInstance = undefined;
}

async function createGit(): Promise<SimpleGit> {
  const env = await getGitEnv();
  const git = simpleGit({
    baseDir: getRepoRoot(),
    unsafe: {
      allowUnsafeSshCommand: true,
      allowUnsafeAskPass: true,
    },
  });
  git.env(env);
  return git;
}

export async function ensureGit(): Promise<SimpleGit> {
  if (!gitInstance) {
    gitInstance = await createGit();
  }
  return gitInstance;
}

export interface GitStatusInfo {
  branch: string;
  isClean: boolean;
  modified: string[];
  created: string[];
  ahead: number;
  behind: number;
  hasUnpushedCommits: boolean;
  remote: string;
  remoteConfigured: boolean;
}

export async function getGitStatus(): Promise<GitStatusInfo> {
  ensureGitRepo(getRepoRoot());
  const git = await ensureGit();
  const status = await git.status();
  const remotes = await git.getRemotes(true);
  const origin = remotes.find((r) => r.name === 'origin');
  const remote = origin?.refs.push ?? origin?.refs.fetch ?? '';

  return {
    branch: status.current ?? 'unknown',
    isClean: status.isClean(),
    modified: [...status.modified, ...status.deleted],
    created: [...status.created, ...status.not_added],
    ahead: status.ahead,
    behind: status.behind,
    hasUnpushedCommits: status.ahead > 0,
    remote: remote.replace(/:\/\/[^@]+@/, '://***@'),
    remoteConfigured: await isRemoteConfigured(),
  };
}

export interface PushResult {
  success: boolean;
  pushed: boolean;
  summary: string;
  commit?: string;
  changedFiles: number;
  branch: string;
}

function formatPushError(message: string): string {
  if (/permission denied|publickey|passphrase|authentication|401|403|invalid username|not supported for git/i.test(message)) {
    return '认证失败：请确认 Setting 中的 Token 或 SSH 配置正确';
  }
  if (/couldn'?t connect|timed out|超时|connection refused|network is unreachable/i.test(message)) {
    return '无法连接 github.com（网络超时）。请检查代理/VPN';
  }
  return message;
}

export async function pushLocalChanges(customMessage?: string): Promise<PushResult> {
  if (!(await isRemoteConfigured())) {
    throw new Error('请先在 Setting 中配置远程仓库连接');
  }

  try {
    const { applyRemoteToOrigin } = await import('../remote/index.js');
    await applyRemoteToOrigin();
    resetGit();
    const git = await ensureGit();
    const status = await git.status();
    const branch = status.current ?? 'master';

    const hasUncommittedChanges = !status.isClean();
    const hasUnpushedCommits = status.ahead > 0;

    if (!hasUncommittedChanges && !hasUnpushedCommits) {
      return {
        success: true,
        pushed: false,
        summary: '没有需要推送的更改',
        changedFiles: 0,
        branch,
      };
    }

    let commitResult: Awaited<ReturnType<SimpleGit['commit']>> | undefined;
    if (hasUncommittedChanges) {
      const pendingCount =
        status.modified.length +
        status.not_added.length +
        status.created.length +
        status.deleted.length;

      await git.add('.');
      const message = customMessage?.trim() || 'blog: 同步本地更改';
      commitResult = await git.commit(message);

      await withTimeout(git.push('origin', branch), GIT_TIMEOUT_MS, 'git push');

      const changedFiles = commitResult.summary.changes || pendingCount;
      return {
        success: true,
        pushed: true,
        summary: `已推送 ${changedFiles} 个文件的更改`,
        commit: commitResult.commit,
        changedFiles,
        branch,
      };
    }

    await withTimeout(git.push('origin', branch), GIT_TIMEOUT_MS, 'git push');
    return {
      success: true,
      pushed: true,
      summary: `已推送 ${status.ahead} 个未同步的提交`,
      changedFiles: status.ahead,
      branch,
    };
  } catch (error) {
    const message = (error as Error).message;
    if (/nothing to commit|no changes added to commit/i.test(message)) {
      const git = await ensureGit();
      const status = await git.status();
      const branch = status.current ?? 'master';
      if (status.ahead > 0) {
        await withTimeout(git.push('origin', branch), GIT_TIMEOUT_MS, 'git push');
        return {
          success: true,
          pushed: true,
          summary: `已推送 ${status.ahead} 个未同步的提交`,
          changedFiles: status.ahead,
          branch,
        };
      }
      return {
        success: true,
        pushed: false,
        summary: '没有需要推送的更改',
        changedFiles: 0,
        branch,
      };
    }
    throw new Error(formatPushError(message));
  }
}

export async function commitAndPush(message: string): Promise<{ commit: string; pushed: boolean }> {
  if (!(await isRemoteConfigured())) {
    throw new Error('请先在 Setting 中配置远程仓库连接');
  }

  const { applyRemoteToOrigin } = await import('../remote/index.js');
  await applyRemoteToOrigin();
  resetGit();
  const git = await ensureGit();
  await git.add('.');
  const commitResult = await git.commit(message);
  const status = await git.status();
  const branch = status.current ?? 'master';
  await git.push('origin', branch);
  return { commit: commitResult.commit, pushed: true };
}

export interface PullResult {
  success: boolean;
  summary: string;
  branch: string;
}

export async function pullLatest(): Promise<PullResult> {
  if (!(await isRemoteConfigured())) {
    return {
      success: false,
      summary: '请先在 Setting 中配置远程仓库连接（HTTP 或 SSH）',
      branch: 'unknown',
    };
  }

  try {
    const { applyRemoteToOrigin } = await import('../remote/index.js');
    await applyRemoteToOrigin();
    resetGit();
    const git = await ensureGit();

    const status = await git.status();
    const branch = status.current ?? 'master';

    await withTimeout(git.fetch('origin'), GIT_TIMEOUT_MS, 'git fetch');
    const pullSummary = await withTimeout(git.pull('origin', branch), GIT_TIMEOUT_MS, 'git pull');
    const changed = pullSummary.summary.changes;
    const summary = changed > 0 ? `已拉取 ${changed} 个更新` : '已是最新内容';
    return { success: true, summary, branch };
  } catch (error) {
    const message = (error as Error).message;
    const branch = 'master';
    if (/local changes|would be overwritten|cannot pull/i.test(message)) {
      return {
        success: false,
        summary: '本地有未提交修改，请先提交或暂存后再同步',
        branch,
      };
    }
    if (/permission denied|publickey|passphrase|authentication|401|403|invalid username|not supported for git|invalid format/i.test(message)) {
      return {
        success: false,
        summary: '认证失败：SSH 请确认粘贴的是私钥（非 .pub）；HTTP 请确认 Password 填的是 GitHub Token',
        branch,
      };
    }
    if (/couldn'?t connect|timed out|超时|connection refused|network is unreachable/i.test(message)) {
      return {
        success: false,
        summary: '无法连接 GitHub（git 超时）。SSH 走 22 端口，与 curl https://github.com 不是同一条路径；请检查系统代理或改用 HTTP + Token',
        branch,
      };
    }
    return { success: false, summary: message, branch };
  }
}
