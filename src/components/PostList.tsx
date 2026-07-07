import { useState } from 'react';
import type { PostSummary } from '../lib/api';
import { IconDoc } from './Icons';

interface PostListProps {
  posts: PostSummary[];
  syncing: boolean;
  pushing: boolean;
  deleting?: boolean;
  syncMessage?: string;
  pendingFileCount?: number;
  postChanges?: Map<string, 'new' | 'modified'>;
  selectedSlugs: Set<string>;
  pushEnabled: boolean;
  hasUnpushedCommits?: boolean;
  onNewPost: () => void;
  onSelectPost: (slug: string) => void;
  onSync: () => void;
  onPush: () => void;
  onSelectedSlugsChange: (slugs: Set<string>) => void;
  onDeleteSelected: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatPostDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

export default function PostList({
  posts,
  syncing,
  pushing,
  deleting = false,
  syncMessage,
  pendingFileCount = 0,
  postChanges,
  selectedSlugs,
  pushEnabled,
  hasUnpushedCommits = false,
  onNewPost,
  onSelectPost,
  onSync,
  onPush,
  onSelectedSlugsChange,
  onDeleteSelected,
}: PostListProps) {
  const [selectionMode, setSelectionMode] = useState(false);
  const busy = syncing || pushing || deleting;
  const selectedCount = selectedSlugs.size;
  const allSelected = posts.length > 0 && selectedCount === posts.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const toggleSlug = (slug: string, checked: boolean) => {
    const next = new Set(selectedSlugs);
    if (checked) {
      next.add(slug);
    } else {
      next.delete(slug);
    }
    onSelectedSlugsChange(next);
  };

  const toggleAll = (checked: boolean) => {
    onSelectedSlugsChange(checked ? new Set(posts.map((post) => post.slug)) : new Set());
  };

  const enterSelectionMode = () => {
    setSelectionMode(true);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    onSelectedSlugsChange(new Set());
  };

  const handleRowActivate = (slug: string) => {
    if (busy) return;
    if (selectionMode) {
      toggleSlug(slug, !selectedSlugs.has(slug));
      return;
    }
    onSelectPost(slug);
  };

  return (
    <div className="main-panel">
      <header className="panel-header">
        <div className="panel-header-left">
          <h1>Post</h1>
          {syncing && <span className="sync-badge">Syncing…</span>}
          {pushing && <span className="sync-badge">Pushing…</span>}
          {deleting && <span className="sync-badge">Deleting…</span>}
          {!busy && syncMessage && <span className="sync-badge muted">{syncMessage}</span>}
        </div>
        <div className="panel-header-actions">
          {selectionMode ? (
            <>
              {selectedCount > 0 && (
                <button
                  type="button"
                  className="btn-ghost btn-danger"
                  onClick={onDeleteSelected}
                  disabled={busy}
                >
                  Delete ({selectedCount})
                </button>
              )}
              <button type="button" className="btn-ghost" onClick={exitSelectionMode} disabled={busy}>
                Cancel
              </button>
            </>
          ) : (
            posts.length > 0 && (
              <button
                type="button"
                className="btn-ghost"
                onClick={enterSelectionMode}
                disabled={busy}
              >
                Select
              </button>
            )
          )}
          <button type="button" className="btn-ghost" onClick={onSync} disabled={busy}>
            Sync
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={onPush}
            disabled={busy || !pushEnabled}
            title={
              pushEnabled
                ? hasUnpushedCommits && pendingFileCount > 0
                  ? '推送未同步的本地提交'
                  : '提交并推送所有本地更改'
                : '请先在 Setting 中配置远程连接'
            }
          >
            Push{pendingFileCount > 0 ? ` (${pendingFileCount})` : ''}
          </button>
          <button type="button" className="btn-primary" onClick={onNewPost} disabled={busy}>
            New post
          </button>
        </div>
      </header>

      <div className={`post-list${selectionMode ? ' post-list--selecting' : ''}`}>
        {posts.length > 0 && (
          <div className="post-list-header">
            <span className="post-row-status" aria-hidden="true" />
            <div className="post-row-check-cell">
              <input
                type="checkbox"
                className="post-row-check"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={(e) => toggleAll(e.target.checked)}
                disabled={busy || posts.length === 0}
                aria-label="全选"
                tabIndex={selectionMode ? 0 : -1}
              />
            </div>
            <span className="post-row-icon" aria-hidden="true" />
            <span className="post-list-header-title">Title</span>
            <span className="post-row-date">Date</span>
          </div>
        )}
        {posts.map((post) => {
          const changeKind = postChanges?.get(post.slug);
          const checked = selectedSlugs.has(post.slug);
          return (
            <div
              key={post.slug}
              className={`post-row${selectionMode ? ' post-row--selecting' : ''}${checked ? ' post-row--selected' : ''}`}
              onClick={() => handleRowActivate(post.slug)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRowActivate(post.slug);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <span className="post-row-status" aria-hidden="true">
                {changeKind === 'new' && (
                  <span className="post-row-dot post-row-dot-new" title="新增未推送" />
                )}
                {changeKind === 'modified' && (
                  <span className="post-row-dot post-row-dot-modified" title="修改未推送" />
                )}
              </span>
              <div
                className="post-row-check-cell"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  className="post-row-check"
                  checked={checked}
                  onChange={(e) => toggleSlug(post.slug, e.target.checked)}
                  disabled={busy}
                  aria-label={`选择 ${post.title}`}
                  tabIndex={selectionMode ? 0 : -1}
                />
              </div>
              <span className="post-row-icon">
                <IconDoc />
              </span>
              <span className="post-row-title">{post.title}</span>
              <span className="post-row-date">{formatPostDate(post.date)}</span>
            </div>
          );
        })}
        {!syncing && posts.length === 0 && (
          <p className="empty-state">No posts yet. Create your first one.</p>
        )}
      </div>
    </div>
  );
}
