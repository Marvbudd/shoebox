const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('TACO', {
  onMediaDisplay: (callback) => {
    ipcRenderer.on('mediaDisplay', (event, data) => {
      callback(data)
    })
  }
})