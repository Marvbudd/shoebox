const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('BURRITO', {
    req: {
        ITEMGETDETAIL: 'item:getDetail',
        ITEMSGETLIST: 'items:getList',
        ITEMPLAY: 'item:Play',
        ITEMSRELOAD: 'items:reload',
        ITEMSCOLLECTION: 'items:collection',
        ITEMSETCOLLECTION: 'item:setCollection',
        ITEMEDIT: 'item:edit',
        OPENWEBSITE: 'open:Website',
        OPENPERSONLINK: 'open:PersonLink',
        PERSONGET: 'person:get',
        PERSONGETBYTMGID: 'person:getByTMGID',
        PERSONSAVE: 'person:save',
        PERSONCREATEKEY: 'person:createKey',
        PERSONUPDATETMGID: 'person:updateTMGID',
        PERSONGETITEMS: 'person:getItems',
        PERSONGETWITHITEMS: 'person:getWithItems'
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
    // Person Library synchronous IPC methods
    getPerson: (personKey) => {
        return ipcRenderer.sendSync('person:get', personKey);
    },
    getPersonByTMGID: (tmgid) => {
        return ipcRenderer.sendSync('person:getByTMGID', tmgid);
    },
    savePerson: (personData) => {
        return ipcRenderer.sendSync('person:save', JSON.stringify(personData));
    },
    createPersonKey: (personData) => {
        return ipcRenderer.sendSync('person:createKey', JSON.stringify(personData));
    },
    updatePersonTMGID: (personKey, tmgid) => {
        return ipcRenderer.sendSync('person:updateTMGID', JSON.stringify({ personKey, tmgid }));
    },
    getItemsForPerson: (personKey) => {
        return ipcRenderer.sendSync('person:getItems', personKey);
    },
    getPersonWithItems: (personKey) => {
        return ipcRenderer.sendSync('person:getWithItems', personKey);
    }
})

contextBridge.exposeInMainWorld('electronAPI', {
    validateDatabase: () => ipcRenderer.invoke('accessions:validate')
})
