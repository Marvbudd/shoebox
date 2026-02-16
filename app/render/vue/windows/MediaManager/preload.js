const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  loadItem: (identifier) => ipcRenderer.invoke('item:load', identifier),
  saveItem: (itemData) => ipcRenderer.invoke('item:save', itemData),
  deleteItem: (link) => ipcRenderer.invoke('item:delete', link),
  openFile: (filePath) => ipcRenderer.invoke('file:open', filePath),
  getExistingPersons: () => ipcRenderer.invoke('persons:getFromAccessions'),
  getPersonsWithDescriptors: () => ipcRenderer.invoke('persons:getWithDescriptors'),
  getDescriptorsForLink: (link) => ipcRenderer.invoke('persons:getDescriptorsForLink', link),
  addFaceDescriptor: (personID, link, model, region, descriptor, confidence) => 
    ipcRenderer.invoke('persons:addFaceDescriptor', personID, link, model, region, descriptor, confidence),
  removeFaceDescriptor: (personID, link) => ipcRenderer.invoke('persons:removeFaceDescriptor', personID, link),
  getAudioVideoItems: () => ipcRenderer.invoke('accessions:getAudioVideoItems'),
  getMediaPath: (type, link) => ipcRenderer.invoke('media:getPath', type, link),
  detectFaces: (accession, options) => ipcRenderer.invoke('face-detection:detect', accession, options),
  getFaceDetectionStatus: () => ipcRenderer.invoke('face-detection:status'),
  getFaceDetectionModels: () => ipcRenderer.invoke('face-detection:get-models'),
  matchFaces: (accession, detectedFaces) => ipcRenderer.invoke('face-detection:match', accession, detectedFaces),
  reverseGeocode: (latitude, longitude) => ipcRenderer.invoke('geocoding:reverse', latitude, longitude),
  getCurrentPlaybackTime: () => ipcRenderer.invoke('mediaPlayer:getCurrentTime'),
  openPersonManager: (personID) => ipcRenderer.invoke('window:openPersonManager', personID),
  getConfig: (key) => ipcRenderer.invoke('config:get', key),
  setConfig: (key, value) => ipcRenderer.invoke('config:set', key, value),
  saveWindowGeometry: () => ipcRenderer.invoke('window:saveMediaManagerGeometry'),
  
  // Event listeners
  onPersonSaved: (callback) => {
    ipcRenderer.on('person:saved', (event, personID) => callback(personID));
  },
  onItemLoad: (callback) => {
    ipcRenderer.on('item:load', (event, identifier, queueData) => callback(identifier, queueData));
  }
});
