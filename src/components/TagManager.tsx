import { useState } from 'react';
import type { TagInfo } from '../lib/api';
import { IconTag } from './Icons';

interface TagManagerProps {
  tags: TagInfo[];
  onCreateTag: (name: string) => Promise<void>;
  onRenameTag: (id: string, name: string) => Promise<void>;
  onDeleteTag: (id: string) => Promise<void>;
}

export default function TagManager({ tags, onCreateTag, onRenameTag, onDeleteTag }: TagManagerProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    void run(async () => {
      await onCreateTag(trimmed);
      setName('');
      setMessage(`已创建「${trimmed}」`);
    });
  };

  const startEdit = (tag: TagInfo) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setError('');
    setMessage('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleRename = (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    void run(async () => {
      await onRenameTag(id, trimmed);
      setEditingId(null);
      setEditName('');
      setMessage(`已重命名为「${trimmed}」`);
    });
  };

  const handleDelete = (tag: TagInfo) => {
    const used = tag.postCount > 0 ? `将从 ${tag.postCount} 篇文章中移除该标签。` : '该标签尚未用于任何文章。';
    if (!window.confirm(`删除标签「${tag.name}」？\n${used}`)) return;
    void run(async () => {
      await onDeleteTag(tag.id);
      if (editingId === tag.id) cancelEdit();
      setMessage(`已删除「${tag.name}」`);
    });
  };

  return (
    <div className="main-panel">
      <header className="panel-header">
        <h1>Tag</h1>
      </header>

      <div className="tag-manager-create">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New tag name"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCreate();
            }
          }}
        />
        <button type="button" className="btn-primary" disabled={busy || !name.trim()} onClick={handleCreate}>
          Create tag
        </button>
      </div>

      {(error || message) && (
        <p className={`page-feedback${error ? ' error' : ''}`}>{error || message}</p>
      )}

      <div className="tag-list">
        {tags.map((tag) => {
          const editing = editingId === tag.id;
          return (
            <div key={tag.id} className="tag-row">
              <span className="tag-row-icon">
                <IconTag />
              </span>
              {editing ? (
                <input
                  className="tag-row-name-input"
                  value={editName}
                  autoFocus
                  disabled={busy}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleRename(tag.id);
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelEdit();
                    }
                  }}
                />
              ) : (
                <span className="tag-row-name">{tag.name}</span>
              )}
              <span className="tag-row-meta">{tag.postCount} posts</span>
              <span className="tag-row-id">{tag.id}</span>
              <div className="tag-row-actions">
                {editing ? (
                  <>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={busy || !editName.trim()}
                      onClick={() => handleRename(tag.id)}
                    >
                      Save
                    </button>
                    <button type="button" className="btn-ghost" disabled={busy} onClick={cancelEdit}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn-ghost" disabled={busy} onClick={() => startEdit(tag)}>
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-danger"
                      disabled={busy}
                      onClick={() => handleDelete(tag)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {tags.length === 0 && <p className="empty-state">No tags yet.</p>}
      </div>
    </div>
  );
}
