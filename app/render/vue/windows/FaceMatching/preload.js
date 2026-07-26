const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getMediaPath: (type, link) => ipcRenderer.invoke('media:getPath', type, link),
  editItem: (link) => ipcRenderer.invoke('item:Edit', link),
  getMatchUnassignedDescriptor: (personID, descriptorIndex, options) => ipcRenderer.invoke('person:getMatchUnassignedDescriptor', personID, descriptorIndex, options),
  excludeDescriptorFromMatching: (personID, descriptorKey) => ipcRenderer.invoke('persons:excludeDescriptorFromMatching', personID, descriptorKey),
  assignFaceMatchingSelections: (payload) => ipcRenderer.invoke('person:assignFaceMatchingSelections', payload),
  onItemSaved: (callback) => {
    ipcRenderer.on('item:saved', (_event, payload) => callback(payload));
  },
  onItemDeleted: (callback) => {
    ipcRenderer.on('item:deleted', (_event, payload) => callback(payload));
  },
  onFaceMatchingLoad: (callback) => {
    ipcRenderer.on('faceMatching:load', (_event, payload) => callback(payload));
  }
});
