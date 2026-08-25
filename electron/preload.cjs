const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  relaunch: () => ipcRenderer.invoke('relaunch-app'),
  terminal: {
    create: (cols, rows) => ipcRenderer.invoke('terminal:create', { cols, rows }),
    write: (id, data) => ipcRenderer.invoke('terminal:write', { id, data }),
    resize: (id, cols, rows) => ipcRenderer.invoke('terminal:resize', { id, cols, rows }),
    kill: (id) => ipcRenderer.invoke('terminal:kill', { id }),
    getCwd: () => ipcRenderer.invoke('terminal:cwd'),
    onData: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('terminal:data', listener);
      return () => ipcRenderer.removeListener('terminal:data', listener);
    },
    onExit: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('terminal:exit', listener);
      return () => ipcRenderer.removeListener('terminal:exit', listener);
    },
  },
});
