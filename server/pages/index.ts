import fs from 'node:fs/promises';
import path from 'node:path';
import { EDITOR_ROOT, INDEX_FILE, REPO_ROOT } from '../config.js';
import { renderNavContainer } from '../templates/sidebar.js';
import type { SiteNavItem } from '../templates/sidebar.js';

const NAV_FILE = path.join(EDITOR_ROOT, 'config', 'site-nav.json');

export interface SiteNavConfig {
  items: SiteNavItem[];
}

export type { SiteNavItem };

const DEFAULT_NAV: SiteNavItem[] = [
  { id: 'home', label: '首页', href: '/' },
  { id: 'archives', label: '归档', href: '/archives' },
  { id: 'tags', label: '标签', href: '/tags' },
];

const NAV_BLOCK_RE =
  /(<div class="top-header-container">[\s\S]*?<\/div>\s*)<div>[\s\S]*?class="site-nav"[\s\S]*?<\/div>(\s*<\/div>\s*<div class="bottom-container")/;

async function parseNavFromIndex(): Promise<SiteNavItem[]> {
  try {
    const html = await fs.readFile(INDEX_FILE, 'utf-8');
    const linkRe = /<a href="([^"]*)" class="site-nav">\s*([\s\S]*?)\s*<\/a>/g;
    const items: SiteNavItem[] = [];
    let match: RegExpExecArray | null;
    let index = 0;
    while ((match = linkRe.exec(html)) !== null) {
      const label = match[2].replace(/\s+/g, ' ').trim();
      const href = match[1].trim();
      items.push({
        id: `nav-${index + 1}`,
        label,
        href,
      });
      index += 1;
    }
    return items.length > 0 ? items : DEFAULT_NAV;
  } catch {
    return DEFAULT_NAV;
  }
}

export async function readSiteNav(): Promise<SiteNavItem[]> {
  try {
    const raw = await fs.readFile(NAV_FILE, 'utf-8');
    const config = JSON.parse(raw) as SiteNavConfig;
    if (Array.isArray(config.items) && config.items.length > 0) {
      return config.items;
    }
  } catch {
    // fall through
  }
  return parseNavFromIndex();
}

async function writeSiteNav(items: SiteNavItem[]): Promise<void> {
  const config: SiteNavConfig = { items };
  await fs.writeFile(NAV_FILE, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
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

export async function applySiteNavToRepo(items: SiteNavItem[]): Promise<number> {
  const navContainer = renderNavContainer(items);
  const htmlFiles = await collectHtmlFiles(REPO_ROOT);
  let updated = 0;

  for (const filePath of htmlFiles) {
    const html = await fs.readFile(filePath, 'utf-8');
    if (!html.includes('class="site-nav"')) continue;
    if (!NAV_BLOCK_RE.test(html)) continue;

    const nextHtml = html.replace(
      NAV_BLOCK_RE,
      `$1${navContainer}$2`,
    );
    if (nextHtml !== html) {
      await fs.writeFile(filePath, nextHtml, 'utf-8');
      updated += 1;
    }
  }

  return updated;
}

function generateNavId(existing: Set<string>): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  do {
    id = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (existing.has(id));
  return id;
}

export async function saveSiteNav(items: SiteNavItem[]): Promise<{ items: SiteNavItem[]; updatedFiles: number }> {
  const normalized = items
    .map((item) => ({
      id: item.id.trim(),
      label: item.label.trim(),
      href: item.href.trim(),
    }))
    .filter((item) => item.label && item.href);

  if (normalized.length === 0) {
    throw new Error('至少保留一个导航栏目');
  }

  const ids = new Set<string>();
  for (const item of normalized) {
    if (!item.id) {
      item.id = generateNavId(ids);
    }
    if (ids.has(item.id)) {
      throw new Error(`导航 id 重复: ${item.id}`);
    }
    ids.add(item.id);
  }

  await writeSiteNav(normalized);
  const updatedFiles = await applySiteNavToRepo(normalized);
  return { items: normalized, updatedFiles };
}

export async function listSiteNav(): Promise<SiteNavItem[]> {
  return readSiteNav();
}
