import type { GitStatusInfo } from '../lib/api';
import {
  IconBook,
  IconChevronDown,
  IconCompass,
  IconGlobe,
  IconMoon,
  IconPage,
  IconPost,
  IconSetting,
  IconSun,
  IconTag,
  IconTerminal,
  IconTheme,
} from './Icons';

export type NavItem = 'post' | 'page' | 'tag' | 'theme' | 'setting' | 'console';

interface SidebarProps {
  active: NavItem;
  editorThemeId: 'light' | 'dark';
  onNavigate: (item: NavItem) => void;
  onToggleEditorTheme: () => void;
  gitStatus: GitStatusInfo | null;
  siteRepoPath: string;
}

const NAV_ITEMS: { id: NavItem; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
  { id: 'post', label: 'Post', icon: <IconPost /> },
  { id: 'page', label: 'Page', icon: <IconPage /> },
  { id: 'tag', label: 'Tag', icon: <IconTag /> },
  { id: 'theme', label: 'Theme', icon: <IconTheme /> },
  { id: 'setting', label: 'Setting', icon: <IconSetting /> },
];

function shortenPath(fullPath: string): string {
  if (!fullPath) return '本地站点仓库';
  const home = fullPath.match(/^\/Users\/[^/]+/);
  if (home) {
    return fullPath.replace(home[0], '~');
  }
  return fullPath;
}

export default function Sidebar({
  active,
  editorThemeId,
  onNavigate,
  onToggleEditorTheme,
  gitStatus,
  siteRepoPath,
}: SidebarProps) {
  const isDark = editorThemeId === 'dark';

  return (
    <aside className="sidebar">
      <div className="sidebar-top-icons">
        <button type="button" className="top-icon active" aria-label="Site">
          <IconGlobe />
        </button>
        <button type="button" className="top-icon" aria-label="Explore" disabled>
          <IconCompass />
        </button>
        <button type="button" className="top-icon" aria-label="Docs" disabled>
          <IconBook />
        </button>
      </div>

      <div className="site-selector">
        <div className="site-avatar">LR</div>
        <span className="site-name">Luro</span>
        <IconChevronDown />
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item${active === item.id ? ' active' : ''}`}
            disabled={item.disabled}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-appearance">
        <span className="sidebar-appearance-label">Appearance</span>
        <button
          type="button"
          className={`appearance-toggle${isDark ? ' is-dark' : ''}`}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={onToggleEditorTheme}
        >
          <span className="appearance-toggle-track">
            <span className="appearance-toggle-thumb">
              {isDark ? <IconMoon /> : <IconSun />}
            </span>
          </span>
        </button>
      </div>

      <button
        type="button"
        className={`sidebar-console-entry${active === 'console' ? ' active' : ''}`}
        onClick={() => onNavigate('console')}
      >
        <span className="sidebar-console-entry-icon">
          <IconTerminal />
        </span>
        <span className="sidebar-console-entry-body">
          <span className="sidebar-console-entry-title">Terminal</span>
          <span className="sidebar-console-entry-preview preview-empty">
            {shortenPath(siteRepoPath)}
          </span>
        </span>
      </button>

      {gitStatus && active === 'setting' && (
        <div className="sidebar-meta">
          <p>{gitStatus.branch}</p>
          <p>
            {gitStatus.hasUnpushedCommits
              ? `${gitStatus.ahead} commits ahead`
              : gitStatus.isClean
                ? 'Clean'
                : `${gitStatus.modified.length} changes`}
          </p>
        </div>
      )}
    </aside>
  );
}
