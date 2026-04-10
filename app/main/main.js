/**
 * main.js - Shoebox Application Entry Point
 * 
 * This file orchestrates the Electron application by:
 * - Configuring application settings (nconf)
 * - Creating the main window
 * - Registering IPC handlers for renderer communication
 * - Managing window lifecycle
 * 
 * ARCHITECTURE:
 * This file was refactored from 1439 lines to ~320 lines (Dec 2025).
 * Functionality is now organized into modules:
 * 
 * - app/main/ipc/           - IPC handlers grouped by feature
 *   - personHandlers.js     - Person management (10 handlers)
 *   - itemHandlers.js       - Item/media management (14 handlers)
 *   - collectionHandlers.js - Collection management (6 handlers)
 *   - accessionsHandlers.js - Accessions creation (3 handlers)
 * 
 * - app/main/windows/       - Window creation and UI
 *   - windowManager.js      - All window lifecycle management
 *   - menuTemplates.js      - Application menus
 * 
 * - app/main/utils/         - Helper functions
 *   - helpers.js            - Utility functions
 *   - AccessionClass.js     - Core data model
 * 
 * KEY PATTERNS:
 * 
 * 1. Reference Objects for Pass-by-Reference:
 *    JavaScript doesn't have true pass-by-reference, so we use objects:
 *    const windowRefs = { media: { value: null }, personManager: { value: null } }
 *    Access: windowRefs.media.value
 *    This allows modules to modify window references.
 * 
 * 2. Dependency Injection:
 *    Functions are passed as parameters to avoid tight coupling:
 *    registerItemHandlers(ipcMain, () => accessionClass, verifyAccessions, ...)
 * 
 * 3. Getter Functions:
 *    Use () => variable instead of passing variable directly
 *    This ensures the latest value is always accessed
 * 
 * ADDING NEW FEATURES:
 * - New window? Add creation function to windowManager.js
 * - New IPC handler? Add to appropriate file in ipc/
 * - New menu item? Add to menuTemplates.js
 */

import { app, BrowserWindow, dialog, ipcMain, shell, Menu, powerSaveBlocker, protocol } from 'electron';
import fs from 'fs';
import electron from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getMimeType } from './utils/mimeTypes.js';
import { createRequire } from 'module';
import nconf from 'nconf';
import { AccessionClass } from '../main/utils/AccessionClass.js';
import { FaceDetectionService } from '../main/utils/FaceDetectionService.js';
import { hmsToSeconds, verifyAccessions as verifyAccessionsHelper, resetAccessions as resetAccessionsHelper, buildCollection as buildCollectionHelper, generateTimestamp } from '../main/utils/helpers.js';
import { createMainMenu, createMinimalMenu } from '../main/windows/menuTemplates.js';
import * as windowManager from '../main/windows/windowManager.js';
import { registerPersonHandlers } from '../main/ipc/personHandlers.js';
import { registerItemHandlers } from '../main/ipc/itemHandlers.js';
import { registerCollectionHandlers } from '../main/ipc/collectionHandlers.js';
import { registerAccessionsHandlers } from '../main/ipc/accessionsHandlers.js';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
autoUpdater.logger = null; // Disable auto-updater logging
autoUpdater.checkForUpdatesAndNotify();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Register custom protocol as privileged (must be before app.ready)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true // Enable streaming for video/audio
    }
  }
]);

// Disable hardware video decoding to avoid VAAPI errors on Linux
// Forces software decoding which is more reliable across different systems
app.commandLine.appendSwitch('disable-accelerated-video-decode');

// Slideshow display sleep blocker
let slideshowBlockerId = null;

const startSlideshowBlocker = () => {
  if (slideshowBlockerId && powerSaveBlocker.isStarted(slideshowBlockerId)) {
    return slideshowBlockerId;
  }
  slideshowBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  return slideshowBlockerId;
};

const stopSlideshowBlocker = () => {
  if (slideshowBlockerId && powerSaveBlocker.isStarted(slideshowBlockerId)) {
    powerSaveBlocker.stop(slideshowBlockerId);
  }
  slideshowBlockerId = null;
};

// Import version from package.json
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');
const APP_VERSION = packageJson.version;

console.log('main.js __dirname is ' + __dirname);

// ===== Path Configuration =====
// Determine if running in development or production
const isDev = !app.isPackaged;

// Set paths for resources and models based on environment
const resourcePath = isDev 
  ? path.resolve(__dirname, "../resource")
  : path.join(process.resourcesPath, "resource");

const modelsPath = isDev
  ? path.resolve(__dirname, "../models")
  : path.join(__dirname, "../models");

console.log('Resource path:', resourcePath);
console.log('Models path:', modelsPath);

// ===== Configuration Setup =====
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
      "audioChecked": true,
      "videoChecked": true,
      "restrictChecked": false
    },
    "db": {
      "accessionsPath": path.join(resourcePath, "accessions.json")
    },
    "faceDetection": {
      "confidenceThreshold": 0.20,
      "autoAssignThreshold": 0.60
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
  nconf.set('db:accessionsPath', path.join(resourcePath, "accessions.json"));
  nconf.save('user');
  console.log('Changed accessionsPath to default');
}
process.on('warning', e => console.warn(e.stack));
process.on('uncaughtException - ', e => console.log('***** uncaughtException with error=', e))

// ===== Application State =====

// Application state
let accessionClass = undefined;
let mainWindow = null;

// Face detection service (initialized on first use)
let faceDetectionService = null;

// Window references (using objects for pass-by-reference)
const windowRefs = {
  media: { value: null },
  personManager: { value: null },
  createAccessions: { value: null },
  mediaManager: { value: null },
  updateCollection: { value: null },
  collectionManager: { value: null },
  collectionSetOperations: { value: null }
};
const collectionManagerModeRef = { value: 'create' }; // 'create' or 'delete'

// tracks the renderer drop-down selection via 'items:collection' message
const showCollectionRef = { value: false };

// ===== Main Window Creation =====

const createWindow = () => {
  // Create the browser window.
  mainWindow = windowManager.newWindow('main', '../render/vue/windows/MainWindow/preload.js', false, true, nconf);
  mainWindow.loadFile(path.resolve(__dirname + '/../render/vue-dist/mainWindow/index.html'));
  
  // Set the application menu (use Menu.setApplicationMenu for proper click handling on Linux)
  Menu.setApplicationMenu(createMenu());

  mainWindow.on('close', (e) => {
    if (mainWindow) {
      windowManager.saveWindowState(mainWindow, 'main', nconf);
    }
    if (accessionClass) {
      accessionClass.saveAccessions(); // persist the current accessions
      accessionClass = undefined;
    }
  }) // close

  // when the main window is destroyed, close the other windows too
  mainWindow.webContents.on('destroyed', () => {
    if (windowRefs.media.value && typeof windowRefs.media.value.close === 'function') {
      windowRefs.media.value.close();
    }
    if (windowRefs.personManager.value && typeof windowRefs.personManager.value.close === 'function') {
      windowRefs.personManager.value.close();
    }
    if (windowRefs.createAccessions.value && typeof windowRefs.createAccessions.value.close === 'function') {
      windowRefs.createAccessions.value.close();
    }
    if (windowRefs.mediaManager.value && typeof windowRefs.mediaManager.value.close === 'function') {
      windowRefs.mediaManager.value.close();
    }
    if (windowRefs.updateCollection.value && typeof windowRefs.updateCollection.value.close === 'function') {
      windowRefs.updateCollection.value.close();
    }
    if (windowRefs.collectionManager.value && typeof windowRefs.collectionManager.value.close === 'function') {
      windowRefs.collectionManager.value.close();
    }
    if (windowRefs.collectionSetOperations.value && typeof windowRefs.collectionSetOperations.value.close === 'function') {
      windowRefs.collectionSetOperations.value.close();
    }
    mainWindow = null
  }) // destroyed

  // ===== IPC Handlers Registration =====
  
  // Fire-and-forget handlers for plain renderer (index.html)
  ipcMain.on('open:Website', () => {
    if (!accessionClass) {
      console.error('AccessionClass not initialized');
      return;
    }
    createTreeWindow(accessionClass);
  }); // open:Website

  ipcMain.on('open:PersonLink', (event, tmgid) => {
    if (!tmgid || !accessionClass) {
      console.error('Missing TMGID or accession class');
      return;
    }
    const personUrl = accessionClass.getPersonWebsiteUrl(tmgid);
    if (personUrl) {
      shell.openExternal(personUrl);
    } else {
      console.error('Could not generate person URL for TMGID:', tmgid);
    }
  }); // open:PersonLink
  
  // Async handlers for Vue windows (MainWindow, etc.)
  ipcMain.handle('open:Website', async () => {
    if (!accessionClass) {
      console.error('AccessionClass not initialized');
      return { success: false, error: 'AccessionClass not initialized' };
    }
    createTreeWindow(accessionClass);
    return { success: true };
  }); // open:Website (async)

  ipcMain.handle('open:PersonLink', async (event, tmgid) => {
    if (!tmgid || !accessionClass) {
      console.error('Missing TMGID or accession class');
      return { success: false, error: 'Missing TMGID or accession class' };
    }
    const personUrl = accessionClass.getPersonWebsiteUrl(tmgid);
    console.log('Generated person URL:', personUrl);
    if (personUrl) {
      shell.openExternal(personUrl);
      return { success: true };
    }
    return { success: false, error: 'Could not generate person URL' };
  }); // open:PersonLink (async)

  ipcMain.handle('open:Documentation', async (event) => {
    shell.openExternal('https://marvbudd.github.io/shoebox/');
    return { success: true };
  }); // open:Documentation

  // ===== Config (nconf) IPC Handlers =====
  ipcMain.handle('config:get', async (event, key) => {
    return nconf.get(key);
  });

  ipcMain.handle('config:set', async (event, key, value) => {
    nconf.set(key, value);
    nconf.save('user');
    return { success: true };
  });

  // ===== Person Library IPC Handlers =====
  registerPersonHandlers(ipcMain, () => accessionClass, verifyAccessions);

  // ===== Item IPC Handlers =====
  registerItemHandlers(
    ipcMain,
    () => accessionClass,
    verifyAccessions,
    () => mainWindow,
    createMediaWindow,
    createMediaManagerWindow,
    createMenu,
    resetAccessions,
    hmsToSeconds,
    nconf,
    showCollectionRef,
    () => windowRefs.personManager.value
  );

  // ===== Collection IPC Handlers =====
  registerCollectionHandlers(
    ipcMain,
    () => accessionClass,
    verifyAccessions,
    () => mainWindow,
    resetAccessions,
    () => collectionManagerModeRef.value,
    nconf
  );

  // ===== Accessions and Media IPC Handlers =====
  registerAccessionsHandlers(
    ipcMain,
    dialog,
    () => accessionClass,
    (value) => { accessionClass = value; },
    verifyAccessions,
    resetAccessions,
    () => windowRefs.createAccessions.value,
    nconf,
    shell
  );

  // ===== Window Management IPC Handlers =====

  // Slideshow display sleep blocker (prevent screensaver during slideshow)
  ipcMain.handle('slideshow:setDisplaySleepBlock', async (_event, shouldBlock) => {
    if (shouldBlock) {
      const id = startSlideshowBlocker();
      return { active: true, id };
    }
    stopSlideshowBlocker();
    return { active: false };
  });
  
  // Open Person Manager with a specific person selected
  ipcMain.handle('window:openPersonManager', async (event, personID) => {
    try {
      // Open or focus the Person Manager window
      createPersonManagerWindow();
      
      // Send the personID to the Person Manager window after it's ready (if provided)
      if (personID && windowRefs.personManager.value && windowRefs.personManager.value.webContents) {
        // Wait for the window to be fully loaded before sending selection
        const sendSelection = () => {
          if (windowRefs.personManager.value && !windowRefs.personManager.value.isDestroyed()) {
            windowRefs.personManager.value.webContents.send('person:select', personID);
          }
        };
        
        // If window is already loaded, send immediately
        if (!windowRefs.personManager.value.webContents.isLoading()) {
          setTimeout(sendSelection, 100);
        } else {
          // Otherwise wait for the did-finish-load event
          windowRefs.personManager.value.webContents.once('did-finish-load', () => {
            setTimeout(sendSelection, 100);
          });
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error opening Person Manager:', error);
      return { success: false, error: error.message };
    }
  }); // window:openPersonManager

  // Open Person Manager in Select mode for choosing a person (from Media Manager)
  ipcMain.handle('window:openPersonManagerForSelection', async (event, assignedPersonIDs) => {
    try {
      // Open or focus the Person Manager window
      createPersonManagerWindow();
      
      // Send mode change event to Person Manager window
      if (windowRefs.personManager.value && windowRefs.personManager.value.webContents) {
        const sendModeChange = () => {
          if (windowRefs.personManager.value && !windowRefs.personManager.value.isDestroyed()) {
            windowRefs.personManager.value.webContents.send('personManager:modeChange', {
              mode: 'select',
              assignedPersonIDs: assignedPersonIDs || []
            });
          }
        };
        
        // If window is already loaded, send immediately
        if (!windowRefs.personManager.value.webContents.isLoading()) {
          setTimeout(sendModeChange, 100);
        } else {
          // Otherwise wait for the did-finish-load event
          windowRefs.personManager.value.webContents.once('did-finish-load', () => {
            setTimeout(sendModeChange, 100);
          });
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error opening Person Manager for selection:', error);
      return { success: false, error: error.message };
    }
  }); // window:openPersonManagerForSelection

  // Receive person selection from Person Manager and forward to Media Manager
  ipcMain.on('personManager:personSelected', (event, personID) => {
    try {
      // Forward the selection to all Media Manager windows
      if (windowRefs.mediaManager && windowRefs.mediaManager.value && !windowRefs.mediaManager.value.isDestroyed()) {
        windowRefs.mediaManager.value.webContents.send('personManager:personSelected', personID);
      }
    } catch (error) {
      console.error('Error forwarding person selection:', error);
    }
  }); // personManager:personSelected

  // Save Media Manager window geometry before closing
  ipcMain.handle('window:saveMediaManagerGeometry', async (event) => {
    try {
      if (windowRefs.mediaManager && windowRefs.mediaManager.value && !windowRefs.mediaManager.value.isDestroyed()) {
        windowManager.saveWindowState(windowRefs.mediaManager.value, 'mediaManager', nconf);
        return { success: true };
      }
      return { success: false, error: 'Window not available' };
    } catch (error) {
      console.error('Error saving Media Manager geometry:', error);
      return { success: false, error: error.message };
    }
  }); // window:saveMediaManagerGeometry

  // ===== Face Detection IPC Handlers =====
  
  // Initialize face detection service on first use
  const initFaceDetection = async () => {
    if (!faceDetectionService) {
      faceDetectionService = new FaceDetectionService(modelsPath);
      await faceDetectionService.loadModels();
    }
    return faceDetectionService;
  };

  // Detect faces in a photo
  ipcMain.handle('face-detection:detect', async (event, link, options = {}) => {
    try {
      verifyAccessions();
      const service = await initFaceDetection();
      
      // Get image path
      const itemView = accessionClass.getItemView(null, link);
      if (!itemView) {
        throw new Error(`Item not found: ${link}`);
      }
      
      if (itemView.getType() !== 'photo') {
        throw new Error('Face detection only works on photos');
      }
      
      const imagePath = accessionClass.getMediaPath(itemView.getType(), itemView.getLink());
      // Get models to use (default to SSD only)
      const models = options.models || ['ssd'];
      const minConfidence = options.minConfidence || 0.5;
      
      // Detect faces
      const faces = await service.detectFaces(imagePath, models, minConfidence);
      
      return {
        success: true,
        link,
        facesDetected: faces.length,
        faces: faces.map(face => ({
          descriptor: Array.from(face.descriptor), // Convert Float32Array to regular array for IPC
          region: face.region,
          confidence: face.confidence
        }))
      };
    } catch (error) {
      console.error('Face detection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Get face detection status
  ipcMain.handle('face-detection:status', async () => {
    if (!faceDetectionService) {
      return {
        initialized: false,
        modelsLoaded: false
      };
    }
    return {
      initialized: true,
      ...faceDetectionService.getStatus()
    };
  });

  // Get available detection models
  ipcMain.handle('face-detection:get-models', async () => {
    try {
      const service = await initFaceDetection();
      return {
        success: true,
        models: service.getAvailableModels()
      };
    } catch (error) {
      console.error('Error getting face detection models:', error);
      return {
        success: false,
        error: error.message,
        models: []
      };
    }
  });

  // Match detected faces to persons already listed in this photo
  ipcMain.handle('face-detection:match', async (event, link, detectedFaces) => {
    try {
      verifyAccessions();
      
      if (!detectedFaces || detectedFaces.length === 0) {
        return { success: true, matches: [], unmatchedFaces: [] };
      }
      
      const itemView = accessionClass.getItemView(null, link);
      if (!itemView) {
        throw new Error(`Item not found: ${link}`);
      }
      
      const item = itemView.itemJSON;
      const itemPersons = item.person || [];
      
      if (itemPersons.length === 0) {
        // No persons in item, all faces are unmatched
        return { 
          success: true, 
          matches: [], 
          unmatchedFaces: detectedFaces.map((face, index) => ({
            faceIndex: index,
            region: face.region,
            confidence: face.confidence
          }))
        };
      }
      
      // MATCH_THRESHOLD explanation:
      // - Phase 1 (backend re-matching): Strict 0.05 threshold for re-detecting SAME IMAGE with SAME MODEL
      // - Expects distance ≈ 0.0 (perfect match) since it's the exact same face descriptor
      // - Only auto-assigns if distance < 0.05 (~95% confidence)
      // - Confidence display uses simple formula: (1 - distance) * 100 for consistency with UI
      const SAME_IMAGE_THRESHOLD = 0.05;  // For re-detecting same image (expect ~0.0)
      
      // Use strict threshold for Phase 1 auto-matching
      const MATCH_THRESHOLD = SAME_IMAGE_THRESHOLD;
      
      const matches = [];
      const unmatchedFaces = [];
      
      // Try to match each detected face to persons in THIS item only
      for (let faceIndex = 0; faceIndex < detectedFaces.length; faceIndex++) {
        const face = detectedFaces[faceIndex];
        let bestMatch = null;
        let bestDistance = Infinity;
        // Convert descriptor array back to Float32Array for comparison
        const faceDescriptor = new Float32Array(face.descriptor);

        // Track which persons have already been matched
        const alreadyMatchedPersonIndices = matches.map(m => m.personIndex);

        // Check each person in the item for stored face descriptors in faceBioData
        for (let personIndex = 0; personIndex < itemPersons.length; personIndex++) {
          // Skip if this person has already been matched to a face
          if (alreadyMatchedPersonIndices.includes(personIndex)) continue;
          const personRef = itemPersons[personIndex];
          
          // Get person from library to check faceBioData
          if (!personRef.personID) continue;
          const person = accessionClass.getPerson(personRef.personID);
          if (!person || !person.faceBioData) continue;
          
          // Find descriptor for current link with matching model
          const faceModel = face.model || 'ssd';
          const descriptor = person.faceBioData.find(d => 
            d.link === item.link && d.model === faceModel
          );
          if (!descriptor || !descriptor.descriptor) continue;
          
          const storedDescriptor = new Float32Array(descriptor.descriptor);
          const distance = faceDetectionService.euclideanDistance(
            faceDescriptor,
            storedDescriptor
          );
          
          // Use consistent confidence formula: (1 - distance) matching frontend display
          if (distance < bestDistance && distance < MATCH_THRESHOLD) {
            bestDistance = distance;
            bestMatch = {
              personIndex,
              personID: personRef.personID,
              distance,
              confidence: 1 - distance  // Consistent with frontend: (1 - distance)
            };
          }
        }

        if (bestMatch) {
          matches.push({
            faceIndex,
            ...bestMatch,
            region: face.region
          });
        } else {
          unmatchedFaces.push({
            faceIndex,
            region: face.region,
            confidence: face.confidence
            // Don't include descriptor - renderer already has it in detectedFaces
          });
        }
      }
      
      return {
        success: true,
        matches,
        unmatchedFaces
      };
    } catch (error) {
      console.error('Face matching error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });



}; // createWindow

// ===== Custom Protocol Registration =====

// Register custom protocol for secure media file access
// This allows renderer to load media:// URLs while maintaining security
app.whenReady().then(() => {
  protocol.handle('media', async (request) => {
    try {
      // Parse URL: media://type/filename
      const url = new URL(request.url);
      const type = url.hostname; // 'photo', 'audio', or 'video'
      const link = decodeURIComponent(url.pathname.substring(1)); // Remove leading slash and decode URL encoding
      
      if (!accessionClass) {
        return new Response('Accessions not loaded', { status: 500 });
      }
      
      const baseDir = path.dirname(accessionClass.accessionFilename);
      const filePath = path.resolve(baseDir, type, link);
      
      // Read file
      const fileBuffer = await fs.promises.readFile(filePath);
      
      // Determine MIME type from shared utility (single source of truth)
      const mimeType = getMimeType(type, link);
      
      return new Response(fileBuffer, {
        headers: { 'Content-Type': mimeType }
      });
    } catch (error) {
      console.error('Protocol handler error:', error);
      return new Response('File not found', { status: 404 });
    }
  });
});

// ===== Application Lifecycle Events =====

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

// ===== Menu Creation Functions =====

async function validateDatabase() {
  try {
    verifyAccessions();
    const logInfo = await accessionClass.validateArchive();
    
    const message = `Archive validation complete!\n\n` +
      `Errors: ${logInfo.errorCount}\n` +
      `Warnings: ${logInfo.warningCount}\n` +
      (logInfo.orphanedDescriptorCount > 0 ? `Orphaned Face Descriptors: ${logInfo.orphanedDescriptorCount}\n` : '') +
      (logInfo.unreferencedPersonCount > 0 ? `Unreferenced Persons: ${logInfo.unreferencedPersonCount}\n` : '') +
      `\nLog file saved to:\n${logInfo.filename}`;
    
    // Build buttons array - include cleanup buttons only if needed
    const buttons = ['OK', 'Open Log File'];
    let orphanedDescButtonIndex = -1;
    let unreferencedPersonsButtonIndex = -1;
    
    if (logInfo.orphanedDescriptorCount > 0) {
      orphanedDescButtonIndex = buttons.length;
      buttons.push('Cleanup Orphaned Descriptors');
    }
    if (logInfo.unreferencedPersonCount > 0) {
      unreferencedPersonsButtonIndex = buttons.length;
      buttons.push('Cleanup Unreferenced Persons');
    }
    
    const response = await dialog.showMessageBox(mainWindow, {
      type: logInfo.errorCount === 0 ? 'info' : 'warning',
      title: 'Archive Validation',
      message: message,
      buttons: buttons
    });
    
    if (response.response === 1) {
      // Open Log File
      shell.openPath(logInfo.path);
    } else if (response.response === orphanedDescButtonIndex && orphanedDescButtonIndex !== -1) {
      // Cleanup Orphaned Descriptors
      await cleanupOrphanedDescriptors();
    } else if (response.response === unreferencedPersonsButtonIndex && unreferencedPersonsButtonIndex !== -1) {
      // Cleanup Unreferenced Persons
      await cleanupUnreferencedPersons();
    }
  } catch (error) {
    console.error('Validation error:', error);
    dialog.showErrorBox('Validation Error', `Failed to validate archive: ${error.message}`);
  }
} // validateDatabase

async function cleanupOrphanedDescriptors() {
  try {
    verifyAccessions();
    
    // Backup archive before cleanup
    const backupResult = accessionClass.backupAccessions();
    if (!backupResult.success) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Backup Failed',
        message: 'Cannot proceed with cleanup',
        detail: `Failed to backup archive: ${backupResult.error}\n\nOperation aborted to protect data integrity.`,
        buttons: ['OK']
      });
      return;
    }
    
    const result = accessionClass.cleanupOrphanedDescriptors();
    
    const message = result.totalRemoved > 0
      ? `Successfully removed ${result.totalRemoved} orphaned face descriptor(s).`
      : `No orphaned face descriptors found to cleanup.`;
    
    const detail = result.totalRemoved > 0
      ? `These were face detection data entries that no longer matched any items or person assignments.`
      : undefined;
    
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Cleanup Complete',
      message: message,
      detail: detail,
      buttons: ['OK']
    });
    
    // Optionally re-run validation to confirm cleanup
    if (result.totalRemoved > 0) {
      const revalidate = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: 'Re-run Validation?',
        message: 'Would you like to re-run validation to confirm the orphaned descriptors were removed?',
        buttons: ['Yes', 'No'],
        defaultId: 0
      });
      
      if (revalidate.response === 0) {
        await validateDatabase();
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error);
    dialog.showErrorBox('Cleanup Error', `Failed to cleanup orphaned descriptors: ${error.message}`);
  }
} // cleanupOrphanedDescriptors

async function cleanupUnreferencedPersons() {
  try {
    verifyAccessions();
    
    // Backup archive before cleanup
    const backupResult = accessionClass.backupAccessions();
    if (!backupResult.success) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Backup Failed',
        message: 'Cannot proceed with cleanup',
        detail: `Failed to backup archive: ${backupResult.error}\n\nOperation aborted to protect data integrity.`,
        buttons: ['OK']
      });
      return;
    }
    
    const result = accessionClass.cleanupUnreferencedPersons();
    
    const message = result.totalRemoved > 0
      ? `Successfully removed ${result.totalRemoved} unreferenced person(s).`
      : `No unreferenced persons found to cleanup.`;
    
    let detail = result.totalRemoved > 0
      ? `The following persons were not referenced in any items and have been removed:\n\n`
      : undefined;
    
    if (detail && result.removedPersons) {
      const names = result.removedPersons.map(p => `  • ${p.name}`).join('\n');
      detail += names;
    }
    
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Cleanup Complete',
      message: message,
      detail: detail,
      buttons: ['OK']
    });
    
    // Optionally re-run validation to confirm cleanup
    if (result.totalRemoved > 0) {
      const revalidate = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: 'Re-run Validation?',
        message: 'Would you like to re-run validation to confirm the unreferenced persons were removed?',
        buttons: ['Yes', 'No'],
        defaultId: 0
      });
      
      if (revalidate.response === 0) {
        await validateDatabase();
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error);
    dialog.showErrorBox('Cleanup Error', `Failed to cleanup unreferenced persons: ${error.message}`);
  }
} // cleanupUnreferencedPersons

async function importPersonsFromArchive() {
  try {
    verifyAccessions();
    
    // Open file picker for source accessions.json
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Source Archive',
      properties: ['openFile'],
      filters: [
        { name: 'Accessions JSON', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      message: 'Select the accessions.json file to import persons from'
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return;
    }
    
    const sourceFilePath = result.filePaths[0];
    
    // Prevent importing from the same archive
    if (path.resolve(sourceFilePath) === path.resolve(accessionClass.accessionFilename)) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Invalid Source',
        message: 'Cannot import from the same archive',
        detail: 'You cannot import persons from the currently open archive. Please select a different archive file.',
        buttons: ['OK']
      });
      return;
    }
    
    // Read and parse source file to show preview
    let sourceData;
    try {
      const fileContent = await fs.promises.readFile(sourceFilePath, 'utf8');
      sourceData = JSON.parse(fileContent);
    } catch (error) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Invalid File',
        message: 'Failed to read source file',
        detail: error.message,
        buttons: ['OK']
      });
      return;
    }
    
    if (!sourceData.persons || typeof sourceData.persons !== 'object') {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Invalid File',
        message: 'Source file does not contain a valid persons object',
        buttons: ['OK']
      });
      return;
    }
    
    const sourcePersonCount = Object.keys(sourceData.persons).length;
    const sourceArchiveTitle = sourceData.accessions?.title || 'Unknown Archive';
    
    // Show preview/confirmation dialog
    const confirmation = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Import Persons',
      message: `Import Person Library from:\n${sourceArchiveTitle}`,
      detail: `Source file: ${path.basename(sourceFilePath)}\nPersons in source: ${sourcePersonCount}\n\nOptions:`,
      buttons: ['Cancel', 'Import (Strip Face Descriptors)', 'Import (Include Face Descriptors)'],
      defaultId: 1,
      cancelId: 0,
      checkboxLabel: 'Create backup before import',
      checkboxChecked: true
    });
    
    if (confirmation.response === 0) {
      return; // Canceled
    }
    
    const includeFaceDescriptors = confirmation.response === 2;
    const createBackup = confirmation.checkboxChecked;
    
    // Backup if requested
    if (createBackup) {
      const backupResult = accessionClass.backupAccessions();
      if (!backupResult.success) {
        await dialog.showMessageBox(mainWindow, {
          type: 'error',
          title: 'Backup Failed',
          message: 'Cannot proceed with import',
          detail: `Failed to backup archive: ${backupResult.error}\n\nOperation aborted to protect data integrity.`,
          buttons: ['OK']
        });
        return;
      }
    }
    
    // Perform import using AccessionClass method
    const importResult = accessionClass.importPersonsFromArchive(
      sourceData.persons,
      { includeFaceDescriptors }
    );
    
    // Show results
    const {
      imported = [],
      skipped = [],
      tmgidConflicts = [],
      uuidCollisions = []
    } = importResult;
    
    let message = `Import complete!\n\n`;
    message += `Persons imported: ${imported.length}\n`;
    message += `Persons skipped (already exist): ${skipped.length}\n`;
    
    if (uuidCollisions.length > 0) {
      message += `\n⚠️ UUID collisions detected: ${uuidCollisions.length}\n`;
      message += `(Same UUID but different person data - requires manual resolution)\n`;
    }
    
    if (tmgidConflicts.length > 0) {
      message += `\n⚠️ TMGID conflicts detected: ${tmgidConflicts.length}\n`;
      message += `(Different persons with same TMGID - run Archive > Validate to review)\n`;
    }
    
    const buttons = ['OK'];
    let detailText = '';
    
    if (imported.length > 0 && imported.length <= 20) {
      detailText += 'Imported persons:\n';
      detailText += imported.map(p => `  • ${p.name}`).join('\n');
    } else if (imported.length > 20) {
      detailText += `Imported ${imported.length} persons (too many to list)`;
    }
    
    if (uuidCollisions.length > 0) {
      buttons.push('Show UUID Collisions');
    }
    
    if (tmgidConflicts.length > 0) {
      buttons.push('Run Validation');
    }
    
    const response = await dialog.showMessageBox(mainWindow, {
      type: uuidCollisions.length > 0 ? 'warning' : 'info',
      title: 'Import Complete',
      message: message,
      detail: detailText || undefined,
      buttons: buttons
    });
    
    // Handle button responses
    if (response.response === buttons.indexOf('Show UUID Collisions')) {
      let collisionDetail = 'UUID Collisions (Manual Resolution Required):\n\n';
      uuidCollisions.forEach((collision, index) => {
        collisionDetail += `${index + 1}. UUID: ${collision.personID}\n`;
        collisionDetail += `   Source: ${collision.sourceName}\n`;
        collisionDetail += `   Target: ${collision.targetName}\n\n`;
      });
      collisionDetail += 'These persons have the same UUID but different data.\n';
      collisionDetail += 'You may need to manually adjust UUIDs or merge data.';
      
      await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'UUID Collisions',
        message: collisionDetail,
        buttons: ['OK']
      });
    } else if (response.response === buttons.indexOf('Run Validation')) {
      await validateDatabase();
    }
    
  } catch (error) {
    console.error('Import persons error:', error);
    dialog.showErrorBox('Import Error', `Failed to import persons: ${error.message}`);
  }
} // importPersonsFromArchive

async function importArchive(providedSourceFilePath = null, providedSourceData = null) {
  try {
    verifyAccessions();
    
    let sourceFilePath = providedSourceFilePath;
    let sourceData = providedSourceData;
    
    // Open file picker for source accessions.json only if not already provided
    if (!sourceFilePath) {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Source Archive',
        properties: ['openFile'],
        filters: [
          { name: 'Accessions JSON', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        message: 'Select the accessions.json file to import from'
      });
      
      if (result.canceled || result.filePaths.length === 0) {
        return;
      }
      
      sourceFilePath = result.filePaths[0];
    }
    
    // Prevent importing from the same archive
    if (path.resolve(sourceFilePath) === path.resolve(accessionClass.accessionFilename)) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Invalid Source',
        message: 'Cannot import from the same archive',
        detail: 'You cannot import from the currently open archive. Please select a different archive file.',
        buttons: ['OK']
      });
      return;
    }
    
    // Read and parse source file to show preview (only if not already provided)
    if (!sourceData) {
      try {
        const fileContent = await fs.promises.readFile(sourceFilePath, 'utf8');
        sourceData = JSON.parse(fileContent);
      } catch (error) {
        await dialog.showMessageBox(mainWindow, {
          type: 'error',
          title: 'Invalid File',
          message: 'Failed to read source file',
          detail: error.message,
          buttons: ['OK']
        });
        return;
      }
    }
    
    if (!sourceData.persons || !sourceData.accessions) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Invalid File',
        message: 'Source file does not contain a valid archive structure',
        detail: 'The file must contain both "persons" and "accessions" sections.',
        buttons: ['OK']
      });
      return;
    }
    
    const sourcePersonCount = Object.keys(sourceData.persons).length;
    const sourceItemCount = sourceData.accessions.item?.length || 0;
    const sourceArchiveTitle = sourceData.accessions?.title || 'Unknown Archive';
    
    // Check if _ImportConflicts collection already exists
    if (accessionClass.accessionJSON.collections && accessionClass.accessionJSON.collections['_ImportConflicts']) {
      const confirmReplace = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Conflict Collection Exists',
        message: 'The "_ImportConflicts" collection already exists in this archive.',
        detail: 'Import will replace this collection with new conflict data. Do you want to continue?',
        buttons: ['Cancel', 'Continue Import'],
        defaultId: 0,
        cancelId: 0
      });
      
      if (confirmReplace.response === 0) {
        return;
      }
    }
    
    // Show preview/confirmation dialog with dry-run option (only if doing initial selection)
    let dryRun = false;
    let hashVerification = true;
    
    if (!providedSourceFilePath) {
      const confirmation = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: 'Import Archive',
        message: `Import Archive from:\n${sourceArchiveTitle}`,
        detail: `Source file: ${path.basename(sourceFilePath)}\nPersons in source: ${sourcePersonCount}\nItems in source: ${sourceItemCount}\n\n⚠️  TIP: Consider running as dry-run first to preview conflicts.\n\nBackup will be created automatically before import.`,
        buttons: ['Cancel', 'Import (Full)', 'Dry Run (Preview Only)'],
        defaultId: 2,
        cancelId: 0,
        checkboxLabel: 'Hash verification (slower but thorough)',
        checkboxChecked: true
      });
      
      if (confirmation.response === 0) {
        return; // Canceled
      }
      
      dryRun = confirmation.response === 2;
      hashVerification = confirmation.checkboxChecked;
    }
    // If source was provided, we're doing a full import (not a dry run)
    
    // Backup if not dry run (mandatory)
    if (!dryRun) {
      const backupResult = accessionClass.backupAccessions();
      if (!backupResult.success) {
        await dialog.showMessageBox(mainWindow, {
          type: 'error',
          title: 'Backup Failed',
          message: 'Cannot proceed with import',
          detail: `Failed to backup archive: ${backupResult.error}\n\nOperation aborted to protect data integrity.`,
          buttons: ['OK']
        });
        return;
      }
    }
    
    // Perform import using AccessionClass method
    const executeResult = await accessionClass.importArchive(
      sourceData,
      sourceFilePath,
      {
        dryRun: dryRun,
        hashVerification: hashVerification
      }
    );
    
    const importResult = {
      success: true,
      results: executeResult.results,
      logContent: executeResult.logContent
    };
    
    if (!importResult || !importResult.success) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Import Failed',
        message: 'Failed to import archive',
        detail: importResult?.error || 'Unknown error occurred',
        buttons: ['OK']
      });
      return;
    }
    
    // Save log file
    const timestamp = generateTimestamp();
    const logFileName = `import-log-${timestamp}.txt`;
    const logFilePath = path.join(path.dirname(accessionClass.accessionFilename), logFileName);
    
    try {
      await fs.promises.writeFile(logFilePath, importResult.logContent, 'utf8');
    } catch (error) {
      console.error('Failed to write log file:', error);
    }
    
    // Show results
    const {
      persons = { imported: [], skipped: [], conflicts: [] },
      items = { imported: [], skipped: [], conflicts: [], filesRestored: [] },
      files = { verified: [], sizeMismatches: [], hashMismatches: [], symlinkDetected: false }
    } = importResult.results;
    
    const totalPersonConflicts = persons.conflicts.length;
    const totalItemConflicts = items.conflicts.length;
    const totalConflicts = totalPersonConflicts + totalItemConflicts;
    
    let message = dryRun ? 'Dry Run Complete (No Changes Made)\n\n' : 'Import Complete!\n\n';
    message += `Persons: ${persons.imported.length} imported, ${persons.skipped.length} skipped\n`;
    message += `Items: ${items.imported.length} imported, ${items.skipped.length} skipped\n`;
    
    if (items.filesRestored && items.filesRestored.length > 0 && !dryRun) {
      message += `\n✓ ${items.filesRestored.length} missing file(s) restored from source\n`;
    }
    
    if (totalConflicts > 0) {
      message += `\n⚠️  Conflicts detected: ${totalConflicts} total\n`;
      message += `   - Person conflicts: ${totalPersonConflicts}\n`;
      message += `   - Item conflicts: ${totalItemConflicts}\n`;
      if (!dryRun) {
        message += `\n"_ImportConflicts" collection created for review.\n`;
      }
    }
    
    if (files.symlinkDetected) {
      message += `\n⚠️  Symlinks detected in resource directories.\n`;
    }
    
    const buttons = ['OK'];
    if (totalConflicts > 0) {
      buttons.push('Open Import Log');
    }
    if (dryRun && totalConflicts === 0) {
      buttons.push('Proceed with Full Import');
    }
    
    const response = await dialog.showMessageBox(mainWindow, {
      type: totalConflicts > 0 ? 'warning' : 'info',
      title: dryRun ? 'Dry Run Complete' : 'Import Complete',
      message: message,
      detail: `Log file: ${logFileName}`,
      buttons: buttons
    });
    
    // Handle button responses
    if (response.response === buttons.indexOf('Open Import Log')) {
      shell.openPath(logFilePath);
    } else if (response.response === buttons.indexOf('Proceed with Full Import')) {
      // Call importArchive again with the same source, but as full import
      await importArchive(sourceFilePath, sourceData);
    }
    
  } catch (error) {
    console.error('Import archive error:', error);
    dialog.showErrorBox('Import Error', `Failed to import archive: ${error.message}`);
  }
} // importArchive

async function validateCollection() {
  try {
    verifyAccessions();
    
    // Get the currently selected collection from UI
    const selectedCollectionKey = nconf.get('controls:selectedCollection');
    
    if (!selectedCollectionKey) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'No Collection Selected',
        message: 'Please select a collection from the dropdown to validate.',
        buttons: ['OK']
      });
      return;
    }
    
    // Validate the collection using encapsulated method
    const { results, logInfo, collectionText } = await accessionClass.collections.validateCollection(selectedCollectionKey, accessionClass);
    
    // Show dialog with results
    const message = results.errorCount === 0 && results.warningCount === 0
      ? `Collection "${collectionText}" validation complete!\n\nNo errors or warnings found.\n\nLog file: ${logInfo.filename}`
      : `Collection "${collectionText}" validation complete!\n\nErrors: ${results.errorCount}\nWarnings: ${results.warningCount}\n\nLog file: ${logInfo.filename}`;
    
    // Build buttons array - include cleanup button only if errors exist
    const buttons = results.errorCount === 0 && results.warningCount === 0
      ? ['OK']
      : ['Open Log File', 'Close'];
    
    if (results.errorCount > 0) {
      buttons.push('Clean Up Collection');
    }
    
    const dialogResponse = await dialog.showMessageBox(mainWindow, {
      type: results.errorCount > 0 ? 'warning' : 'info',
      title: 'Collection Validation Complete',
      message: message,
      buttons: buttons,
      defaultId: 0
    });
    
    // Handle button responses
    if (dialogResponse.response === 0 && buttons.length > 1) {
      // Open Log File
      await shell.openPath(logInfo.path);
    } else if (dialogResponse.response === 2 && results.errorCount > 0) {
      // Clean Up Collection
      await cleanupCollection(selectedCollectionKey, results, collectionText);
    }
    
  } catch (error) {
    console.error('Failed to validate collection:', error);
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Validation Error',
      message: `Failed to validate collection: ${error.message}`,
      buttons: ['OK']
    });
  }
} // validateCollection

async function cleanupCollection(collectionKey, validationResults, collectionText) {
  try {
    verifyAccessions();
    
    // Backup archive before cleanup
    const backupResult = accessionClass.backupAccessions();
    if (!backupResult.success) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Backup Failed',
        message: 'Cannot proceed with cleanup',
        detail: `Failed to backup archive: ${backupResult.error}\n\nOperation aborted to protect data integrity.`,
        buttons: ['OK']
      });
      return;
    }
    
    // Get the collection
    const collection = accessionClass.collections.getCollection(collectionKey);
    if (!collection) {
      throw new Error(`Collection "${collectionKey}" not found`);
    }
    
    // Find all links with COLLECTION_LINK_NOT_FOUND errors
    const missingLinks = validationResults.errors
      .filter(error => error.type === 'COLLECTION_LINK_NOT_FOUND')
      .map(error => error.link);
    
    // Remove missing items from collection
    // removeItem() automatically sets collectionChanged = true for delayed save
    let removedCount = 0;
    for (const link of missingLinks) {
      if (collection.hasItem(link)) {
        collection.removeItem(link);
        removedCount++;
      }
    }
    
    const message = removedCount > 0
      ? `Successfully removed ${removedCount} missing item(s) from collection "${collectionText}".`
      : `No missing items found to cleanup in collection "${collectionText}".`;
    
    const detail = removedCount > 0
      ? `These were items referenced in the collection but no longer exist in the archive.`
      : undefined;
    
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Cleanup Complete',
      message: message,
      detail: detail,
      buttons: ['OK']
    });
    
    // Optionally re-run validation to confirm cleanup
    if (removedCount > 0) {
      const revalidate = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: 'Re-run Validation?',
        message: 'Would you like to re-run validation to confirm the cleanup was successful?',
        buttons: ['Yes', 'No'],
        defaultId: 0
      });
      
      if (revalidate.response === 0) {
        await validateCollection();
      }
    }
    
  } catch (error) {
    console.error('Failed to cleanup collection:', error);
    await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Cleanup Error',
      message: `Failed to cleanup collection: ${error.message}`,
      buttons: ['OK']
    });
  }
} // cleanupCollection

// ===== Backup Functions =====

/**
 * Backup the archive (accessions.json) file
 * Creates a timestamped copy without .json extension to prevent ingestion
 */
async function backupArchive() {
  try {
    verifyAccessions();
    
    const result = accessionClass.backupAccessions();
    
    if (result.success) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Archive Backup Complete',
        message: `Archive successfully backed up!`,
        detail: `Backup file: ${result.backupFilename}`,
        buttons: ['OK']
      });
    } else {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Backup Error',
        message: `Failed to backup archive: ${result.error}`,
        buttons: ['OK']
      });
    }
  } catch (error) {
    console.error('Failed to backup archive:', error);
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Backup Error',
      message: `Failed to backup archive: ${error.message}`,
      buttons: ['OK']
    });
  }
} // backupArchive

/**
 * Backup all collections
 * Creates timestamped copies without .json extension for each collection
 */
async function backupAllCollections() {
  try {
    verifyAccessions();
    
    const result = accessionClass.collections.backupAllCollections();
    
    if (result.success) {
      const fileList = result.backedUpFiles.join('\n');
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Collections Backup Complete',
        message: `Successfully backed up ${result.backedUpFiles.length} collection(s)!`,
        detail: fileList,
        buttons: ['OK']
      });
    } else {
      dialog.showMessageBox(mainWindow, {
        type: result.error === 'No collections to backup' ? 'info' : 'warning',
        title: result.error === 'No collections to backup' ? 'No Collections' : 'Backup Failed',
        message: result.error || 'Failed to backup collections.',
        buttons: ['OK']
      });
    }
  } catch (error) {
    console.error('Failed to backup collections:', error);
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Backup Error',
      message: `Failed to backup collections: ${error.message}`,
      buttons: ['OK']
    });
  }
} // backupAllCollections

/**
 * Create maintenance collections for items missing critical data
 * Creates _nolocation.json, _nopersons.json, _nosource.json, _nodescription.json
 */
async function createMaintenanceCollections() {
  try {
    verifyAccessions();
    
    // Delegate to AccessionClass to check for existing maintenance collections
    const existingCollections = accessionClass.getExistingMaintenanceCollections();
    
    if (existingCollections.length > 0) {
      const response = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        title: 'Replace Existing Collections',
        message: 'This will replace existing maintenance collections. Continue?',
        detail: `The following collections will be replaced:\n${existingCollections.map(c => `${c.key}.json (${c.text})`).join('\n')}`,
        buttons: ['Continue', 'Cancel'],
        defaultId: 1,
        cancelId: 1
      });
      
      if (response === 1) {
        return; // User cancelled
      }
    }
    
    // Delegate to AccessionClass
    const result = accessionClass.createMaintenanceCollections();
    
    // Refresh main window to show new collections in dropdown
    if (result.created.length > 0) {
      mainWindow.webContents.send('items:render', JSON.stringify({ reload: true, preserveSort: true }));
    }
    
    // Show summary
    if (result.created.length > 0) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Maintenance Collections Created',
        message: `Created ${result.created.length} maintenance collection(s):`,
        detail: result.created.join('\n'),
        buttons: ['OK']
      });
    } else {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'No Issues Found',
        message: 'All items have complete data. No maintenance collections needed.',
        buttons: ['OK']
      });
    }
  } catch (error) {
    console.error('Failed to create maintenance collections:', error);
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Error Creating Collections',
      message: `Failed to create maintenance collections: ${error.message}`,
      buttons: ['OK']
    });
  }
} // createMaintenanceCollections

/**
 * Update collection metadata (text and title only)
 * Opens dialog to edit collection display name and full title
 */
async function updateCollectionMetadata() {
  try {
    verifyAccessions();
    
    // Get all collections
    const collections = accessionClass.collections.collections;
    
    if (collections.length === 0) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'No Collections',
        message: 'No collections available to update.',
        buttons: ['OK']
      });
      return;
    }
    
    // For now, use the currently selected collection from dropdown
    const selectedKey = nconf.get('controls:selectedCollection');
    
    if (!selectedKey) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'No Collection Selected',
        message: 'Please select a collection from the dropdown at the bottom of the main window first.',
        buttons: ['OK']
      });
      return;
    }
    
    const selectedCollection = accessionClass.collections.getCollection(selectedKey);
    
    if (!selectedCollection) {
      throw new Error(`Collection not found: ${selectedKey}`);
    }
    
    // Create a small modal window for editing
    const editWindow = new BrowserWindow({
      width: 500,
      height: 350,
      parent: mainWindow,
      modal: true,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    
    // Load HTML content directly
    editWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 20px;
              margin: 0;
              background: #f5f5f5;
            }
            h2 {
              margin-top: 0;
              color: #333;
            }
            .form-group {
              margin-bottom: 15px;
            }
            label {
              display: block;
              margin-bottom: 5px;
              font-weight: 500;
              color: #555;
            }
            input {
              width: 100%;
              padding: 8px;
              border: 1px solid #ddd;
              border-radius: 4px;
              font-size: 14px;
              box-sizing: border-box;
            }
            input:focus {
              outline: none;
              border-color: #667eea;
            }
            .readonly {
              background: #e9ecef;
              color: #6c757d;
            }
            .buttons {
              margin-top: 20px;
              display: flex;
              gap: 10px;
              justify-content: flex-end;
            }
            button {
              padding: 8px 20px;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
            }
            .btn-save {
              background: #667eea;
              color: white;
            }
            .btn-save:hover {
              background: #5568d3;
            }
            .btn-cancel {
              background: #6c757d;
              color: white;
            }
            .btn-cancel:hover {
              background: #5a6268;
            }
            small {
              display: block;
              margin-top: 3px;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <h2>Update Collection Metadata</h2>
          <div class="form-group">
            <label>Collection Key (filename)</label>
            <input type="text" id="key" value="${selectedCollection.key}" readonly class="readonly" />
            <small>Cannot be changed - this is the filename</small>
          </div>
          <div class="form-group">
            <label>Text (Short Name)</label>
            <input type="text" id="text" value="${selectedCollection.text || ''}" placeholder="Short description for dropdown" />
            <small>Shown in collection dropdown</small>
          </div>
          <div class="form-group">
            <label>Title (Full Name)</label>
            <input type="text" id="title" value="${selectedCollection.title || ''}" placeholder="Full descriptive title" />
            <small>Longer, more descriptive title</small>
          </div>
          <div class="buttons">
            <button class="btn-save" onclick="save()">Save</button>
            <button class="btn-cancel" onclick="cancel()">Cancel</button>
          </div>
          <script>
            const { ipcRenderer } = require('electron');
            
            function save() {
              const data = {
                text: document.getElementById('text').value,
                title: document.getElementById('title').value
              };
              ipcRenderer.send('collection-metadata-updated', data);
            }
            
            function cancel() {
              ipcRenderer.send('collection-metadata-cancelled');
            }
            
            // Allow Enter to save
            document.getElementById('title').addEventListener('keypress', (e) => {
              if (e.key === 'Enter') save();
            });
          </script>
        </body>
      </html>
    `)}`);
    
    // Handle save
    ipcMain.once('collection-metadata-updated', (event, data) => {
      selectedCollection.setText(data.text);
      selectedCollection.setTitle(data.title);
      accessionClass.saveAccessions(); // Save collections
      
      // Refresh main window to show updated collection name
      mainWindow.webContents.send('items:render', JSON.stringify({ reload: true, preserveSort: true }));
      
      editWindow.close();
      
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Success',
        message: 'Collection metadata updated successfully.',
        buttons: ['OK']
      });
    });
    
    // Handle cancel
    ipcMain.once('collection-metadata-cancelled', () => {
      editWindow.close();
    });
    
    editWindow.once('ready-to-show', () => {
      editWindow.show();
    });
    
    // Clean up listeners when window closes
    editWindow.on('closed', () => {
      ipcMain.removeAllListeners('collection-metadata-updated');
      ipcMain.removeAllListeners('collection-metadata-cancelled');
    });
    
  } catch (error) {
    console.error('Failed to update collection metadata:', error);
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Error',
      message: `Failed to update collection metadata: ${error.message}`,
      buttons: ['OK']
    });
  }
} // updateCollectionMetadata

/**
 * Add items from another collection to the target collection (union operation)
 * Opens a Vue window for the operation
 */
function addItemsFromCollection() {
  const targetKey = nconf.get('controls:selectedCollection');
  if (!targetKey) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'No Target Collection',
      message: 'Please select a collection from the dropdown first.',
      buttons: ['OK']
    });
    return;
  }
  
  windowManager.createCollectionSetOperationsWindow(
    'add',
    targetKey,
    windowRefs.collectionSetOperations,
    nconf
  );
}

/**
 * Remove items (in another collection) from target (difference operation)
 * Opens a Vue window for the operation
 */
function removeItemsFromCollection() {
  const targetKey = nconf.get('controls:selectedCollection');
  if (!targetKey) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'No Target Collection',
      message: 'Please select a collection from the dropdown first.',
      buttons: ['OK']
    });
    return;
  }
  
  windowManager.createCollectionSetOperationsWindow(
    'remove',
    targetKey,
    windowRefs.collectionSetOperations,
    nconf
  );
}

/**
 * Keep only items in both collections (intersection operation)
 * Opens a Vue window for the operation
 */
function intersectWithCollection() {
  const targetKey = nconf.get('controls:selectedCollection');
  if (!targetKey) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'No Target Collection',
      message: 'Please select a collection from the dropdown first.',
      buttons: ['OK']
    });
    return;
  }
  
  windowManager.createCollectionSetOperationsWindow(
    'intersect',
    targetKey,
    windowRefs.collectionSetOperations,
    nconf
  );
}

/**
 * Add all archive items to the target collection
 * Opens a Vue window for the operation
 */
function addAllItemsToCollection() {
  const targetKey = nconf.get('controls:selectedCollection');
  if (!targetKey) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'No Target Collection',
      message: 'Please select a collection from the dropdown first.',
      buttons: ['OK']
    });
    return;
  }
  
  windowManager.createCollectionSetOperationsWindow(
    'addAll',
    targetKey,
    windowRefs.collectionSetOperations,
    nconf
  );
}

function createMenu() {
  return createMainMenu({
    showCollection: showCollectionRef.value,
    chooseAccessionsPath,
    buildCollection,
    createCreateAccessionsWindow,
    createUpdateCollectionWindow,
    createPersonManagerWindow,
    createCollectionManagerWindow,
    createTreeWindow,
    validateDatabase,
    validateCollection,
    showAbout,
    backupArchive,
    backupAllCollections,
    createMaintenanceCollections,
    updateCollectionMetadata,
    addItemsFromCollection,
    removeItemsFromCollection,
    intersectWithCollection,
    addAllItemsToCollection,
    createBulkEditItemsWindow: createUpdateCollectionWindow, // Alias for now
    editMediaFromMenu,
    importPersonsFromArchive,
    importArchive
  });
} // createMenu

function createMinMenu() {
  return createMinimalMenu({
    createTreeWindow
  });
} // createMinMenu

// ===== File Selection =====

function chooseAccessionsPath() {
  windowManager.chooseAccessionsPath(dialog, mainWindow, resetAccessions, nconf);
}

// ===== Menu Triggered Actions =====

function editMediaFromMenu() {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('menu:editMedia');
  }
}

// ===== Window Creation Functions =====
// These are thin wrappers that delegate to windowManager module

function createMediaWindow(mediaInfo) {
  windowManager.createMediaWindow(mediaInfo, windowRefs.media, nconf);
} // createMediaWindow

function createPersonManagerWindow() {
  windowManager.createPersonManagerWindow(windowRefs.personManager, nconf);
}

function createCreateAccessionsWindow() {
  windowManager.createCreateAccessionsWindow(windowRefs.createAccessions, nconf);
}

function createMediaManagerWindow(identifier, collectionKey = null, sortBy = '1') {
  // Build queue from collection if provided
  let queueData = null;
  if (collectionKey) {
    const collection = accessionClass.collections.getCollection(collectionKey);
    if (collection) {
      const links = collection.getLinks();
      
      // Get items in the collection
      const accessionSorter = accessionClass.accessionSorter;
      const items = accessionClass.accessionJSON.accessions?.item || [];
      const queueItems = items.filter(item => links.includes(item.link));
      
      // Sort by the same method used in main window
      let sortedItems;
      switch(sortBy) {
        case '1': // By Date
          sortedItems = accessionSorter.sortByDate(queueItems);
          break;
        case '2': // By Person
          sortedItems = accessionSorter.sortByPerson(queueItems, accessionClass);
          break;
        case '3': // By Location
          sortedItems = accessionSorter.sortByLocation(queueItems);
          break;
        case '4': // By File
          sortedItems = accessionSorter.sortByFile(queueItems);
          break;
        case '5': // By Source
          sortedItems = accessionSorter.sortBySource(queueItems, accessionClass);
          break;
        case '6': // By Accession
          sortedItems = accessionSorter.sortByAccession(queueItems);
          break;
        default:
          sortedItems = accessionSorter.sortByDate(queueItems);
      }
      
      queueData = {
        collectionKey: collectionKey,
        collectionText: collection.text,
        queue: sortedItems.map(item => item.link)
      };
    }
  }
  
  windowManager.createMediaManagerWindow(identifier, queueData, windowRefs.mediaManager, nconf);
}

function createUpdateCollectionWindow() {
  windowManager.createUpdateCollectionWindow(windowRefs.updateCollection, nconf);
}

function createCollectionManagerWindow(mode) {
  windowManager.createCollectionManagerWindow(mode, windowRefs.collectionManager, collectionManagerModeRef, nconf);
}

// ===== Utility Functions =====
// Wrappers around helper functions to maintain current API

// After changing the accessions file, the main window and views need to be reloaded
function resetAccessions(baseDirectory) {
  // Wrapper to maintain current API
  const saveConfig = (path) => {
    nconf.set('db:accessionsPath', path);
    nconf.save('user');
  };
  const state = { accessionClass, AccessionClass };
  resetAccessionsHelper(state, mainWindow, windowRefs, saveConfig, baseDirectory);
  accessionClass = state.accessionClass; // Update global reference
} // resetAccessions

// When accessionClass is not defined, create a new instance
function verifyAccessions() {
  const state = { accessionClass, AccessionClass };
  const result = verifyAccessionsHelper(state, nconf.get('db:accessionsPath'));
  accessionClass = result; // Update global reference
  return result;
} // verifyAccessions

async function buildCollection() {
  try {
    const selectedCollection = nconf.get('controls:selectedCollection');
    
    if (!selectedCollection) {
      dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        title: 'No Collection Selected',
        message: 'Please select a collection first',
        buttons: ['OK']
      });
      return;
    }
    
    verifyAccessions();
    const collection = accessionClass.collections.getCollection(selectedCollection);
    
    if (!collection) {
      dialog.showMessageBoxSync(mainWindow, {
        type: 'error',
        title: 'Collection Not Found',
        message: `Collection "${selectedCollection}" was not found`,
        buttons: ['OK']
      });
      return;
    }
    
    // Ask if user wants to validate collection first
    const validateResponse = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      title: 'Validate Collection?',
      message: `Export collection "${collection.text}"?`,
      detail: `This will create a new directory with:\n• accessions.json (items and persons)\n• Media files (automatically linked or copied)\n\nWould you like to validate the collection first to check for missing items?`,
      buttons: ['Validate First', 'Export Without Validation', 'Cancel'],
      defaultId: 0,
      cancelId: 2
    });
    
    if (validateResponse === 2) {
      return; // User cancelled
    }
    
    // If user chose to validate first
    if (validateResponse === 0) {
      try {
        const validationResults = await accessionClass.collections.validateCollection(selectedCollection, accessionClass);
        
        if (validationResults.results.errorCount > 0 || validationResults.results.warningCount > 0) {
          const continueResponse = dialog.showMessageBoxSync(mainWindow, {
            type: 'warning',
            title: 'Collection Has Issues',
            message: `Collection "${collection.text}" has validation issues`,
            detail: `Errors: ${validationResults.results.errorCount}\n` +
                    `Warnings: ${validationResults.results.warningCount}\n\n` +
                    `A detailed log has been saved to:\n${validationResults.logInfo.path}\n\n` +
                    `Do you want to continue with the export?`,
            buttons: ['Continue Export', 'Cancel'],
            defaultId: 1,
            cancelId: 1
          });
          
          if (continueResponse === 1) {
            return; // User cancelled
          }
        } else {
          dialog.showMessageBoxSync(mainWindow, {
            type: 'info',
            title: 'Validation Passed',
            message: `Collection is valid! Proceeding with export...`,
            buttons: ['OK']
          });
        }
      } catch (validationError) {
        dialog.showMessageBoxSync(mainWindow, {
          type: 'error',
          title: 'Validation Error',
          message: `Failed to validate collection: ${validationError.message}`,
          buttons: ['OK']
        });
        return;
      }
    }
    
    // Perform the export
    try {
      const result = await buildCollectionHelper(accessionClass, selectedCollection, nconf.get('db:accessionsPath'));
      
      if (result.success) {
        // Show success message with details
        const detailMessage = result.warnings 
          ? `${result.message}\n\nWarnings:\n${result.warnings}`
          : result.message;
        
        dialog.showMessageBoxSync(mainWindow, {
          type: 'info',
          title: 'Export Completed',
          message: `Collection exported successfully`,
          detail: detailMessage,
          buttons: ['OK']
        });
      } else {
        dialog.showMessageBoxSync(mainWindow, {
          type: 'error',
          title: 'Export Failed',
          message: `Failed to export collection`,
          detail: result.error || 'Unknown error',
          buttons: ['OK']
        });
      }
      
    } catch (exportError) {
      dialog.showMessageBoxSync(mainWindow, {
        type: 'error',
        title: 'Export Failed',
        message: `Failed to export collection: ${exportError.message}`,
        detail: exportError.stack || '',
        buttons: ['OK']
      });
    }
  } catch (error) {
    console.error('buildCollection error:', error);
    dialog.showMessageBoxSync(mainWindow, {
      type: 'error',
      title: 'Error',
      message: `An unexpected error occurred: ${error.message}`,
      buttons: ['OK']
    });
  }
} // buildCollection

// ===== About Dialog =====

function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About Shoebox',
    message: `Shoebox v${APP_VERSION}`,
    detail: `A multimedia genealogy archive browser\n\n` +
            `Copyright © 2001-2026 Marvin E Budd\n` +
            `License: MIT\n\n` +
            `Documentation: https://marvbudd.github.io/shoebox/\n` +
            `GitHub: https://github.com/Marvbudd/shoebox\n\n` +
            `Built with Electron ${process.versions.electron}`,
    buttons: ['OK']
  });
}

// ===== Tree Window =====

// create a window to display the family tree website from SecondSite
function createTreeWindow() {
  verifyAccessions();
  let treeURL = accessionClass.getWebsite();
  shell.openExternal(treeURL);
} // createTreeWindow
