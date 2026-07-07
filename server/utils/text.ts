import { pinyin } from 'pinyin-pro';

export function titleToSlug(title: string): string {
  const normalized = title.trim().replace(/[【】]/g, '');
  const slug = pinyin(normalized, {
    toneType: 'none',
    nonZh: 'consecutive',
    separator: '-',
  });

  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/\n/g, '&#10;');
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
