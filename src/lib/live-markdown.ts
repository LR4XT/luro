import {
  HighlightStyle,
  foldService,
  syntaxHighlighting,
  syntaxTree,
} from '@codemirror/language';
import {
  EditorState,
  RangeSetBuilder,
  StateField,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { rewritePreviewImageSrc } from './markdown';

const HIDE_MARK_NODES = new Set([
  'HeaderMark',
  'EmphasisMark',
  'CodeMark',
  'LinkMark',
  'QuoteMark',
]);

const FONT_SIZE_RE = /\{(\d{1,3})\}([\s\S]*?)\{\/\}/g;
const IMAGE_RE = /^!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)$/;

const hideMark = Decoration.replace({});

export function atxHeadingLevel(line: string): number {
  const match = /^(#{1,6})(?:\s|$)/.exec(line);
  return match ? match[1].length : 0;
}

export function headingFoldService(
  state: EditorState,
  lineStart: number,
  _lineEnd: number,
): { from: number; to: number } | null {
  const line = state.doc.lineAt(lineStart);
  const level = atxHeadingLevel(line.text);
  if (!level) return null;

  let to = state.doc.length;
  for (let n = line.number + 1; n <= state.doc.lines; n++) {
    const next = state.doc.line(n);
    const nextLevel = atxHeadingLevel(next.text);
    if (nextLevel && nextLevel <= level) {
      to = next.from;
      break;
    }
  }

  if (to <= line.to) return null;
  return { from: line.to, to };
}

class MarkdownImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly block: boolean,
  ) {
    super();
  }

  eq(other: MarkdownImageWidget) {
    return this.src === other.src && this.alt === other.alt && this.block === other.block;
  }

  get estimatedHeight() {
    return this.block ? 200 : -1;
  }

  toDOM(view: EditorView) {
    const img = document.createElement('img');
    img.className = this.block ? 'cm-md-image' : 'cm-md-image cm-md-image-inline';
    img.src = rewritePreviewImageSrc(this.src);
    img.alt = this.alt || this.src;
    img.draggable = false;

    // A block widget is measured with getBoundingClientRect, which ignores margins,
    // so spacing lives on a padded wrapper instead — otherwise every line below the
    // image sits lower than CodeMirror thinks and clicks land on the wrong line.
    let root: HTMLElement = img;
    if (this.block) {
      root = document.createElement('div');
      root.className = 'cm-md-image-block';
      root.appendChild(img);
    }

    // Height is unknown until the image decodes; a cached image never fires load.
    const remeasure = () => view.requestMeasure();
    img.addEventListener('load', remeasure);
    img.addEventListener('error', () => {
      img.classList.add('cm-md-image-broken');
      remeasure();
    });
    if (img.complete) remeasure();

    img.addEventListener('mousedown', (event) => {
      event.preventDefault();
      const pos = view.posAtDOM(img);
      view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
      view.focus();
    });
    return root;
  }

  ignoreEvent(event: Event) {
    return event.type !== 'mousedown';
  }
}

function selectionTouches(state: EditorState, from: number, to: number): boolean {
  const startLine = state.doc.lineAt(from);
  const endLine = state.doc.lineAt(Math.max(from, to));
  for (const range of state.selection.ranges) {
    if (range.to >= startLine.from && range.from <= endLine.to) return true;
  }
  return false;
}

function extendMarkHideTo(state: EditorState, to: number): number {
  if (to < state.doc.length && state.sliceDoc(to, to + 1) === ' ') return to + 1;
  return to;
}

function parseImageMarkdown(raw: string): { alt: string; src: string } | null {
  const match = IMAGE_RE.exec(raw.trim());
  if (!match) return null;
  return { alt: match[1], src: match[2] };
}

/**
 * Images that sit alone on a line become block widgets, and CodeMirror only
 * accepts block decorations from a state field — a plugin throws at update time.
 */
function blockImageDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n);
    if (!line.text.trim().startsWith('![')) continue;
    const parsed = parseImageMarkdown(line.text);
    if (!parsed) continue;
    if (selectionTouches(state, line.from, line.to)) continue;
    builder.add(
      line.from,
      line.to,
      Decoration.replace({
        widget: new MarkdownImageWidget(parsed.src, parsed.alt, true),
        block: true,
      }),
    );
  }
  return builder.finish();
}

const blockImageField = StateField.define<DecorationSet>({
  create: blockImageDecorations,
  update(value, tr) {
    if (!tr.docChanged && !tr.selection) return value.map(tr.changes);
    return blockImageDecorations(tr.state);
  },
  provide: (field) => EditorView.decorations.from(field),
});

function fenceStateUntil(state: EditorState, beforeLine: number): boolean {
  let inFence = false;
  for (let n = 1; n < beforeLine; n++) {
    const trimmed = state.doc.line(n).text.trimStart();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) inFence = !inFence;
  }
  return inFence;
}

function buildLineDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const builder = new RangeSetBuilder<Decoration>();
  const firstVisible = view.visibleRanges[0]
    ? state.doc.lineAt(view.visibleRanges[0].from).number
    : 1;
  let inFence = fenceStateUntil(state, firstVisible);

  for (const range of view.visibleRanges) {
    const startLine = state.doc.lineAt(range.from);
    const endLine = state.doc.lineAt(range.to);
    for (let n = startLine.number; n <= endLine.number; n++) {
      const line = state.doc.line(n);
      const trimmed = line.text.trimStart();
      if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
        inFence = !inFence;
        builder.add(line.from, line.from, Decoration.line({ class: 'cm-md-codeblock' }));
        continue;
      }
      if (inFence) {
        builder.add(line.from, line.from, Decoration.line({ class: 'cm-md-codeblock' }));
        continue;
      }
      const heading = atxHeadingLevel(line.text);
      if (heading) {
        builder.add(
          line.from,
          line.from,
          Decoration.line({ class: `cm-md-heading cm-md-h${heading}` }),
        );
      } else if (trimmed.startsWith('>')) {
        builder.add(line.from, line.from, Decoration.line({ class: 'cm-md-quote' }));
      } else if (/^---+$|^\*\*\*+$|^___+$/.test(trimmed)) {
        builder.add(line.from, line.from, Decoration.line({ class: 'cm-md-hr' }));
      }
    }
  }

  return builder.finish();
}

function buildReplaceDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  const pending: { from: number; to: number; deco: Decoration }[] = [];

  for (const range of view.visibleRanges) {
    syntaxTree(state).iterate({
      from: range.from,
      to: range.to,
      enter(node) {
        if (node.name === 'Image') {
          const line = state.doc.lineAt(node.from);
          // Images alone on a line are rendered as block widgets by blockImageField.
          if (line.text.trim() === state.sliceDoc(node.from, node.to).trim()) return false;
          if (selectionTouches(state, node.from, node.to)) return true;
          const parsed = parseImageMarkdown(state.sliceDoc(node.from, node.to));
          if (!parsed) return true;
          pending.push({
            from: node.from,
            to: node.to,
            deco: Decoration.replace({
              widget: new MarkdownImageWidget(parsed.src, parsed.alt, false),
            }),
          });
          return false;
        }

        if (HIDE_MARK_NODES.has(node.name)) {
          if (node.to <= node.from) return true;
          if (selectionTouches(state, node.from, node.to)) return true;
          pending.push({
            from: node.from,
            to: extendMarkHideTo(state, node.to),
            deco: hideMark,
          });
          return true;
        }

        if (node.name === 'URL') {
          const parent = node.node.parent?.name;
          if (parent !== 'Link' && parent !== 'Image') return true;
          if (selectionTouches(state, node.from, node.to)) return true;
          pending.push({ from: node.from, to: node.to, deco: hideMark });
        }

        return true;
      },
    });
  }

  FONT_SIZE_RE.lastIndex = 0;
  const text = state.sliceDoc(0);
  let match: RegExpExecArray | null;
  while ((match = FONT_SIZE_RE.exec(text))) {
    const fullFrom = match.index;
    const fullTo = fullFrom + match[0].length;
    const innerFrom = fullFrom + match[1].length + 2;
    const innerTo = fullTo - 3;
    if (innerTo < innerFrom) continue;
    if (selectionTouches(state, fullFrom, fullTo)) continue;
    pending.push({ from: fullFrom, to: innerFrom, deco: hideMark });
    pending.push({ from: innerTo, to: fullTo, deco: hideMark });
  }

  pending.sort((a, b) => a.from - b.from || a.to - b.to);
  const builder = new RangeSetBuilder<Decoration>();
  let lastTo = -1;
  for (const item of pending) {
    if (item.to <= item.from) continue;
    if (item.from < lastTo) continue;
    try {
      builder.add(item.from, item.to, item.deco);
      lastTo = item.to;
    } catch {
      // Skip invalid overlaps.
    }
  }
  return builder.finish();
}

function buildFontSizeMarks(view: EditorView): DecorationSet {
  const { state } = view;
  const builder = new RangeSetBuilder<Decoration>();
  const text = state.sliceDoc(0);
  FONT_SIZE_RE.lastIndex = 0;
  const marks: { from: number; to: number; deco: Decoration }[] = [];
  let match: RegExpExecArray | null;
  while ((match = FONT_SIZE_RE.exec(text))) {
    const size = Number(match[1]);
    if (!Number.isFinite(size) || size < 8 || size > 96) continue;
    const fullFrom = match.index;
    const innerFrom = fullFrom + match[1].length + 2;
    const innerTo = fullFrom + match[0].length - 3;
    if (innerTo <= innerFrom) continue;
    marks.push({
      from: innerFrom,
      to: innerTo,
      deco: Decoration.mark({
        attributes: { style: `font-size:${size}px` },
        class: 'cm-md-fontsize',
      }),
    });
  }
  marks.sort((a, b) => a.from - b.from || a.to - b.to);
  for (const mark of marks) {
    try {
      builder.add(mark.from, mark.to, mark.deco);
    } catch {
      // Skip invalid overlaps.
    }
  }
  return builder.finish();
}

function decoPlugin(build: (view: EditorView) => DecorationSet) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = build(view);
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          syntaxTree(update.startState) !== syntaxTree(update.state)
        ) {
          this.decorations = build(update.view);
        }
      }
    },
    { decorations: (value) => value.decorations },
  );
}

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700', fontSize: '1.85em', lineHeight: '1.3' },
  { tag: tags.heading2, fontWeight: '700', fontSize: '1.5em', lineHeight: '1.35' },
  { tag: tags.heading3, fontWeight: '650', fontSize: '1.28em', lineHeight: '1.4' },
  { tag: tags.heading4, fontWeight: '650', fontSize: '1.12em' },
  { tag: tags.heading5, fontWeight: '600', fontSize: '1.05em' },
  { tag: tags.heading6, fontWeight: '600', color: 'var(--muted)' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: 'var(--accent-text)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--muted)' },
  {
    tag: tags.monospace,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  { tag: tags.quote, color: 'var(--muted)', fontStyle: 'italic' },
  { tag: tags.meta, color: 'var(--muted)' },
  { tag: tags.processingInstruction, color: 'var(--muted)' },
  { tag: tags.contentSeparator, color: 'var(--muted)' },
  { tag: tags.comment, color: 'var(--muted)' },
  { tag: tags.tagName, color: 'var(--accent-text)' },
  { tag: tags.attributeName, color: 'var(--muted)' },
  { tag: tags.attributeValue, color: 'var(--accent-text)' },
]);

export const liveMarkdownExtensions: Extension[] = [
  foldService.of(headingFoldService),
  syntaxHighlighting(markdownHighlightStyle, { fallback: true }),
  blockImageField,
  decoPlugin(buildLineDecorations),
  decoPlugin(buildReplaceDecorations),
  decoPlugin(buildFontSizeMarks),
];
