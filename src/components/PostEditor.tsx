import { useMemo, useRef, useState } from 'react';
import type { TagInfo } from '../lib/api';
import MarkdownEditor, { type MarkdownEditorHandle } from './MarkdownEditor';
import Toolbar from './Toolbar';
import TagPicker from './TagPicker';
import { IconBack } from './Icons';
import { renderMarkdownPreview } from '../lib/markdown';

type EditorPanelMode = 'edit' | 'preview';

interface PostEditorProps {
  isNew: boolean;
  loading: boolean;
  panelMode: EditorPanelMode;
  onPanelModeChange: (mode: EditorPanelMode) => void;
  loadedContentHtml: string;
  markdownSource: 'draft' | 'converted' | 'empty';
  title: string;
  slug: string;
  date: string;
  tags: string[];
  availableTags: TagInfo[];
  featureImage: string;
  markdown: string;
  busy: boolean;
  onTitleChange: (v: string) => void;
  onSlugChange: (v: string) => void;
  onDateChange: (v: string) => void;
  onTagsChange: (v: string[]) => void;
  onCreateTag: (name: string) => Promise<void>;
  onFeatureImageChange: (v: string) => void;
  onMarkdownChange: (v: string) => void;
  onBack: () => void;
  onSave: () => void;
  onPickCover: (file: File) => Promise<void>;
  onUploadImage: (file: File) => Promise<string | void>;
}

export default function PostEditor({
  isNew,
  loading,
  panelMode,
  onPanelModeChange,
  loadedContentHtml,
  markdownSource,
  title,
  slug,
  date,
  tags,
  availableTags,
  featureImage,
  markdown,
  busy,
  onTitleChange,
  onSlugChange,
  onDateChange,
  onTagsChange,
  onCreateTag,
  onFeatureImageChange,
  onMarkdownChange,
  onBack,
  onSave,
  onPickCover,
  onUploadImage,
}: PostEditorProps) {
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const previewHtml = useMemo(() => {
    if (markdown.trim()) {
      return renderMarkdownPreview(markdown);
    }
    return loadedContentHtml;
  }, [markdown, loadedContentHtml]);

  const featureUrl = featureImage ? `/api/assets/post-images/${featureImage}` : undefined;
  const headerTitle = isNew ? 'New post' : title.trim() || 'Edit post';

  const handleCoverFile = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setCoverBusy(true);
    try {
      await onPickCover(file);
    } finally {
      setCoverBusy(false);
      if (coverInputRef.current) {
        coverInputRef.current.value = '';
      }
    }
  };

  const insertUploadedImage = async (file: File) => {
    const snippet = await onUploadImage(file);
    if (snippet) editorRef.current?.insertText(`\n${snippet}\n`);
  };

  if (loading) {
    return (
      <div className="main-panel editor-panel">
        <header className="panel-header">
          <div className="panel-header-left">
            <button type="button" className="btn-ghost" onClick={onBack}>
              <IconBack />
              Back
            </button>
            <h1>Loading…</h1>
          </div>
        </header>
        <p className="empty-state">Loading post…</p>
      </div>
    );
  }

  return (
    <div className={`main-panel editor-panel${panelMode === 'preview' ? ' editor-panel-preview' : ''}`}>
      <header className="panel-header">
        <div className="panel-header-left">
          <button type="button" className="btn-ghost" onClick={onBack} disabled={busy}>
            <IconBack />
            Back
          </button>
          <h1>{headerTitle}</h1>
        </div>
        <div className="panel-header-actions">
          <div className="view-toggle">
            <button
              type="button"
              className={panelMode === 'edit' ? 'active' : ''}
              onClick={() => onPanelModeChange('edit')}
            >
              Edit
            </button>
            <button
              type="button"
              className={panelMode === 'preview' ? 'active' : ''}
              onClick={() => onPanelModeChange('preview')}
            >
              Preview
            </button>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !title.trim()}
            onClick={onSave}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {panelMode === 'edit' ? (
        <div className="editor-body editor-body-single">
          <section className="editor-form">
            <input
              className="title-input"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Post title"
            />

            <div className="meta-row">
              <label>
                Slug
                <input
                  value={slug}
                  onChange={(e) => onSlugChange(e.target.value)}
                  placeholder="留空则按标题自动生成"
                  readOnly={!isNew}
                />
              </label>
              <label>
                Date
                <input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
              </label>
              <label className="field-block cover-field">
                Cover
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => void handleCoverFile(e.target.files?.[0])}
                />
                <div className="cover-picker">
                  <button
                    type="button"
                    className="btn-ghost cover-picker-btn"
                    disabled={busy || coverBusy}
                    onClick={() => coverInputRef.current?.click()}
                  >
                    {coverBusy ? 'Uploading…' : '选择图片'}
                  </button>
                  {featureImage && (
                    <button
                      type="button"
                      className="btn-ghost cover-clear-btn"
                      disabled={busy || coverBusy}
                      onClick={() => onFeatureImageChange('')}
                    >
                      Clear
                    </button>
                  )}
                </div>
                {featureUrl && (
                  <div
                    className="cover-preview"
                    style={{ backgroundImage: `url('${featureUrl}')` }}
                    title={featureImage}
                  />
                )}
              </label>
            </div>

            <TagPicker
              availableTags={availableTags}
              selected={tags}
              onChange={onTagsChange}
              onCreateTag={onCreateTag}
            />

            <Toolbar editorRef={editorRef} onUploadImage={insertUploadedImage} />

            <MarkdownEditor
              ref={editorRef}
              value={markdown}
              onChange={onMarkdownChange}
              onUploadImage={insertUploadedImage}
              placeholderText="Write in Markdown…"
            />

            {markdownSource === 'converted' && (
              <p className="field-hint">
                已从已发布 HTML 自动还原 Markdown，并保存为草稿。请检查格式后再保存。
              </p>
            )}

            <p className="field-hint">点击 Save 保存到本地；在列表页使用 Push 推送到远程。</p>
          </section>
        </div>
      ) : (
        <div className="editor-preview-full">
          <article className="preview-pane post-detail">
            <h2 className="post-title">{title || 'Untitled'}</h2>
            <div className="post-date">{date}</div>

            {featureUrl && (
              <div
                className="feature-container"
                style={{ backgroundImage: `url('${featureUrl}')` }}
              />
            )}

            {tags.length > 0 && (
              <div className="preview-tags">
                {tags.map((tag) => (
                  <span key={tag} className="preview-tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </article>
        </div>
      )}
    </div>
  );
}
