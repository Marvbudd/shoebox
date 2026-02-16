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
  updatePersonTMGID: (personID, tmgid) => ipcRenderer.invoke('person:updateTMGID', { personID, tmgid }),
  getItemsForPerson: (personID) => ipcRenderer.invoke('person:getItems', personID),
  getPersonWithItems: (personID) => ipcRenderer.invoke('person:getWithItems', personID),
  
  // IPC event listeners
  onPersonSelect: (callback) => {
    ipcRenderer.on('person:select', (event, personID) => callback(personID));
  },
  onPersonsRefresh: (callback) => {
    ipcRenderer.on('persons:refresh', () => callback());
  }
});


