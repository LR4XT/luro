import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { copyBundledSiteAssets } from './site-assets.js';
import { PLACEHOLDER_SITE_URL } from './site-url.js';

/** Default local blog site under the user's Documents folder. */
export function getDefaultSiteRepoPath(home = process.env.HOME ?? ''): string {
  return path.join(home, 'Documents', 'blog-site');
}

export function isSiteRepo(dir: string): boolean {
  try {
    return (
      fs.existsSync(path.join(dir, 'index.html')) &&
      fs.existsSync(path.join(dir, 'post')) &&
      fs.existsSync(path.join(dir, 'atom.xml'))
    );
  } catch {
    return false;
  }
}

export function isGitRepo(dir: string): boolean {
  try {
    return fs.existsSync(path.join(dir, '.git'));
  } catch {
    return false;
  }
}

const IGNORABLE_NAMES = new Set([
  '.git',
  '.gitignore',
  '.ds_store',
  'readme',
  'readme.md',
  'readme.txt',
  'license',
  'license.md',
  'license.txt',
  'thumbs.db',
  'desktop.ini',
]);

/**
 * Missing, empty, or new-repo directories (README / LICENSE / .git only)
 * are valid starting points. The editor writes the static-site scaffold.
 */
export function canInitializeSiteRepo(dir: string): boolean {
  try {
    if (!fs.existsSync(dir)) {
      return true;
    }
    if (!fs.statSync(dir).isDirectory()) {
      return false;
    }
    const entries = fs.readdirSync(dir);
    return entries.every((name) => IGNORABLE_NAMES.has(name.toLowerCase()));
  } catch {
    return false;
  }
}

export function ensureGitRepo(repoPath: string): { initialized: boolean } {
  if (isGitRepo(repoPath)) {
    return { initialized: false };
  }
  fs.mkdirSync(repoPath, { recursive: true });
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'ignore' });
  return { initialized: true };
}

function scaffoldPage(title: string, body: string): string {
  const site = PLACEHOLDER_SITE_URL;
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>${title} | Blog</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <link rel="stylesheet" href="${site}/styles/main.css">
    <link rel="stylesheet" href="https://unpkg.com/aos@next/dist/aos.css" />
    <script src="https://cdn.jsdelivr.net/npm/vue/dist/vue.js"></script>
  </head>
  <body>
    <div id="app" class="main">
      <div class="sidebar" :class="{ 'full-height': menuVisible }">
        <div class="top-container" data-aos="fade-right">
          <div class="top-header-container">
            <a class="site-title-container" href="${site}">
              <img src="${site}/images/avatar.png" class="site-logo">
              <h1 class="site-title">Blog</h1>
            </a>
            <div class="menu-btn" @click="menuVisible = !menuVisible">
              <div class="line"></div>
            </div>
          </div>
          <div>
            <a href="${site}/" class="site-nav">首页</a>
            <a href="${site}/archives" class="site-nav">归档</a>
            <a href="${site}/tags" class="site-nav">标签</a>
          </div>
        </div>
        <div class="bottom-container" data-aos="flip-up" data-aos-offset="0">
          <div class="site-description">
            <p></p>
          </div>
          <div class="site-footer">
            | <a class="rss" href="${site}/atom.xml" target="_blank">RSS</a>
          </div>
        </div>
      </div>
      <div class="main-container">
        ${body}
      </div>
    </div>
    <script src="https://unpkg.com/aos@next/dist/aos.js"></script>
    <script type="application/javascript">
      AOS.init();
      var app = new Vue({ el: '#app', data: { menuVisible: false } });
    </script>
  </body>
</html>
`;
}

function writeScaffold(repoPath: string): void {
  fs.mkdirSync(path.join(repoPath, 'post'), { recursive: true });
  fs.mkdirSync(path.join(repoPath, 'post-images'), { recursive: true });
  fs.mkdirSync(path.join(repoPath, 'archives'), { recursive: true });
  fs.mkdirSync(path.join(repoPath, 'tags'), { recursive: true });
  fs.mkdirSync(path.join(repoPath, 'tag'), { recursive: true });

  const indexHtml = scaffoldPage(
    'Blog',
    `<div class="content-container" data-aos="fade-up">
          </div>`,
  );

  const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Blog</title>
  <id>${PLACEHOLDER_SITE_URL}/</id>
  <updated>${new Date().toISOString()}</updated>
  <rights>©</rights>
</feed>
`;

  const archivesHtml = scaffoldPage(
    'Archives',
    `<div class="content-container" data-aos="fade-up">
            <h2 class="archives-title">归档</h2>
            <div class="archives-container">
            </div>
          </div>`,
  );

  const tagsHtml = scaffoldPage(
    'Tags',
    `<div class="content-container" data-aos="fade-up">
            <h2 class="tag-list-title">标签列表</h2>
            <div class="tags-container"></div>
          </div>`,
  );

  fs.writeFileSync(path.join(repoPath, 'index.html'), indexHtml, 'utf-8');
  fs.writeFileSync(path.join(repoPath, 'atom.xml'), atomXml, 'utf-8');
  fs.writeFileSync(path.join(repoPath, 'archives', 'index.html'), archivesHtml, 'utf-8');
  fs.writeFileSync(path.join(repoPath, 'tags', 'index.html'), tagsHtml, 'utf-8');
  copyBundledSiteAssets(repoPath);

  const gitignorePath = path.join(repoPath, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '.DS_Store\n', 'utf-8');
  }
}

export const OCCUPIED_DIR_ERROR =
  '无法作为博客仓库：该目录不是空的，也不是已有站点。请选择空文件夹，或包含 index.html、post/ 和 atom.xml 的目录。';

export function ensureSiteRepo(repoPath: string): { created: boolean; gitInitialized: boolean } {
  const resolved = path.resolve(repoPath);
  if (isSiteRepo(resolved)) {
    const git = ensureGitRepo(resolved);
    copyBundledSiteAssets(resolved);
    return { created: false, gitInitialized: git.initialized };
  }
  if (!canInitializeSiteRepo(resolved)) {
    throw new Error(OCCUPIED_DIR_ERROR);
  }
  writeScaffold(resolved);
  const git = ensureGitRepo(resolved);
  return { created: true, gitInitialized: git.initialized };
}

export function ensureDefaultSiteRepo(repoPath: string): { created: boolean } {
  if (isSiteRepo(repoPath)) {
    ensureGitRepo(repoPath);
    copyBundledSiteAssets(repoPath);
    return { created: false };
  }
  writeScaffold(repoPath);
  ensureGitRepo(repoPath);
  return { created: true };
}
