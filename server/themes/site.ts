import fs from 'node:fs/promises';
import path from 'node:path';
import { EDITOR_ROOT, getRepoRoot, SITE_URL } from '../config.js';
import { readThemes, type SiteThemePreset, type ThemeConfig } from './index.js';

function siteThemeStateFile(): string {
  return path.join(getRepoRoot(), 'config', 'site-theme.json');
}

export interface SiteThemeState {
  themeId: string;
}

const THEME_OVERLAY_LINK_RE =
  /\n<link rel="stylesheet" href="[^"]*\/styles\/themes\/[^"]+\.css(?:\?v=[^"]*)?">/g;

const MAIN_CSS_LINK_RE =
  /(<link rel="stylesheet" href=")([^"]*\/styles\/main\.css(?:\?v=[^"]*)?)(">)/;

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

export function buildThemeLinks(preset: SiteThemePreset): string {
  const mainLink = `<link rel="stylesheet" href="${SITE_URL}/${preset.siteStylesheet}">`;
  if (!preset.themeOverlay) {
    return mainLink;
  }
  return `${mainLink}\n<link rel="stylesheet" href="${SITE_URL}/${preset.themeOverlay}">`;
}

function stripThemeOverlay(html: string): string {
  return html.replace(THEME_OVERLAY_LINK_RE, '');
}

function applyThemeLinksToHtml(html: string, preset: SiteThemePreset): string {
  let next = stripThemeOverlay(html);
  const links = buildThemeLinks(preset);
  if (MAIN_CSS_LINK_RE.test(next)) {
    next = next.replace(MAIN_CSS_LINK_RE, links);
    return next;
  }
  return next;
}

export async function readSiteThemeState(): Promise<SiteThemeState> {
  try {
    const raw = await fs.readFile(siteThemeStateFile(), 'utf-8');
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

async function writeSiteThemeState(themeId: string): Promise<void> {
  const file = siteThemeStateFile();
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

async function syncThemeOverlayFile(preset: SiteThemePreset): Promise<void> {
  if (!preset.themeOverlay) return;

  const repoRoot = getRepoRoot();
  const dest = path.join(repoRoot, preset.themeOverlay);
  await fs.mkdir(path.dirname(dest), { recursive: true });

  const alreadyInRepo = path.resolve(dest);
  try {
    await fs.access(alreadyInRepo);
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
    if (!(preset.imported)) {
      throw new Error(`主题样式文件缺失: ${path.basename(preset.themeOverlay)}`);
    }
  }
}

export async function applySiteThemeToRepo(themeId: string): Promise<{ updatedFiles: number; theme: SiteThemePreset }> {
  const config = await readThemes();
  const preset = config.site.presets.find((theme) => theme.id === themeId);
  if (!preset) {
    throw new Error(`未找到网站主题: ${themeId}`);
  }

  await syncThemeOverlayFile(preset);

  const htmlFiles = await collectHtmlFiles(getRepoRoot());
  let updated = 0;

  for (const filePath of htmlFiles) {
    const html = await fs.readFile(filePath, 'utf-8');
    if (!html.includes('styles/main.css')) continue;
    const nextHtml = applyThemeLinksToHtml(html, preset);
    if (nextHtml !== html) {
      await fs.writeFile(filePath, nextHtml, 'utf-8');
      updated += 1;
    }
  }

  await writeSiteThemeState(themeId);
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
