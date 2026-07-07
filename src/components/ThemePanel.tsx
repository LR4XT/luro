import type { ThemePreset } from '../lib/api';

interface ThemePanelProps {
  themes: ThemePreset[];
  activeId: string;
  onSelect: (id: string) => void;
}

export default function ThemePanel({ themes, activeId, onSelect }: ThemePanelProps) {
  return (
    <div className="main-panel">
      <header className="panel-header">
        <h1>Theme</h1>
      </header>

      <div className="theme-grid">
        {themes.map((theme) => (
          <button
            key={theme.id}
            type="button"
            className={`theme-card${activeId === theme.id ? ' active' : ''}`}
            onClick={() => onSelect(theme.id)}
          >
            <div className="theme-preview" data-theme-preview={theme.id}>
              <div className="theme-preview-sidebar" style={{ background: theme.variables['--sidebar-bg'] }} />
              <div className="theme-preview-main" style={{ background: theme.variables['--panel-bg'] }}>
                <div className="theme-preview-btn" style={{ background: theme.variables['--btn-primary'] }} />
              </div>
            </div>
            <div className="theme-card-body">
              <strong>{theme.name}</strong>
              {theme.id === 'lr4xt-default' && <span className="theme-badge">Preset</span>}
              <p>{theme.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
