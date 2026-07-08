import { useRef, useState } from 'react';
import type { SiteThemePreset } from '../lib/api';

interface ThemePanelProps {
  themes: SiteThemePreset[];
  activeId: string;
  applying: boolean;
  onSelect: (id: string) => void;
  onImport: (name: string, css: string) => Promise<void>;
}

export default function ThemePanel({
  themes,
  activeId,
  applying,
  onSelect,
  onImport,
}: ThemePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importName, setImportName] = useState('');
  const [importCss, setImportCss] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const css = await file.text();
    setImportCss(css);
    if (!importName.trim()) {
      setImportName(file.name.replace(/\.css$/i, ''));
    }
    event.target.value = '';
  };

  const handleImport = async () => {
    setImportError('');
    setImporting(true);
    try {
      await onImport(importName, importCss);
      setImportName('');
      setImportCss('');
    } catch (error) {
      setImportError((error as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="main-panel">
      <header className="panel-header">
        <div>
          <h1>Theme</h1>
          <p className="panel-subtitle">切换博客网站（lr4xt.com）的视觉主题，会更新站点内所有 HTML 页面</p>
        </div>
      </header>

      <div className="theme-grid">
        {themes.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className={`theme-card${activeId === theme.id ? ' active' : ''}`}
            disabled={applying}
            onClick={() => onSelect(theme.id)}
          >
            <div className="theme-preview">
              <div className="theme-preview-sidebar" style={{ background: theme.preview.sidebar }} />
              <div className="theme-preview-main" style={{ background: theme.preview.bg }}>
                <div className="theme-preview-btn" style={{ background: theme.preview.accent }} />
              </div>
            </div>
            <div className="theme-card-body">
              <strong>
                {theme.name}
                {theme.id === 'lr4xt-classic' && <span className="theme-badge">Default</span>}
                {theme.imported && <span className="theme-badge">Imported</span>}
              </strong>
              <p>{theme.description}</p>
            </div>
          </button>
        ))}
      </div>

      <section className="theme-import">
        <h2>导入主题</h2>
        <p className="theme-import-desc">
          上传 CSS 文件作为主题覆盖层（基于 <code>styles/main.css</code> 叠加生效）。适合导入自定义配色或微调样式。
        </p>
        <div className="theme-import-form">
          <label className="field">
            <span>主题名称</span>
            <input
              type="text"
              value={importName}
              placeholder="例如：My Custom Theme"
              onChange={(event) => setImportName(event.target.value)}
            />
          </label>
          <div className="theme-import-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept=".css,text/css"
              hidden
              onChange={(event) => void handleFileChange(event)}
            />
            <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              选择 CSS 文件
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={importing || !importName.trim() || !importCss.trim()}
              onClick={() => void handleImport()}
            >
              {importing ? '导入中…' : '导入并添加'}
            </button>
          </div>
          <label className="field">
            <span>CSS 内容</span>
            <textarea
              rows={8}
              value={importCss}
              placeholder="粘贴或上传 CSS，覆盖博客站点样式…"
              onChange={(event) => setImportCss(event.target.value)}
            />
          </label>
          {importError && <p className="field-error">{importError}</p>}
        </div>
      </section>
    </div>
  );
}
