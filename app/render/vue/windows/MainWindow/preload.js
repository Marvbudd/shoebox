const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Get list of items with specified sort order
  getItemsList: (requestParams) => ipcRenderer.invoke('items:getList', requestParams),
  
  // Get details for a specific item
  getItemDetail: (accession) => ipcRenderer.invoke('item:getDetail', accession),
  
  // Toggle item's membership in currently selected collection
  toggleItemInCollection: (link) => ipcRenderer.invoke('item:setCollection', link),
  
  // Update filter controls (photo/audio/video checkboxes, collection selection)
  updateControls: (controls) => ipcRenderer.invoke('items:collection', controls),
  
  // Play media item
  playItem: (entry) => ipcRenderer.invoke('item:Play', entry),
  
  // Edit item (opens MediaManager window)
  editItem: (accession, collectionKey, includeQueue, sortBy) => ipcRenderer.invoke('item:Edit', accession, collectionKey, includeQueue, sortBy),

  // Prevent display sleep/screensaver during slideshow
  setSlideshowDisplaySleepBlock: (shouldBlock) => ipcRenderer.invoke('slideshow:setDisplaySleepBlock', shouldBlock),
  
  // Open website/tree window
  openWebsite: () => ipcRenderer.invoke('open:Website'),
  
  // Open person link in genealogy website
  openPersonLink: (tmgid) => ipcRenderer.invoke('open:PersonLink', tmgid),
  
  // Open documentation website
  openDocumentation: () => ipcRenderer.invoke('open:Documentation'),
  
  // Listen for item detail messages (e.g., photo references from MediaPlayer)
  onItemDetail: (callback) => {
    ipcRenderer.on('item:detail', (event, data) => {
      callback(data);
    });
  },
  
  // Listen for items reload/refresh messages (e.g., when accessions change)
  onItemsRender: (callback) => {
    ipcRenderer.on('items:render', (event, data) => {
      callback(data);
    });
  },
  
  // Listen for person saved event (to refresh person names in nav)
  onPersonSaved: (callback) => {
    ipcRenderer.on('person:saved', (event, personID) => {
      callback(personID);
    });
  },
  
  // Listen for menu-triggered edit media command
  onEditMedia: (callback) => {
    ipcRenderer.on('menu:editMedia', () => {
      callback();
    });
  }
});
