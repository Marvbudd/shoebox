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
  
  // Get media path (returns media:// protocol URL for audio/video, base64 for photos)
  getMediaPath: (type, link) => ipcRenderer.invoke('media:getPath', type, link),
  
  // Open media in external player
  openMediaExternal: (type, link) => ipcRenderer.invoke('media:openExternal', type, link),
  
  // Play media item from playlist
  playItem: (entry) => ipcRenderer.invoke('item:Play', entry),
  
  // Edit item (opens MediaManager window)
  editItem: (accession) => ipcRenderer.invoke('item:Edit', accession),
  
  // Open website/tree window
  openWebsite: () => ipcRenderer.invoke('open:Website')
});
