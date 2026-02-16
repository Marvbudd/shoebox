/**
 * Window Manager
 * 
 * Manages all application windows including creation, positioning, and state persistence
 */

import { BrowserWindow, shell } from 'electron';
import electron from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Check if a window reference is valid and not destroyed
 */
function isValidWindow(windowRef) {
  return windowRef && 
         windowRef.value && 
         typeof windowRef.value.isDestroyed === 'function' && 
         !windowRef.value.isDestroyed();
}

/**
 * Save window position and size to config
 */
export function saveWindowState(window, confname, nconf) {
  const windowBounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds();

  nconf.set(`ui:${confname}:width`,  windowBounds.width);
  nconf.set(`ui:${confname}:height`, windowBounds.height);
  nconf.set(`ui:${confname}:x`,      windowBounds.x);
  nconf.set(`ui:${confname}:y`,      windowBounds.y);
  nconf.set(`ui:${confname}:isMaximized`, window.isMaximized());

  let allDisplays = electron.screen.getAllDisplays();
  const currentDisplay = allDisplays.findIndex(display => {
    return windowBounds.x >= display.bounds.x &&
      windowBounds.x < display.bounds.x + display.bounds.width &&
      windowBounds.y >= display.bounds.y &&
      windowBounds.y < display.bounds.y + display.bounds.height;
  });

  nconf.set(`ui:${confname}:display`, currentDisplay);
  nconf.save('user');
}

/**
 * Create a new window with saved position/size
 */
export function newWindow(confname, preload, parentWindow, show, nconf) {
  let displayIndex = nconf.get(`ui:${confname}:display`);
  let allDisplays = electron.screen.getAllDisplays();
  let targetDisplay = allDisplays[displayIndex] || electron.screen.getPrimaryDisplay();
  let modalValue = parentWindow ? true : false;

  let savedX = nconf.get(`ui:${confname}:x`);
  let savedY = nconf.get(`ui:${confname}:y`);
  
  // Validate saved position is on target display
  let x = savedX;
  let y = savedY;
  
  if (savedX !== undefined && savedY !== undefined) {
    const isOnTargetDisplay = 
      savedX >= targetDisplay.bounds.x &&
      savedX < targetDisplay.bounds.x + targetDisplay.bounds.width &&
      savedY >= targetDisplay.bounds.y &&
      savedY < targetDisplay.bounds.y + targetDisplay.bounds.height;
    
    if (!isOnTargetDisplay) {
      x = targetDisplay.bounds.x + 100;
      y = targetDisplay.bounds.y + 100;
    }
  } else {
    x = targetDisplay.bounds.x + 100;
    y = targetDisplay.bounds.y + 100;
  }

  let windowBounds = {
    x: x,
    y: y,
    width: nconf.get(`ui:${confname}:width`) || 400,
    height: nconf.get(`ui:${confname}:height`) || 300
  };

  const mainWindow = parentWindow; // For parent reference
  const win = new BrowserWindow(
    {
      ...windowBounds,
      autoHideMenuBar: true,
      show: show,
      parent: parentWindow || null,
      modal: modalValue,
      webPreferences: {
        webtools: true,
        preload: path.resolve(__dirname, '..', preload),
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
  });
  
  return win;
}

/**
 * Create media player window
 */
export function createMediaWindow(mediaInfo, windowRef, nconf) {
  if (!windowRef.value) {
    windowRef.value = newWindow('mediaPlayer', '../render/vue/windows/MediaPlayer/preload.js', false, false, nconf);
    windowRef.value.loadFile(path.resolve(__dirname + '/../../render/vue-dist/mediaPlayer/index.html'));
    windowRef.value.once('ready-to-show', () => {
      windowRef.value.show()
      windowRef.value.send('mediaDisplay', mediaInfo)
    })
    windowRef.value.webContents.on('destroyed', () => {
      windowRef.value = null;
    })
    windowRef.value.on('close', (e) => {
      if (windowRef.value) {
        saveWindowState(windowRef.value, 'mediaPlayer', nconf);
      }
    })
  } else {
    if (isValidWindow(windowRef)) {
      windowRef.value.send('mediaDisplay', mediaInfo)
    }
  }
}

/**
 * Create person manager window
 */
export function createPersonManagerWindow(windowRef, nconf) {
  if (!windowRef.value) {
    let displayIndex = nconf.get('ui:personManager:display');
    let allDisplays = electron.screen.getAllDisplays();
    let targetDisplay = allDisplays[displayIndex] || electron.screen.getPrimaryDisplay();
    
    let savedX = nconf.get('ui:personManager:x');
    let savedY = nconf.get('ui:personManager:y');
    
    let x = savedX;
    let y = savedY;
    
    if (savedX !== undefined && savedY !== undefined) {
      const isOnTargetDisplay = 
        savedX >= targetDisplay.bounds.x &&
        savedX < targetDisplay.bounds.x + targetDisplay.bounds.width &&
        savedY >= targetDisplay.bounds.y &&
        savedY < targetDisplay.bounds.y + targetDisplay.bounds.height;
      
      if (!isOnTargetDisplay) {
        x = targetDisplay.bounds.x + 100;
        y = targetDisplay.bounds.y + 100;
      }
    } else {
      x = targetDisplay.bounds.x + 100;
      y = targetDisplay.bounds.y + 100;
    }
    
    let windowBounds = {
      x: x,
      y: y,
      width: nconf.get('ui:personManager:width') || 1000,
      height: nconf.get('ui:personManager:height') || 700
    };
    
    windowRef.value = new BrowserWindow({
      ...windowBounds,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: path.resolve(__dirname, '../../render/vue/windows/PersonManager/preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const vueDistPath = path.resolve(__dirname, '../../render/vue-dist/personManager/index.html');
    console.log('Loading Person Manager from:', vueDistPath);
    
    windowRef.value.loadFile(vueDistPath)
      .then(() => {
        windowRef.value.show();
        windowRef.value.focus();
      })
      .catch((err) => {
        console.error('Failed to load Person Manager:', err);
      });

    windowRef.value.on('close', () => {
      if (windowRef.value) {
        saveWindowState(windowRef.value, 'personManager', nconf);
      }
    });

    windowRef.value.on('closed', () => {
      console.log('Person Manager window closed');
      windowRef.value = null;
    });

    windowRef.value.webContents.on('destroyed', () => {
      windowRef.value = null;
    });
    
    windowRef.value.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Person Manager failed to load:', errorCode, errorDescription);
    });
  } else {
    if (isValidWindow(windowRef)) {
      windowRef.value.show();
      windowRef.value.focus();
    }
  }
}

/**
 * Create create accessions window
 */
export function createCreateAccessionsWindow(windowRef, nconf) {
  if (!windowRef.value) {
    let displayIndex = nconf.get('ui:createAccessions:display');
    let allDisplays = electron.screen.getAllDisplays();
    let targetDisplay = allDisplays[displayIndex] || electron.screen.getPrimaryDisplay();
    
    let savedX = nconf.get('ui:createAccessions:x');
    let savedY = nconf.get('ui:createAccessions:y');
    
    let x = savedX;
    let y = savedY;
    
    if (savedX !== undefined && savedY !== undefined) {
      const isOnTargetDisplay = 
        savedX >= targetDisplay.bounds.x &&
        savedX < targetDisplay.bounds.x + targetDisplay.bounds.width &&
        savedY >= targetDisplay.bounds.y &&
        savedY < targetDisplay.bounds.y + targetDisplay.bounds.height;
      
      if (!isOnTargetDisplay) {
        x = targetDisplay.bounds.x + 100;
        y = targetDisplay.bounds.y + 100;
      }
    } else {
      x = targetDisplay.bounds.x + 100;
      y = targetDisplay.bounds.y + 100;
    }
    
    let windowBounds = {
      x: x,
      y: y,
      width: nconf.get('ui:createAccessions:width') || 800,
      height: nconf.get('ui:createAccessions:height') || 700
    };
    
    windowRef.value = new BrowserWindow({
      ...windowBounds,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: path.resolve(__dirname, '../../render/vue/windows/CreateAccessions/preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const vueDistPath = path.resolve(__dirname, '../../render/vue-dist/createAccessions/index.html');
    
    windowRef.value.loadFile(vueDistPath)
      .then(() => {
        windowRef.value.show();
        windowRef.value.focus();
      })
      .catch((err) => {
        console.error('Failed to load Create Accessions:', err);
      });

    windowRef.value.on('close', () => {
      if (windowRef.value) {
        saveWindowState(windowRef.value, 'createAccessions', nconf);
      }
    });

    windowRef.value.on('closed', () => {
      windowRef.value = null;
    });

    windowRef.value.webContents.on('destroyed', () => {
      windowRef.value = null;
    });
  } else {
    if (isValidWindow(windowRef)) {
      windowRef.value.show();
      windowRef.value.focus();
    }
  }
}

/**
 * Create media manager window
 */
export function createMediaManagerWindow(identifier, queueData, windowRef, nconf) {
  if (!windowRef.value) {
    let displayIndex = nconf.get('ui:mediaManager:display');
    let allDisplays = electron.screen.getAllDisplays();
    let targetDisplay = allDisplays[displayIndex] || electron.screen.getPrimaryDisplay();
    
    let savedX = nconf.get('ui:mediaManager:x');
    let savedY = nconf.get('ui:mediaManager:y');
    
    let x = savedX;
    let y = savedY;
    
    if (savedX !== undefined && savedY !== undefined) {
      const isOnTargetDisplay = 
        savedX >= targetDisplay.bounds.x &&
        savedX < targetDisplay.bounds.x + targetDisplay.bounds.width &&
        savedY >= targetDisplay.bounds.y &&
        savedY < targetDisplay.bounds.y + targetDisplay.bounds.height;
      
      if (!isOnTargetDisplay) {
        x = targetDisplay.bounds.x + 100;
        y = targetDisplay.bounds.y + 100;
      }
    } else {
      x = targetDisplay.bounds.x + 100;
      y = targetDisplay.bounds.y + 100;
    }
    
    let windowBounds = {
      x: x,
      y: y,
      width: nconf.get('ui:mediaManager:width') || 1000,
      height: nconf.get('ui:mediaManager:height') || 800
    };
    
    windowRef.value = new BrowserWindow({
      ...windowBounds,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: path.resolve(__dirname, '../../render/vue/windows/MediaManager/preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const vueDistPath = path.resolve(__dirname, '../../render/vue-dist/mediaManager/index.html');
    
    const shouldMaximize = nconf.get('ui:mediaManager:isMaximized');

    // Position adjustment fix for Electron bug https://github.com/electron/electron/issues/10388
    const initialBounds = windowRef.value.getBounds();
    windowRef.value.once('move', () => {
      const windowBoundsShow = windowRef.value.getBounds();
      const titleBarHeight = windowBoundsShow.y - initialBounds.y;
      const newY = windowBoundsShow.y - titleBarHeight - titleBarHeight;
      windowRef.value.setPosition(windowBoundsShow.x, newY);
    });

    // Build URL params
    let searchParams = `link=${encodeURIComponent(identifier)}`;
    if (queueData) {
      searchParams += `&queue=${encodeURIComponent(JSON.stringify(queueData))}`;
    }

    windowRef.value.loadFile(vueDistPath, { search: searchParams })
      .then(() => {
        windowRef.value.show();
        if (shouldMaximize) {
          windowRef.value.maximize();
        }
        windowRef.value.focus();
      })
      .catch((err) => {
        console.error('Failed to load Media Manager:', err);
      });

    let windowStateSaved = false;
    
    windowRef.value.on('close', () => {
      if (windowRef.value && !windowStateSaved) {
        saveWindowState(windowRef.value, 'mediaManager', nconf);
        windowStateSaved = true;
      }
    });

    windowRef.value.on('closed', () => {
      windowRef.value = null;
    });

    windowRef.value.webContents.on('destroyed', () => {
      // Don't null out reference here - let 'closed' event handle it
      // This prevents race condition where windowRef becomes null before close event completes
    });
  } else {
    if (isValidWindow(windowRef)) {
      windowRef.value.show();
      windowRef.value.focus();
      
      // If an identifier is provided, send it to the window with queue data
      if (identifier && windowRef.value.webContents) {
        // Give the window a moment to be ready for interaction
        setTimeout(() => {
          if (windowRef.value && !windowRef.value.isDestroyed()) {
            windowRef.value.webContents.send('item:load', identifier, queueData);
          }
        }, 100);
      }
    }
  }
}

/**
 * Create update collection window
 */
export function createUpdateCollectionWindow(windowRef, nconf) {
  if (!windowRef.value) {
    let displayIndex = nconf.get('ui:updateCollection:display');
    let allDisplays = electron.screen.getAllDisplays();
    let targetDisplay = allDisplays[displayIndex] || electron.screen.getPrimaryDisplay();
    
    let savedX = nconf.get('ui:updateCollection:x');
    let savedY = nconf.get('ui:updateCollection:y');
    
    let x = savedX;
    let y = savedY;
    
    if (savedX !== undefined && savedY !== undefined) {
      const isOnTargetDisplay = 
        savedX >= targetDisplay.bounds.x &&
        savedX < targetDisplay.bounds.x + targetDisplay.bounds.width &&
        savedY >= targetDisplay.bounds.y &&
        savedY < targetDisplay.bounds.y + targetDisplay.bounds.height;
      
      if (!isOnTargetDisplay) {
        x = targetDisplay.bounds.x + 100;
        y = targetDisplay.bounds.y + 100;
      }
    } else {
      x = targetDisplay.bounds.x + 100;
      y = targetDisplay.bounds.y + 100;
    }
    
    let windowBounds = {
      x: x,
      y: y,
      width: nconf.get('ui:updateCollection:width') || 800,
      height: nconf.get('ui:updateCollection:height') || 700
    };
    
    windowRef.value = new BrowserWindow({
      ...windowBounds,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: path.resolve(__dirname, '../../render/vue/windows/UpdateCollection/preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const vueDistPath = path.resolve(__dirname, '../../render/vue-dist/updateCollection/index.html');
    
    windowRef.value.loadFile(vueDistPath)
      .then(() => {
        windowRef.value.show();
        windowRef.value.focus();
      })
      .catch((err) => {
        console.error('Failed to load Update Collection:', err);
      });

    windowRef.value.on('close', () => {
      if (windowRef.value) {
        saveWindowState(windowRef.value, 'updateCollection', nconf);
      }
    });

    windowRef.value.on('closed', () => {
      windowRef.value = null;
    });

    windowRef.value.webContents.on('destroyed', () => {
      windowRef.value = null;
    });
  } else {
    if (isValidWindow(windowRef)) {
      windowRef.value.show();
      windowRef.value.focus();
    }
  }
}

/**
 * Create collection set operations window
 */
export function createCollectionSetOperationsWindow(operation, targetCollection, windowRef, nconf) {
  console.log('Creating Collection Set Operations window...', { operation, targetCollection });
  if (!windowRef.value) {
    let displayIndex = nconf.get('ui:collectionSetOperations:display');
    let allDisplays = electron.screen.getAllDisplays();
    let targetDisplay = allDisplays[displayIndex] || electron.screen.getPrimaryDisplay();
    
    let windowBounds = {
      x: nconf.get('ui:collectionSetOperations:x') || targetDisplay.bounds.x + 100,
      y: nconf.get('ui:collectionSetOperations:y') || targetDisplay.bounds.y + 100,
      width: nconf.get('ui:collectionSetOperations:width') || 700,
      height: nconf.get('ui:collectionSetOperations:height') || 600
    };
    
    windowRef.value = new BrowserWindow({
      ...windowBounds,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: path.resolve(__dirname, '../../render/vue/windows/CollectionSetOperations/preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Build URL with query parameters for operation and target collection
    const vueDistPath = path.resolve(__dirname, '../../render/vue-dist/collectionSetOperations/index.html');
    const queryParams = new URLSearchParams({
      operation,
      targetCollection
    });
    const urlWithParams = `file://${vueDistPath}?${queryParams.toString()}`;
    
    console.log('Loading Collection Set Operations from:', urlWithParams);
    
    windowRef.value.loadURL(urlWithParams)
      .then(() => {
        windowRef.value.show();
        windowRef.value.focus();
      })
      .catch((err) => {
        console.error('Failed to load Collection Set Operations:', err);
      });

    windowRef.value.on('close', () => {
      if (windowRef.value) {
        saveWindowState(windowRef.value, 'collectionSetOperations', nconf);
      }
    });

    windowRef.value.on('closed', () => {
      windowRef.value = null;
    });

    windowRef.value.webContents.on('destroyed', () => {
      windowRef.value = null;
    });
  } else {
    if (isValidWindow(windowRef)) {
      windowRef.value.show();
      windowRef.value.focus();
    }
  }
}

/**
 * Create collection manager window
 */
export function createCollectionManagerWindow(mode, windowRef, modeRef, nconf) {
  modeRef.value = mode;
  if (!windowRef.value) {
    let displayIndex = nconf.get('ui:collectionManager:display');
    let allDisplays = electron.screen.getAllDisplays();
    let targetDisplay = allDisplays[displayIndex] || electron.screen.getPrimaryDisplay();
    
    let savedX = nconf.get('ui:collectionManager:x');
    let savedY = nconf.get('ui:collectionManager:y');
    
    let x = savedX;
    let y = savedY;
    
    if (savedX !== undefined && savedY !== undefined) {
      const isOnTargetDisplay = 
        savedX >= targetDisplay.bounds.x &&
        savedX < targetDisplay.bounds.x + targetDisplay.bounds.width &&
        savedY >= targetDisplay.bounds.y &&
        savedY < targetDisplay.bounds.y + targetDisplay.bounds.height;
      
      if (!isOnTargetDisplay) {
        x = targetDisplay.bounds.x + 100;
        y = targetDisplay.bounds.y + 100;
      }
    } else {
      x = targetDisplay.bounds.x + 100;
      y = targetDisplay.bounds.y + 100;
    }
    
    let windowBounds = {
      x: x,
      y: y,
      width: nconf.get('ui:collectionManager:width') || 600,
      height: nconf.get('ui:collectionManager:height') || 500
    };
    
    windowRef.value = new BrowserWindow({
      ...windowBounds,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: path.resolve(__dirname, '../../render/vue/windows/CollectionManager/preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const vueDistPath = path.resolve(__dirname, '../../render/vue-dist/collectionManager/index.html');
    
    windowRef.value.loadFile(vueDistPath)
      .then(() => {
        windowRef.value.show();
        windowRef.value.focus();
      })
      .catch((err) => {
        console.error('Failed to load Collection Manager:', err);
      });

    windowRef.value.on('close', () => {
      if (windowRef.value) {
        saveWindowState(windowRef.value, 'collectionManager', nconf);
      }
    });

    windowRef.value.on('closed', () => {
      windowRef.value = null;
    });

    windowRef.value.webContents.on('destroyed', () => {
      windowRef.value = null;
    });
  } else {
    if (isValidWindow(windowRef)) {
      windowRef.value.show();
      windowRef.value.focus();
    }
  }
}

/**
 * Open family tree website
 */
export function createTreeWindow(accessionClass) {
  let treeURL = accessionClass.getWebsite();
  shell.openExternal(treeURL);
}

/**
 * Show accessions file picker dialog
 */
export function chooseAccessionsPath(dialog, mainWindow, resetAccessions, nconf) {
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
}
