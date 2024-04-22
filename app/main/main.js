import { app, BrowserWindow, dialog, ipcMain, shell, Menu } from 'electron';
import fs from 'fs';
import electron from 'electron';
import path from 'path';
import nconf from 'nconf';
import { AccessionClass } from '../main/utils/AccessionClass.js';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
autoUpdater.checkForUpdatesAndNotify();

import { fileURLToPath } from 'url'
import { dirname } from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('main.js __dirname is ' + __dirname);
// Setup nconf to use (in-order):
//   1. Command-line arguments
//   2. Environment variables
//   3. A file located at 'config/config.json'
//   4. Defaults in the object below
// The first in the list to have a value takes precedence
// Chosen values are stored to config/config.json

const configDir = app.getPath('userData')
const configFile = path.resolve(configDir, 'shoeboxConfig.json')
fs.stat(configDir, (error, stats) => {
  if (error) {
    if (error.code === 'ENOENT') {
      console.log(`Creating config directory. ${configDir}`)
      fs.mkdirSync(configDir)
    } else {
      console.error('Config directory error ' + error);
      return
    }
  } else {
    if (!stats.isDirectory()) {
      console.error(`${configDir} is not a directory!!!`)
      return
    }
  }
})
nconf.argv()
  .env()
  .file('user', configFile)
  .defaults({
    "controls": {
      "photoChecked": true,
      "tapeChecked": true,
      "videoChecked": true,
      "restrictChecked": false
    },
    "db": {
      "accessionsPath": path.resolve(__dirname, "../resource/accessions.json")
    },
    "ui": {
      "main": {
        "width": 800,
        "height": 600
      },
      "mediaPlayer": {
        "width": 400,
        "height": 300
      }
    }
  })
// if the accessionsPath is an xml file (old version) change to default
if (nconf.get('db:accessionsPath').includes('.xml')) {
  nconf.set('db:accessionsPath', path.resolve(__dirname, "../resource/accessions.json"));
  nconf.save('user');
  console.log('Changed accessionsPath to default');
}
process.on('warning', e => console.warn(e.stack));
process.on('uncaughtException - ', e => console.log('***** uncaughtException with error=', e))
let accessionClass = undefined
let mainWindow = null;
let helpWindow = null;
let mediaWindow = null;
let addMediaWindow = null;
let editCollectionWindow = null;
let editCollectionWindowType = 'create'; // create or delete selected in Edit menu

// tracks the renderer drop-down selection via 'items:collection' message
let showCollection = false

const createWindow = () => {
  // Create the browser window.
  mainWindow = newWindow('main', '../render/js/preload.js', false, true);
  mainWindow.loadFile(path.resolve(__dirname + '/../render/html/index.html'));

  mainWindow.on('close', (e) => {
    if (mainWindow) {
      saveWindowState(mainWindow, 'main');
    }
    if (accessionClass) {
      accessionClass.saveAccessions(); // persist the current accessions
      accessionClass = undefined;
    }
  }) // close

  // when the main window is destroyed, close the other windows too
  mainWindow.webContents.on('destroyed', () => {
    if (helpWindow) {
      helpWindow.close();
    }
    if (mediaWindow) {
      mediaWindow.close()
    }
    if (addMediaWindow) {
      addMediaWindow.close()
    }
    mainWindow = null
  }) // destroyed

  ipcMain.on('items:getList', (event, requestParams) => {
    let transformedObject = []
    let listObject = {}
    let selectedCollection = nconf.get('controls:selectedCollection')
    verifyAccessions();
    transformedObject = accessionClass.transformToHtml(requestParams.sort - 1)
    if (transformedObject) {
      listObject.tableBody = transformedObject.tableBody
      listObject.navHeader = transformedObject.navHeader
    } else {
      console.error('Error: transformedObject is undefined')
    }
    let colls = accessionClass.getCollections()
    showCollection = colls.length > 0
    if (showCollection
      && colls.find((collection) => collection.value === selectedCollection) === undefined) {
      selectedCollection = colls[0].value
      nconf.set('controls:selectedCollection', selectedCollection)
      nconf.save('user')
    }
    listObject.collections = colls;
    listObject.selectedCollection = selectedCollection
    listObject.accessionTitle = accessionClass.getTitle()
    listObject.photoChecked = nconf.get('controls:photoChecked')
    listObject.tapeChecked = nconf.get('controls:tapeChecked')
    listObject.videoChecked = nconf.get('controls:videoChecked')
    listObject.restrictChecked = nconf.get('controls:restrictChecked')
    event.sender.send('items:render', JSON.stringify(listObject))
    mainWindow.setMenu(createMenu()); // set the menu for the current window
  }) // items:getList

  ipcMain.on('item:getDetail', async (_, accession) => {
    // This fires when requesting any item from the left-hand list
    verifyAccessions();
    let itemView = accessionClass.getItemView(accession);
    if (itemView) {
      itemView.getViewObject((viewObject) => {
        if (itemView.getType() === 'photo') {
          mainWindow.send('item:detail', JSON.stringify(viewObject));
        } else {
          createMediaWindow(JSON.stringify(viewObject));
        }
      })
    };
  }) // item:getDetail

  ipcMain.on('items:collection', (_, controls) => {
    let itemsObject = JSON.parse(controls)
    nconf.set('controls:photoChecked', itemsObject.photoChecked)
    nconf.set('controls:tapeChecked', itemsObject.tapeChecked)
    nconf.set('controls:videoChecked', itemsObject.videoChecked)
    nconf.set('controls:restrictChecked', itemsObject.restrictChecked)
    nconf.set('controls:selectedCollection', itemsObject.selectedCollection)
    nconf.save('user')
  }) // items:collection

  // This is the message from the renderer to set/reset the collection of an item
  ipcMain.on('item:setCollection', (_, accession) => {
    verifyAccessions();
    accessionClass.toggleItemInCollection(nconf.get('controls:selectedCollection'), accession)
  }) // item:setCollection

  ipcMain.on('item:Play', (_, playString) => {
    // This fires when requesting AV for a filename attached to a photo
    const playObject = JSON.parse(playString)
    verifyAccessions();
    let itemView = accessionClass.getItemView(null, playObject.ref);
    if (itemView) {
      itemView.getViewObject((viewObject) => {
        if (itemView.getType() === 'photo') {
          mainWindow.send('item:detail', JSON.stringify(viewObject))
        } else {
          // console.log('audioPlay ' + playObject.ref + ' start ' + playObject.start + ' secs ' + playObject.startSeconds)
          viewObject.entry = {
            startSeconds: hmsToSeconds(playObject.start),
            durationSeconds: hmsToSeconds(playObject.duration)
          }
          createMediaWindow(JSON.stringify(viewObject));
        }
      })
    }
  }) // item:Play

  ipcMain.on('items:reload', (_, itemsString) => {
    // reload on main window causes a reload of accessions in case it changed.
    if (accessionClass) {
      accessionClass.saveAccessions();
    }
    accessionClass = undefined
  }) // items:reload

  ipcMain.on('show:Dialog', (_, queryType) => {
    showAddMediaDialog(queryType);
  }) // show:Dialog

  ipcMain.on('item:edit', (_, keyData) => {
    // This fires when requesting to edit an item
    let editObject = JSON.parse(keyData);
    let queryObject = {
      type: 'accession',
      directory: editObject.keyData.accession
    };
    createAddMediaWindow(JSON.stringify(queryObject));
  }) // item:Edit

  ipcMain.on('open:Website', () => {
    createTreeWindow();
  }) // open:Website
  
  ipcMain.on('add:Media', (_, mediaForm) => {
    let formJSON = JSON.parse(mediaForm)
    let title = formJSON.title
    let directoryPath = formJSON.updateFocus
    switch (formJSON.selectQuery) {
      case 'directory':
        (async () => {
          try {
            if (accessionClass) {
              accessionClass.saveAccessions(); // persist the current accessions
              accessionClass = undefined;
            }
            nconf.set('db:accessionsPath', path.resolve(directoryPath, "accessions.json"));
            nconf.save('user');
            accessionClass = new AccessionClass(nconf.get('db:accessionsPath'), title);
            await accessionClass.addMediaFiles(formJSON);
            // All media files added successfully
            addMediaWindow.close();
            resetAccessions();
          } catch (error) {
            // Handle any errors that occurred during media file addition
            console.error('Error adding media files:', error);
          }
        })();
        break;
      case 'collection':
        // collection is in formJSON.updateFocus
        verifyAccessions();
        accessionClass.updateCollection(formJSON);
        addMediaWindow.close();
        resetAccessions();
        break;
      case 'accession':
        // accession is in formJSON.accession
        verifyAccessions();
        accessionClass.updateAccession(formJSON);
        addMediaWindow.close();
        resetAccessions();
        break;
      default:
        console.error('AddMedia.addMedia Unknown selectQuery: ' + formJSON.selectQuery);
    }
  }) // add:media

  ipcMain.on('get:Collection', (_, collectionForm) => {
    let response = {}
    if (editCollectionWindowType === 'delete') {
      response.collectionlist = accessionClass.getCollections()
    } // else create and no content needed
    editCollectionWindow.send('show:collections', JSON.stringify(response));
  }) // get:Collection

  ipcMain.on('add:Collection', (_, formData) => {
    let formJSON = JSON.parse(formData)
    verifyAccessions();
    accessionClass.createCollection(formJSON.key, formJSON.title, formJSON.text)
    nconf.set('controls:selectedCollection', formJSON.key)
    nconf.save('user')
    editCollectionWindow.close()
    resetAccessions()
  }) // add:Collection

  ipcMain.on('delete:Collection', (_, formData) => {
    let formJSON = JSON.parse(formData)
    verifyAccessions();
    accessionClass.deleteCollection(formJSON.collection)
    editCollectionWindow.close()
    resetAccessions()
  }) // delete:Collection
}; // createWindow

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow()
}); // app.on('ready')

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); // app.on('window-all-closed')

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); // app.on('activate')

function createMenu() {
  const template = [
    {
      label: '&File',
      submenu: [
        {
          label: 'Choose &Accessions.json file',
          click: chooseAccessionsPath
        },
        (showCollection ? {
          label: 'E&xport Collection',
          click: buildCollection
        }
          : { type: 'separator' }),
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: '&Edit',
      submenu: [
        {
          label: 'Edit &Media',
          click: createAddMediaWindowShim
        },
        {
          label: 'C&reate Collection',
          click: createCollectionWindow
        },
        {
          label: 'De&lete Collection',
          click: deleteCollectionWindow
        }
      ]
    },
    {
      label: '&View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: '&Window',
      submenu: [
        {
          label: 'Family &Tree',
          click: createTreeWindow
        }
      ]
    },
    {
      label: '&Help',
      submenu: [
        {
          label: '&Info',
          click: createHelpWindow
        },
        { role: 'about' }
      ]
    }
  ];
  return Menu.buildFromTemplate(template);
} // createMenu

function createMinMenu() {
  const template = [
    {
    label: '&File',
    submenu: [
      { role: 'close' }
    ]},
    {
      label: '&Window',
      submenu: [
        {
          label: 'Family &Tree',
          click: createTreeWindow
        }
      ]
    }
  ];
  return Menu.buildFromTemplate(template);
} // createMinMenu

function hmsToSeconds(hms) {
  let a = hms.split(':')
  return parseInt(a[0]) * 3600 + parseInt(a[1]) * 60 + parseInt(a[2])
}

function chooseAccessionsPath() {
  dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'json', extensions: 'json' }],
    title: 'Select accessions.json file with "audio", "video", "photo" folders in the same folder.',
    defaultPath: nconf.get('db.accessionsPath'),
    properties: ['openFile']
  }).then(mediaDirectory => {
    if (!mediaDirectory.canceled) {
      resetAccessions(mediaDirectory.filePaths[0]);
    }
  }).catch((e) => {
    console.error('error in showOpenDialog: ', e);
  });
} // chooseAccessionsPath

function createMediaWindow(mediaInfo) {
  if (!mediaWindow) {
    mediaWindow = newWindow('mediaPlayer', '../render/js/mediaPreload.js', false, false);
    // mediaWindow.setMenu(createMinMenu(mediaWindow));
    mediaWindow.loadFile(path.resolve(__dirname + '/../render/html/media.html'));
    mediaWindow.once('ready-to-show', () => {
      mediaWindow.show()
      mediaWindow.send('mediaDisplay', mediaInfo)
    })
    mediaWindow.webContents.on('destroyed', () => {
      mediaWindow = null;
    })
    mediaWindow.on('close', (e) => {
      if (mediaWindow) {
        saveWindowState(mediaWindow, 'mediaPlayer');
      }
    })
  } else {
    // On Mac this may cause an unwanted focus change to the media window
    // if (!mediaWindow.isVisible() || !mediaWindow.isFocused()) {
    //  mediaWindow.show();
    // }
    mediaWindow.send('mediaDisplay', mediaInfo)
  }
} // createMediaWindow

function createAddMediaWindowShim(/* menu */) {
  createAddMediaWindow() // because the menu call parameter is the menu itself and breaks the call
} // createAddMediaWindowShim
function createAddMediaWindow(mediaInfo) {
  if (!addMediaWindow) {
    addMediaWindow = newWindow('addMedia', '../render/js/addmediaPreload.js', mainWindow, false);
    // addMediaWindow.setMenu(createMinMenu(addMediaWindow));
    addMediaWindow.loadFile(path.resolve(__dirname + '/../render/html/addmedia.html'));
    addMediaWindow.once('ready-to-show', () => {
      // mediaInfo is a stringified JSON object simulating a request to edit an accession
      // usually the result of a click on the edit media button 
      if (mediaInfo) {
        showAddMediaDialog(mediaInfo)
      }
      addMediaWindow.show();
    });

    addMediaWindow.on('closed', () => {
      addMediaWindow = null;
    });

    addMediaWindow.webContents.on('destroyed', () => {
      addMediaWindow = null;
    });
    addMediaWindow.on('close', (e) => {
      if (addMediaWindow) {
        saveWindowState(addMediaWindow, 'addMedia');
      }
    });
  } else {
    console.error('AddMediaWindow is already open!!');
  }
} // createAddMediaWindow

function createCollectionWindow() {
  editCollectionWindowType = 'create';
  createEditCollectionWindow();
} // createCollectionWindow
function deleteCollectionWindow() {
  editCollectionWindowType = 'delete';
  createEditCollectionWindow();
} // deleteCollectionWindow
function createEditCollectionWindow() {
  if (!editCollectionWindow) {
    editCollectionWindow = newWindow('editCollection', '../render/js/editCollectionPreload.js', mainWindow, false)
    // editCollectionWindow.setMenu(createMinMenu(editCollectionWindow));
    editCollectionWindow.loadFile(path.resolve(__dirname + '/../render/html/editCollection.html'));
    editCollectionWindow.once('ready-to-show', () => {
      editCollectionWindow.show();
    });

    editCollectionWindow.on('closed', () => {
      editCollectionWindow = null;
    });

    editCollectionWindow.webContents.on('destroyed', () => {
      editCollectionWindow = null;
    });
    editCollectionWindow.on('close', (e) => {
      if (editCollectionWindow) {
        saveWindowState(editCollectionWindow, 'editCollection');
      }
    });
  } else {
    console.error('editCollectionWindow is already open!!');
  }
} // createEditCollectionWindow

function saveWindowState(window, confname) {
  const windowBounds = window.getBounds();

  nconf.set(`ui:${confname}:width`,  windowBounds.width);
  nconf.set(`ui:${confname}:height`, windowBounds.height);
  nconf.set(`ui:${confname}:x`,      windowBounds.x);
  nconf.set(`ui:${confname}:y`,      windowBounds.y);

  let allDisplays = electron.screen.getAllDisplays();
  const currentDisplay = allDisplays.findIndex(display => {
    return windowBounds.x >= display.bounds.x &&
      windowBounds.x < display.bounds.x + display.bounds.width &&
      windowBounds.y >= display.bounds.y &&
      windowBounds.y < display.bounds.y + display.bounds.height;
  });

  nconf.set(`ui:${confname}:display`, currentDisplay);
  nconf.save('user');
} // saveWindowState

function newWindow(confname, preload, parentWindow, show) {
  let displayIndex = nconf.get('ui:addMedia:display');
  let allDisplays = electron.screen.getAllDisplays();
  let targetDisplay = allDisplays[displayIndex] || electron.screen.getPrimaryDisplay();
  let modalValue = parentWindow ? true : false;

  let windowBounds = {
    x: nconf.get(`ui:${confname}:x`) || targetDisplay.bounds.x,
    y: nconf.get(`ui:${confname}:y`) || targetDisplay.bounds.y,
    width: nconf.get(`ui:${confname}:width` || 400),
    height: nconf.get(`ui:${confname}:height` || 300)
  };

  const win = new BrowserWindow(
    {
      ...windowBounds,
      autoHideMenuBar: true,
      show: show,
      parent: parentWindow ? mainWindow : null,
      modal: modalValue,
      webPreferences: {
        webtools: true,
        preload: path.resolve(__dirname, preload),
        nodeIntegration: false,
        contextIsolation: true
      }
    }
  );
  // See https://github.com/electron/electron/issues/10388 for why this adjustment is needed.
  // If that bug is ever fixed, this code can be removed.
  win.once('move', () => {
    const windowBoundsShow = win.getBounds();
    const titleBarHeight = windowBoundsShow.y - windowBounds.y;
    const newY = windowBoundsShow.y - titleBarHeight - titleBarHeight;
    win.setPosition(windowBoundsShow.x, newY);
    // console.log('newWindow move ' + confname + ' newY=' + newY + ' winBy=' + windowBounds.y + ' y=' + windowBoundsShow.y + ' tbh=' + titleBarHeight);
  });
  return win;
} // newWindowParameters

// After changing the accessions file, the main window and views need to be reloaded
function resetAccessions(baseDirectory) {
  // a new baseDirectory means we save any changes and reset the accessionsPath
  if (baseDirectory) {
    if (accessionClass) {
      accessionClass.saveAccessions(); // persist the current accessions
      accessionClass = undefined;
    }
    nconf.set('db:accessionsPath', baseDirectory); // save the new accessionsPath
    nconf.save('user');
  } // else we just reload all views
  mediaWindow?.close();
  mainWindow.reload();
} // resetAccessions

// When accessionClass is not defined, create a new instance
function verifyAccessions() {
  if (!accessionClass) {
    accessionClass = new AccessionClass(nconf.get('db:accessionsPath'));
  }
} // verifyAccessions

function showAddMediaDialog(queryType) {
  let queryObject = JSON.parse(queryType);
  let response = {};
  response.selectQuery = queryObject.type; // reflect the query type in the response
  switch (queryObject.type) {
    case 'directory':
      // On Linux the dialog is not modal causing several problems
      dialog.showOpenDialog(addMediaWindow, {
        properties: ['openDirectory'],
        defaultPath: queryObject.directory
      }).then((result) => {
        if (!result.canceled) {
          response.value = result.filePaths[0];
          response.text = "Add Directory Media";
          addMediaWindow.send('showDirectory', JSON.stringify(response));
        }
      });
      break;
    case 'collection':
      verifyAccessions();
      let collection = accessionClass.getCollections()
        .find((collection) => collection.value === queryObject.directory);
      if (collection) {
        response.value = collection.value;
        response.text = collection.text;
      } else {
        response.value = queryObject.directory;
        response.text = 'Unknown Collection';
      }
      addMediaWindow.send('showDirectory', JSON.stringify(response));
      break;
    case 'accession':
      // This is similar to getting the detail of an item above
      verifyAccessions();
      let itemView = accessionClass.getItemView(queryObject.directory);
      if (itemView) {
        response = { ...response, ...itemView.getFormJSON() };
        response.value = queryObject.directory;
        response.text = 'Update One Accession';
        addMediaWindow.send('showDirectory', JSON.stringify(response));
      };
      break;
    default:
      console.error('AddMedia.showDialog Unknown queryType: ' + queryObject.type);
  }
} // showAddMediaDialog

async function buildCollection() {
  let selectedCollection = nconf.get('controls:selectedCollection')
  const sourceDir = path.dirname(nconf.get('db:accessionsPath'))
  let collectionDir = path.resolve(sourceDir, '../', selectedCollection)
  // Getting information for a directory
  fs.stat(collectionDir, (error, stats) => {
    if (error) {
      if (error.code === 'ENOENT') {
        console.log(`Creating Directory ${collectionDir} for collection ${selectedCollection}.`)
        fs.mkdirSync(collectionDir)
      } else {
        console.error('buildCollection Directory error ' + error);
        return
      }
    } else {
      if (!stats.isDirectory()) {
        console.error(`${collectionDir} is not a directory!!!`)
        return
      }
    }
    let commandsPath = path.resolve(collectionDir, 'commands')
    verifyAccessions();
    try {
      let commandsFile = accessionClass.getCommands(sourceDir, collectionDir, selectedCollection)
      fs.writeFileSync(commandsPath, commandsFile.split("\r\n").join("\n"))
      console.log(`Created ${commandsPath}`)
    }
    catch (error) {
      console.error('error creating commands - error - ' + error)
    }
    let accessionsPath = path.resolve(collectionDir, 'accessions.json')
    try {
      let accessionsFile = accessionClass.getAccessions(selectedCollection)
      fs.writeFileSync(accessionsPath, JSON.stringify(accessionsFile));
      console.log(`Created ${accessionsPath}`)
    }
    catch (error) {
      console.error('error creating accessions.json - error - ' + error)
    }
  });
} // buildCollection

function createHelpWindow() {
  if (!helpWindow) {
    helpWindow = new BrowserWindow({
      width: 800,
      height: 600,
      autoHideMenuBar: true,
    });
    helpWindow.setMenu(createMinMenu(helpWindow));
    helpWindow.loadFile(path.resolve(__dirname + '/../render/html/help.html'));
    helpWindow.webContents.on('destroyed', () => {
      helpWindow = null;
    });
  } else {
    if (!helpWindow.isVisible() || !helpWindow.isFocused()) {
      helpWindow.show();
    }
  }
} // createHelpWindow

// create a window to display the family tree website from SecondSite
function createTreeWindow() {
  verifyAccessions();
  let treeURL = accessionClass.getWebsite();
  shell.openExternal(treeURL);
} // createTreeWindow
