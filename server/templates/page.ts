import {
  CACHE_VERSION,
  SITE_TITLE,
  SITE_URL,
} from '../config.js';
import { renderSidebarHtml, type SiteNavItem } from './sidebar.js';
import { renderStylesheetLinks } from './stylesheets.js';
import { escapeHtml } from '../utils/text.js';
import type { ThemeStyles } from '../themes/links.js';

export function renderPageShell(
  title: string,
  body: string,
  navItems: SiteNavItem[],
  theme: ThemeStyles,
): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" >
<title>${escapeHtml(title)} | ${SITE_TITLE}</title>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.7.2/css/all.css" integrity="sha384-fnmOCqbTlWIlj8LyTjo7mOUStjsKC4pOpQbqyi7RrhN7udi9RwhKkMHpvLbHG9Sr" crossorigin="anonymous">
<link rel="shortcut icon" href="${SITE_URL}/favicon.ico?v=${CACHE_VERSION}">
${renderStylesheetLinks(theme)}
<link rel="stylesheet" href="https://unpkg.com/aos@next/dist/aos.css" />
<script src="https://cdn.jsdelivr.net/npm/vue/dist/vue.js"></script>
  </head>
  <body>
    <div id="app" class="main">
      ${renderSidebarHtml(navItems)}
      <div class="main-container">
        <div class="content-container" data-aos="fade-up">
          ${body}
        </div>
      </div>
    </div>
    <script src="https://unpkg.com/aos@next/dist/aos.js"></script>
<script type="application/javascript">
AOS.init();
var app = new Vue({ el: '#app', data: { menuVisible: false } });
</script>
  </body>
</html>`;
}
