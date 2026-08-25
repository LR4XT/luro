/// <reference types="vite/client" />

interface TerminalBridge {
  create: (
    cols: number,
    rows: number,
  ) => Promise<{ id: string; cwd: string; shell: string }>;
  write: (id: string, data: string) => Promise<void>;
  resize: (id: string, cols: number, rows: number) => Promise<void>;
  kill: (id: string) => Promise<void>;
  getCwd: () => Promise<string>;
  onData: (callback: (payload: { id: string; data: string }) => void) => () => void;
  onExit: (
    callback: (payload: { id: string; exitCode: number }) => void,
  ) => () => void;
}

interface ElectronBridge {
  isElectron: boolean;
  pickFolder: () => Promise<string | null>;
  relaunch: () => Promise<void>;
  terminal?: TerminalBridge;
}

declare global {
  interface Window {
    electron?: ElectronBridge;
  }
}

export {};
