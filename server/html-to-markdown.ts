import TurndownService from 'turndown';

function normalizeImageSrc(src: string): string {
  const trimmed = src.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return trimmed
    .replace(/^https?:\/\/lr4xt\.com\//i, '/')
    .replace(/^https?:\/\/[^/]+\/post-images\//i, '/post-images/');
}

function restoreFontSizeSyntax(markdown: string): string {
  return markdown.replace(
    /<span style="font-size:\s*(\d{1,3})px(?:;\s*)?">([\s\S]*?)<\/span>/gi,
    (_match, size, text) => `{${size}}${text}{/}`,
  );
}

export function htmlToMarkdown(html: string): string {
  const prepared = restoreFontSizeSyntax(html);

  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  turndown.addRule('figureImage', {
    filter: (node: HTMLElement) => node.nodeName === 'FIGURE' && Boolean(node.querySelector('img')),
    replacement: (_content: string, node: HTMLElement) => {
      const element = node as HTMLElement;
      const img = element.querySelector('img');
      if (!img) return '';
      const src = normalizeImageSrc(img.getAttribute('src') ?? '');
      const alt = img.getAttribute('alt') ?? '';
      return `\n\n![${alt}](${src})\n\n`;
    },
  });

  turndown.addRule('image', {
    filter: 'img',
    replacement: (_content: string, node: HTMLElement) => {
      const element = node as HTMLImageElement;
      const src = normalizeImageSrc(element.getAttribute('src') ?? '');
      const alt = element.getAttribute('alt') ?? '';
      return `![${alt}](${src})`;
    },
  });

  turndown.addRule('lineBreak', {
    filter: 'br',
    replacement: () => '  \n',
  });

  let markdown = turndown.turndown(prepared);
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')
    .replace(/!\[\]\((\/post-images\/[^)]+)\)/g, '![]($1)')
    .trim();

  return markdown;
}
