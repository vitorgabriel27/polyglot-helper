import { contextBridge, ipcRenderer } from 'electron';
import {
  DESKTOP_EVENTS,
  type DesktopAPI,
  type DesktopEventName,
  type Snapshot,
} from '../core/contracts';
const api: DesktopAPI = {
  snapshot: () => ipcRenderer.invoke(DESKTOP_EVENTS.snapshot),
  command: (command) => ipcRenderer.invoke(DESKTOP_EVENTS.command, command),
  subscribe: (listener) => {
    const channel: DesktopEventName = DESKTOP_EVENTS.state;
    const handler = (_event: Electron.IpcRendererEvent, state: Snapshot) => listener(state);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
};
contextBridge.exposeInMainWorld('polyglotHelper', api);
