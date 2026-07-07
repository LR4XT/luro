import { useRef, type RefObject } from 'react';
import { insertAtCursor } from '../lib/markdown';

interface ToolbarProps {
  value: string;
  onChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement>;
  onUploadImage: (file: File) => Promise<void>;
}

function wrapSelection(
  value: string,
  onChange: (v: string) => void,
  textarea: HTMLTextAreaElement | null,
  before: string,
  after: string,
) {
  if (!textarea) return;
  const { selectionStart, selectionEnd } = textarea;
  const { nextValue, cursor } = insertAtCursor(
    value,
    selectionStart,
    selectionEnd,
    '',
    { before, after },
  );
  onChange(nextValue);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
  });
}

export default function Toolbar({
  value,
  onChange,
  textareaRef,
  onUploadImage,
}: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const fontSizeRef = useRef<HTMLInputElement>(null);

  const insertFontSize = () => {
    const px = fontSizeRef.current?.value || '20';
    wrapSelection(value, onChange, textareaRef.current, `{${px}}`, '{/}');
  };

  const insertLine = (line: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    const { nextValue, cursor } = insertAtCursor(
      value,
      selectionStart,
      selectionEnd,
      line,
    );
    onChange(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button type="button" onClick={() => wrapSelection(value, onChange, textareaRef.current, '**', '**')}>
          粗体
        </button>
        <button type="button" onClick={() => wrapSelection(value, onChange, textareaRef.current, '*', '*')}>
          斜体
        </button>
        <button type="button" onClick={() => insertLine('\n## 标题\n')}>
          H2
        </button>
        <button type="button" onClick={() => insertLine('\n### 小标题\n')}>
          H3
        </button>
        <button
          type="button"
          onClick={() =>
            wrapSelection(value, onChange, textareaRef.current, '[', '](https://)')
          }
        >
          链接
        </button>
        <button type="button" onClick={() => insertLine('\n> 引用\n')}>
          引用
        </button>
        <button type="button" onClick={() => insertLine('\n```\ncode\n```\n')}>
          代码
        </button>
      </div>

      <div className="toolbar-group">
        <label className="font-size-control">
          字号
          <input ref={fontSizeRef} type="number" min={10} max={72} defaultValue={20} />
          px
        </label>
        <button type="button" onClick={insertFontSize}>
          应用字号
        </button>
        <button
          type="button"
          onClick={() =>
            wrapSelection(
              value,
              onChange,
              textareaRef.current,
              '<span style="font-size:20px">',
              '</span>',
            )
          }
        >
          HTML 字号
        </button>
      </div>

      <div className="toolbar-group">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            await onUploadImage(file);
            e.target.value = '';
          }}
        />
        <button type="button" onClick={() => fileRef.current?.click()}>
          插入图片
        </button>
      </div>

      <span className="toolbar-hint">
        字号：<code>{'{20}大号文字{/}'}</code> · 拖拽图片到编辑器也可上传
      </span>
    </div>
  );
}
