import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ARCHIVES_FILE,
  ATOM_FILE,
  DRAFTS_DIR,
  INDEX_FILE,
  POST_DIR,
  SITE_URL,
} from '../config.js';
import { extractAbstract, markdownToHtml } from '../markdown.js';
import {
  renderArchiveItem,
  renderAtomEntry,
  renderIndexPostItem,
  renderPostPage,
} from '../templates/post.js';
import { titleToSlug, escapeHtml } from '../utils/text.js';
import { addPostToTagPages, ensureTags, removePostFromTagPages, replacePostInTagPages } from '../tags/index.js';
import { getSiteThemePreset } from '../themes/site.js';
import { readSiteNav } from '../pages/index.js';
import { rewriteSiteUrls } from '../utils/assets.js';
import { htmlToMarkdown } from '../html-to-markdown.js';

export interface PublishInput {
  title: string;
  date: string;
  markdown: string;
  tags?: string[];
  featureImage?: string;
  slug?: string;
  keywords?: string;
  push?: boolean;
  commitMessage?: string;
  themeId?: string;
  update?: boolean;
}

export interface PublishResult {
  slug: string;
  postPath: string;
  pushed: boolean;
  commit?: string;
}

export interface PostSummary {
  title: string;
  slug: string;
  date: string;
  featureImage?: string;
}

export interface PostDetail extends PostSummary {
  contentHtml: string;
  markdown: string;
  markdownSource: 'draft' | 'converted' | 'empty';
  tags: string[];
  nextPost?: { slug: string; title: string };
  sourcePath: string;
}

const POST_TITLE_RE = /<h2 class="post-title">([^<]+)<\/h2>/;
const POST_DATE_RE = /<div class="post-date">\s*(\d{4}-\d{2}-\d{2})\s*<\/div>/;
const POST_LINK_RE = /href="https:\/\/lr4xt\.com\/post\/([^"/]+)\/"/;
const FEATURE_IMAGE_RE = /post-images\/([^'"]+)/;

export async function listExistingPosts(): Promise<PostSummary[]> {
  const indexHtml = await fs.readFile(INDEX_FILE, 'utf-8');
  const articles = indexHtml.split('<article class="post-item">').slice(1);
  const posts: PostSummary[] = [];

  for (const block of articles) {
    const titleMatch = block.match(POST_TITLE_RE);
    const dateMatch = block.match(/<div class="post-date">\s*([\d-]+)/);
    const linkMatch = block.match(POST_LINK_RE);
    const featureMatch = block.match(FEATURE_IMAGE_RE);

    if (titleMatch && dateMatch && linkMatch) {
      posts.push({
        title: titleMatch[1].trim(),
        slug: linkMatch[1],
        date: dateMatch[1],
        featureImage: featureMatch?.[1],
      });
    }
  }

  return posts;
}

export async function publishPost(input: PublishInput): Promise<PublishResult> {
  const slug = input.slug?.trim() || titleToSlug(input.title);
  if (!slug) {
    throw new Error('无法从标题生成 slug，请手动填写 slug');
  }

  const existingPosts = await listExistingPosts();
  const exists = existingPosts.some((p) => p.slug === slug);

  if (exists && !input.update) {
    throw new Error(`文章 slug "${slug}" 已存在，请修改标题或 slug`);
  }
  if (!exists && input.update) {
    throw new Error(`文章 "${slug}" 不存在，无法更新`);
  }

  const contentHtml = markdownToHtml(input.markdown);
  const description = extractAbstract(contentHtml);
  const keywords = input.keywords ?? (input.tags ?? []).join(', ');
  const tagNames = input.tags ?? [];
  const resolvedTags = await ensureTags(tagNames);
  const theme = await getSiteThemePreset(input.themeId);
  const navItems = await readSiteNav();

  let nextPost: { slug: string; title: string } | undefined;
  if (exists) {
    const currentHtml = await fs.readFile(path.join(POST_DIR, slug, 'index.html'), 'utf-8');
    const nextMatch = currentHtml.match(
      /<div class="next-post">[\s\S]*?href="https:\/\/lr4xt\.com\/post\/([^"/]+)\/"[\s\S]*?<h3 class="post-title">\s*([\s\S]*?)\s*<\/h3>/,
    );
    nextPost = nextMatch
      ? { slug: nextMatch[1], title: nextMatch[2].replace(/\s+/g, ' ').trim() }
      : undefined;
  } else {
    const previousPost = existingPosts[0];
    nextPost = previousPost
      ? { slug: previousPost.slug, title: previousPost.title }
      : undefined;
  }

  const postMeta = {
    title: input.title,
    slug,
    date: input.date,
    keywords,
    description,
    contentHtml,
    featureImage: input.featureImage,
    tags: resolvedTags,
    nextPost,
    siteStylesheet: theme.siteStylesheet,
    themeOverlay: theme.themeOverlay,
    navItems,
  };

  const postDir = path.join(POST_DIR, slug);
  await fs.mkdir(postDir, { recursive: true });
  const postPath = path.join(postDir, 'index.html');
  await fs.writeFile(postPath, renderPostPage(postMeta), 'utf-8');

  await fs.mkdir(DRAFTS_DIR, { recursive: true });
  await fs.writeFile(
    path.join(DRAFTS_DIR, `${slug}.md`),
    buildDraftFile(input, slug),
    'utf-8',
  );

  const listItem = {
    title: input.title,
    slug,
    date: input.date,
    abstract: description,
    featureImage: input.featureImage,
  };

  if (exists) {
    await replaceIndexPost(slug, listItem);
    await replaceAtomEntry(slug, {
      title: input.title,
      slug,
      date: input.date,
      contentHtml,
    });
    await replaceArchivePost(slug, { title: input.title, slug, date: input.date });
    await replacePostInTagPages(listItem, tagNames);
  } else {
    await updateIndex(listItem);
    await updateAtom({
      title: input.title,
      slug,
      date: input.date,
      contentHtml,
    });
    await updateArchives({
      title: input.title,
      slug,
      date: input.date,
    });
    await addPostToTagPages(listItem, tagNames);
  }

  let pushed = false;
  let commit: string | undefined;

  if (input.push) {
    const { commitAndPush } = await import('../utils/git.js');
    const result = await commitAndPush(
      input.commitMessage ??
        (exists ? `blog: 更新文章《${input.title}》` : `blog: 发布文章《${input.title}》`),
    );
    pushed = result.pushed;
    commit = result.commit;
  }

  return { slug, postPath, pushed, commit };
}

function buildDraftFile(input: PublishInput, slug: string): string {
  const tags = (input.tags ?? []).join(', ');
  return `---
title: ${input.title}
slug: ${slug}
date: ${input.date}
tags: ${tags}
featureImage: ${input.featureImage ?? ''}
---

${input.markdown}
`;
}

async function updateIndex(post: {
  title: string;
  slug: string;
  date: string;
  abstract: string;
  featureImage?: string;
}): Promise<void> {
  const html = await fs.readFile(INDEX_FILE, 'utf-8');
  const marker = '<div class="content-container" data-aos="fade-up">';
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error('无法在 index.html 中找到内容容器');
  }

  const insertAt = markerIndex + marker.length;
  const newArticle = renderIndexPostItem(post);
  const updated = `${html.slice(0, insertAt)}\n          ${newArticle.trim()}\n          ${html.slice(insertAt)}`;
  await fs.writeFile(INDEX_FILE, updated, 'utf-8');
}

async function updateAtom(post: {
  title: string;
  slug: string;
  date: string;
  contentHtml: string;
}): Promise<void> {
  let xml = await fs.readFile(ATOM_FILE, 'utf-8');
  const updatedTime = new Date().toISOString();
  xml = xml.replace(/<updated>[^<]+<\/updated>/, `<updated>${updatedTime}</updated>`);

  const rightsEnd = xml.indexOf('</rights>');
  if (rightsEnd === -1) {
    throw new Error('无法在 atom.xml 中找到插入点');
  }

  const insertAt = rightsEnd + '</rights>'.length;
  const entry = `\n${renderAtomEntry(post)}`;
  xml = `${xml.slice(0, insertAt)}${entry}${xml.slice(insertAt)}`;
  await fs.writeFile(ATOM_FILE, xml, 'utf-8');
}

async function updateArchives(post: {
  title: string;
  slug: string;
  date: string;
}): Promise<void> {
  const html = await fs.readFile(ARCHIVES_FILE, 'utf-8');
  const year = post.date.slice(0, 4);
  const yearHeading = `<h2 class="year" data-aos="fade-in" data-aos-delay="500">${year}</h2>`;
  const yearIndex = html.indexOf(yearHeading);

  const articleHtml = renderArchiveItem(post).trim();

  if (yearIndex !== -1) {
    const insertAt = yearIndex + yearHeading.length;
    const updated = `${html.slice(0, insertAt)}\n              ${articleHtml}\n              ${html.slice(insertAt)}`;
    await fs.writeFile(ARCHIVES_FILE, updated, 'utf-8');
    return;
  }

  const containerMarker = '<div class="archives-container">';
  const containerIndex = html.indexOf(containerMarker);
  if (containerIndex === -1) {
    throw new Error('无法在 archives/index.html 中找到归档容器');
  }

  const insertAt = containerIndex + containerMarker.length;
  const block = `
            
              ${yearHeading}
              ${articleHtml}
            `;
  const updated = `${html.slice(0, insertAt)}${block}${html.slice(insertAt)}`;
  await fs.writeFile(ARCHIVES_FILE, updated, 'utf-8');
}

function parseDraftFile(raw: string): {
  title: string;
  slug: string;
  date: string;
  tags: string[];
  featureImage: string;
  markdown: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n\r?([\s\S]*)$/);
  if (!match) {
    return {
      title: '',
      slug: '',
      date: '',
      tags: [],
      featureImage: '',
      markdown: raw.trim(),
    };
  }

  const frontmatter = match[1];
  const markdown = match[2].replace(/^\n/, '');
  const readField = (key: string) => {
    const fieldMatch = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
    return fieldMatch?.[1]?.trim() ?? '';
  };
  const tagsRaw = readField('tags');
  const tags = tagsRaw
    ? tagsRaw.split(',').map((tag) => tag.trim()).filter(Boolean)
    : [];

  return {
    title: readField('title'),
    slug: readField('slug'),
    date: readField('date'),
    tags,
    featureImage: readField('featureImage'),
    markdown,
  };
}

async function readPostDraft(slug: string): Promise<string> {
  const draftPath = path.join(DRAFTS_DIR, `${slug}.md`);
  try {
    const raw = await fs.readFile(draftPath, 'utf-8');
    return parseDraftFile(raw).markdown;
  } catch {
    return '';
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function saveDraftFromMeta(
  meta: {
    title: string;
    date: string;
    tags: string[];
    featureImage?: string;
    markdown: string;
  },
  slug: string,
): Promise<void> {
  await fs.mkdir(DRAFTS_DIR, { recursive: true });
  await fs.writeFile(
    path.join(DRAFTS_DIR, `${slug}.md`),
    buildDraftFile(
      {
        title: meta.title,
        date: meta.date,
        markdown: meta.markdown,
        tags: meta.tags,
        featureImage: meta.featureImage,
      },
      slug,
    ),
    'utf-8',
  );
}

async function resolvePostMarkdown(
  slug: string,
  contentHtml: string,
  meta: {
    title: string;
    date: string;
    tags: string[];
    featureImage?: string;
  },
): Promise<{ markdown: string; markdownSource: PostDetail['markdownSource'] }> {
  const draft = await readPostDraft(slug);
  if (draft.trim()) {
    return { markdown: draft, markdownSource: 'draft' };
  }

  const markdown = htmlToMarkdown(contentHtml);
  if (markdown.trim()) {
    await saveDraftFromMeta({ ...meta, markdown }, slug);
    return { markdown, markdownSource: 'converted' };
  }

  return { markdown: '', markdownSource: 'empty' };
}

async function replaceIndexPost(
  slug: string,
  post: {
    title: string;
    slug: string;
    date: string;
    abstract: string;
    featureImage?: string;
  },
): Promise<void> {
  const html = await fs.readFile(INDEX_FILE, 'utf-8');
  const articleRe = new RegExp(
    `<article class="post-item">[\\s\\S]*?/post/${escapeRegex(slug)}/[\\s\\S]*?</article>`,
    'i',
  );
  const newArticle = renderIndexPostItem(post).trim();
  if (!articleRe.test(html)) {
    await updateIndex(post);
    return;
  }
  await fs.writeFile(INDEX_FILE, html.replace(articleRe, newArticle), 'utf-8');
}

async function replaceAtomEntry(
  slug: string,
  post: {
    title: string;
    slug: string;
    date: string;
    contentHtml: string;
  },
): Promise<void> {
  let xml = await fs.readFile(ATOM_FILE, 'utf-8');
  const entryRe = new RegExp(
    `<entry>[\\s\\S]*?/post/${escapeRegex(slug)}/[\\s\\S]*?</entry>`,
    'i',
  );
  const newEntry = renderAtomEntry(post).trim();
  if (entryRe.test(xml)) {
    xml = xml.replace(entryRe, newEntry);
  } else {
    const rightsEnd = xml.indexOf('</rights>');
    if (rightsEnd === -1) throw new Error('无法在 atom.xml 中找到插入点');
    const insertAt = rightsEnd + '</rights>'.length;
    xml = `${xml.slice(0, insertAt)}\n${newEntry}${xml.slice(insertAt)}`;
  }
  xml = xml.replace(/<updated>[^<]+<\/updated>/, `<updated>${new Date().toISOString()}</updated>`);
  await fs.writeFile(ATOM_FILE, xml, 'utf-8');
}

async function replaceArchivePost(
  slug: string,
  post: { title: string; slug: string; date: string },
): Promise<void> {
  const html = await fs.readFile(ARCHIVES_FILE, 'utf-8');
  const articleRe = new RegExp(
    `<article class="post">[\\s\\S]*?/post/${escapeRegex(slug)}/[\\s\\S]*?</article>`,
    'i',
  );
  const newArticle = renderArchiveItem({ title: post.title, slug: post.slug }).trim();
  if (articleRe.test(html)) {
    await fs.writeFile(ARCHIVES_FILE, html.replace(articleRe, newArticle), 'utf-8');
  }
}

export async function getPostDetail(slug: string): Promise<PostDetail> {
  const postPath = path.join(POST_DIR, slug, 'index.html');
  const html = await fs.readFile(postPath, 'utf-8');

  const titleMatch = html.match(/<h2 class="post-title">([^<]+)<\/h2>/);
  const dateMatch = html.match(POST_DATE_RE);
  const contentMatch = html.match(/<div class="post-content" v-pre>\s*([\s\S]*?)\s*<\/div>/);
  const featureMatch = html.match(
    /feature-container[^>]*style="background-image: url\('([^']+)'\)"/,
  );
  const tagMatches = [...html.matchAll(/<div class="tag-container">[\s\S]*?<\/div>/g)];
  const tags: string[] = [];
  if (tagMatches.length > 0) {
    const tagBlock = tagMatches[0][0];
    for (const m of tagBlock.matchAll(/class="tag">\s*([^<]+?)\s*<\/a>/g)) {
      tags.push(m[1].trim());
    }
  }
  const nextMatch = html.match(
    /<div class="next-post">[\s\S]*?href="https:\/\/lr4xt\.com\/post\/([^"/]+)\/"[\s\S]*?<h3 class="post-title">\s*([\s\S]*?)\s*<\/h3>/,
  );

  if (!titleMatch || !dateMatch) {
    throw new Error(`无法解析文章: ${slug}`);
  }

  let featureImage: string | undefined;
  if (featureMatch) {
    const url = featureMatch[1];
    featureImage = url.replace(/.*\/post-images\//, '');
  }

  const contentHtml = rewriteSiteUrls(contentMatch?.[1]?.trim() ?? '');
  const title = titleMatch[1].trim();
  const date = dateMatch[1];
  const { markdown, markdownSource } = await resolvePostMarkdown(slug, contentHtml, {
    title,
    date,
    tags,
    featureImage,
  });

  return {
    title,
    slug,
    date,
    featureImage,
    contentHtml,
    markdown,
    markdownSource,
    tags,
    nextPost: nextMatch
      ? { slug: nextMatch[1], title: nextMatch[2].replace(/\s+/g, ' ').trim() }
      : undefined,
    sourcePath: postPath,
  };
}

export async function readPostContent(slug: string): Promise<{ html: string; meta: PostSummary | null }> {
  const detail = await getPostDetail(slug);
  return {
    html: detail.contentHtml,
    meta: { title: detail.title, slug: detail.slug, date: detail.date, featureImage: detail.featureImage },
  };
}

export interface DeletePostsResult {
  deleted: string[];
}

async function removeIndexPost(slug: string): Promise<void> {
  const html = await fs.readFile(INDEX_FILE, 'utf-8');
  const articleRe = new RegExp(
    `<article class="post-item">[\\s\\S]*?/post/${escapeRegex(slug)}/[\\s\\S]*?</article>\\s*`,
    'i',
  );
  if (!articleRe.test(html)) return;
  await fs.writeFile(INDEX_FILE, html.replace(articleRe, ''), 'utf-8');
}

async function removeAtomEntry(slug: string): Promise<void> {
  let xml = await fs.readFile(ATOM_FILE, 'utf-8');
  const entryRe = new RegExp(
    `<entry>[\\s\\S]*?/post/${escapeRegex(slug)}/[\\s\\S]*?</entry>\\s*`,
    'i',
  );
  if (!entryRe.test(xml)) return;
  xml = xml.replace(entryRe, '');
  xml = xml.replace(/<updated>[^<]+<\/updated>/, `<updated>${new Date().toISOString()}</updated>`);
  await fs.writeFile(ATOM_FILE, xml, 'utf-8');
}

async function removeArchivePost(slug: string): Promise<void> {
  const html = await fs.readFile(ARCHIVES_FILE, 'utf-8');
  const articleRe = new RegExp(
    `<article class="post">[\\s\\S]*?/post/${escapeRegex(slug)}/[\\s\\S]*?</article>\\s*`,
    'i',
  );
  if (!articleRe.test(html)) return;
  await fs.writeFile(ARCHIVES_FILE, html.replace(articleRe, ''), 'utf-8');
}

function renderNextPostBlock(nextPost?: { slug: string; title: string }): string {
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

async function fixNextPostLinks(
  deletedSlug: string,
  replacement?: { slug: string; title: string },
): Promise<void> {
  const posts = await listExistingPosts();
  const nextPostRe = new RegExp(
    `<div class="next-post">[\\s\\S]*?/post/${escapeRegex(deletedSlug)}/[\\s\\S]*?</a>\\s*</div>`,
    'i',
  );

  for (const post of posts) {
    if (post.slug === deletedSlug) continue;
    const postPath = path.join(POST_DIR, post.slug, 'index.html');
    let html: string;
    try {
      html = await fs.readFile(postPath, 'utf-8');
    } catch {
      continue;
    }
    if (!nextPostRe.test(html)) continue;
    const updated = html.replace(nextPostRe, renderNextPostBlock(replacement));
    await fs.writeFile(postPath, updated, 'utf-8');
  }
}

async function deleteSinglePost(
  slug: string,
  nextPost?: { slug: string; title: string },
): Promise<void> {
  await fixNextPostLinks(slug, nextPost);
  await removeIndexPost(slug);
  await removeAtomEntry(slug);
  await removeArchivePost(slug);
  await removePostFromTagPages(slug);

  const postDir = path.join(POST_DIR, slug);
  await fs.rm(postDir, { recursive: true, force: true });

  const draftPath = path.join(DRAFTS_DIR, `${slug}.md`);
  await fs.rm(draftPath, { force: true });
}

export async function deletePosts(slugs: string[]): Promise<DeletePostsResult> {
  const unique = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  if (unique.length === 0) {
    throw new Error('请选择要删除的文章');
  }

  const existing = await listExistingPosts();
  const existingSlugs = new Set(existing.map((post) => post.slug));
  const deleted: string[] = [];

  for (const slug of unique) {
    if (!existingSlugs.has(slug)) continue;

    let nextPost: { slug: string; title: string } | undefined;
    try {
      const detail = await getPostDetail(slug);
      nextPost = detail.nextPost;
    } catch {
      // continue deleting even if detail parse fails
    }

    await deleteSinglePost(slug, nextPost);
    deleted.push(slug);
    existingSlugs.delete(slug);
  }

  if (deleted.length === 0) {
    throw new Error('未找到可删除的文章');
  }

  return { deleted };
}
