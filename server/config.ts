import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SITE_URL = 'https://lr4xt.com';
export const SITE_TITLE = 'LR4XT';
export const SITE_DESCRIPTION =
  '<p style="text-align: center;font-size: 13px;">总有更值得做的事</p>';
export const CACHE_VERSION = Date.now().toString();

export const IS_ELECTRON = process.env.ELECTRON_RUN === '1';

function resolveEditorRoot(): string {
  if (process.env.EDITOR_ROOT) {
    return path.resolve(process.env.EDITOR_ROOT);
  }

  const fromDist = path.resolve(__dirname, '..', '..');
  if (fs.existsSync(path.join(fromDist, 'config', 'tags.json'))) {
    return fromDist;
  }

  return path.resolve(__dirname, '..');
}

export const EDITOR_ROOT = resolveEditorRoot();

function resolveUserDataRoot(): string {
  if (process.env.USER_DATA_ROOT) {
    return path.resolve(process.env.USER_DATA_ROOT);
  }
  return EDITOR_ROOT;
}

export const USER_DATA_ROOT = resolveUserDataRoot();

function isSiteRepo(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, 'index.html')) &&
    fs.existsSync(path.join(dir, 'post')) &&
    fs.existsSync(path.join(dir, 'atom.xml'))
  );
}

function readConfiguredRepoPath(): string | null {
  const siteFile = path.join(USER_DATA_ROOT, '.credentials', 'site.json');
  try {
    const site = JSON.parse(fs.readFileSync(siteFile, 'utf-8')) as { repoPath?: string };
    if (site.repoPath && isSiteRepo(site.repoPath)) {
      return path.resolve(site.repoPath);
    }
  } catch {
    // ignore
  }
  return null;
}

function resolveRepoRoot(): string {
  if (process.env.SITE_REPO) {
    const configured = path.resolve(process.env.SITE_REPO);
    if (!isSiteRepo(configured)) {
      throw new Error(`SITE_REPO 不是有效的静态站点目录: ${configured}`);
    }
    return configured;
  }

  const configured = readConfiguredRepoPath();
  if (configured) return configured;

  const home = process.env.HOME ?? '';
  const candidates = [
    path.join(EDITOR_ROOT, '..', 'lr4xt.github.io'),
    path.join(EDITOR_ROOT, '..'),
    path.join(home, 'personal_code', 'lr4xt.github.io'),
    path.join(home, 'Documents', 'lr4xt.github.io'),
  ];

  for (const candidate of candidates) {
    if (isSiteRepo(candidate)) {
      return path.resolve(candidate);
    }
  }

  throw new Error(
    '找不到 lr4xt.github.io 静态站点。请在 Setting 中设置 Site repository path，或设置 SITE_REPO 环境变量。',
  );
}

export function getRepoRoot(): string {
  return resolveRepoRoot();
}

export const REPO_ROOT = getRepoRoot();
export const POST_DIR = path.join(REPO_ROOT, 'post');
export const POST_IMAGES_DIR = path.join(REPO_ROOT, 'post-images');
export const DRAFTS_DIR = path.join(USER_DATA_ROOT, 'drafts');
export const INDEX_FILE = path.join(REPO_ROOT, 'index.html');
export const ATOM_FILE = path.join(REPO_ROOT, 'atom.xml');
export const ARCHIVES_FILE = path.join(REPO_ROOT, 'archives', 'index.html');

export function getPostImagesDir(): string {
  return path.join(getRepoRoot(), 'post-images');
}

export const DEV_CLIENT_URL =
  process.env.EDITOR_CLIENT_URL ?? (IS_ELECTRON ? 'http://127.0.0.1:3456' : 'http://localhost:5173');
