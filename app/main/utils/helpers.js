/**
 * Utility helper functions for the main Electron process
 */

import fs from 'fs';
import path from 'path';

/**
 * Generate standardized timestamp for log files and backups
 * Format: YYYYDDD-HHMMSS (year + day of year + time)
 * Example: 2025364-143052 (December 30, 2025 at 14:30:52)
 * 
 * @returns {string} Formatted timestamp
 */
export function generateTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  
  // Calculate day of year (1-366)
  const start = new Date(year, 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  
  // Format time as HHMMSS
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${String(dayOfYear).padStart(3, '0')}-${hours}${minutes}${seconds}`;
}

/**
 * Convert HH:MM:SS time format to seconds
 * @param {string} hms - Time in HH:MM:SS or HH:MM:SS.s format
 * @returns {number} Total seconds
 */
export function hmsToSeconds(hms) {
  const parts = hms.split(':');
  return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
}

/**
 * Verify that accessionClass is initialized, create if needed
 * @param {Object} state - Application state object containing accessionClass and AccessionClass constructor
 * @param {string} accessionsPath - Path to accessions.json file
 * @returns {Object} The accessionClass instance
 */
export function verifyAccessions(state, accessionsPath) {
  if (!state.accessionClass) {
    state.accessionClass = new state.AccessionClass(accessionsPath);
  }
  return state.accessionClass;
}

/**
 * Reset accessions - save current, optionally change path, reload main window
 * IMPORTANT: When the model (AccessionClass) changes, views need to refresh.
 * This function notifies all view windows to reload their data without closing them.
 * Only when switching accessions files (baseDirectory provided) do we close windows.
 * 
 * @param {Object} state - Application state object
 * @param {Object} mainWindow - Main BrowserWindow instance
 * @param {Object} mediaWindow - Media BrowserWindow instance (can be null)
 * @param {Function} saveConfig - Function to save configuration (nconf.save)
 * @param {string} baseDirectory - Optional new path to accessions.json
 * @param {Object} windowRefs - Optional references to all view windows for refresh notifications
 */
export function resetAccessions(state, mainWindow, mediaWindow, saveConfig, baseDirectory, windowRefs = null) {
  // A new baseDirectory means we save any changes and reset the accessionsPath
  if (baseDirectory) {
    if (state.accessionClass) {
      state.accessionClass.saveAccessions(); // Persist the current accessions
      state.accessionClass = undefined;
    }
    state.accessionsPath = baseDirectory; // Update state
    saveConfig(baseDirectory); // Save the new accessionsPath to nconf
    
    // When switching accessions files, close all view windows (they'll show wrong data)
    if (windowRefs) {
      windowRefs.media?.value?.close();
      windowRefs.mediaManager?.value?.close();
      windowRefs.personManager?.value?.close();
      // Don't close createAccessions, updateCollection, collectionManager - they're modal dialogs
    }
    
    // Full reload of main window (don't preserve sort since switching files)
    mainWindow.webContents.send('items:render', JSON.stringify({ reload: true }));
  } else {
    // Model changed but same accessions file - just refresh views without closing
    // Send refresh event to main window (preserve current sort selection)
    mainWindow.webContents.send('items:render', JSON.stringify({ reload: true, preserveSort: true }));
    
    // Notify other view windows to refresh (if they're open)
    if (windowRefs) {
      // Media Player - send refresh event instead of closing
      if (windowRefs.media?.value && !windowRefs.media.value.isDestroyed()) {
        windowRefs.media.value.webContents.send('accession:changed');
      }
      
      // Person Manager - send refresh event
      if (windowRefs.personManager?.value && !windowRefs.personManager.value.isDestroyed()) {
        windowRefs.personManager.value.webContents.send('accession:changed');
      }
      
      // Media Manager - send refresh event
      if (windowRefs.mediaManager?.value && !windowRefs.mediaManager.value.isDestroyed()) {
        windowRefs.mediaManager.value.webContents.send('accession:changed');
      }
    }
  }
}

/**
 * Build collection - create directory structure and files for export
 * @param {Object} accessionClass - AccessionClass instance
 * @param {string} selectedCollection - Collection key to export
 * @param {string} accessionsPath - Path to accessions.json
 */
export function buildCollection(accessionClass, selectedCollection, accessionsPath) {
  const sourceDir = path.dirname(accessionsPath);
  const collectionDir = path.resolve(sourceDir, '../', selectedCollection);
  
  // Getting information for a directory
  fs.stat(collectionDir, (error, stats) => {
    if (error) {
      if (error.code === 'ENOENT') {
        console.log(`Creating Directory ${collectionDir} for collection ${selectedCollection}.`);
        try {
          fs.mkdirSync(collectionDir);
        } catch (mkdirError) {
          console.error('Failed to create collection directory:', mkdirError);
          return { success: false, error: `Failed to create directory: ${mkdirError.message}` };
        }
      } else {
        console.error('buildCollection Directory error ' + error);
        return { success: false, error: `Directory error: ${error.message}` };
      }
    } else {
      if (!stats.isDirectory()) {
        console.error(`${collectionDir} is not a directory!!!`);
        return { success: false, error: `${collectionDir} is not a directory` };
      }
    }
    
    const commandsPath = path.resolve(collectionDir, 'commands');
    try {
      const commandsFile = accessionClass.getCommands(sourceDir, collectionDir, selectedCollection);
      fs.writeFileSync(commandsPath, commandsFile.split("\r\n").join("\n"));
      console.log(`Created ${commandsPath}`);
    } catch (error) {
      console.error('Error creating commands:', error);
      return { success: false, error: `Failed to create commands file: ${error.message}` };
    }
    
    const accessionsPath = path.resolve(collectionDir, 'accessions.json');
    try {
      const accessionsFile = accessionClass.getAccessions(selectedCollection);
      fs.writeFileSync(accessionsPath, JSON.stringify(accessionsFile, null, 2));
      console.log(`Created ${accessionsPath}`);
      
      // Success - return summary
      const itemCount = accessionsFile.accessions.item.length;
      const personCount = Object.keys(accessionsFile.persons || {}).length;
      console.log(`Collection exported successfully: ${itemCount} items, ${personCount} persons`);
      return { 
        success: true, 
        collectionDir,
        itemCount,
        personCount,
        message: `Collection exported successfully!\n\nLocation: ${collectionDir}\nItems: ${itemCount}\nPersons: ${personCount}`
      };
    } catch (error) {
      console.error('Error creating accessions.json:', error);
      return { success: false, error: `Failed to create accessions.json: ${error.message}` };
    }
  });
}
