import { BrowserWindow } from 'electron';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { IPty } from 'node-pty';

const require = createRequire(import.meta.url);
const { spawn } = require('node-pty') as typeof import('node-pty');

interface PtySession {
  id: string;
  process: IPty;
  webContentsId: number;
}

const sessions = new Map<string, PtySession>();
let nextId = 1;

function getShell(): { file: string; args: string[] } {
  if (process.platform === 'win32') {
    return { file: process.env.COMSPEC || 'powershell.exe', args: [] };
  }
  return { file: process.env.SHELL || '/bin/zsh', args: ['-l'] };
}

export function getTerminalCwd(): string {
  const site = process.env.SITE_REPO;
  if (site) {
    const resolved = path.resolve(site);
    if (fs.existsSync(resolved)) return resolved;
  }
  return os.homedir();
}

function sendToRenderer(
  webContentsId: number,
  channel: string,
  payload: unknown,
): void {
  const win = BrowserWindow.getAllWindows().find(
    (w) => w.webContents.id === webContentsId,
  );
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

export function createPty(
  webContentsId: number,
  cols: number,
  rows: number,
): { id: string; cwd: string; shell: string } {
  const cwd = getTerminalCwd();
  const { file, args } = getShell();
  const id = String(nextId++);

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') env[key] = value;
  }
  env.TERM = 'xterm-256color';
  env.COLORTERM = 'truecolor';

  const term = spawn(file, args, {
    name: 'xterm-256color',
    cols: Math.max(cols || 80, 2),
    rows: Math.max(rows || 24, 1),
    cwd,
    env,
  });

  term.onData((data) => {
    sendToRenderer(webContentsId, 'terminal:data', { id, data });
  });

  term.onExit(({ exitCode }) => {
    sessions.delete(id);
    sendToRenderer(webContentsId, 'terminal:exit', { id, exitCode });
  });

  sessions.set(id, { id, process: term, webContentsId });
  return { id, cwd, shell: path.basename(file) };
}

export function writePty(id: string, data: string): void {
  sessions.get(id)?.process.write(data);
}

export function resizePty(id: string, cols: number, rows: number): void {
  const session = sessions.get(id);
  if (!session) return;
  session.process.resize(Math.max(cols, 2), Math.max(rows, 1));
}

export function killPty(id: string): void {
  const session = sessions.get(id);
  if (!session) return;
  try {
    session.process.kill();
  } catch {
    // already exited
  }
  sessions.delete(id);
}

export function killPtysForWebContents(webContentsId: number): void {
  for (const session of [...sessions.values()]) {
    if (session.webContentsId === webContentsId) {
      killPty(session.id);
    }
  }
}

export function killAllPtys(): void {
  for (const id of [...sessions.keys()]) {
    killPty(id);
  }
}
