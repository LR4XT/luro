import fs from 'node:fs/promises';
import path from 'node:path';
import { EDITOR_ROOT, getRepoRoot, refreshSiteMeta, SITE_URL } from '../config.js';
import { applySiteNavToRepo, readSiteNav } from '../pages/index.js';
import { copyBundledSiteAssets } from '../site-assets.js';
import {
  githubPagesUrlFromRepo,
  isPlaceholderSiteUrl,
  rewriteSiteUrlInRepo,
} from '../site-url.js';
import { getRemoteConfigPublic } from '../remote/config.js';
import { renderPageShell } from '../templates/page.js';
import { applyThemeLinksToHtml, buildThemeLinks } from './links.js';
import { readThemes, type SiteThemePreset, type ThemeConfig } from './index.js';

function siteThemeStateFile(repoRoot = getRepoRoot()): string {
  return path.join(repoRoot, 'config', 'site-theme.json');
}

export interface SiteThemeState {
  themeId: string;
}

async function collectHtmlFiles(dir: string, files: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectHtmlFiles(fullPath, files);
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

export { applyThemeLinksToHtml, buildThemeLinks };

export async function readSiteThemeState(repoRoot = getRepoRoot()): Promise<SiteThemeState> {
  try {
    const raw = await fs.readFile(siteThemeStateFile(repoRoot), 'utf-8');
    const state = JSON.parse(raw) as SiteThemeState;
    if (state.themeId) {
      return state;
    }
  } catch {
    // fall through
  }

  const config = await readThemes();
  return { themeId: config.site.default };
}

async function writeSiteThemeState(themeId: string, repoRoot = getRepoRoot()): Promise<void> {
  const file = siteThemeStateFile(repoRoot);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(
    file,
    `${JSON.stringify({ themeId }, null, 2)}\n`,
    'utf-8',
  );
}

export async function getSiteThemePreset(themeId?: string): Promise<SiteThemePreset> {
  const config = await readThemes();
  const id = themeId ?? (await readSiteThemeState()).themeId;
  return (
    config.site.presets.find((theme) => theme.id === id) ??
    config.site.presets.find((theme) => theme.id === config.site.default) ??
    config.site.presets[0]
  );
}

async function syncThemeOverlayFile(preset: SiteThemePreset, repoRoot: string): Promise<void> {
  if (!preset.themeOverlay) return;

  const dest = path.join(repoRoot, preset.themeOverlay);
  await fs.mkdir(path.dirname(dest), { recursive: true });

  try {
    await fs.access(dest);
    if (preset.imported) return;
  } catch {
    if (preset.imported) {
      throw new Error(`自定义主题文件不存在: ${preset.themeOverlay}`);
    }
  }

  const source = path.join(EDITOR_ROOT, 'config', 'site-themes', path.basename(preset.themeOverlay));
  try {
    await fs.copyFile(source, dest);
  } catch {
    if (!preset.imported) {
      throw new Error(`主题样式文件缺失: ${path.basename(preset.themeOverlay)}`);
    }
  }
}

function extractInner(html: string, className: string): string | null {
  const re = new RegExp(
    `<div class="${className}"[^>]*>([\\s\\S]*?)</div>\\s*</body>`,
    'i',
  );
  const match = html.match(re);
  return match ? match[1].trim() : null;
}

function needsPageShell(html: string): boolean {
  return html.includes('content-container') && !html.includes('class="sidebar"');
}

async function upgradeScaffoldPage(
  filePath: string,
  html: string,
  repoRoot: string,
  preset: SiteThemePreset,
): Promise<string> {
  if (!needsPageShell(html)) return html;

  const rel = path.relative(repoRoot, filePath).replace(/\\/g, '/');
  const navItems = await readSiteNav();

  if (rel === 'index.html') {
    const inner =
      extractInner(html, 'content-container') ??
      html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1]?.trim() ??
      '';
    return renderPageShell('Blog', inner, navItems, preset);
  }

  if (rel === 'archives/index.html') {
    const inner = extractInner(html, 'archives-container') ?? '';
    return renderPageShell(
      '归档',
      `<h2 class="archives-title">归档</h2>\n<div class="archives-container">\n${inner}\n</div>`,
      navItems,
      preset,
    );
  }

  if (rel === 'tags/index.html') {
    const inner = extractInner(html, 'tags-container') ?? '';
    return renderPageShell(
      '标签列表',
      `<h2 class="tag-list-title">标签列表</h2>\n<div class="tags-container">${inner}</div>`,
      navItems,
      preset,
    );
  }

  return html;
}

async function applyPlaceholderSiteUrl(repoRoot: string): Promise<void> {
  if (!isPlaceholderSiteUrl(SITE_URL)) return;
  const remote = await getRemoteConfigPublic();
  const pagesUrl = githubPagesUrlFromRepo(remote.repoUrl);
  if (!pagesUrl) return;
  await rewriteSiteUrlInRepo(repoRoot, SITE_URL, pagesUrl);
  refreshSiteMeta();
}

export async function applySiteThemeToRepo(
  themeId: string,
  repoRoot = getRepoRoot(),
): Promise<{ updatedFiles: number; theme: SiteThemePreset }> {
  const config = await readThemes();
  const preset = config.site.presets.find((theme) => theme.id === themeId);
  if (!preset) {
    throw new Error(`未找到网站主题: ${themeId}`);
  }

  copyBundledSiteAssets(repoRoot);
  await applyPlaceholderSiteUrl(repoRoot);
  await syncThemeOverlayFile(preset, repoRoot);

  const htmlFiles = await collectHtmlFiles(repoRoot);
  let updated = 0;

  for (const filePath of htmlFiles) {
    const html = await fs.readFile(filePath, 'utf-8');
    const upgraded = await upgradeScaffoldPage(filePath, html, repoRoot, preset);
    const nextHtml = applyThemeLinksToHtml(upgraded, preset, SITE_URL);
    if (nextHtml !== html) {
      await fs.writeFile(filePath, nextHtml, 'utf-8');
      updated += 1;
    }
  }

  await applySiteNavToRepo(await readSiteNav());

  await writeSiteThemeState(themeId, repoRoot);
  return { updatedFiles: updated, theme: preset };
}

function slugifyThemeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'imported-theme';
}

export async function importSiteTheme(name: string, css: string): Promise<{ theme: SiteThemePreset; updatedConfig: ThemeConfig }> {
  const trimmedName = name.trim();
  const trimmedCss = css.trim();
  if (!trimmedName) {
    throw new Error('请填写主题名称');
  }
  if (!trimmedCss) {
    throw new Error('请上传或粘贴 CSS 内容');
  }

  const config = await readThemes();
  const slug = slugifyThemeName(trimmedName);
  let id = `imported-${slug}`;
  let suffix = 1;
  while (config.site.presets.some((theme) => theme.id === id)) {
    id = `imported-${slug}-${suffix}`;
    suffix += 1;
  }

  const overlayPath = `styles/themes/${id}.css`;
  const overlayFile = path.join(getRepoRoot(), overlayPath);
  await fs.mkdir(path.dirname(overlayFile), { recursive: true });
  await fs.writeFile(overlayFile, `${trimmedCss}\n`, 'utf-8');

  const preset: SiteThemePreset = {
    id,
    name: trimmedName,
    description: '用户导入的自定义主题',
    siteStylesheet: 'styles/main.css',
    themeOverlay: overlayPath,
    preview: {
      sidebar: '#7c8280',
      bg: '#f8f9fa',
      accent: '#4c6ef5',
    },
    imported: true,
  };

  config.site.presets.push(preset);
  const themesFile = path.join(EDITOR_ROOT, 'config', 'themes.json');
  await fs.writeFile(themesFile, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');

  return { theme: preset, updatedConfig: config };
}

export async function getSiteThemesResponse(): Promise<{
  site: ThemeConfig['site'];
  activeSiteThemeId: string;
}> {
  const config = await readThemes();
  const state = await readSiteThemeState();
  return {
    site: config.site,
    activeSiteThemeId: state.themeId,
  };
}
