import { SITE_URL } from '../config.js';
import { renderPageShell } from './page.js';
import type { SiteNavItem } from './sidebar.js';
import { escapeHtml } from '../utils/text.js';
import type { ThemeStyles } from '../themes/links.js';

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
  theme: ThemeStyles,
): string {
  const body = `
          <h2 class="current-tag">标签: ${escapeHtml(tagName)}</h2>
          ${posts.map((post) => renderTagPostItem(post)).join('\n')}
        `;
  return renderPageShell(tagName, body, navItems, theme);
}

export function renderTagsIndexPage(
  tagLinks: string,
  navItems: SiteNavItem[],
  theme: ThemeStyles,
): string {
  const body = `
          <h2 class="tag-list-title">标签列表</h2>
          <div class="tags-container">${tagLinks}
          </div>
        `;
  return renderPageShell('标签列表', body, navItems, theme);
}
