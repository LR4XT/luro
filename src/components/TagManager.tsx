import { useState } from 'react';
import type { TagInfo } from '../lib/api';
import { IconTag } from './Icons';

interface TagManagerProps {
  tags: TagInfo[];
  onCreateTag: (name: string) => Promise<void>;
}

export default function TagManager({ tags, onCreateTag }: TagManagerProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await onCreateTag(trimmed);
      setName('');
    } finally {
      setBusy(false);
    }
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
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleCreate();
            }
          }}
        />
        <button type="button" className="btn-primary" disabled={busy || !name.trim()} onClick={() => void handleCreate()}>
          Create tag
        </button>
      </div>

      <div className="tag-list">
        {tags.map((tag) => (
          <div key={tag.id} className="tag-row">
            <span className="tag-row-icon">
              <IconTag />
            </span>
            <span className="tag-row-name">{tag.name}</span>
            <span className="tag-row-meta">{tag.postCount} posts</span>
            <span className="tag-row-id">{tag.id}</span>
          </div>
        ))}
        {tags.length === 0 && <p className="empty-state">No tags yet.</p>}
      </div>
    </div>
  );
}
