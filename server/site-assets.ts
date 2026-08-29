import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function editorRoot(): string {
  if (process.env.EDITOR_ROOT) {
    return path.resolve(process.env.EDITOR_ROOT);
  }

  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, '..'), path.resolve(here, '..', '..')];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'config', 'themes.json'))) {
      return dir;
    }
  }
  return path.resolve(here, '..');
}

const BUNDLED_ASSETS: Array<[string, string]> = [
  ['config/site-assets/styles/main.css', 'styles/main.css'],
  ['config/site-assets/media/images/sidebar-bg.jpg', 'media/images/sidebar-bg.jpg'],
  ['config/site-assets/images/avatar.png', 'images/avatar.png'],
];

export function copyBundledSiteAssets(
  repoPath: string,
  options: { overwrite?: boolean } = {},
): string[] {
  const root = editorRoot();
  const copied: string[] = [];

  for (const [fromRel, toRel] of BUNDLED_ASSETS) {
    const from = path.join(root, fromRel);
    const to = path.join(repoPath, toRel);
    if (!fs.existsSync(from)) continue;
    if (!options.overwrite && fs.existsSync(to)) continue;
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    copied.push(toRel);
  }

  return copied;
}
