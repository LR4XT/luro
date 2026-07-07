import { useState } from 'react';
import type { TagInfo } from '../lib/api';

interface TagPickerProps {
  availableTags: TagInfo[];
  selected: string[];
  onChange: (tags: string[]) => void;
  onCreateTag: (name: string) => Promise<void>;
}

export default function TagPicker({
  availableTags,
  selected,
  onChange,
  onCreateTag,
}: TagPickerProps) {
  const [newTag, setNewTag] = useState('');
  const [creating, setCreating] = useState(false);

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter((t) => t !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  const handleCreate = async () => {
    const name = newTag.trim();
    if (!name) return;
    setCreating(true);
    try {
      await onCreateTag(name);
      if (!selected.includes(name)) {
        onChange([...selected, name]);
      }
      setNewTag('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="tag-picker">
      <span className="tag-picker-label">Tags</span>
      <div className="tag-chip-list">
        {availableTags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={`tag-chip${selected.includes(tag.name) ? ' selected' : ''}`}
            onClick={() => toggle(tag.name)}
          >
            {tag.name}
            <span className="tag-count">{tag.postCount}</span>
          </button>
        ))}
      </div>
      <div className="tag-create-row">
        <input
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="新建标签…"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleCreate();
            }
          }}
        />
        <button type="button" className="btn-ghost" disabled={creating || !newTag.trim()} onClick={() => void handleCreate()}>
          Add
        </button>
      </div>
    </div>
  );
}
