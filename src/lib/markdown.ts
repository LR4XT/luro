import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

export function expandFontSizeSyntax(markdown: string): string {
  return markdown.replace(
    /\{(\d{1,3})\}([\s\S]*?)\{\/\}/g,
    '<span style="font-size:$1px">$2</span>',
  );
}

export function renderMarkdownPreview(markdown: string): string {
  return md.render(expandFontSizeSyntax(markdown));
}

export function insertAtCursor(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  insertText: string,
  wrap?: { before: string; after: string },
): { nextValue: string; cursor: number } {
  const selected = value.slice(selectionStart, selectionEnd);
  const snippet = wrap
    ? `${wrap.before}${selected || '文字'}${wrap.after}`
    : insertText;

  const nextValue =
    value.slice(0, selectionStart) + snippet + value.slice(selectionEnd);

  const cursor = selectionStart + snippet.length;
  return { nextValue, cursor };
}

export function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
