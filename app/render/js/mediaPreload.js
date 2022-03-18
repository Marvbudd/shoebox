const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('TACO', {
  req: {
    ITEMPLAY: 'item:Play'
  },
  onMediaDisplay: (callback) => {
    ipcRenderer.on('mediaDisplay', (event, data) => {
      callback(data)
    })
  },
  sendToMain: (message, args) => {
    // console.log('sendToMain', message, args)
    return ipcRenderer.send(message, args)
  }
})