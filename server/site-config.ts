import fs from 'node:fs/promises';
import path from 'node:path';
import { USER_DATA_ROOT } from './config.js';

const SITE_FILE = path.join(USER_DATA_ROOT, '.credentials', 'site.json');

export interface SiteConfig {
  repoPath: string;
}

export async function readSiteConfig(): Promise<SiteConfig | null> {
  try {
    const raw = await fs.readFile(SITE_FILE, 'utf-8');
    return JSON.parse(raw) as SiteConfig;
  } catch {
    return null;
  }
}

export async function writeSiteConfig(config: SiteConfig): Promise<void> {
  await fs.mkdir(path.dirname(SITE_FILE), { recursive: true, mode: 0o700 });
  await fs.writeFile(SITE_FILE, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

export function getSiteConfigPath(): string {
  return SITE_FILE;
}
