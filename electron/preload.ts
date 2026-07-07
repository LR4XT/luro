import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('pick-folder'),
  relaunch: (): Promise<void> => ipcRenderer.invoke('relaunch-app'),
});
