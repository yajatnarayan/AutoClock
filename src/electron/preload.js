/**
 * AutoOC Electron Preload
 * Exposes a minimal, safe API to the renderer process.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('autooc', {
  getWsAuthToken: () => ipcRenderer.invoke('autooc:getWsAuthToken'),
  getVersion: () => ipcRenderer.invoke('autooc:getVersion'),
  getPaths: () => ipcRenderer.invoke('autooc:getPaths'),
  openLogsFolder: () => ipcRenderer.invoke('autooc:openLogsFolder'),
  openTextFile: () => ipcRenderer.invoke('autooc:openTextFile'),
  saveTextFile: (defaultName, content) =>
    ipcRenderer.invoke('autooc:saveTextFile', { defaultName, content }),
});
