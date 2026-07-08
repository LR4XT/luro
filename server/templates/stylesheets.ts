import { SITE_URL } from '../config.js';
import type { SiteThemePreset } from '../themes/index.js';

export function renderStylesheetLinks(
  preset: Pick<SiteThemePreset, 'siteStylesheet' | 'themeOverlay'>,
): string {
  const mainLink = `<link rel="stylesheet" href="${SITE_URL}/${preset.siteStylesheet}">`;
  if (!preset.themeOverlay) {
    return mainLink;
  }
  return `${mainLink}\n<link rel="stylesheet" href="${SITE_URL}/${preset.themeOverlay}">`;
}
