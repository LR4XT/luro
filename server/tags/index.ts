import fs from 'node:fs/promises';
import path from 'node:path';
import { DRAFTS_DIR, EDITOR_ROOT, POST_DIR, REPO_ROOT, SITE_TITLE, USER_DATA_ROOT } from '../config.js';
import { readSiteNav } from '../pages/index.js';
import { getSiteThemePreset } from '../themes/site.js';
import { renderTagIndexLink, renderTagPage, renderTagPostItem } from '../templates/tag.js';
import { escapeAttr, escapeHtml } from '../utils/text.js';

const BUNDLED_TAGS_FILE = path.join(EDITOR_ROOT, 'config', 'tags.json');
const TAGS_FILE = path.join(USER_DATA_ROOT, 'config', 'tags.json');
const TAGS_INDEX = path.join(REPO_ROOT, 'tags', 'index.html');
const TAG_DIR = path.join(REPO_ROOT, 'tag');

export interface TagInfo {
  name: string;
  id: string;
  postCount: number;
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function parseTagIndexHtml(html: string): Record<string, string> {
  const map: Record<string, string> = {};
  const tagLinkRe =
    /<a\s+[^>]*class="tag"[^>]*href="[^"]*\/tag\/([^/"']+)\/?"[^>]*>\s*([^<]+?)\s*<\/a>/gi;
  for (const match of html.matchAll(tagLinkRe)) {
    const id = match[1]?.trim();
    const name = decodeBasicEntities(match[2]?.trim() ?? '');
    if (id && name) map[name] = id;
  }
  return map;
}

function tagMapsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}

function mergeTagMaps(
  local: Record<string, string>,
  site: Record<string, string>,
): Record<string, string> {
  const usedIds = new Set<string>();
  const merged: Record<string, string> = {};
  for (const [name, id] of Object.entries(site)) {
    merged[name] = id;
    usedIds.add(id);
  }
  for (const [name, id] of Object.entries(local)) {
    if (usedIds.has(id) || merged[name]) continue;
    merged[name] = id;
    usedIds.add(id);
  }
  return merged;
}

function findNameById(map: Record<string, string>, id: string): string | undefined {
  return Object.entries(map).find(([, tagId]) => tagId === id)?.[0];
}

function assertSafeTagId(id: string): string {
  const trimmed = id.trim();
  if (!/^[A-Za-z0-9]+$/.test(trimmed)) {
    throw new Error('无效的标签 ID');
  }
  return trimmed;
}

function rewriteNameList(raw: string, from: string, to: string | null): string {
  const next = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part === from ? to : part))
    .filter((part): part is string => Boolean(part));
  return [...new Set(next)].join(', ');
}

async function readLocalTagMap(): Promise<Record<string, string>> {
  for (const file of [TAGS_FILE, BUNDLED_TAGS_FILE]) {
    try {
      const raw = await fs.readFile(file, 'utf-8');
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      // try the next location
    }
  }
  return {};
}

async function readSiteTagMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};

  try {
    const html = await fs.readFile(TAGS_INDEX, 'utf-8');
    Object.assign(map, parseTagIndexHtml(html));
  } catch {
    // tags/index.html may be missing on a brand-new site
  }

  let ids: string[];
  try {
    ids = await fs.readdir(TAG_DIR);
  } catch {
    return map;
  }

  const knownIds = new Set(Object.values(map));
  for (const id of ids) {
    if (knownIds.has(id)) continue;
    try {
      const html = await fs.readFile(path.join(TAG_DIR, id, 'index.html'), 'utf-8');
      const nameMatch = html.match(/<h2 class="current-tag">标签:\s*([^<]+)<\/h2>/);
      const name = nameMatch?.[1]?.trim();
      if (name && !map[name]) {
        map[name] = id;
        knownIds.add(id);
      }
    } catch {
      // skip unreadable tag pages
    }
  }

  return map;
}

export async function readTagMap(): Promise<Record<string, string>> {
  const local = await readLocalTagMap();
  const site = await readSiteTagMap();
  // Site pages are the source of truth for published tags (Gridea IDs).
  const merged = mergeTagMaps(local, site);
  if (!tagMapsEqual(local, merged)) {
    await writeTagMap(merged);
  }
  return merged;
}

async function writeTagMap(map: Record<string, string>): Promise<void> {
  await fs.mkdir(path.dirname(TAGS_FILE), { recursive: true });
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

function rewriteKeywordsMeta(html: string, from: string, to: string | null): string {
  return html.replace(
    /(<meta name="keywords" content=")([^"]*)("\s*\/?>)/i,
    (_match, open: string, content: string, close: string) => {
      const next = rewriteNameList(decodeBasicEntities(content), from, to);
      return `${open}${escapeAttr(next)}${close}`;
    },
  );
}

function rewritePostTagAnchor(html: string, id: string, newName: string): string {
  return html.replace(
    new RegExp(
      `(<a\\s[^>]*href="[^"]*\\/tag\\/${escapeRegex(id)}\\/?"[^>]*>)([\\s\\S]*?)(<\\/a>)`,
      'gi',
    ),
    `$1\n                    ${escapeHtml(newName)}\n                  $3`,
  );
}

function removePostTagAnchor(html: string, id: string): string {
  const withoutLink = html.replace(
    new RegExp(`\\s*<a\\s[^>]*href="[^"]*\\/tag\\/${escapeRegex(id)}\\/?"[^>]*>[\\s\\S]*?<\\/a>`, 'gi'),
    '',
  );
  return withoutLink.replace(/<div class="tag-container">\s*<\/div>/gi, '');
}

async function rewriteTagIndexLink(id: string, newName: string): Promise<void> {
  const html = await fs.readFile(TAGS_INDEX, 'utf-8');
  const re = new RegExp(
    `<a\\s[^>]*href="[^"]*\\/tag\\/${escapeRegex(id)}\\/?"[^>]*>\\s*[^<]*\\s*<\\/a>`,
    'i',
  );
  const updated = html.replace(re, renderTagIndexLink(newName, id).trim());
  if (updated !== html) {
    await fs.writeFile(TAGS_INDEX, updated, 'utf-8');
    return;
  }
  if (!html.includes(`/tag/${id}/`)) {
    await appendTagToIndex(newName, id);
  }
}

async function removeTagIndexLink(id: string): Promise<void> {
  try {
    const html = await fs.readFile(TAGS_INDEX, 'utf-8');
    const re = new RegExp(
      `\\n?\\s*<a\\s[^>]*href="[^"]*\\/tag\\/${escapeRegex(id)}\\/?"[^>]*>\\s*[^<]*\\s*<\\/a>`,
      'i',
    );
    const updated = html.replace(re, '');
    if (updated !== html) {
      await fs.writeFile(TAGS_INDEX, updated, 'utf-8');
    }
  } catch {
    // tags/index.html may be missing
  }
}

async function rewriteTagPageHeading(id: string, newName: string): Promise<void> {
  const tagPagePath = path.join(TAG_DIR, id, 'index.html');
  try {
    const html = await fs.readFile(tagPagePath, 'utf-8');
    const updated = html
      .replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(newName)} | ${SITE_TITLE}</title>`)
      .replace(
        /<h2 class="current-tag">标签:\s*[^<]*<\/h2>/,
        `<h2 class="current-tag">标签: ${escapeHtml(newName)}</h2>`,
      );
    await fs.writeFile(tagPagePath, updated, 'utf-8');
  } catch {
    const navItems = await readSiteNav();
    const theme = await getSiteThemePreset();
    await fs.mkdir(path.join(TAG_DIR, id), { recursive: true });
    await fs.writeFile(tagPagePath, renderTagPage(newName, id, [], navItems, theme), 'utf-8');
  }
}

async function mapPostHtml(update: (html: string) => string): Promise<number> {
  let changed = 0;
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
      const next = update(html);
      if (next !== html) {
        await fs.writeFile(postPath, next, 'utf-8');
        changed += 1;
      }
    } catch {
      // skip unreadable posts
    }
  }
  return changed;
}

async function rewriteDraftTagNames(from: string, to: string | null): Promise<void> {
  let files: string[];
  try {
    files = await fs.readdir(DRAFTS_DIR);
  } catch {
    return;
  }

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const filePath = path.join(DRAFTS_DIR, file);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const next = raw.replace(/^tags:\s*(.*)$/m, (_match, list: string) => {
        return `tags: ${rewriteNameList(list, from, to)}`;
      });
      if (next !== raw) {
        await fs.writeFile(filePath, next, 'utf-8');
      }
    } catch {
      // skip unreadable drafts
    }
  }
}

export async function renameTag(
  id: string,
  name: string,
): Promise<{ tag: TagInfo; previousName: string; updatedPosts: number }> {
  const safeId = assertSafeTagId(id);
  const newName = name.trim();
  if (!newName) throw new Error('标签名不能为空');

  const map = await readTagMap();
  const previousName = findNameById(map, safeId);
  if (!previousName) throw new Error('标签不存在');
  if (previousName === newName) {
    return {
      tag: { name: newName, id: safeId, postCount: await countPostsForTag(safeId) },
      previousName,
      updatedPosts: 0,
    };
  }

  const conflictId = map[newName];
  if (conflictId && conflictId !== safeId) {
    throw new Error(`标签「${newName}」已存在`);
  }

  await rewriteTagIndexLink(safeId, newName);
  await rewriteTagPageHeading(safeId, newName);
  const updatedPosts = await mapPostHtml((html) =>
    rewriteKeywordsMeta(rewritePostTagAnchor(html, safeId, newName), previousName, newName),
  );
  await rewriteDraftTagNames(previousName, newName);

  delete map[previousName];
  map[newName] = safeId;
  await writeTagMap(map);

  return {
    tag: { name: newName, id: safeId, postCount: await countPostsForTag(safeId) },
    previousName,
    updatedPosts,
  };
}

export async function deleteTag(
  id: string,
): Promise<{ deleted: { name: string; id: string }; updatedPosts: number }> {
  const safeId = assertSafeTagId(id);
  const map = await readTagMap();
  const name = findNameById(map, safeId);
  if (!name) throw new Error('标签不存在');

  await removeTagIndexLink(safeId);
  await fs.rm(path.join(TAG_DIR, safeId), { recursive: true, force: true });
  const updatedPosts = await mapPostHtml((html) =>
    rewriteKeywordsMeta(removePostTagAnchor(html, safeId), name, null),
  );
  await rewriteDraftTagNames(name, null);

  delete map[name];
  await writeTagMap(map);

  return { deleted: { name, id: safeId }, updatedPosts };
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

