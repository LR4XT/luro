import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef, useState } from 'react';
import '@xterm/xterm/css/xterm.css';

export default function TerminalView() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [cwd, setCwd] = useState('');
  const [shell, setShell] = useState('zsh');
  const [error, setError] = useState('');
  const [restartKey, setRestartKey] = useState(0);

  useEffect(() => {
    const bridge = window.electron?.terminal;
    const host = hostRef.current;

    if (!bridge) {
      setError(
        window.electron
          ? '终端桥接未加载，请重启桌面应用。'
          : '请从「应用程序」打开 luro 桌面版；浏览器或 localhost 网页无法使用内置终端。',
      );
      return;
    }
    if (!host) return;

    let disposed = false;
    let term: Terminal | null = null;
    let fitAddon: FitAddon | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let unsubData: (() => void) | null = null;
    let unsubExit: (() => void) | null = null;
    let sessionId: string | null = null;
    let onWindowResize: (() => void) | null = null;

    const boot = async () => {
      try {
        const knownCwd = await bridge.getCwd();
        if (disposed) return;
        setCwd(knownCwd);
        setError('');

        term = new Terminal({
          cursorBlink: true,
          fontSize: 13,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          theme: {
            background: '#0d1117',
            foreground: '#c9d1d9',
            cursor: '#c9d1d9',
            selectionBackground: '#264f78',
            black: '#484f58',
            red: '#ff7b72',
            green: '#3fb950',
            yellow: '#d29922',
            blue: '#58a6ff',
            magenta: '#bc8cff',
            cyan: '#39c5cf',
            white: '#b1bac4',
            brightBlack: '#6e7681',
            brightRed: '#ffa198',
            brightGreen: '#56d364',
            brightYellow: '#e3b341',
            brightBlue: '#79c0ff',
            brightMagenta: '#d2a8ff',
            brightCyan: '#56d4dd',
            brightWhite: '#f0f6fc',
          },
          allowProposedApi: true,
        });

        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(host);
        fitAddon.fit();

        const dims = fitAddon.proposeDimensions();
        const created = await bridge.create(dims?.cols ?? 80, dims?.rows ?? 24);
        if (disposed) {
          await bridge.kill(created.id);
          return;
        }

        sessionId = created.id;
        setCwd(created.cwd);
        setShell(created.shell);

        unsubData = bridge.onData((payload) => {
          if (payload.id === sessionId) {
            term?.write(payload.data);
          }
        });

        unsubExit = bridge.onExit((payload) => {
          if (payload.id !== sessionId) return;
          term?.writeln('');
          term?.writeln(`[process exited with code ${payload.exitCode}]`);
          sessionId = null;
        });

        term.onData((data) => {
          if (sessionId) {
            void bridge.write(sessionId, data);
          }
        });

        const syncSize = () => {
          if (!fitAddon || !term || !sessionId) return;
          fitAddon.fit();
          void bridge.resize(sessionId, term.cols, term.rows);
        };

        onWindowResize = syncSize;
        resizeObserver = new ResizeObserver(syncSize);
        resizeObserver.observe(host);
        window.addEventListener('resize', syncSize);
        term.focus();
      } catch (err) {
        if (!disposed) {
          setError((err as Error).message || '无法启动终端');
        }
      }
    };

    void boot();

    return () => {
      disposed = true;
      if (onWindowResize) {
        window.removeEventListener('resize', onWindowResize);
      }
      resizeObserver?.disconnect();
      unsubData?.();
      unsubExit?.();
      if (sessionId) {
        void bridge.kill(sessionId);
      }
      term?.dispose();
    };
  }, [restartKey]);

  return (
    <div className="terminal-panel">
      <header className="terminal-header">
        <div className="terminal-header-left">
          <span className="terminal-dot terminal-dot-red" />
          <span className="terminal-dot terminal-dot-yellow" />
          <span className="terminal-dot terminal-dot-green" />
          <span className="terminal-title">
            luro — {shell}
            {cwd ? ` · ${cwd}` : ''}
          </span>
        </div>
        <button
          type="button"
          className="terminal-clear"
          onClick={() => {
            setError('');
            setRestartKey((key) => key + 1);
          }}
        >
          Restart
        </button>
      </header>

      {error ? <div className="terminal-fallback">{error}</div> : null}
      <div
        ref={hostRef}
        className="terminal-xterm"
        style={error ? { display: 'none' } : undefined}
      />
    </div>
  );
}
