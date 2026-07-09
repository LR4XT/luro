import { useEffect, useMemo, useRef } from 'react';
import { formatLogTime, type ConsoleLogEntry } from '../lib/console-log';

interface TerminalViewProps {
  logs: ConsoleLogEntry[];
  onClear: () => void;
}

function levelPrefix(level: ConsoleLogEntry['level']): string {
  switch (level) {
    case 'success':
      return 'OK';
    case 'warn':
      return 'WARN';
    case 'error':
      return 'ERR';
    default:
      return 'INFO';
  }
}

export default function TerminalView({ logs, onClear }: TerminalViewProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const chronological = useMemo(() => [...logs].reverse(), [logs]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = body.scrollHeight;
  }, [logs.length]);

  return (
    <div className="terminal-panel">
      <header className="terminal-header">
        <div className="terminal-header-left">
          <span className="terminal-dot terminal-dot-red" />
          <span className="terminal-dot terminal-dot-yellow" />
          <span className="terminal-dot terminal-dot-green" />
          <span className="terminal-title">lr-blog-editor — zsh</span>
        </div>
        <button
          type="button"
          className="terminal-clear"
          onClick={onClear}
          disabled={logs.length === 0}
        >
          Clear
        </button>
      </header>

      <div ref={bodyRef} className="terminal-body">
        <div className="terminal-line terminal-line-muted">
          LR Blog Editor · 操作日志终端
        </div>
        <div className="terminal-line terminal-line-muted">
          记录 Sync、Push、Save、Delete 等操作输出
        </div>
        <div className="terminal-line terminal-line-spacer" aria-hidden="true" />

        {chronological.length === 0 ? (
          <div className="terminal-line terminal-line-muted">
            <span className="terminal-prompt">$</span> 等待操作…
          </div>
        ) : (
          chronological.map((log) => (
            <div key={log.id} className={`terminal-line terminal-line-${log.level}`}>
              <span className="terminal-time">[{formatLogTime(log.time)}]</span>
              <span className="terminal-level">{levelPrefix(log.level)}</span>
              <span className="terminal-action">{log.action}</span>
              <span className="terminal-message">{log.message}</span>
            </div>
          ))
        )}

        <div className="terminal-line terminal-line-input">
          <span className="terminal-prompt">$</span>
          <span className="terminal-cursor" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
