import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canInitializeSiteRepo,
  ensureDefaultSiteRepo,
  ensureSiteRepo,
  getDefaultSiteRepoPath,
  isSiteRepo,
} from './default-site.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const CACHE_VERSION = Date.now().toString();

export const IS_ELECTRON = process.env.ELECTRON_RUN === '1';

function resolveEditorRoot(): string {
  if (process.env.EDITOR_ROOT) {
    return path.resolve(process.env.EDITOR_ROOT);
  }

  const fromDist = path.resolve(__dirname, '..', '..');
  if (fs.existsSync(path.join(fromDist, 'config', 'themes.json'))) {
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

function readConfiguredRepoPath(): string | null {
  const siteFile = path.join(USER_DATA_ROOT, '.credentials', 'site.json');
  try {
    const site = JSON.parse(fs.readFileSync(siteFile, 'utf-8')) as { repoPath?: string };
    if (!site.repoPath) return null;
    const resolved = path.resolve(site.repoPath);
    if (isSiteRepo(resolved) || canInitializeSiteRepo(resolved)) {
      ensureSiteRepo(resolved);
      return resolved;
    }
  } catch {
    // ignore
  }
  return null;
}

function resolveRepoRoot(): string {
  if (process.env.SITE_REPO) {
    const configured = path.resolve(process.env.SITE_REPO);
    if (isSiteRepo(configured) || canInitializeSiteRepo(configured)) {
      ensureSiteRepo(configured);
      return configured;
    }
    throw new Error(`SITE_REPO 不是有效的静态站点目录: ${configured}`);
  }

  const configured = readConfiguredRepoPath();
  if (configured) return configured;

  // Default: ~/Documents/blog-site (created on first launch if missing).
  const fallback = getDefaultSiteRepoPath();
  ensureDefaultSiteRepo(fallback);
  return path.resolve(fallback);
}

function detectSiteMeta(repoRoot: string): {
  url: string;
  title: string;
  description: string;
} {
  let url = 'https://example.com';
  let title = 'Blog';
  let description = '<p></p>';

  try {
    const html = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf-8');
    const titleMatch = html.match(/<h1 class="site-title">\s*([\s\S]*?)<\/h1>/i);
    if (titleMatch?.[1]) {
      title = titleMatch[1].replace(/\s+/g, ' ').trim();
    }

    const siteLinkMatch =
      html.match(/<a class="site-title-container" href="(https:\/\/[^"]+)"/i) ??
      html.match(/href="(https:\/\/[^"/]+)\/post\//i);
    if (siteLinkMatch?.[1]) {
      url = siteLinkMatch[1].replace(/\/+$/, '');
    }

    const descMatch = html.match(/class="description"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
    if (descMatch?.[1]) {
      description = descMatch[1].trim();
    }
  } catch {
    // use defaults
  }

  return { url, title, description };
}

export function getRepoRoot(): string {
  return resolveRepoRoot();
}

export const REPO_ROOT = getRepoRoot();
const siteMeta = detectSiteMeta(REPO_ROOT);
export let SITE_URL = siteMeta.url;
export let SITE_TITLE = siteMeta.title;
export let SITE_DESCRIPTION = siteMeta.description;

export function refreshSiteMeta(): void {
  const meta = detectSiteMeta(getRepoRoot());
  SITE_URL = meta.url;
  SITE_TITLE = meta.title;
  SITE_DESCRIPTION = meta.description;
}

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
