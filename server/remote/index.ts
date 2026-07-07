import { resetGit, ensureGit } from '../utils/git.js';
import {
  buildOriginUrl,
  getRemoteConfigPublic,
  isRemoteConfigured,
  maskRemoteUrl,
  saveRemoteConfig,
  type RemoteConfigInput,
} from './config.js';

export async function applyRemoteToOrigin(): Promise<string> {
  const url = await buildOriginUrl();
  if (!url) {
    throw new Error('请先在 Setting 中配置远程仓库连接');
  }

  resetGit();
  const git = await ensureGit();
  const remotes = await git.getRemotes();
  const hasOrigin = remotes.some((r) => r.name === 'origin');

  if (hasOrigin) {
    await git.remote(['set-url', 'origin', url]);
  } else {
    await git.addRemote('origin', url);
  }

  return maskRemoteUrl(url);
}

export async function saveAndApplyRemoteConfig(input: RemoteConfigInput): Promise<{
  config: Awaited<ReturnType<typeof getRemoteConfigPublic>>;
  remoteUrl: string;
}> {
  const config = await saveRemoteConfig(input);
  resetGit();
  const remoteUrl = await applyRemoteToOrigin();
  return { config, remoteUrl };
}

export async function testRemoteConnection(): Promise<{ ok: boolean; message: string }> {
  if (!(await isRemoteConfigured())) {
    return { ok: false, message: '请先保存远程连接配置' };
  }

  try {
    resetGit();
    await applyRemoteToOrigin();
    resetGit();
    const git = await ensureGit();
    await git.listRemote(['--heads', 'origin']);
    return { ok: true, message: '连接成功' };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

export { getRemoteConfigPublic, saveRemoteConfig, isRemoteConfigured, maskRemoteUrl };
