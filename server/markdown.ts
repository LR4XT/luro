import MarkdownIt from 'markdown-it';
import { SITE_URL } from './config.js';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

const defaultImageRender =
  md.renderer.rules.image ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = token.attrGet('src') ?? '';

  if (src.startsWith('/post-images/')) {
    token.attrSet('src', `${SITE_URL}${src}`);
  } else if (src.startsWith('post-images/')) {
    token.attrSet('src', `${SITE_URL}/${src}`);
  }

  token.attrSet('loading', 'lazy');
  if (!token.attrGet('alt')) {
    token.attrSet('alt', '');
  }

  return defaultImageRender(tokens, idx, options, env, self);
};

/** Convert `{20}text{/}` shorthand to span with font-size px */
export function expandFontSizeSyntax(markdown: string): string {
  return markdown.replace(
    /\{(\d{1,3})\}([\s\S]*?)\{\/\}/g,
    '<span style="font-size:$1px">$2</span>',
  );
}

export function markdownToHtml(markdown: string): string {
  const expanded = expandFontSizeSyntax(markdown);
  return md.render(expanded).trim();
}

export function extractAbstract(html: string, maxLength = 160): string {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
