const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Listen for media display messages from main process
  onMediaDisplay: (callback) => {
    ipcRenderer.on('mediaDisplay', (event, data) => {
      callback(data);
    });
  },
  
  // Play media item from playlist
  playItem: (entry) => ipcRenderer.invoke('item:Play', entry),
  
  // Edit item (opens MediaManager window)
  editItem: (accession) => ipcRenderer.invoke('item:Edit', accession),
  
  // Open website/tree window
  openWebsite: () => ipcRenderer.invoke('open:Website')
});
