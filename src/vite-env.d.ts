/// <reference types="vite/client" />

interface ElectronBridge {
  isElectron: boolean;
  pickFolder: () => Promise<string | null>;
  relaunch: () => Promise<void>;
}

declare global {
  interface Window {
    electron?: ElectronBridge;
  }
}

export {};
