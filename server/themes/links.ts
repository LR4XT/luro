export interface ThemeStyles {
  siteStylesheet: string;
  themeOverlay?: string;
}

const THEME_OVERLAY_LINK_RE =
  /\n<link rel="stylesheet" href="[^"]*\/styles\/themes\/[^"]+\.css(?:\?v=[^"]*)?">/g;

const MAIN_CSS_LINK_RE =
  /<link rel="stylesheet" href="[^"]*\/styles\/main\.css(?:\?v=[^"]*)?">/;

export function buildThemeLinks(preset: ThemeStyles, siteUrl: string): string {
  const base = siteUrl.replace(/\/+$/, '');
  const mainLink = `<link rel="stylesheet" href="${base}/${preset.siteStylesheet}">`;
  if (!preset.themeOverlay) {
    return mainLink;
  }
  return `${mainLink}\n<link rel="stylesheet" href="${base}/${preset.themeOverlay}">`;
}

export function stripThemeOverlay(html: string): string {
  return html.replace(THEME_OVERLAY_LINK_RE, '');
}

export function applyThemeLinksToHtml(html: string, preset: ThemeStyles, siteUrl: string): string {
  const next = stripThemeOverlay(html);
  const links = buildThemeLinks(preset, siteUrl);
  if (MAIN_CSS_LINK_RE.test(next)) {
    return next.replace(MAIN_CSS_LINK_RE, links);
  }
  if (/<\/head>/i.test(next)) {
    return next.replace(/<\/head>/i, `  ${links}\n</head>`);
  }
  return next;
}
