const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('directory:select'),
  createAccessions: (formData) => ipcRenderer.invoke('accessions:create', formData),
  getExistingPersons: (directoryPath) => ipcRenderer.invoke('persons:getExisting', directoryPath)
});
