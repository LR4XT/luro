import fs from 'node:fs/promises';
import path from 'node:path';
import { EDITOR_ROOT, POST_DIR, REPO_ROOT } from '../config.js';
import { readSiteNav } from '../pages/index.js';
import { getSiteThemePreset } from '../themes/site.js';
import { renderTagIndexLink, renderTagPage, renderTagPostItem } from '../templates/tag.js';

const TAGS_FILE = path.join(EDITOR_ROOT, 'config', 'tags.json');
const TAGS_INDEX = path.join(REPO_ROOT, 'tags', 'index.html');
const TAG_DIR = path.join(REPO_ROOT, 'tag');

export interface TagInfo {
  name: string;
  id: string;
  postCount: number;
}

export async function readTagMap(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(TAGS_FILE, 'utf-8');
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeTagMap(map: Record<string, string>): Promise<void> {
  await fs.writeFile(TAGS_FILE, `${JSON.stringify(map, null, 2)}\n`, 'utf-8');
}

function generateTagId(existing: Set<string>): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  do {
    id = Array.from({ length: 9 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (existing.has(id));
  return id;
}

async function countPostsForTag(tagId: string): Promise<number> {
  let count = 0;
  let entries: string[];
  try {
    entries = await fs.readdir(POST_DIR);
  } catch {
    return 0;
  }

  for (const slug of entries) {
    const postPath = path.join(POST_DIR, slug, 'index.html');
    try {
      const html = await fs.readFile(postPath, 'utf-8');
      if (html.includes(`/tag/${tagId}/`)) count += 1;
    } catch {
      // skip
    }
  }
  return count;
}

export async function listTags(): Promise<TagInfo[]> {
  const map = await readTagMap();
  const tags: TagInfo[] = [];
  for (const [name, id] of Object.entries(map)) {
    tags.push({ name, id, postCount: await countPostsForTag(id) });
  }
  return tags.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

export async function createTag(name: string): Promise<TagInfo> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('标签名不能为空');

  const map = await readTagMap();
  if (map[trimmed]) {
    return { name: trimmed, id: map[trimmed], postCount: await countPostsForTag(map[trimmed]) };
  }

  const id = generateTagId(new Set(Object.values(map)));
  map[trimmed] = id;
  await writeTagMap(map);

  await fs.mkdir(path.join(TAG_DIR, id), { recursive: true });
  const navItems = await readSiteNav();
  const theme = await getSiteThemePreset();
  await fs.writeFile(
    path.join(TAG_DIR, id, 'index.html'),
    renderTagPage(trimmed, id, [], navItems, theme),
    'utf-8',
  );
  await appendTagToIndex(trimmed, id);

  return { name: trimmed, id, postCount: 0 };
}

async function appendTagToIndex(name: string, id: string): Promise<void> {
  const html = await fs.readFile(TAGS_INDEX, 'utf-8');
  const link = renderTagIndexLink(name, id);
  if (html.includes(`/tag/${id}/`)) return;

  const marker = '<div class="tags-container">';
  const idx = html.indexOf(marker);
  if (idx === -1) throw new Error('无法在 tags/index.html 中找到容器');

  const insertAt = idx + marker.length;
  const updated = `${html.slice(0, insertAt)}\n            ${link.trim()}\n            ${html.slice(insertAt)}`;
  await fs.writeFile(TAGS_INDEX, updated, 'utf-8');
}

export async function ensureTags(names: string[]): Promise<{ name: string; id: string }[]> {
  const resolved: { name: string; id: string }[] = [];
  for (const name of names) {
    const tag = await createTag(name);
    resolved.push({ name: tag.name, id: tag.id });
  }
  return resolved;
}

export async function addPostToTagPages(
  post: {
    title: string;
    slug: string;
    date: string;
    abstract: string;
    featureImage?: string;
  },
  tagNames: string[],
): Promise<void> {
  if (tagNames.length === 0) return;

  const tags = await ensureTags(tagNames);
  const articleHtml = renderTagPostItem(post).trim();
  const navItems = await readSiteNav();
  const theme = await getSiteThemePreset();

  for (const tag of tags) {
    const tagPagePath = path.join(TAG_DIR, tag.id, 'index.html');
    let html: string;
    try {
      html = await fs.readFile(tagPagePath, 'utf-8');
    } catch {
      html = renderTagPage(tag.name, tag.id, [], navItems, theme);
      await fs.mkdir(path.join(TAG_DIR, tag.id), { recursive: true });
    }

    if (html.includes(`/post/${post.slug}/`)) continue;

    const marker = `<h2 class="current-tag">标签: ${tag.name}</h2>`;
    const idx = html.indexOf(marker);
    if (idx === -1) {
      await fs.writeFile(tagPagePath, renderTagPage(tag.name, tag.id, [post], navItems, theme), 'utf-8');
      continue;
    }

    const insertAt = idx + marker.length;
    const updated = `${html.slice(0, insertAt)}\n          ${articleHtml}\n          ${html.slice(insertAt)}`;
    await fs.writeFile(tagPagePath, updated, 'utf-8');
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function replacePostInTagPages(
  post: {
    title: string;
    slug: string;
    date: string;
    abstract: string;
    featureImage?: string;
  },
  tagNames: string[],
): Promise<void> {
  if (tagNames.length === 0) return;

  const tags = await ensureTags(tagNames);
  const articleHtml = renderTagPostItem(post).trim();

  for (const tag of tags) {
    const tagPagePath = path.join(TAG_DIR, tag.id, 'index.html');
    let html: string;
    try {
      html = await fs.readFile(tagPagePath, 'utf-8');
    } catch {
      continue;
    }

    const articleRe = new RegExp(
      `<article class="post-item">[\\s\\S]*?/post/${escapeRegex(post.slug)}/[\\s\\S]*?</article>`,
      'i',
    );
    if (articleRe.test(html)) {
      await fs.writeFile(tagPagePath, html.replace(articleRe, articleHtml), 'utf-8');
    } else {
      await addPostToTagPages(post, [tag.name]);
    }
  }
}

export async function removePostFromTagPages(slug: string): Promise<void> {
  let tagIds: string[];
  try {
    tagIds = await fs.readdir(TAG_DIR);
  } catch {
    return;
  }

  const articleRe = new RegExp(
    `<article class="post-item">[\\s\\S]*?/post/${escapeRegex(slug)}/[\\s\\S]*?</article>\\s*`,
    'i',
  );

  for (const tagId of tagIds) {
    const tagPagePath = path.join(TAG_DIR, tagId, 'index.html');
    try {
      const html = await fs.readFile(tagPagePath, 'utf-8');
      if (!articleRe.test(html)) continue;
      await fs.writeFile(tagPagePath, html.replace(articleRe, ''), 'utf-8');
    } catch {
      // skip missing tag pages
    }
  }
}

