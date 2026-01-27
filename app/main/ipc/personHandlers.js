/**
 * Person-related IPC handlers
 * 
 * Handles all IPC communication for person management:
 * - Getting persons (all, by ID, by TMGID)
 * - Saving persons
 * - Creating person keys
 * - Updating TMGID
 * - Getting items for persons
 * - Getting persons from accessions
 * - Getting descriptors for model pre-selection
 */

import fs from 'fs';
import path from 'path';
import { BrowserWindow } from 'electron';
import { PersonService } from '../utils/PersonService.js';

/**
 * Register all person-related IPC handlers
 * 
 * @param {Electron.IpcMain} ipcMain - The Electron IPC main instance
 * @param {Function} getAccessionClass - Function that returns the current AccessionClass instance
 * @param {Function} verifyAccessions - Function to ensure AccessionClass is initialized
 */
export function registerPersonHandlers(ipcMain, getAccessionClass, verifyAccessions) {
  
  // Getting all persons
  ipcMain.handle('person:getAll', async () => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    const personsObject = accessionClass.accessionJSON.persons;
    
    // Convert persons object to array with item reference counts
    return Object.entries(personsObject).map(([personID, person]) => {
      const itemCount = accessionClass.getItemsForPerson(personID).length;
      return {
        personID,
        ...person,
        itemCount
      };
    });
  });

  ipcMain.handle('person:get', async (_event, personKey) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    const person = accessionClass.getPerson(personKey);
    return person;
  }); // person:get

  ipcMain.handle('person:getByTMGID', async (_event, tmgid) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    const personData = accessionClass.getPersonByTMGID(tmgid);
    return personData;
  }); // person:getByTMGID

  ipcMain.handle('person:save', async (_event, person) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    try {
      const personID = accessionClass.savePerson(person);
      
      // Broadcast to all windows that a person was saved
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('person:saved', personID);
      });
      
      return { success: true, personID }; // Return success status and personID
    } catch (error) {
      console.error('Failed to save person:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle('person:delete', async (_event, personID) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    try {
      const success = accessionClass.deletePerson(personID);
      
      if (!success) {
        return { success: false, error: 'Person not found or is referenced by items' };
      }
      
      // Broadcast to all windows that a person was deleted
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('person:deleted', personID);
      });
      
      return { success: true };
    } catch (error) {
      console.error('Failed to delete person:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.on('person:createKey', (event, personData) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    try {
      const person = JSON.parse(personData);
      const personKey = accessionClass.createPersonKey(person);
      event.returnValue = personKey;
    } catch (error) {
      console.error('Failed to parse person data in person:createKey:', error);
      event.returnValue = null;
    }
  }); // person:createKey

  ipcMain.on('person:updateTMGID', (event, data) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    try {
      const { personKey, tmgid } = JSON.parse(data);
      const success = accessionClass.updatePersonTMGID(personKey, tmgid);
      event.returnValue = success;
    } catch (error) {
      console.error('Failed to parse data in person:updateTMGID:', error);
      event.returnValue = false;
    }
  }); // person:updateTMGID

  ipcMain.on('person:getItems', (event, personKey) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    const items = accessionClass.getItemsForPerson(personKey);
    event.returnValue = items;
  }); // person:getItems

  ipcMain.on('person:getWithItems', (event, personKey) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    const personWithItems = accessionClass.getPersonWithItems(personKey);
    event.returnValue = personWithItems;
  }); // person:getWithItems

  ipcMain.handle('persons:getExisting', async (_event, directoryPath) => {
    try {
      const accessionsPath = path.resolve(directoryPath, 'accessions.json');
      
      // Check if accessions.json exists
      if (!fs.existsSync(accessionsPath)) {
        return [];
      }
      
      // Read and parse the file
      const data = fs.readFileSync(accessionsPath, 'utf8');
      const json = JSON.parse(data);
      
      // Extract persons array
      if (json.persons && typeof json.persons === 'object') {
        return Object.values(json.persons);
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get existing persons:', error);
      return [];
    }
  });

  ipcMain.handle('persons:getFromAccessions', async () => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      if (!accessionClass || !accessionClass.accessionJSON.persons) {
        return [];
      }
      return Object.values(accessionClass.accessionJSON.persons);
    } catch (error) {
      console.error('Failed to get persons from accessions:', error);
      return [];
    }
  });

  // Get persons with face descriptors for similarity search
  ipcMain.handle('persons:getWithDescriptors', async () => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      if (!accessionClass || !accessionClass.accessionJSON.persons) {
        return [];
      }
      
      // Collect face descriptors from persons.faceBioData (new centralized structure)
      const personsWithDescriptors = [];
      
      const persons = accessionClass.accessionJSON.persons;
      Object.entries(persons).forEach(([personID, personData]) => {
        // Check if person has faceBioData
        if (personData.faceBioData && 
            Array.isArray(personData.faceBioData) &&
            personData.faceBioData.length > 0) {
          
          personsWithDescriptors.push({
            personID,
            first: personData.first || '',
            last: personData.last || [],
            descriptors: personData.faceBioData.map(d => ({
              link: d.link,
              model: d.model || 'ssd',
              descriptor: d.descriptor,
              confidence: d.confidence || 0
            }))
          });
        }
      });
      
      return personsWithDescriptors;
    } catch (error) {
      console.error('Failed to get persons with descriptors:', error);
      return [];
    }
  });

  // Get descriptors for a specific link (for model pre-selection)
  ipcMain.handle('persons:getDescriptorsForLink', async (_event, link) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      if (!accessionClass || !accessionClass.accessionJSON.persons) {
        return [];
      }

      const personService = new PersonService(accessionClass.accessionJSON);
      const descriptors = personService.getDescriptorsForLink(
        accessionClass.accessionJSON.persons,
        link
      );
      
      return descriptors;
    } catch (error) {
      console.error('Failed to get descriptors for link:', error);
      return [];
    }
  });

  // Add a face descriptor to a person's faceBioData
  ipcMain.handle('persons:addFaceDescriptor', async (_event, personID, link, model, region, descriptor, confidence) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      if (!accessionClass || !accessionClass.accessionJSON.persons) {
        return { success: false, error: 'No accessions loaded' };
      }

      const personService = new PersonService(accessionClass.accessionJSON);
      
      // Determine type from link extension
      const type = link.toLowerCase().endsWith('.mp4') || link.toLowerCase().endsWith('.avi') ? 'video' :
                   link.toLowerCase().endsWith('.mp3') || link.toLowerCase().endsWith('.wav') ? 'audio' :
                   'photo';
      
      personService.addDescriptor(
        accessionClass.accessionJSON.persons,
        personID,
        type,
        link,
        model,
        region,
        descriptor,
        confidence
      );
      
      // Mark accessions as changed so it gets saved
      accessionClass.accessionsChanged = true;
      
      return { success: true };
    } catch (error) {
      console.error('Failed to add face descriptor:', error);
      return { success: false, error: error.message };
    }
  });

  // Remove a face descriptor from a person's faceBioData
  ipcMain.handle('persons:removeFaceDescriptor', async (_event, personID, link) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      if (!accessionClass || !accessionClass.accessionJSON.persons) {
        return { success: false, error: 'No accessions loaded' };
      }

      const personService = new PersonService(accessionClass.accessionJSON);
      const removed = personService.removeDescriptorByLink(
        accessionClass.accessionJSON.persons,
        personID,
        link
      );
      
      if (removed > 0) {
        accessionClass.accessionsChanged = true;
      }
      
      return { success: true, removed };
    } catch (error) {
      console.error('Failed to remove face descriptor:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('persons:cleanupOrphanedDescriptors', async () => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      if (!accessionClass || !accessionClass.accessionJSON.persons) {
        return { success: false, error: 'No accessions loaded' };
      }

      const personService = new PersonService(accessionClass.accessionJSON);
      const items = accessionClass.accessionJSON.accessions?.item || [];
      const result = personService.removeOrphanedDescriptors(
        accessionClass.accessionJSON.persons,
        items
      );
      
      if (result.totalRemoved > 0) {
        accessionClass.accessionsChanged = true;
      }
      
      return { success: true, ...result };
    } catch (error) {
      console.error('Failed to cleanup orphaned descriptors:', error);
      return { success: false, error: error.message };
    }
  });
}
