import { SITE_URL } from '../config.js';
import { buildThemeLinks, type ThemeStyles } from '../themes/links.js';

export function renderStylesheetLinks(preset: ThemeStyles): string {
  return buildThemeLinks(preset, SITE_URL);
}
