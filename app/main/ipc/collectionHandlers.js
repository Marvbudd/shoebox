/**
 * Collection-related IPC handlers
 * 
 * Handles all IPC communication for collection management:
 * - Listing collections
 * - Getting collection items
 * - Creating collections
 * - Updating collections (bulk update items)
 * - Deleting collections
 * - Validating collections
 */

import { dialog, shell } from 'electron';
import { ValidationService } from '../utils/ValidationService.js';

/**
 * Register all collection-related IPC handlers
 * 
 * @param {Electron.IpcMain} ipcMain - The Electron IPC main instance
 * @param {Function} getAccessionClass - Function that returns the current AccessionClass instance
 * @param {Function} verifyAccessions - Function to ensure AccessionClass is initialized
 * @param {Function} getMainWindow - Function that returns the main window
 * @param {Function} resetAccessions - Function to reload accessions
 * @param {Function} getCollectionManagerMode - Function that returns collection manager mode
 * @param {Object} nconf - Configuration object
 */
export function registerCollectionHandlers(
  ipcMain,
  getAccessionClass,
  verifyAccessions,
  getMainWindow,
  resetAccessions,
  getCollectionManagerMode,
  nconf
) {

  // List all collections
  ipcMain.handle('collections:list', async () => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      return accessionClass.getCollections();
    } catch (error) {
      console.error('Failed to get collections:', error);
      return [];
    }
  });

  // Get items in a specific collection
  ipcMain.handle('collection:getItems', async (_event, collectionKey) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      const collection = accessionClass.collections.getCollection(collectionKey);
      
      if (!collection) {
        return [];
      }
      
      // Use getLinks() method to maintain encapsulation
      // Returns array of link strings
      return collection.getLinks();
    } catch (error) {
      console.error('Failed to get collection items:', error);
      return [];
    }
  });

  // Create a new collection
  ipcMain.handle('collection:create', async (_event, data) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      accessionClass.createCollection(data.key, data.title, data.text);
      nconf.set('controls:selectedCollection', data.key);
      nconf.save('user');
      
      // Refresh main window
      const mainWindow = getMainWindow();
      if (mainWindow) {
        resetAccessions();
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to create collection:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // Update all items in a collection with new metadata
  ipcMain.handle('collection:update', async (_event, updateData) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      
      // Backup archive before bulk update
      const backupResult = accessionClass.backupAccessions();
      if (!backupResult.success) {
        return { 
          success: false, 
          error: `Backup failed before update: ${backupResult.error}. Operation aborted to protect data integrity.` 
        };
      }
      
      // Use encapsulated method to bulk update items
      const updatedCount = accessionClass.bulkUpdateCollectionItems(
        updateData.collectionKey,
        updateData.updates,
        updateData.onlyIfEmpty
      );
      
      if (updatedCount === 0 && !accessionClass.collections.getCollection(updateData.collectionKey)) {
        return { success: false, error: 'Collection not found' };
      }
      
      // Refresh main window
      const mainWindow = getMainWindow();
      if (mainWindow) {
        resetAccessions();
      }
      
      return { success: true, itemsUpdated: updatedCount };
    } catch (error) {
      console.error('Failed to update collection:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // Delete a collection
  ipcMain.handle('collection:delete', async (_event, collectionKey) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      accessionClass.deleteCollection(collectionKey);
      
      // Refresh main window
      const mainWindow = getMainWindow();
      if (mainWindow) {
        resetAccessions();
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to delete collection:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // Get collection manager mode (create or delete)
  ipcMain.handle('collectionManager:getMode', async () => {
    return getCollectionManagerMode();
  });

  // Validate a collection
  ipcMain.handle('collection:validate', async (_event, collectionKey) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      const collection = accessionClass.collections.getCollection(collectionKey);
      
      if (!collection) {
        return { 
          success: false, 
          error: `Collection "${collectionKey}" not found` 
        };
      }
      
      // Create validation service and validate the collection
      const baseDirectory = accessionClass.baseDirectory;
      const validationService = new ValidationService(accessionClass, baseDirectory);
      const results = await validationService.validateCollection(collectionKey, collection);
      
      // Write log file
      const logInfo = await validationService.writeCollectionLogFile(collectionKey, results);
      
      // Show dialog with results
      const message = results.errorCount === 0 && results.warningCount === 0
        ? `Collection "${collectionKey}" validation complete!\n\nNo errors or warnings found.\n\nLog file: ${logInfo.filename}`
        : `Collection "${collectionKey}" validation complete!\n\nErrors: ${results.errorCount}\nWarnings: ${results.warningCount}\n\nLog file: ${logInfo.filename}`;
      
      const buttons = results.errorCount === 0 && results.warningCount === 0
        ? ['OK']
        : ['Open Log File', 'Close'];
      
      const mainWindow = getMainWindow();
      const response = await dialog.showMessageBox(mainWindow, {
        type: results.errorCount > 0 ? 'warning' : 'info',
        title: 'Collection Validation Complete',
        message: message,
        buttons: buttons,
        defaultId: 0
      });
      
      // If user clicked "Open Log File"
      if (response.response === 0 && buttons.length > 1) {
        await shell.openPath(logInfo.path);
      }
      
      return {
        success: true,
        ...results,
        logFile: logInfo.filename
      };
      
    } catch (error) {
      console.error('Failed to validate collection:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // Execute collection set operations (add, remove, intersect, addAll)
  ipcMain.handle('collection:executeSetOperation', async (_event, operationData) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      const { operation, targetCollection, sourceCollection } = operationData;

      // Validate target collection exists
      if (!accessionClass.collections.getCollection(targetCollection)) {
        return { success: false, error: `Target collection "${targetCollection}" not found` };
      }

      // Note: Backups are handled automatically by the collection operation methods
      
      let result;
      let message = '';
      const accessionsPath = accessionClass.accessionFilename;

      // Validate accessionsPath exists
      if (!accessionsPath) {
        return { success: false, error: 'Accessions path not found. Please ensure an accessions file is loaded.' };
      }

      switch (operation) {
        case 'add': {
          // Validate source collection
          if (!sourceCollection) {
            return { success: false, error: 'Source collection is required for add operation' };
          }
          if (!accessionClass.collections.getCollection(sourceCollection)) {
            return { success: false, error: `Source collection "${sourceCollection}" not found` };
          }

          result = accessionClass.collections.addItemsFromCollection(
            targetCollection,
            sourceCollection,
            accessionsPath
          );
          message = `Added ${result.addedCount} item(s) from "${sourceCollection}" to "${targetCollection}". ${result.skippedCount} duplicate(s) skipped.`;
          break;
        }

        case 'remove': {
          // Validate source collection
          if (!sourceCollection) {
            return { success: false, error: 'Source collection is required for remove operation' };
          }
          if (!accessionClass.collections.getCollection(sourceCollection)) {
            return { success: false, error: `Source collection "${sourceCollection}" not found` };
          }

          result = accessionClass.collections.removeItemsFromCollection(
            targetCollection,
            sourceCollection,
            accessionsPath
          );
          message = `Removed ${result.removedCount} item(s) from "${targetCollection}".`;
          break;
        }

        case 'intersect': {
          // Validate source collection
          if (!sourceCollection) {
            return { success: false, error: 'Source collection is required for intersect operation' };
          }
          if (!accessionClass.collections.getCollection(sourceCollection)) {
            return { success: false, error: `Source collection "${sourceCollection}" not found` };
          }

          result = accessionClass.collections.intersectWithCollection(
            targetCollection,
            sourceCollection,
            accessionsPath
          );
          message = `Kept ${result.keptCount} item(s) in "${targetCollection}". Removed ${result.removedCount} item(s) not in "${sourceCollection}".`;
          break;
        }

        case 'addAll': {
          result = accessionClass.collections.addAllArchiveItems(
            targetCollection,
            accessionClass,
            accessionsPath
          );
          message = `Added ${result.addedCount} item(s) from archive to "${targetCollection}". ${result.skippedCount} duplicate(s) skipped.`;
          break;
        }

        default:
          return { success: false, error: `Unknown operation: ${operation}` };
      }

      // Refresh main window
      const mainWindow = getMainWindow();
      if (mainWindow) {
        resetAccessions();
      }

      return { success: true, message, ...result };

    } catch (error) {
      console.error('Failed to execute collection set operation:', error);
      return { success: false, error: error.message || String(error) };
    }
  });
}
