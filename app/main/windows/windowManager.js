/**
 * Window Manager
 * 
 * Manages all application windows including creation, positioning, and state persistence
 */

import { BrowserWindow, shell } from 'electron';
import electron from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STRICT_DISPLAY_CHECKS = process.env.SHOEBOX_STRICT_DISPLAY_CHECKS === '1';
let hasWarnedDisplayFallback = false;

/**
 * Check if a window reference is valid and not destroyed
 */
function isValidWindow(windowRef) {
  return windowRef && 
         typeof windowRef.value.isDestroyed === 'function' && 
         !windowRef.value.isDestroyed();
}

function getAllDisplaysSafe(context = 'windowManager') {
  const screenApi = electron?.screen;
  const hasGetAllDisplays = typeof screenApi?.getAllDisplays === 'function';
  const hasGetPrimaryDisplay = typeof screenApi?.getPrimaryDisplay === 'function';

  if (!hasGetAllDisplays || !hasGetPrimaryDisplay) {
    throw new Error(`[WindowManager] Invalid Electron screen API in ${context}: expected getAllDisplays() and getPrimaryDisplay()`);
  }

  const displays = screenApi.getAllDisplays();
  if (Array.isArray(displays) && displays.length > 0) {
    return displays;
  }

  const message = `[WindowManager] getAllDisplays() returned no displays in ${context}. Falling back to primary display.`;
  if (!hasWarnedDisplayFallback) {
    console.error(message);
    hasWarnedDisplayFallback = true;
  }

  if (STRICT_DISPLAY_CHECKS) {
    throw new Error(`[WindowManager] Strict display checks enabled. ${message}`);
  }

  return [screenApi.getPrimaryDisplay()];
}

function resolveTargetDisplay(confname, nconf, context = 'windowManager') {
  const displays = getAllDisplaysSafe(context);
  const primaryDisplay = electron.screen.getPrimaryDisplay();
  const savedDisplayId = nconf.get(`ui:${confname}:displayId`);

  if (savedDisplayId !== undefined && savedDisplayId !== null) {
    const byId = displays.find(display => display.id === savedDisplayId);
    if (byId) {
      return byId;
    }
  }

  // Backward compatibility with legacy index-based persistence.
  const legacyIndex = nconf.get(`ui:${confname}:display`);
  if (Number.isInteger(legacyIndex) && legacyIndex >= 0 && legacyIndex < displays.length) {
    return displays[legacyIndex];
  }

  return primaryDisplay;
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function getSafeWindowBounds(confname, nconf, targetDisplay, defaults = {}) {
  const bounds = targetDisplay.bounds || { x: 0, y: 0, width: 1920, height: 1080 };
  const workArea = targetDisplay.workArea || bounds;

  const defaultWidth = defaults.width || 800;
  const defaultHeight = defaults.height || 600;
  const minWidth = defaults.minWidth || 300;
  const minHeight = defaults.minHeight || 200;

  const savedX = nconf.get(`ui:${confname}:x`);
  const savedY = nconf.get(`ui:${confname}:y`);
  const savedWidth = nconf.get(`ui:${confname}:width`);
  const savedHeight = nconf.get(`ui:${confname}:height`);

  const width = clampNumber(
    Number.isFinite(savedWidth) ? savedWidth : defaultWidth,
    minWidth,
    Math.max(minWidth, bounds.width)
  );

  const height = clampNumber(
    Number.isFinite(savedHeight) ? savedHeight : defaultHeight,
    minHeight,
    Math.max(minHeight, bounds.height)
  );

  let x;
  let y;

  if (Number.isFinite(savedX) && Number.isFinite(savedY)) {
    // Check if saved position is on or near the target display
    const isOnTargetDisplay =
      savedX >= bounds.x - 50 &&
      savedX < bounds.x + bounds.width - 50 &&
      savedY >= bounds.y - 20 &&
      savedY < bounds.y + bounds.height - 50;

    if (isOnTargetDisplay) {
      x = savedX;
      y = savedY;
    } else {
      x = workArea.x + 100;
      y = workArea.y + 100;
    }
  } else {
    // First run fallback: 100px inset from target display workArea (safe from dock/top bar)
    x = workArea.x + 100;
    y = workArea.y + 100;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height)
  };
}

function applyWindowsTitleBarPositionWorkaround(window, initialBounds) {
  if (process.platform !== 'win32') {
    return;
  }

  // See https://github.com/electron/electron/issues/10388 for why this adjustment is needed.
  // If that bug is ever fixed, this code can be removed.
  window.once('move', () => {
    const windowBounds = window.getBounds();
    const titleBarHeight = windowBounds.y - initialBounds.y;
    const newY = windowBounds.y - titleBarHeight - titleBarHeight;
    window.setPosition(windowBounds.x, newY);
  });
}

function createPersistedWindow(confname, nconf, defaults, options = {}) {
  const targetDisplay = resolveTargetDisplay(confname, nconf, `createPersistedWindow(${confname})`);
  const initialBounds = getSafeWindowBounds(confname, nconf, targetDisplay, defaults);
  const window = new BrowserWindow({
    ...initialBounds,
    autoHideMenuBar: true,
    ...options
  });

  applyWindowsTitleBarPositionWorkaround(window, initialBounds);

  return window;
}

/**
 * Save window position and size to config
 */
export function saveWindowState(window, confname, nconf) {
  const windowBounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds();
  const allDisplays = getAllDisplaysSafe(`saveWindowState(${confname})`);
  const matchingDisplay = electron.screen.getDisplayMatching(windowBounds);

  nconf.set(`ui:${confname}:width`,  windowBounds.width);
  nconf.set(`ui:${confname}:height`, windowBounds.height);
  nconf.set(`ui:${confname}:x`,      windowBounds.x);
  nconf.set(`ui:${confname}:y`,      windowBounds.y);
  nconf.set(`ui:${confname}:isMaximized`, window.isMaximized());

  const currentDisplay = allDisplays.findIndex(display => {
    return windowBounds.x >= display.bounds.x &&
      windowBounds.x < display.bounds.x + display.bounds.width &&
      windowBounds.y >= display.bounds.y &&
      windowBounds.y < display.bounds.y + display.bounds.height;
  });

  nconf.set(`ui:${confname}:displayId`, matchingDisplay?.id ?? null);
  nconf.set(`ui:${confname}:display`, currentDisplay);
  nconf.save('user');
}

/**
 * Create a new window with saved position/size
 */
export function newWindow(confname, preload, parentWindow, show, nconf) {
  return createPersistedWindow(confname, nconf, {
    width: 400,
    height: 300,
    minWidth: 300,
    minHeight: 200
  }, {
    show,
    parent: parentWindow || null,
    modal: Boolean(parentWindow),
    webPreferences: {
      webtools: true,
      preload: path.resolve(__dirname, '..', preload),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
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
    windowRef.value = createPersistedWindow('personManager', nconf, {
      width: 1000,
      height: 700,
      minWidth: 800,
      minHeight: 600
    }, {
      show: false,
      webPreferences: {
        preload: path.resolve(__dirname, '../../render/vue/windows/PersonManager/preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const vueDistPath = path.resolve(__dirname, '../../render/vue-dist/personManager/index.html');
    
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
      if (windowRef.value.webContents && !windowRef.value.webContents.isLoading()) {
        windowRef.value.webContents.send('personManager:focusSearch');
      } else if (windowRef.value.webContents) {
        windowRef.value.webContents.once('did-finish-load', () => {
          windowRef.value.webContents.send('personManager:focusSearch');
        });
      }
    }
  }
}

/**
 * Create Face Matching window
 */
export function createFaceMatchingWindow(payload, windowRef, nconf) {
  if (!windowRef.value) {
    windowRef.value = createPersistedWindow('faceMatching', nconf, {
      width: 1100,
      height: 760,
      minWidth: 900,
      minHeight: 600
    }, {
      show: false,
      webPreferences: {
        preload: path.resolve(__dirname, '../../render/vue/windows/FaceMatching/preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const vueDistPath = path.resolve(__dirname, '../../render/vue-dist/faceMatching/index.html');

    windowRef.value.loadFile(vueDistPath)
      .then(() => {
        windowRef.value.show();
        windowRef.value.focus();
        if (windowRef.value?.webContents && !windowRef.value.isDestroyed()) {
          windowRef.value.webContents.send('faceMatching:load', payload || {});
        }
      })
      .catch((err) => {
        console.error('Failed to load Face Matching:', err);
      });

    windowRef.value.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Face Matching failed to load:', errorCode, errorDescription);
    });

    windowRef.value.on('close', () => {
      if (windowRef.value) {
        saveWindowState(windowRef.value, 'faceMatching', nconf);
      }
    });

    windowRef.value.on('closed', () => {
      windowRef.value = null;
    });

    windowRef.value.webContents.on('destroyed', () => {
      windowRef.value = null;
    });
  } else if (isValidWindow(windowRef)) {
    windowRef.value.show();
    windowRef.value.focus();
    if (windowRef.value.webContents) {
      windowRef.value.webContents.send('faceMatching:load', payload || {});
    }
  }
}

/**
 * Create create accessions window
 */
export function createCreateAccessionsWindow(windowRef, nconf) {
  if (!windowRef.value) {
    windowRef.value = createPersistedWindow('createAccessions', nconf, {
      width: 800,
      height: 700,
      minWidth: 700,
      minHeight: 600
    }, {
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
    windowRef.value = createPersistedWindow('mediaManager', nconf, {
      width: 1000,
      height: 800,
      minWidth: 900,
      minHeight: 700
    }, {
      show: false,
      webPreferences: {
        preload: path.resolve(__dirname, '../../render/vue/windows/MediaManager/preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const vueDistPath = path.resolve(__dirname, '../../render/vue-dist/mediaManager/index.html');
    
    const shouldMaximize = nconf.get('ui:mediaManager:isMaximized');

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
    windowRef.value = createPersistedWindow('updateCollection', nconf, {
      width: 800,
      height: 700,
      minWidth: 700,
      minHeight: 600
    }, {
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
    windowRef.value = createPersistedWindow('collectionSetOperations', nconf, {
      width: 700,
      height: 600,
      minWidth: 650,
      minHeight: 500
    }, {
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
    // Use pathToFileURL for proper Windows path handling
    const baseUrl = pathToFileURL(vueDistPath).href;
    const urlWithParams = `${baseUrl}?${queryParams.toString()}`;
    
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
    windowRef.value = createPersistedWindow('collectionManager', nconf, {
      width: 600,
      height: 600,
      minWidth: 550,
      minHeight: 500
    }, {
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

    // Handle programmatic close from renderer (saves state before closing)
    electron.ipcMain.on('window:close', (event) => {
      if (event.sender === windowRef.value?.webContents) {
        if (windowRef.value && !windowRef.value.isDestroyed()) {
          saveWindowState(windowRef.value, 'collectionManager', nconf);
          windowRef.value.close();
        }
      }
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
export function chooseAccessionsPath(dialog, mainWindow, resetAccessions, nconf, onPathChosen = null) {
  dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'json', extensions: 'json' }],
    title: 'Select accessions.json file with "audio", "video", "photo" folders in the same folder.',
    defaultPath: nconf.get('db.accessionsPath'),
    properties: ['openFile']
  }).then(mediaDirectory => {
    if (!mediaDirectory.canceled) {
      const selectedPath = mediaDirectory.filePaths[0];
      resetAccessions(selectedPath);
      if (typeof onPathChosen === 'function') {
        onPathChosen(selectedPath);
      }
    }
  }).catch((e) => {
    console.error('error in showOpenDialog: ', e);
  });
}
