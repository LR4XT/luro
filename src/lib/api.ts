import type { ThemeConfig, SiteThemePreset, EditorThemePreset } from './theme';

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

export interface TagInfo {
  name: string;
  id: string;
  postCount: number;
}

export interface SiteNavItem {
  id: string;
  label: string;
  href: string;
}

export interface GitStatusInfo {
  branch: string;
  isClean: boolean;
  modified: string[];
  created: string[];
  ahead: number;
  behind: number;
  hasUnpushedCommits: boolean;
  remote: string;
  remoteConfigured: boolean;
}

export type RemoteAuthType = 'http' | 'ssh';

export interface RemoteConfigPublic {
  authType: RemoteAuthType;
  repoUrl: string;
  httpUsername: string;
  hasHttpPassword: boolean;
  hasSshKey: boolean;
  hasSshPassphrase: boolean;
}

export interface SyncResult {
  success: boolean;
  summary: string;
  branch: string;
  posts: PostSummary[];
}

export interface PushResult {
  success: boolean;
  pushed: boolean;
  summary: string;
  commit?: string;
  changedFiles: number;
  branch: string;
}

export interface UploadImageResult {
  filename: string;
  url: string;
  absoluteUrl: string;
  markdown: string;
}

export interface PublishResult {
  slug: string;
  postPath: string;
  pushed: boolean;
  commit?: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? '请求失败');
  }
  return data as T;
}

export function syncRepo(): Promise<SyncResult> {
  return request('/api/sync', { method: 'POST' });
}

export function pushRepo(commitMessage?: string): Promise<PushResult> {
  return request('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(commitMessage ? { commitMessage } : {}),
  });
}

export function fetchPosts(): Promise<{ posts: PostSummary[] }> {
  return request('/api/posts');
}

export function fetchPost(slug: string): Promise<{ post: PostDetail }> {
  return request(`/api/posts/${encodeURIComponent(slug)}`);
}

export function fetchTags(): Promise<{ tags: TagInfo[] }> {
  return request('/api/tags');
}

export function createTag(name: string): Promise<{ tag: TagInfo }> {
  return request('/api/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function renameTag(
  id: string,
  name: string,
): Promise<{ tag: TagInfo; previousName: string; updatedPosts: number }> {
  return request(`/api/tags/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function deleteTag(id: string): Promise<{ deleted: { name: string; id: string }; updatedPosts: number }> {
  return request(`/api/tags/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function fetchPages(): Promise<{ items: SiteNavItem[] }> {
  return request('/api/pages');
}

export function savePages(items: SiteNavItem[]): Promise<{ items: SiteNavItem[]; updatedFiles: number; message: string }> {
  return request('/api/pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
}

export function fetchThemes(): Promise<ThemeConfig> {
  return request('/api/themes');
}

export function applySiteTheme(themeId: string): Promise<{
  theme: SiteThemePreset;
  updatedFiles: number;
  message: string;
}> {
  return request('/api/themes/site/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ themeId }),
  });
}

export function importSiteTheme(name: string, css: string): Promise<{
  theme: SiteThemePreset;
  site: ThemeConfig['site'];
  message: string;
}> {
  return request('/api/themes/site/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, css }),
  });
}

export function fetchGitStatus(): Promise<GitStatusInfo> {
  return request('/api/git/status');
}

export function fetchRemoteConfig(): Promise<{ config: RemoteConfigPublic }> {
  return request('/api/remote/config');
}

export function saveRemoteConfig(payload: {
  authType: RemoteAuthType;
  repoUrl: string;
  httpUsername?: string;
  httpPassword?: string;
  sshPrivateKey?: string;
  sshPassphrase?: string;
}): Promise<{ config: RemoteConfigPublic; remoteUrl: string }> {
  return request('/api/remote/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function testRemoteConnection(): Promise<{ ok: boolean; message: string }> {
  return request('/api/remote/test', { method: 'POST' });
}

export interface SiteConfig {
  repoPath: string;
  autoCreated?: boolean;
}

export function fetchSiteConfig(): Promise<{
  config: SiteConfig | null;
  repoRoot: string;
  setupNeeded?: boolean;
}> {
  return request('/api/site-config');
}

export function saveSiteConfig(repoPath: string): Promise<{ ok: boolean; repoPath: string; message: string }> {
  return request('/api/site-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoPath }),
  });
}

export function generateSlug(title: string): Promise<{ slug: string }> {
  return request('/api/slug', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
}

export async function uploadImage(file: File): Promise<UploadImageResult> {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch('/api/upload-image', { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? '图片上传失败');
  }
  return data as UploadImageResult;
}

export function deletePosts(
  slugs: string[],
  options?: { push?: boolean; commitMessage?: string },
): Promise<{ deleted: string[]; pushed: boolean; pushSummary?: string }> {
  return request('/api/posts/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slugs, ...options }),
  });
}

export function publishPost(payload: {
  title: string;
  date: string;
  markdown: string;
  tags: string[];
  slug: string;
  featureImage?: string;
  keywords?: string;
  push: boolean;
  update?: boolean;
  themeId?: string;
}): Promise<PublishResult> {
  return request('/api/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export type { ThemeConfig, SiteThemePreset, EditorThemePreset };
