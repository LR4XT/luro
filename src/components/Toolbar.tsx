import { useRef, type RefObject } from 'react';
import type { MarkdownEditorHandle } from './MarkdownEditor';

interface ToolbarProps {
  editorRef: RefObject<MarkdownEditorHandle | null>;
  onUploadImage: (file: File) => Promise<void>;
}

export default function Toolbar({ editorRef, onUploadImage }: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const fontSizeRef = useRef<HTMLInputElement>(null);

  const wrap = (before: string, after: string) => {
    editorRef.current?.wrapSelection(before, after);
  };

  const insert = (text: string) => {
    editorRef.current?.insertText(text);
  };

  const insertFontSize = () => {
    const px = fontSizeRef.current?.value || '20';
    wrap(`{${px}}`, '{/}');
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button type="button" onClick={() => wrap('**', '**')}>
          粗体
        </button>
        <button type="button" onClick={() => wrap('*', '*')}>
          斜体
        </button>
        <button type="button" onClick={() => insert('\n## 标题\n')}>
          H2
        </button>
        <button type="button" onClick={() => insert('\n### 小标题\n')}>
          H3
        </button>
        <button type="button" onClick={() => wrap('[', '](https://)')}>
          链接
        </button>
        <button type="button" onClick={() => insert('\n> 引用\n')}>
          引用
        </button>
        <button type="button" onClick={() => insert('\n```\ncode\n```\n')}>
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
        <button type="button" onClick={() => wrap('<span style="font-size:20px">', '</span>')}>
          HTML 字号
        </button>
      </div>

      <div className="toolbar-group">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            await onUploadImage(file);
            event.target.value = '';
          }}
        />
        <button type="button" onClick={() => fileRef.current?.click()}>
          插入图片
        </button>
        <button type="button" onClick={() => editorRef.current?.foldAll()}>
          折叠全部
        </button>
        <button type="button" onClick={() => editorRef.current?.unfoldAll()}>
          展开全部
        </button>
      </div>

      <span className="toolbar-hint">
        点击标题左侧 ▾ 可折叠该节 · 光标所在行显示 Markdown 原文 · 字号：
        <code>{'{20}大号文字{/}'}</code>
      </span>
    </div>
  );
}
