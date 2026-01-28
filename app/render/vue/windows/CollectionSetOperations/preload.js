const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getCollections: () => ipcRenderer.invoke('collections:list'),
  getCollectionItems: (collectionKey) => ipcRenderer.invoke('collection:getItems', collectionKey),
  executeCollectionOperation: (operationData) => ipcRenderer.invoke('collection:executeSetOperation', operationData)
});
