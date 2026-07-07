import type { GitStatusInfo } from '../lib/api';
import type { ConsoleLogEntry } from '../lib/console-log';
import {
  IconBook,
  IconChart,
  IconChevronDown,
  IconCompass,
  IconExternal,
  IconGlobe,
  IconPage,
  IconPost,
  IconSetting,
  IconTag,
  IconTerminal,
  IconTheme,
} from './Icons';

export type NavItem = 'post' | 'page' | 'tag' | 'theme' | 'setting' | 'analytics' | 'console';

interface SidebarProps {
  active: NavItem;
  onNavigate: (item: NavItem) => void;
  gitStatus: GitStatusInfo | null;
  consoleLogs: ConsoleLogEntry[];
}

const NAV_ITEMS: { id: NavItem; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
  { id: 'post', label: 'Post', icon: <IconPost /> },
  { id: 'page', label: 'Page', icon: <IconPage /> },
  { id: 'tag', label: 'Tag', icon: <IconTag /> },
  { id: 'theme', label: 'Theme', icon: <IconTheme /> },
  { id: 'setting', label: 'Setting', icon: <IconSetting /> },
  { id: 'analytics', label: 'Visit Analytics', icon: <IconChart />, disabled: true },
];

export default function Sidebar({ active, onNavigate, gitStatus, consoleLogs }: SidebarProps) {
  const latestLog = consoleLogs[0];

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
        <div className="site-avatar">L</div>
        <span className="site-name">LR4XT</span>
        <IconChevronDown />
        <a
          className="site-link"
          href="https://lr4xt.com"
          target="_blank"
          rel="noreferrer"
          aria-label="Open site"
        >
          <IconExternal />
        </a>
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

      <button
        type="button"
        className={`sidebar-console-entry${active === 'console' ? ' active' : ''}`}
        onClick={() => onNavigate('console')}
      >
        <span className="sidebar-console-entry-icon">
          <IconTerminal />
        </span>
        <span className="sidebar-console-entry-body">
          <span className="sidebar-console-entry-title">Console</span>
          {latestLog ? (
            <span className={`sidebar-console-entry-preview preview-${latestLog.level}`}>
              {latestLog.message}
            </span>
          ) : (
            <span className="sidebar-console-entry-preview preview-empty">暂无日志</span>
          )}
        </span>
        {consoleLogs.length > 0 && (
          <span className="sidebar-console-badge">{consoleLogs.length}</span>
        )}
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
