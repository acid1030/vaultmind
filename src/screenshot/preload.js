const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('screenshotApi', {
  getSource: () => ipcRenderer.invoke('screenshot:getSource'),
  finish: base64 => ipcRenderer.invoke('screenshot:finish', { base64 }),
  cancel: () => ipcRenderer.invoke('screenshot:cancel'),
});
