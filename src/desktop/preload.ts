import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopAPI, Snapshot } from '../core/contracts';
const api: DesktopAPI = {
  snapshot: () => ipcRenderer.invoke('helper:snapshot'),
  command: command => ipcRenderer.invoke('helper:command', command),
  subscribe: listener => {
    const handler = (_event: Electron.IpcRendererEvent, state: Snapshot) => listener(state);
    ipcRenderer.on('helper:state', handler);
    return () => ipcRenderer.removeListener('helper:state', handler);
  },
};
contextBridge.exposeInMainWorld('polyglotHelper', api);
