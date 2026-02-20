/**
 * Accessions creation and media-related IPC handlers
 * 
 * Handles:
 * - Directory selection
 * - Creating new accessions
 * - Media path resolution
 * - Archive validation
 */

import crypto from 'crypto';
import path from 'path';
import { AccessionClass } from '../../main/utils/AccessionClass.js';
import { ValidationService } from '../utils/ValidationService.js';

/**
 * Register accessions and media IPC handlers
 * 
 * @param {Electron.IpcMain} ipcMain - The Electron IPC main instance
 * @param {Electron.Dialog} dialog - The Electron dialog module
 * @param {Function} getAccessionClass - Function that returns the current AccessionClass instance
 * @param {Function} setAccessionClass - Function to set the AccessionClass instance
 * @param {Function} verifyAccessions - Function to ensure AccessionClass is initialized
 * @param {Function} resetAccessions - Function to reload accessions
 * @param {Function} getCreateAccessionsWindow - Function that returns create accessions window
 * @param {Object} nconf - Configuration object
 * @param {Electron.Shell} shell - The Electron shell module
 */
export function registerAccessionsHandlers(
  ipcMain,
  dialog,
  getAccessionClass,
  setAccessionClass,
  verifyAccessions,
  resetAccessions,
  getCreateAccessionsWindow,
  nconf,
  shell
) {

  // Directory selection dialog
  ipcMain.handle('directory:select', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    
    if (result.canceled) {
      return { canceled: true };
    }
    
    return { 
      canceled: false, 
      filePath: result.filePaths[0] 
    };
  });

  // Create new accessions
  ipcMain.handle('accessions:create', async (_event, formData) => {
    try {
      // Save existing accessions if any
      let accessionClass = getAccessionClass();
      if (accessionClass) {
        accessionClass.saveAccessions();
        setAccessionClass(undefined);
      }

      // Set new accessions path
      const accessionsPath = path.resolve(formData.directory, "accessions.json");
      nconf.set('db:accessionsPath', accessionsPath);
      nconf.save('user');

      // Create new AccessionClass with title
      accessionClass = new AccessionClass(accessionsPath, formData.title);
      setAccessionClass(accessionClass);

      // Handle source person if provided
      let sourcePersonID = null;
      if (formData.sourceMode === 'existing' && formData.sourcePersonID) {
        // Use existing person
        sourcePersonID = formData.sourcePersonID;
      } else if (formData.sourceMode === 'new' && (formData.sourceFirstName || formData.sourceLastName)) {
        // Create new person
        sourcePersonID = crypto.randomUUID();
        
        const newPerson = {
          personID: sourcePersonID,
          TMGID: formData.sourceTMGID ? parseInt(formData.sourceTMGID) : null,
          first: formData.sourceFirstName || '',
          last: formData.sourceLastName ? [{ last: formData.sourceLastName }] : []
        };
        
        // Add person to accessions using encapsulated method
        accessionClass.savePerson(newPerson);
      }

      // Build form data in the format expected by addMediaFiles
      const mediaFormData = {
        selectQuery: 'directory',
        title: formData.title,
        updateFocus: formData.directory,
        description: formData.description || '',
        dateYear: formData.dateYear || '',
        dateMonth: formData.dateMonth || '',
        dateDay: formData.dateDay || '',
        locationDetail: formData.locationDetail || '',
        locationCity: formData.locationCity || '',
        locationState: formData.locationState || ''
      };

      // Add source information if provided
      if (sourcePersonID) {
        mediaFormData.sourcePersonID = sourcePersonID;
        // Use the properly formatted date object
        if (formData.dateReceivedParsed) {
          mediaFormData.dateReceived = formData.dateReceivedParsed;
        }
      }

      // Add media files
      await accessionClass.addMediaFiles(mediaFormData);

      // Save the accessions
      accessionClass.saveAccessions();

      // Get item count
      const itemCount = accessionClass.accessionJSON.accessions?.item?.length || 0;

      // Close window first, then reset (avoid race condition during window destruction)
      const createAccessionsWindow = getCreateAccessionsWindow();
      if (createAccessionsWindow && !createAccessionsWindow.isDestroyed()) {
        createAccessionsWindow.close();
        // Wait for window to fully close before resetting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Now safe to reset and send IPC messages
      resetAccessions();

      return { success: true, itemsAdded: itemCount };
    } catch (error) {
      console.error('Failed to create accessions:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // Get media file path
  ipcMain.handle('media:getPath', async (_event, type, link) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      const baseDir = path.dirname(accessionClass.accessionFilename);
      const resourcePath = path.resolve(baseDir, type, link);
      return `file://${resourcePath}`;
    } catch (error) {
      console.error('Failed to get media path:', error);
      return null;
    }
  });

  // Open file in system default viewer
  ipcMain.handle('file:open', async (_event, filePath) => {
    try {
      // Remove file:// prefix if present
      const cleanPath = filePath.replace(/^file:\/\//, '');
      
      // shell.openPath returns "" on success, or error message string on failure
      const result = await shell.openPath(cleanPath);
      
      if (result) {
        // Non-empty string means error
        console.error('Failed to open file:', result);
        return { success: false, error: result };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to open file:', error);
      return { success: false, error: error.message };
    }
  });

  // Validate archive
  ipcMain.handle('accessions:validate', async (_event) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      const baseDir = path.dirname(accessionClass.accessionFilename);
      
      const validationService = new ValidationService(accessionClass, baseDir);
      await validationService.validate();
      const result = await validationService.writeLogFile();
      
      return { 
        success: true, 
        ...result
      };
    } catch (error) {
      console.error('Failed to validate archive:', error);
      return { 
        success: false, 
        error: error.message || String(error) 
      };
    }
  });

  // Get audio and video items for playlist dropdown
  ipcMain.handle('accessions:getAudioVideoItems', async (_event) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      
      if (!accessionClass.accessionJSON?.accessions?.item) {
        return [];
      }
      
      // Filter for audio and video items only
      const audioVideoItems = accessionClass.accessionJSON.accessions.item
        .filter(item => item.type === 'audio' || item.type === 'video')
        .map(item => ({
          accession: item.accession,
          link: item.link,
          type: item.type,
          description: item.description || ''
        }))
        .sort((a, b) => {
          // Sort by type first (audio before video), then by link
          if (a.type !== b.type) {
            return a.type === 'audio' ? -1 : 1;
          }
          return (a.link || '').localeCompare(b.link || '');
        });
      
      return audioVideoItems;
    } catch (error) {
      console.error('Failed to get audio/video items:', error);
      return [];
    }
  });

  // Reverse geocoding using Nominatim API
  ipcMain.handle('geocoding:reverse', async (event, latitude, longitude) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ShoeboxApp/2.2 (Genealogy Application)'
        }
      });

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.address) {
        // Try multiple fields for city/locality (varies by country and region)
        const city = data.address.city || 
                     data.address.town || 
                     data.address.village || 
                     data.address.municipality ||
                     data.address.county ||
                     data.address.district ||
                     data.address.locality ||
                     '';
        const state = data.address.state || data.address.region || '';
        
        return {
          success: true,
          city,
          state,
          fullAddress: data.display_name
        };
      } else {
        return {
          success: false,
          error: 'No address found for these coordinates'
        };
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });}