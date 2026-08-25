import {
  codeFolding,
  foldAll,
  foldGutter,
  foldKeymap,
  foldNodeProp,
  unfoldAll,
} from '@codemirror/language';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { searchKeymap } from '@codemirror/search';
import { EditorState, Prec } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  keymap,
  placeholder,
} from '@codemirror/view';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';
import { imageFilesFromTransfer } from '../lib/clipboard';
import { liveMarkdownExtensions } from '../lib/live-markdown';

export interface MarkdownEditorHandle {
  wrapSelection(before: string, after: string): void;
  insertText(text: string): void;
  foldAll(): void;
  unfoldAll(): void;
  focus(): void;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onUploadImage: (file: File) => Promise<void>;
  placeholderText?: string;
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    { value, onChange, onUploadImage, placeholderText = 'Write in Markdown…' },
    ref,
  ) {
    const parentRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const valueRef = useRef(value);
    const onChangeRef = useRef(onChange);
    const onUploadImageRef = useRef(onUploadImage);

    valueRef.current = value;
    onChangeRef.current = onChange;
    onUploadImageRef.current = onUploadImage;

    useImperativeHandle(ref, () => ({
      wrapSelection(before, after) {
        const view = viewRef.current;
        if (!view) return;
        const { from, to } = view.state.selection.main;
        const selected = view.state.sliceDoc(from, to);
        const insert = `${before}${selected || '文字'}${after}`;
        view.dispatch({
          changes: { from, to, insert },
          selection: { anchor: from + insert.length },
        });
        view.focus();
      },
      insertText(text) {
        const view = viewRef.current;
        if (!view) return;
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        });
        view.focus();
      },
      foldAll() {
        const view = viewRef.current;
        if (view) foldAll(view);
      },
      unfoldAll() {
        const view = viewRef.current;
        if (view) unfoldAll(view);
      },
      focus() {
        viewRef.current?.focus();
      },
    }));

    useLayoutEffect(() => {
      if (!parentRef.current) return;

      const uploadFiles = (files: File[]) => {
        void (async () => {
          for (const file of files) {
            await onUploadImageRef.current(file);
          }
        })();
      };

      const view = new EditorView({
        parent: parentRef.current,
        state: EditorState.create({
          doc: valueRef.current,
          extensions: [
            history(),
            drawSelection(),
            dropCursor(),
            highlightActiveLine(),
            EditorView.lineWrapping,
            EditorView.contentAttributes.of({ spellcheck: 'false' }),
            placeholder(placeholderText),
            markdown({
              base: markdownLanguage,
              completeHTMLTags: false,
              // Markdown ships fold ranges for every block — list items, quotes,
              // code blocks. Neutralise them so only headings fold, which is what
              // the gutter arrows should mean here.
              extensions: { props: [foldNodeProp.add(() => () => null)] },
            }),
            liveMarkdownExtensions,
            codeFolding({ placeholderText: '…' }),
            foldGutter({
              openText: '▾',
              closedText: '▸',
            }),
            keymap.of([
              ...foldKeymap,
              ...defaultKeymap,
              ...historyKeymap,
              ...searchKeymap,
              indentWithTab,
            ]),
            Prec.high(
              EditorView.domEventHandlers({
                paste(event) {
                  const files = imageFilesFromTransfer(event.clipboardData);
                  if (files.length === 0) return false;
                  event.preventDefault();
                  uploadFiles(files);
                  return true;
                },
                drop(event) {
                  const files = imageFilesFromTransfer(event.dataTransfer);
                  if (files.length === 0) return false;
                  event.preventDefault();
                  uploadFiles(files);
                  return true;
                },
                dragover(event) {
                  if (event.dataTransfer?.types.includes('Files')) {
                    event.preventDefault();
                    return true;
                  }
                  return false;
                },
              }),
            ),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                onChangeRef.current(update.state.doc.toString());
              }
            }),
          ],
        }),
      });

      viewRef.current = view;
      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, [placeholderText]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      if (value !== current) {
        view.dispatch({
          changes: { from: 0, to: current.length, insert: value },
        });
      }
    }, [value]);

    return <div ref={parentRef} className="markdown-editor" />;
  },
);

export default MarkdownEditor;
