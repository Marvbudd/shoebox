const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getCollections: () => ipcRenderer.invoke('collections:list'),
  getCollectionItems: (collectionKey) => ipcRenderer.invoke('collection:getItems', collectionKey),
  updateCollection: (updateData) => ipcRenderer.invoke('collection:update', updateData),
  getPersons: () => ipcRenderer.invoke('persons:getFromAccessions'),
  reverseGeocode: (latitude, longitude) => ipcRenderer.invoke('geocoding:reverse', latitude, longitude)
});
