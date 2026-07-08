import {
  CACHE_VERSION,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from '../config.js';
import { renderSidebarHtml, type SiteNavItem } from './sidebar.js';
import { renderStylesheetLinks } from './stylesheets.js';
import { escapeHtml } from '../utils/text.js';

function pageShell(
  title: string,
  body: string,
  navItems: SiteNavItem[],
  theme: { siteStylesheet: string; themeOverlay?: string },
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

export function renderTagIndexLink(name: string, id: string): string {
  return `<a class="tag" href="${SITE_URL}/tag/${id}/">${escapeHtml(name)}</a>`;
}

export function renderTagPostItem(post: {
  title: string;
  slug: string;
  date: string;
  abstract: string;
  featureImage?: string;
}): string {
  const feature = post.featureImage
    ? `
                <a class="right" href="${SITE_URL}/post/${post.slug}/">
                  <div class="feature-container" style="background-image: url('${SITE_URL}/post-images/${post.featureImage}')">
                  </div>
                </a>`
    : '';

  return `
            <article class="post-item">
              <div class="left">
                <a href="${SITE_URL}/post/${post.slug}/">
                  <h2 class="post-title">${escapeHtml(post.title)}</h2>
                </a>
                <div class="post-date">
                  ${post.date}
                </div>
                <div class="post-abstract">
                  ${escapeHtml(post.abstract)}
                </div>
              </div>
              ${feature}
            </article>`;
}

export function renderTagPage(
  tagName: string,
  tagId: string,
  posts: {
    title: string;
    slug: string;
    date: string;
    abstract: string;
    featureImage?: string;
  }[],
  navItems: SiteNavItem[],
  theme: { siteStylesheet: string; themeOverlay?: string },
): string {
  const body = `
          <h2 class="current-tag">标签: ${escapeHtml(tagName)}</h2>
          ${posts.map((post) => renderTagPostItem(post)).join('\n')}
        `;
  return pageShell(tagName, body, navItems, theme);
}

export function renderTagsIndexPage(
  tagLinks: string,
  navItems: SiteNavItem[],
  theme: { siteStylesheet: string; themeOverlay?: string },
): string {
  const body = `
          <h2 class="tag-list-title">标签列表</h2>
          <div class="tag-list">${tagLinks}
          </div>
        `;
  return pageShell('标签列表', body, navItems, theme);
}
