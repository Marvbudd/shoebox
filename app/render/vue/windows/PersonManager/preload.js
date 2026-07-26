const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Person operations
  getAllPersons: () => ipcRenderer.invoke('person:getAll'),
  savePerson: (person) => ipcRenderer.invoke('person:save', person),
  deletePerson: (personID) => ipcRenderer.invoke('person:delete', personID),
  getPerson: (personID) => ipcRenderer.invoke('person:get', personID),
  getPersonByTMGID: (tmgid) => ipcRenderer.invoke('person:getByTMGID', tmgid),
  getConfig: (key) => ipcRenderer.invoke('config:get', key),
  updatePersonTMGID: (personID, tmgid) => ipcRenderer.invoke('person:updateTMGID', { personID, tmgid }),
  getItemsForPerson: (personID) => ipcRenderer.invoke('person:getItems', personID),
  getPersonWithItems: (personID) => ipcRenderer.invoke('person:getWithItems', personID),
  getMatchUnassignedQueue: (personID, options) => ipcRenderer.invoke('person:getMatchUnassignedQueue', personID, options),
  getMatchUnassignedDescriptor: (personID, descriptorIndex, options) => ipcRenderer.invoke('person:getMatchUnassignedDescriptor', personID, descriptorIndex, options),
  openFaceMatching: (payload) => ipcRenderer.invoke('window:openFaceMatching', payload),

  // Utility to remove all listeners for lifecycle cleanup
  removeAllListeners: (channel) => {
    if (typeof channel !== 'string' || channel.length === 0) {
      return;
    }
    ipcRenderer.removeAllListeners(channel);
  },
  
  // IPC event listeners
  onPersonSelect: (callback) => {
    const listener = (_event, personID) => callback(personID);
    ipcRenderer.on('person:select', listener);
    return () => ipcRenderer.removeListener('person:select', listener);
  },
  onPersonsRefresh: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('persons:refresh', listener);
    return () => ipcRenderer.removeListener('persons:refresh', listener);
  },
  onModeChange: (callback) => {
    const listener = (_event, modeData) => callback(modeData);
    ipcRenderer.on('personManager:modeChange', listener);
    return () => ipcRenderer.removeListener('personManager:modeChange', listener);
  },
  onFocusSearch: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('personManager:focusSearch', listener);
    return () => ipcRenderer.removeListener('personManager:focusSearch', listener);
  },
  
  // Send person selection back to Media Manager
  sendPersonSelection: (personID) => {
    ipcRenderer.send('personManager:personSelected', personID);
  },

  sendPersonSelectionCanceled: () => {
    ipcRenderer.send('personManager:selectionCanceled');
  }
});


