/**
 * Utility helper functions for the main Electron process
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
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
 * Export collection media files to destination directory
 * Uses cross-platform fallback strategy: symlinks → hard links → copy
 * 
 * Strategy:
 * 1. Try symbolic links first (works on Linux/macOS, Windows 10+ with Developer Mode)
 * 2. If symlink fails (EPERM), try hard links (works everywhere on same filesystem)
 * 3. If hard link fails, fall back to copying files
 * 
 * @param {Object} accessionClass - AccessionClass instance
 * @param {string} selectedCollection - Collection key to export
 * @param {string} sourceDir - Source directory containing media subdirectories
 * @param {string} destDir - Destination directory for exported media
 * @returns {Promise<Object>} Result object with success status and statistics
 */
async function exportCollectionMedia(accessionClass, selectedCollection, sourceDir, destDir) {
  const collection = accessionClass.collections.getCollection(selectedCollection);
  const links = collection.getLinks();
  
  // Track statistics and method used
  const stats = {
    total: links.length,
    symlinks: 0,
    hardlinks: 0,
    copies: 0,
    errors: []
  };
  
  // Determine which method to use on first attempt
  let linkMethod = null; // Will be: 'symlink', 'hardlink', or 'copy'
  
  // Get sorted items by type, filtering out any null items (missing from database)
  const sortedItems = links
    .map(link => {
      const itemView = accessionClass.getItemView(null, link);
      if (!itemView) {
        // Item not found in database - track as error
        stats.errors.push({
          file: link,
          type: 'unknown',
          error: 'Item not found in database'
        });
        return null;
      }
      return {
        type: itemView.getType(),
        link: itemView.getLink()
      };
    })
    .filter(item => item !== null) // Remove null entries
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }
      return a.link.localeCompare(b.link);
    });
  
  // Process each item
  for (const item of sortedItems) {
    const sourcePath = path.join(sourceDir, item.type, item.link);
    const destPath = path.join(destDir, item.type, item.link);
    
    try {
      // If method not determined yet, try in order: symlink → hardlink → copy
      if (!linkMethod) {
        try {
          await fsPromises.symlink(sourcePath, destPath);
          linkMethod = 'symlink';
          stats.symlinks++;
          continue;
        } catch (symlinkErr) {
          if (symlinkErr.code === 'EPERM' || symlinkErr.code === 'ENOSYS') {
            // Symlinks not supported or no permission, try hard link
            try {
              await fsPromises.link(sourcePath, destPath);
              linkMethod = 'hardlink';
              stats.hardlinks++;
              continue;
            } catch (hardlinkErr) {
              if (hardlinkErr.code === 'EXDEV' || hardlinkErr.code === 'EPERM') {
                // Cross-device or no permission, fall back to copy
                await fsPromises.copyFile(sourcePath, destPath);
                linkMethod = 'copy';
                stats.copies++;
                continue;
              }
              throw hardlinkErr;
            }
          }
          throw symlinkErr;
        }
      }
      
      // Use determined method for remaining files
      switch (linkMethod) {
        case 'symlink':
          await fsPromises.symlink(sourcePath, destPath);
          stats.symlinks++;
          break;
        case 'hardlink':
          await fsPromises.link(sourcePath, destPath);
          stats.hardlinks++;
          break;
        case 'copy':
          await fsPromises.copyFile(sourcePath, destPath);
          stats.copies++;
          break;
      }
    } catch (error) {
      stats.errors.push({
        file: item.link,
        type: item.type,
        error: error.message
      });
    }
  }
  
  return {
    success: stats.errors.length === 0,
    method: linkMethod,
    stats
  };
}

/**
 * Build collection - create directory structure and files for export
 * @param {Object} accessionClass - AccessionClass instance
 * @param {string} selectedCollection - Collection key to export
 * @param {string} accessionsPath - Path to accessions.json
 * @returns {Promise<Object>} Result object with success status and details
 */
export async function buildCollection(accessionClass, selectedCollection, accessionsPath) {
  const sourceDir = path.dirname(accessionsPath);
  const collectionDir = path.resolve(sourceDir, '../', selectedCollection);
  
  try {
    // Create collection directory if it doesn't exist
    try {
      await fsPromises.mkdir(collectionDir, { recursive: true });
    } catch (mkdirError) {
      return { success: false, error: `Failed to create directory: ${mkdirError.message}` };
    }
    
    // Verify it's a directory
    const stats = await fsPromises.stat(collectionDir);
    if (!stats.isDirectory()) {
      return { success: false, error: `${collectionDir} is not a directory` };
    }
    
    // Create media subdirectories
    const mediaTypes = ['audio', 'photo', 'video'];
    for (const type of mediaTypes) {
      await fsPromises.mkdir(path.join(collectionDir, type), { recursive: true });
    }
    
    // Export media files using cross-platform method
    const mediaResult = await exportCollectionMedia(
      accessionClass,
      selectedCollection,
      sourceDir,
      collectionDir
    );
    
    // Create accessions.json
    const accessionsFilePath = path.resolve(collectionDir, 'accessions.json');
    const accessionsFile = accessionClass.getAccessions(selectedCollection);
    await fsPromises.writeFile(accessionsFilePath, JSON.stringify(accessionsFile, null, 2));
    
    // Calculate statistics
    const itemCount = accessionsFile.accessions.item.length;
    const personCount = Object.keys(accessionsFile.persons || {}).length;
    
    // Build success message with method used
    let methodMessage = '';
    if (mediaResult.method === 'symlink') {
      methodMessage = 'Media files linked using symbolic links';
    } else if (mediaResult.method === 'hardlink') {
      methodMessage = 'Media files linked using hard links';
    } else if (mediaResult.method === 'copy') {
      methodMessage = 'Media files copied';
    }
    
    const message = `Collection exported successfully!\n\n` +
      `Location: ${collectionDir}\n` +
      `Items: ${itemCount}\n` +
      `Persons: ${personCount}\n` +
      `${methodMessage}`;
    
    console.log(`Collection exported: ${itemCount} items, ${personCount} persons, method: ${mediaResult.method}`);
    
    // Export is successful if we created the files, even if some items were missing
    // Missing items are warnings, not fatal errors
    const result = {
      success: true,
      collectionDir,
      itemCount,
      personCount,
      method: mediaResult.method,
      stats: mediaResult.stats,
      message
    };
    
    // Add warnings if there were errors (missing items, failed copies, etc.)
    if (mediaResult.stats.errors.length > 0) {
      result.warnings = `${mediaResult.stats.errors.length} item(s) could not be exported:\n` +
        mediaResult.stats.errors.map(e => `  ${e.type}/${e.file}: ${e.error}`).join('\n');
    }
    
    return result;
    
  } catch (error) {
    console.error('Error exporting collection:', error);
    return { success: false, error: `Export failed: ${error.message}` };
  }
}
