import fs from 'node:fs/promises';
import path from 'node:path';

export const PLACEHOLDER_SITE_URL = 'https://example.com';

export function githubPagesUrlFromRepo(repoUrl: string): string | null {
  const match = repoUrl.trim().match(/github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?\/?$/i);
  if (!match) return null;

  const user = match[1];
  const repo = match[2].replace(/\.git$/i, '');
  if (repo.toLowerCase() === `${user.toLowerCase()}.github.io`) {
    return `https://${user}.github.io`;
  }
  return `https://${user}.github.io/${repo}`;
}

export function isPlaceholderSiteUrl(url: string): boolean {
  return url.replace(/\/+$/, '') === PLACEHOLDER_SITE_URL;
}

export function rewriteSiteUrl(content: string, fromUrl: string, toUrl: string): string {
  const from = fromUrl.replace(/\/+$/, '');
  const to = toUrl.replace(/\/+$/, '');
  if (!from || from === to) return content;
  return content.split(from).join(to);
}

async function collectRewritableFiles(dir: string, files: string[] = []): Promise<string[]> {
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
      await collectRewritableFiles(fullPath, files);
    } else if (entry.name.endsWith('.html') || entry.name.endsWith('.xml')) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function rewriteSiteUrlInRepo(
  repoRoot: string,
  fromUrl: string,
  toUrl: string,
): Promise<number> {
  const from = fromUrl.replace(/\/+$/, '');
  const to = toUrl.replace(/\/+$/, '');
  if (!from || !to || from === to) return 0;

  const files = await collectRewritableFiles(repoRoot);
  let updated = 0;
  for (const filePath of files) {
    const raw = await fs.readFile(filePath, 'utf-8');
    const next = rewriteSiteUrl(raw, from, to);
    if (next !== raw) {
      await fs.writeFile(filePath, next, 'utf-8');
      updated += 1;
    }
  }
  return updated;
}
