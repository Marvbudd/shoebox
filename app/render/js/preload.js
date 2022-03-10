const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('BURRITO', {
    req: {
        ITEMGETDETAIL: 'item:getDetail',
        ITEMSGETLIST: 'items:getList',
        ITEMPLAY: 'item:Play',
        ITEMSRELOAD: 'items:reload',
        ITEMSCATEGORY: 'items:category'
    },
    rsp: {
        ITEMDETAIL: 'item:detail',
        ITEMSRENDER: 'items:render'
    },
    whenItemDetail: (callback) => {
        ipcRenderer.on('item:detail', (event, data) => {
            // console.log('item detail: ', this)
            callback(data)
        })
    },
    whenItemsRender: (callback) => {
        ipcRenderer.on('items:render', (event, data) => {
            // console.log('items:render: ', event, this)
            callback(data)
        })
    },
    sendToMain: (message, args) => {
        // console.log('sendToMain', message, args)
        return ipcRenderer.send(message, args)
    },
    openHelpWindow: () => {
        return ipcRenderer.send(BURRITO.req.HELPOPEN)
    }
})
