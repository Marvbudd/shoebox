const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('EMPANADA', {
  req: {
    SHOWDIRDIALOG: 'show:Dialog',
    ADDMEDIA: 'add:Media'
  },
  // controller catches the event from the view
  onAddMediaShowDirectory: (callback) => {
    ipcRenderer.on('showDirectory', (event, data) => {
      callback(data)
    })
  },
  sendToMain: (message, args) => {
    // console.log('sendToMain', message, args)
    return ipcRenderer.send(message, args)
  }
})