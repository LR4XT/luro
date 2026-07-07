import {
  CACHE_VERSION,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from '../config.js';
import { escapeAttr, escapeHtml } from '../utils/text.js';

export interface SiteNavItem {
  id: string;
  label: string;
  href: string;
}

export function renderNavContainer(items: SiteNavItem[]): string {
  const links = items
    .map(
      (item) => `
        
          <a href="${escapeAttr(item.href)}" class="site-nav">
            ${escapeHtml(item.label)}
          </a>
        `,
    )
    .join('\n      \n');

  return `    <div>\n      ${links}\n      \n    </div>`;
}

export function renderSidebarHtml(items: SiteNavItem[]): string {
  return `<div class="sidebar" :class="{ 'full-height': menuVisible }">
  <div class="top-container" data-aos="fade-right">
    <div class="top-header-container">
      <a class="site-title-container" href="${SITE_URL}">
        <img src="${SITE_URL}/images/avatar.png?v=${CACHE_VERSION}" class="site-logo">
        <h1 class="site-title">${SITE_TITLE}</h1>
      </a>
      <div class="menu-btn" @click="menuVisible = !menuVisible">
        <div class="line"></div>
      </div>
    </div>
${renderNavContainer(items)}
  </div>
  <div class="bottom-container" data-aos="flip-up" data-aos-offset="0">
    <div class="social-container">
      
        
      
        
      
        
      
        
      
        
      
    </div>
    <div class="site-description">
      ${SITE_DESCRIPTION}

    </div>
    <div class="site-footer">
       | <a class="rss" href="${SITE_URL}/atom.xml" target="_blank">RSS</a>
    </div>
  </div>
</div>`;
}
