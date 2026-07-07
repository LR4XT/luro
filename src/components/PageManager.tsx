import { useEffect, useState } from 'react';
import { fetchPages, savePages, type SiteNavItem } from '../lib/api';
import { IconPage } from './Icons';

function createEmptyItem(): SiteNavItem {
  return {
    id: '',
    label: '',
    href: '',
  };
}

export default function PageManager() {
  const [items, setItems] = useState<SiteNavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchPages()
      .then(({ items: nextItems }) => setItems(nextItems))
      .catch((err) => setMessage((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const updateItem = (index: number, patch: Partial<SiteNavItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      setMessage('至少保留一个导航栏目');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = await savePages(items);
      setItems(result.items);
      setMessage(result.message);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="main-panel">
      <header className="panel-header">
        <div className="panel-header-left">
          <h1>Page</h1>
        </div>
        <button type="button" className="btn-primary" disabled={busy || loading} onClick={() => void handleSave()}>
          {busy ? 'Saving…' : 'Save navigation'}
        </button>
      </header>

      <p className="page-hint">
        管理站点左侧导航栏目（首页、归档、标签、外链等）。保存后会同步更新所有静态页面。
      </p>

      {loading ? (
        <p className="empty-state">Loading navigation…</p>
      ) : (
        <div className="page-list">
          {items.map((item, index) => (
            <div key={item.id || `new-${index}`} className="page-row">
              <span className="page-row-icon">
                <IconPage />
              </span>
              <label className="page-field">
                Label
                <input
                  value={item.label}
                  onChange={(e) => updateItem(index, { label: e.target.value })}
                  placeholder="首页"
                />
              </label>
              <label className="page-field">
                Link
                <input
                  value={item.href}
                  onChange={(e) => updateItem(index, { href: e.target.value })}
                  placeholder="/archives"
                />
              </label>
              <div className="page-row-actions">
                <button type="button" className="btn-ghost" disabled={index === 0} onClick={() => moveItem(index, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={index === items.length - 1}
                  onClick={() => moveItem(index, 1)}
                >
                  ↓
                </button>
                <button type="button" className="btn-ghost" onClick={() => removeItem(index)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="page-footer-actions">
        <button type="button" className="btn-ghost" disabled={loading} onClick={() => setItems((prev) => [...prev, createEmptyItem()])}>
          Add link
        </button>
      </div>

      {message && <p className="setting-feedback page-feedback">{message}</p>}
    </div>
  );
}
