import {
  CACHE_VERSION,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from '../config.js';
import { renderSidebarHtml, type SiteNavItem } from './sidebar.js';
import { escapeAttr, escapeHtml } from '../utils/text.js';

export interface PostMeta {
  title: string;
  slug: string;
  date: string;
  keywords: string;
  description: string;
  contentHtml: string;
  featureImage?: string;
  tags: { name: string; id: string }[];
  nextPost?: { slug: string; title: string };
  siteStylesheet?: string;
  navItems: SiteNavItem[];
}

function featureBlock(featureImage?: string): string {
  if (!featureImage) return '';
  const url = featureImage.startsWith('http')
    ? featureImage
    : `${SITE_URL}/post-images/${featureImage}`;
  return `
              <div class="feature-container" style="background-image: url('${url}')">
              </div>
            `;
}

function tagsBlock(tags: { name: string; id: string }[]): string {
  if (tags.length === 0) return '';

  const links = tags
    .map(
      (tag) => `
                  <a href="${SITE_URL}/tag/${tag.id}/" class="tag">
                    ${escapeHtml(tag.name)}
                  </a>`,
    )
    .join('\n                ');
  return `
              <div class="tag-container">${links}
              </div>
            `;
}

function nextPostBlock(nextPost?: { slug: string; title: string }): string {
  if (!nextPost) return '';
  return `
              <div class="next-post">
                <div class="next">下一篇</div>
                <a href="${SITE_URL}/post/${nextPost.slug}/">
                  <h3 class="post-title">
                    ${escapeHtml(nextPost.title)}
                  </h3>
                </a>
              </div>
            `;
}

export function renderPostPage(meta: PostMeta): string {
  const stylesheet = meta.siteStylesheet ?? 'styles/main.css';
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" >

<title>${escapeHtml(meta.title)} | ${SITE_TITLE}</title>

<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">

<link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.7.2/css/all.css" integrity="sha384-fnmOCqbTlWIlj8LyTjo7mOUStjsKC4pOpQbqyi7RrhN7udi9RwhKkMHpvLbHG9Sr" crossorigin="anonymous">
<link rel="shortcut icon" href="${SITE_URL}/favicon.ico?v=${CACHE_VERSION}">
<link rel="stylesheet" href="${SITE_URL}/${stylesheet}">



<link rel="stylesheet" href="https://unpkg.com/aos@next/dist/aos.css" />
<script src="https://cdn.jsdelivr.net/npm/vue/dist/vue.js"></script>



    <meta name="description" content="${escapeAttr(meta.description)}" />
    <meta name="keywords" content="${escapeAttr(meta.keywords)}" />
  </head>
  <body>
    <div id="app" class="main">

      ${renderSidebarHtml(meta.navItems)}


      <div class="main-container">
        <div class="content-container" data-aos="fade-up">
          <div class="post-detail">
            <h2 class="post-title">${escapeHtml(meta.title)}</h2>
            <div class="post-date">${meta.date}</div>
            ${featureBlock(meta.featureImage)}
            <div class="post-content" v-pre>
              ${meta.contentHtml}

            </div>
            ${tagsBlock(meta.tags)}
            ${nextPostBlock(meta.nextPost)}

            

          </div>

        </div>
      </div>
    </div>

    <script src="https://unpkg.com/aos@next/dist/aos.js"></script>
<script type="application/javascript">

AOS.init();

var app = new Vue({
  el: '#app',
  data: {
    menuVisible: false,
  },
})

</script>





  </body>
</html>
`;
}

export function renderIndexPostItem(post: {
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
                </a>
              `
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

export function renderAtomEntry(post: {
  title: string;
  slug: string;
  date: string;
  contentHtml: string;
}): string {
  const isoDate = `${post.date}T12:00:00.000Z`;
  return `    <entry>
        <title type="html"><![CDATA[${post.title}]]></title>
        <id>${SITE_URL}/post/${post.slug}/</id>
        <link href="${SITE_URL}/post/${post.slug}/">
        </link>
        <updated>${isoDate}</updated>
        <content type="html"><![CDATA[${post.contentHtml}
]]></content>
    </entry>`;
}

export function renderArchiveItem(post: { title: string; slug: string }): string {
  return `
                  <article class="post">
                    <a href="${SITE_URL}/post/${post.slug}/">
                      <h2 class="post-title">
                        ${escapeHtml(post.title)}
                      </h2>
                    </a>
                  </article>`;
}
