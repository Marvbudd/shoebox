const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require( 'electron' )
const path = require( 'path' );
const nconf = require( 'nconf' );
import url from 'url'
import * as fs from 'fs';
import { showNodeDescription } from '../main/utils/detailView.js'
import { AccessionClass } from '../main/utils/AccessionClass.js'
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
      console.log('Config directory error ' + error);
      return
    }
  } else {
    if (!stats.isDirectory()) {
      console.log(`${configDir} is not a directory!!!`)
      return
    }
  }
})
nconf.argv()
  .env()
  .file( 'user', configFile )
  .defaults( {
    "media": {
      "photo": path.resolve(__dirname, "../resource/photo"),
      "tape":  path.resolve(__dirname, "../resource/audio"),
      "video": path.resolve(__dirname, "../resource/video")
    },
    "controls": {
      "photoChecked": true,
      "tapeChecked": true,
      "videoChecked": true,
      "categoryDisplay": false
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
process.on('warning', e => console.warn(e.stack));
process.on('uncaughtException - ', e => console.log('***** uncaughtException with error=', e) )
let accessionClass = undefined
let mainWindow = null;
let helpWindow = null;
let mediaWindow = null;
// tracks the renderer drop-down selection via 'items:category' message
let selectedCategory = ''

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: nconf.get('ui:main:width'),
    height: nconf.get('ui:main:height'),
    autoHideMenuBar: true,
    preloadWindow: true,
    webPreferences: {
      webtools: true,
      preload: path.resolve(__dirname, '../render/js/preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  // and load the index.html of the app.
  mainWindow.loadFile( path.resolve(__dirname + '/../render/html/index.html') );
  mainWindow.on('close', (e) => {
    if (mainWindow) {
      const mainWindowSize = mainWindow.getSize()
      nconf.set('ui:main:width', mainWindowSize[0])
      nconf.set('ui:main:height', mainWindowSize[1])
    }
  })
  mainWindow.webContents.on('destroyed', () => {
    if (helpWindow) {
      helpWindow.close();
    }
    if (mediaWindow) {
      mediaWindow.close()
    }
    nconf.save( 'user' )
    mainWindow = null
  })
  ipcMain.on('items:getList', (event, requestParams) => {
    // console.log('items:getList received in main type=', requestParams)
    if (!accessionClass) {
      accessionClass = new AccessionClass( nconf.get('db:accessionsPath') )
    }
    let transformedObject = [ ]
    let listObject = {}
    transformedObject = accessionClass.transformToHtml(requestParams.sort - 1, selectedCategory)
    listObject.tableBody = transformedObject.tableBody
    listObject.navHeader = transformedObject.navHeader
    listObject.categories = accessionClass.getCategories()
    listObject.accessionTitle = accessionClass.getTitle()
    nconf.set('controls:categoryDisplay', listObject.categories.length > 0)
    nconf.save( 'user' )
    listObject.selectedCategory = selectedCategory // tracks the previous category selection
    listObject.photoChecked = nconf.get('controls:photoChecked')
    listObject.tapeChecked = nconf.get('controls:tapeChecked')
    listObject.videoChecked = nconf.get('controls:videoChecked')
    listObject.categoryDisplay = nconf.get('controls:categoryDisplay')
    event.sender.send('items:render', JSON.stringify(listObject))
    createMenu() // update the menu to show/hide the category build option
  })

  ipcMain.on('item:getDetail', (event, requestNum) => {
    // This fires when requesting any item from the left-hand list
    if (!accessionClass) {
      accessionClass = new AccessionClass( nconf.get('db:accessionsPath') )
    }
    accessionClass.getJSONItem( requestNum, (itemObject) => {
      if (itemObject) {
        let resObject = {
          link: itemObject.link
        }
        if (itemObject.type == 'photo') {
          const mediaPath = path.resolve( nconf.get('media:photo'), itemObject.link )
          fs.readFile(mediaPath, (err, data) => {
            // TODO could I resize the photos to an appropriate size to avoid large transfers?
            // See https://www.npmjs.com/package/sharp picture processing library from the task manager project
            // https://www.quora.com/How-do-I-embed-images-into-HTML?share=1
            // https://www.base64encoder.io/node-js/
            if (err) {
              resObject.imgTag = 'An error occurred reading the photo. ' + err
            } else {
              // itemObject.mediaTag = '<img id="previewImg" src="' + mediaPath + '" >'
              const imgEncoded = data.toString('base64');
              resObject.mediaTag = `<a target="_blank" href="${mediaPath}"><img id="previewImg" alt="The Photo" src="data:image/jpg;base64,${imgEncoded}" /></a>`
            }
            resObject.descDetail = showNodeDescription(itemObject)
            if (mainWindow) {
              mainWindow.send('item:detail', JSON.stringify(resObject))
            }
          });
        } else
        if (itemObject.type == 'tape') {
          const mediaPath = path.resolve( nconf.get('media:tape'), itemObject.link )
          resObject.mediaTag = `<audio id="previewAudio" alt="The Audio" controls><source src="${mediaPath}" type="audio/mp3" /></audio>`
          itemObject.reflist = accessionClass.getJSONReferencesForLink(itemObject.link)
          resObject.descDetail = showNodeDescription(itemObject)
          createMediaWindow(JSON.stringify(resObject));
        } else
        if (itemObject.type == 'video') {
          const mediaPath = path.resolve( nconf.get('media:video'), itemObject.link )
          resObject.mediaTag = `<video id="previewVideo" alt="The Video" controls><source src="${mediaPath}" type="video/mp4" /></video>`
          itemObject.reflist = accessionClass.getJSONReferencesForLink(itemObject.link)
          resObject.descDetail = showNodeDescription(itemObject)
          createMediaWindow(JSON.stringify(resObject))
        }  
      }
    })
  })
  ipcMain.on('items:category', (event, category) => {
    selectedCategory = category
  })
  ipcMain.on('item:Play', (event, playString) => {
    // This fires when requesting AV for a filename attached to a photo
    const playObject = JSON.parse(playString)
    accessionClass.getJSONForLink( playObject.ref, (itemObject) => {
      if (itemObject) {
        let resObject = {
          link: itemObject.link
        }
        if (itemObject.type == 'photo') {
          const mediaPath = path.resolve( nconf.get('media:photo'), itemObject.link )
          // console.log('photoPlay ' + playObject.ref + ' start ' + playObject.start + ' secs ' + playObject.startSeconds)
          fs.readFile(mediaPath, (err, data) => {
            if (err) {
              resObject.imgTag = 'An error occurred reading the photo. ' + err
            } else {
              // playObject.mediaTag = '<img id="previewImg" src="' + mediaPath + '" >'
              resObject.mediaTag = `<img id="previewImg" alt="The Photo" src="data:image/jpg;base64,${data.toString('base64')}" />`
            }
            resObject.descDetail = showNodeDescription(itemObject)
            mainWindow.send('item:detail', JSON.stringify(resObject))
          });
        } else
        if (itemObject.type == 'tape') {
          const mediaPath = path.resolve( nconf.get('media:tape'), itemObject.link )
          // console.log('audioPlay ' + playObject.ref + ' start ' + playObject.start + ' secs ' + playObject.startSeconds)
          playObject.startSeconds = hmsToSeconds( playObject.start )
          playObject.durationSeconds = hmsToSeconds( playObject.duration )
          resObject.mediaTag = `<audio id="previewAudio" alt="The Audio" controls><source src="${mediaPath}" type="audio/mp3" /></audio>`
          itemObject.reflist = accessionClass.getJSONReferencesForLink(itemObject.link)
          resObject.descDetail = showNodeDescription(itemObject)
          resObject.entry = playObject
          createMediaWindow(JSON.stringify(resObject));
        } else
        if (itemObject.type == 'video') {
          const mediaPath = path.resolve( nconf.get('media:video'), itemObject.link )
          // console.log('videoPlay ' + playObject.ref + ' start ' + playObject.start + ' secs ' + playObject.startSeconds)
          playObject.startSeconds = hmsToSeconds( playObject.start )
          playObject.durationSeconds = hmsToSeconds( playObject.duration )
          resObject.mediaTag = `<video id="previewVideo" alt="The Video" controls><source src="${mediaPath}" type="video/mp4" /></video>`
          itemObject.reflist = accessionClass.getJSONReferencesForLink(itemObject.link)
          resObject.descDetail = showNodeDescription(itemObject)
          resObject.entry = playObject
          createMediaWindow(JSON.stringify(resObject))
        }  
      }
    })
  })
  ipcMain.on('items:reload', (event, itemsString) => {
    // reload on main window causes a reload of accessions in case it changed.
    accessionClass = undefined
    let itemsObject = JSON.parse(itemsString)
    nconf.set( 'controls:photoChecked', itemsObject.photoChecked)
    nconf.set( 'controls:tapeChecked', itemsObject.tapeChecked)
    nconf.set( 'controls:videoChecked', itemsObject.videoChecked)
    nconf.save( 'user' )
  })
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow()
  createMenu();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function createMenu() {
  const isCategory = nconf.get('controls:categoryDisplay');
  const template = [
    {
      label: '&File',
      submenu: [
        {
          label: 'Choose &Accessions.json file',
          click: chooseAccessionsPath
        },
        (isCategory ? {
          label: '&Build Category',
          click: buildCategory
        }
          : { type: 'separator' }),
        { role: 'quit' }
      ],
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
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function hmsToSeconds( hms ) {
  let a = hms.split(':')
  return parseInt(a[0]) * 3600 + parseInt(a[1]) * 60 + parseInt(a[2])
}

function chooseAccessionsPath() {
  dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'json', extensions: 'json' }],
    title: 'Select accessions.json file with "audio", "video", "photo" folders in same folder.',
    defaultPath: nconf.get('db.accessionsPath'),
    // properties: ['openDirectory', 'createDirectory']
  }).then(mediaDirectory => {
    if (!mediaDirectory.canceled) {
      let baseDirectory = mediaDirectory.filePaths[0];
      const pathParse = path.parse(baseDirectory).dir;
      // remove the subdirectories from the end if there
      // if ( ['photo', 'audio', 'video'].includes(pathParse.base) ) {
      //   baseDirectory = pathParse.dir
      // }
      nconf.set('db:accessionsPath', baseDirectory);
      nconf.set('media:photo', path.resolve(pathParse, 'photo'));
      nconf.set('media:tape', path.resolve(pathParse, 'audio'));
      nconf.set('media:video', path.resolve(pathParse, 'video'));
      nconf.save('user');
      accessionClass = undefined
      mainWindow.loadFile(path.resolve(__dirname + '/../render/html/index.html'));
  }
  }).catch((e) => {
    console.log('error in showOpenDialog: ', e);
  });
}

function createHelpWindow() {
  if (!helpWindow) {
    helpWindow = new BrowserWindow({
      width: 800,
      height: 600,
      autoHideMenuBar: true,
    });
    helpWindow.loadFile( path.resolve( __dirname + '/../render/html/help.html') );
    helpWindow.webContents.on('destroyed', () => {
      helpWindow = null;
    });
  } else {
    if (!helpWindow.isVisible() || !helpWindow.isFocused()) {
      helpWindow.show();
    }
  }
}

function createMediaWindow( mediaInfo ) {
  if (!mediaWindow) {
    mediaWindow = new BrowserWindow({
      width:  nconf.get('ui:mediaPlayer:width'),
      height: nconf.get('ui:mediaPlayer:height'),
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        webtools: true,
        preload: path.resolve(__dirname, '../render/js/mediaPreload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    mediaWindow.loadFile( path.resolve(__dirname + '/../render/html/media.html') );
    // Open the DevTools.
    // mediaWindow.webContents.openDevTools();
    mediaWindow.once('ready-to-show', () => {
      mediaWindow.show()
      mediaWindow.send('mediaDisplay', mediaInfo)
    })
    mediaWindow.webContents.on('destroyed', () => {
      mediaWindow = null;
    })
    mediaWindow.on('close', (e) => {
      if (mediaWindow) {
        const mediaWindowSize = mediaWindow.getSize()
        nconf.set('ui:mediaPlayer:width', mediaWindowSize[0])
        nconf.set('ui:mediaPlayer:height', mediaWindowSize[1])
      }
    })
  } else {
    // On Mac this may cause an unwanted focus change to the media window
    // if (!mediaWindow.isVisible() || !mediaWindow.isFocused()) {
    //  mediaWindow.show();
    // }
    mediaWindow.send('mediaDisplay', mediaInfo)
  }
}

async function buildCategory() {
  let categoryDir = path.resolve( path.dirname( nconf.get('db:accessionsPath') ), '../', selectedCategory )
  // Getting information for a directory
  fs.stat(categoryDir, (error, stats) => {
    if (error) {
      if (error.code === 'ENOENT') {
        console.log(`Creating Directory ${categoryDir} for category ${selectedCategory}.`)
        fs.mkdirSync(categoryDir)  
      } else {
        console.log('buildCategory Directory error ' + error);
        return
      }
    } else {
      if (!stats.isDirectory()) {
        console.log(`${categoryDir} is not a directory!!!`)
        return
      }
    }
    if (!accessionClass) {
      accessionClass = new AccessionClass( nconf.get('db:accessionsPath') )
    }
    let commandsPath = path.resolve( categoryDir, 'commands')
    try {
      const sourceDir= path.dirname( nconf.get('db:accessionsPath') )
      let commandsFile = accessionClass.getCommands(sourceDir, categoryDir, selectedCategory)
      fs.writeFileSync( commandsPath, commandsFile.split("\r\n").join("\n") )
      console.log(`Created ${commandsPath}`)
    }
    catch (error) {
      console.log('error creating commands - error - ' + error)
    }
    let accessionsPath = path.resolve( categoryDir, 'accessions.json')
    try {
      let accessionsFile = accessionClass.getAccessions(selectedCategory)
      fs.writeFileSync(accessionsPath, JSON.stringify(accessionsFile));
      console.log(`Created ${accessionsPath}`)
    }
    catch (error) {
      console.log('error creating accessions.json - error - ' + error)
    }
  });
}

// create a window to display the family tree website from SecondSite
function createTreeWindow() {
  let treeURL = url.pathToFileURL( path.resolve( path.dirname( nconf.get('db:accessionsPath') ), 'website', 'index.htm' ) ).href
  shell.openExternal( treeURL );
}
