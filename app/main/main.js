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

import { app, BrowserWindow, dialog, ipcMain, shell, Menu } from 'electron';
import fs from 'fs';
import electron from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
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

// Import version from package.json
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');
const APP_VERSION = packageJson.version;

console.log('main.js __dirname is ' + __dirname);

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
      "accessionsPath": path.resolve(__dirname, "../resource/accessions.json")
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
  nconf.set('db:accessionsPath', path.resolve(__dirname, "../resource/accessions.json"));
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
    showCollectionRef
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
  
  // Open Person Manager with a specific person selected
  ipcMain.handle('window:openPersonManager', async (event, personID) => {
    try {
      // Open or focus the Person Manager window
      createPersonManagerWindow();
      
      // Send the personID to the Person Manager window after it's ready (if provided)
      if (personID && windowRefs.personManager && windowRefs.personManager.webContents) {
        // Give the window a moment to be ready
        setTimeout(() => {
          windowRefs.personManager.webContents.send('person:select', personID);
        }, 500);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error opening Person Manager:', error);
      return { success: false, error: error.message };
    }
  }); // window:openPersonManager

  // ===== Face Detection IPC Handlers =====
  
  // Initialize face detection service on first use
  const initFaceDetection = async () => {
    if (!faceDetectionService) {
      const modelsPath = path.resolve(__dirname, '../resource/models');
      faceDetectionService = new FaceDetectionService(modelsPath);
      await faceDetectionService.loadModels();
    }
    return faceDetectionService;
  };

  // Detect faces in a photo
  ipcMain.handle('face-detection:detect', async (event, accession, options = {}) => {
    try {
      verifyAccessions();
      const service = await initFaceDetection();
      
      // Get image path
      const itemView = accessionClass.getItemView(accession);
      if (!itemView) {
        throw new Error(`Item not found: ${accession}`);
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
        accession,
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
  ipcMain.handle('face-detection:match', async (event, accession, detectedFaces) => {
    try {
      verifyAccessions();
      
      if (!detectedFaces || detectedFaces.length === 0) {
        return { success: true, matches: [], unmatchedFaces: [] };
      }
      
      const itemView = accessionClass.getItemView(accession);
      if (!itemView) {
        throw new Error(`Item not found: ${accession}`);
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
      // - 0.6 is industry standard for matching SAME PERSON across DIFFERENT PHOTOS
      // - For re-detecting SAME IMAGE with SAME MODEL, expect distance ≈ 0.0 (perfect match)
      // - Use stricter threshold (0.05) to avoid false positives from descriptor drift
      const CROSS_PHOTO_THRESHOLD = 0.6;  // For different photos of same person
      const SAME_IMAGE_THRESHOLD = 0.05;  // For re-detecting same image (expect ~0.0)
      
      // Auto-match only if confidence > 90% (distance < 0.05)
      // This prevents questionable matches from being auto-assigned
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
          
          const personName = `${person.first || ''} ${person.last?.[0]?.last || ''}`.trim();
          // Calculate confidence using cross-photo threshold (0.6) for display consistency
          const confidence = Math.round((1 - (distance / CROSS_PHOTO_THRESHOLD)) * 100);
          
          if (distance < bestDistance && distance < MATCH_THRESHOLD) {
            bestDistance = distance;
            bestMatch = {
              personIndex,
              personID: personRef.personID,
              distance,
              confidence: 1 - (distance / CROSS_PHOTO_THRESHOLD)  // Use 0.6 for display
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
      `\nLog file saved to:\n${logInfo.filename}`;
    
    // Build buttons array - include cleanup button only if orphans exist
    const buttons = ['OK', 'Open Log File'];
    if (logInfo.orphanedDescriptorCount > 0) {
      buttons.push('Cleanup Orphaned Descriptors');
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
    } else if (response.response === 2 && logInfo.orphanedDescriptorCount > 0) {
      // Cleanup Orphaned Descriptors
      await cleanupOrphanedDescriptors();
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
    
    const buttons = results.errorCount === 0 && results.warningCount === 0
      ? ['OK']
      : ['Open Log File', 'Close'];
    
    const dialogResponse = await dialog.showMessageBox(mainWindow, {
      type: results.errorCount > 0 ? 'warning' : 'info',
      title: 'Collection Validation Complete',
      message: message,
      buttons: buttons,
      defaultId: 0
    });
    
    // If user clicked "Open Log File"
    if (dialogResponse.response === 0 && buttons.length > 1) {
      await shell.openPath(logInfo.path);
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
    
    // Show current values (placeholder for full editor)
    const currentText = selectedCollection.text || selectedCollection.key;
    const currentTitle = selectedCollection.title || selectedCollection.key;
    
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Collection Metadata',
      message: `Collection: ${selectedCollection.key}`,
      detail: `Current Text: ${currentText}\nCurrent Title: ${currentTitle}\n\nFull editor dialog coming soon...\n\n(Key "${selectedCollection.key}" cannot be changed - it's the filename)`,
      buttons: ['OK']
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
    createBulkEditItemsWindow: createUpdateCollectionWindow // Alias for now
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

function createMediaManagerWindow(identifier) {
  windowManager.createMediaManagerWindow(identifier, windowRefs.mediaManager, nconf);
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
      detail: `This will create a new directory with:\n• accessions.json (items and persons)\n• commands file (to copy media files)\n\nWould you like to validate the collection first to check for missing items?`,
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
                    `A detailed log has been saved to:\n${validationResults.logInfo.logPath}\n\n` +
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
      const result = buildCollectionHelper(accessionClass, selectedCollection, nconf.get('db:accessionsPath'));
      
      // Show success message (buildCollectionHelper runs async, so we show generic success)
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Export Started',
        message: `Collection export initiated`,
        detail: `Creating export for "${collection.text}"...\n\nCheck the terminal/console for completion status.`,
        buttons: ['OK']
      });
      
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
