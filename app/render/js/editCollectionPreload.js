const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('AREPAS', {
  req: {
    GETCOLLECTION: 'get:Collection',
    SHOWCOLLDIALOG: 'show:CollectionsDialog',
    ADDCOLL: 'add:Collection',
    DELETECOLL: 'delete:Collection',
  },
  // controller catches the event from the view
  onAddMediaShowCollections: (callback) => {
    ipcRenderer.on('show:collections', (event, data) => {
      callback(data)
    })
  },
  sendToMain: (message, args) => {
    // console.log('sendToMain', message, args)
    return ipcRenderer.send(message, args)
  }
})