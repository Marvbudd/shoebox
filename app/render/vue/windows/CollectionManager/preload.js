const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getMode: () => ipcRenderer.invoke('collectionManager:getMode'),
  getCollections: () => ipcRenderer.invoke('collections:list'),
  createCollection: (data) => ipcRenderer.invoke('collection:create', data),
  deleteCollection: (collectionKey) => ipcRenderer.invoke('collection:delete', collectionKey)
});
