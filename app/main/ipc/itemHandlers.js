/**
 * Item-related IPC handlers
 * 
 * Handles all IPC communication for item management:
 * - Getting item lists and details
 * - Playing media items
 * - Editing, saving, and deleting items
 * - Collection management for items
 * - Item reloading
 */

import { BrowserWindow, Menu } from 'electron';
import fs from 'fs';
import { PersonService } from '../utils/PersonService.js';

/**
 * Register all item-related IPC handlers
 * 
 * @param {Electron.IpcMain} ipcMain - The Electron IPC main instance
 * @param {Function} getAccessionClass - Function that returns the current AccessionClass instance
 * @param {Function} verifyAccessions - Function to ensure AccessionClass is initialized
 * @param {Function} getMainWindow - Function that returns the main window
 * @param {Function} createMediaWindow - Function to create media player window
 * @param {Function} createMediaManagerWindow - Function to create media manager window
 * @param {Function} createMenu - Function to create main menu
 * @param {Function} resetAccessions - Function to reload accessions
 * @param {Function} hmsToSeconds - Function to convert HMS to seconds
 * @param {Object} nconf - Configuration object
 * @param {Object} showCollectionRef - Reference object for showCollection flag
 */
export function registerItemHandlers(
  ipcMain, 
  getAccessionClass, 
  verifyAccessions, 
  getMainWindow,
  createMediaWindow,
  createMediaManagerWindow,
  createMenu,
  resetAccessions,
  hmsToSeconds,
  nconf,
  showCollectionRef,
  getPersonManagerWindow
) {
  
  // Get list of items with filtering and sorting
  ipcMain.handle('items:getList', async (event, requestParams) => {
    let transformedObject = []
    let listObject = {}
    let selectedCollection = nconf.get('controls:selectedCollection')
    verifyAccessions();
    const accessionClass = getAccessionClass();
    
    // Use client request if provided, otherwise use saved sortBy, or default to '1'
    const sortBy = requestParams.sort || nconf.get('controls:sortBy') || '1';
    transformedObject = accessionClass.transformToHtml(sortBy - 1)
    
    if (transformedObject) {
      listObject.tableBody = transformedObject.tableBody
      listObject.navHeader = transformedObject.navHeader
    } else {
      console.error('Error: transformedObject is undefined')
    }
    let colls = accessionClass.getCollections()
    showCollectionRef.value = colls.length > 0
    if (showCollectionRef.value
      && colls.find((collection) => collection.value === selectedCollection) === undefined) {
      selectedCollection = colls[0].value
      nconf.set('controls:selectedCollection', selectedCollection)
      nconf.save('user')
    }
    listObject.collections = colls;
    listObject.selectedCollection = selectedCollection
    listObject.accessionTitle = accessionClass.getTitle()
    listObject.photoChecked = nconf.get('controls:photoChecked') ?? true
    listObject.audioChecked = nconf.get('controls:audioChecked') ?? true
    listObject.videoChecked = nconf.get('controls:videoChecked') ?? true
    listObject.limitChecked = nconf.get('controls:limitChecked') ?? false
    listObject.showFaceTags = nconf.get('controls:showFaceTags') || false
    listObject.sortBy = sortBy
    Menu.setApplicationMenu(createMenu());
    return listObject;
  }); // items:getList

  // Get detail for a specific item (async version for Vue)
  ipcMain.handle('item:getDetail', async (_, accession) => {
    // This fires when requesting any item from the left-hand list
    verifyAccessions();
    const accessionClass = getAccessionClass();
    let itemView = accessionClass.getItemView(accession);
    if (itemView) {
      return new Promise((resolve) => {
        itemView.getViewObject((viewObject) => {
          if (itemView.getType() === 'photo') {
            resolve(viewObject);
          } else {
            createMediaWindow(JSON.stringify(viewObject));
            resolve(null);
          }
        })
      });
    }
    return null;
  }); // item:getDetail

  // Save collection-related controls
  ipcMain.handle('items:collection', async (_, controls) => {
    // Use ?? to prevent saving undefined values (preserve existing defaults)
    nconf.set('controls:photoChecked', controls.photoChecked ?? nconf.get('controls:photoChecked') ?? true)
    nconf.set('controls:audioChecked', controls.audioChecked ?? nconf.get('controls:audioChecked') ?? true)
    nconf.set('controls:videoChecked', controls.videoChecked ?? nconf.get('controls:videoChecked') ?? true)
    nconf.set('controls:limitChecked', controls.limitChecked ?? nconf.get('controls:limitChecked') ?? false)
    nconf.set('controls:selectedCollection', controls.selectedCollection ?? nconf.get('controls:selectedCollection') ?? '')
    nconf.set('controls:showFaceTags', controls.showFaceTags ?? nconf.get('controls:showFaceTags') ?? false)
    if (controls.sortBy) {
      nconf.set('controls:sortBy', controls.sortBy)
    }
    nconf.save('user')
    return { success: true };
  }); // items:collection

  // Toggle item in/out of collection
  ipcMain.handle('item:setCollection', async (_, link) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    accessionClass.toggleItemInCollection(nconf.get('controls:selectedCollection'), link)
    return { success: true };
  }); // item:setCollection

  // Play media item (with optional time position for references)
  ipcMain.handle('item:Play', async (event, entry) => {
    // This fires when requesting AV for a filename attached to a photo
    verifyAccessions();
    const accessionClass = getAccessionClass();
    let itemView = accessionClass.getItemView(null, entry.ref);
    if (itemView) {
      return new Promise((resolve) => {
        itemView.getViewObject((viewObject) => {
          if (itemView.getType() === 'photo') {
            // For photos, send to main window if request came from MediaPlayer
            // Otherwise return the viewObject (for MainWindow)
            const senderWindow = BrowserWindow.fromWebContents(event.sender);
            const mainWindow = getMainWindow();
            if (senderWindow && senderWindow !== mainWindow) {
              // Request came from MediaPlayer - send photo to main window with reference info
              viewObject.referenceSource = {
                link: entry.sourceLink || '',
                time: entry.start || ''
              };
              mainWindow.webContents.send('item:detail', viewObject);
              resolve(null);
            } else {
              // Request came from MainWindow - return the viewObject
              resolve(viewObject);
            }
          } else {
            viewObject.entry = {
              startSeconds: hmsToSeconds(entry.start),
              durationSeconds: hmsToSeconds(entry.duration),
              sourceLink: entry.sourceLink || ''  // Pass source link to MediaPlayer
            }
            createMediaWindow(JSON.stringify(viewObject));
            resolve(null);
          }
        })
      });
    }
    return null;
  }); // item:Play

  // Edit an item
  ipcMain.handle('item:Edit', async (_, identifier, collectionKey = null, includeQueue = false, sortBy = '1') => {
    // This fires when requesting to edit an item
    // includeQueue flag determines whether to build navigation queue from collection
    // sortBy determines the sort order for the queue ('1'=Date, '2'=Person, etc.)
    createMediaManagerWindow(identifier, includeQueue ? collectionKey : null, sortBy);
    return { success: true };
  }); // item:Edit

  // Load a specific item by identifier
  ipcMain.handle('item:load', async (_event, identifier) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      const items = accessionClass.accessionJSON.accessions?.item || [];
      
      // Search by accession or link
      const item = items.find(i => 
        i.accession === identifier || i.link === identifier
      );
      
      if (!item) {
        return null;
      }
      
      // Check if media file exists in filesystem
      const mediaPath = accessionClass.getMediaPath(item.type, item.link);
      const fileExists = fs.existsSync(mediaPath);
      
      // Return item with file existence info
      return {
        ...item,
        fileExists
      };
    } catch (error) {
      console.error('Failed to load item:', error);
      return null;
    }
  });

  // Save an item
  ipcMain.handle('item:save', async (_event, itemData) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      
      // Validate itemData structure before saving
      if (!itemData || typeof itemData !== 'object') {
        return { success: false, error: 'Invalid item data: not an object' };
      }
      
      if (!itemData.accession) {
        return { success: false, error: 'Invalid item data: missing accession' };
      }
      
      // Validate all persons have personID
      if (itemData.person && Array.isArray(itemData.person)) {
        for (let i = 0; i < itemData.person.length; i++) {
          const person = itemData.person[i];
          
          if (!person.personID) {
            console.error(`Person at index ${i} missing personID:`, person);
            return { success: false, error: `Person at index ${i} missing personID` };
          }
        }
      }
      
      // Process pending face assignments and add to person library
      if (itemData.person && Array.isArray(itemData.person)) {
        const personService = new PersonService(accessionClass.accessionJSON);
        
        for (const person of itemData.person) {
          if (person.faceTag && person.faceTag.pending) {
            // Determine media type from link
            const link = itemData.link;
            const type = link.toLowerCase().endsWith('.mp4') || link.toLowerCase().endsWith('.avi') ? 'video' :
                         link.toLowerCase().endsWith('.mp3') || link.toLowerCase().endsWith('.wav') ? 'audio' :
                         'photo';
            
            // Add face descriptor to person library
            personService.addDescriptor(
              accessionClass.accessionJSON.persons,
              person.personID,
              type,
              link,
              person.faceTag.model,
              person.faceTag.region,
              person.faceTag.descriptor,
              person.faceTag.confidence
            );
            
            // Remove faceTag from person object (not part of item schema)
            delete person.faceTag;
          }
        }
      }
      
      // Use encapsulated method to save item
      const success = accessionClass.saveItem(itemData);
      
      if (!success) {
        return { success: false, error: 'Item not found' };
      }
      
      // Refresh main window
      const mainWindow = getMainWindow();
      if (mainWindow) {
        resetAccessions();
      }

      const personManagerWindow = getPersonManagerWindow?.();
      if (personManagerWindow && personManagerWindow.webContents) {
        personManagerWindow.webContents.send('persons:refresh');
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to save item:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // Delete an item
  ipcMain.handle('item:delete', async (_event, link) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      
      // Use encapsulated method to delete item
      const success = accessionClass.deleteItem(link);
      
      if (!success) {
        return { success: false, error: 'Item not found' };
      }
      
      // Refresh main window
      const mainWindow = getMainWindow();
      if (mainWindow) {
        resetAccessions();
      }

      const personManagerWindow = getPersonManagerWindow?.();
      if (personManagerWindow && personManagerWindow.webContents) {
        personManagerWindow.webContents.send('persons:refresh');
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to delete item:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // ===== Legacy synchronous handlers (for old HTML windows) =====

  ipcMain.on('items:getList', (event, requestParams) => {
    let transformedObject = []
    let listObject = {}
    let selectedCollection = nconf.get('controls:selectedCollection')
    verifyAccessions();
    const accessionClass = getAccessionClass();
    transformedObject = accessionClass.transformToHtml(requestParams.sort - 1)
    if (transformedObject) {
      listObject.tableBody = transformedObject.tableBody
      listObject.navHeader = transformedObject.navHeader
    } else {
      console.error('Error: transformedObject is undefined')
    }
    let colls = accessionClass.getCollections()
    showCollectionRef.value = colls.length > 0
    if (showCollectionRef.value
      && colls.find((collection) => collection.value === selectedCollection) === undefined) {
      selectedCollection = colls[0].value
      nconf.set('controls:selectedCollection', selectedCollection)
      nconf.save('user')
    }
    listObject.collections = colls;
    listObject.selectedCollection = selectedCollection
    listObject.accessionTitle = accessionClass.getTitle()
    
    // Load controls from nconf
    const photoValue = nconf.get('controls:photoChecked');
    const audioValue = nconf.get('controls:audioChecked');
    const videoValue = nconf.get('controls:videoChecked');
    
    listObject.photoChecked = photoValue ?? true
    listObject.audioChecked = audioValue ?? true
    listObject.videoChecked = videoValue ?? true
    listObject.limitChecked = nconf.get('controls:limitChecked') ?? false
    listObject.showFaceTags = nconf.get('controls:showFaceTags') || false
    listObject.sortBy = nconf.get('controls:sortBy') || '1'
    
    event.sender.send('items:render', JSON.stringify(listObject))
    Menu.setApplicationMenu(createMenu());
  }); // items:getList

  ipcMain.on('item:getDetail', async (_, accession) => {
    // This fires when requesting any item from the left-hand list
    verifyAccessions();
    const accessionClass = getAccessionClass();
    let itemView = accessionClass.getItemView(accession);
    if (itemView) {
      itemView.getViewObject((viewObject) => {
        const mainWindow = getMainWindow();
        if (mainWindow && itemView.getType() === 'photo') {
          mainWindow.send('item:detail', JSON.stringify(viewObject));
        } else if (mainWindow) {
          createMediaWindow(JSON.stringify(viewObject));
        }
      })
    } else {
      console.error('No itemView found for accession:', accession);
    }
  }); // item:getDetail

  ipcMain.on('items:collection', (_, controls) => {
    let itemsObject = JSON.parse(controls)
    // Use ?? to prevent saving undefined values (preserve existing defaults)
    nconf.set('controls:photoChecked', itemsObject.photoChecked ?? nconf.get('controls:photoChecked') ?? true)
    nconf.set('controls:audioChecked', itemsObject.audioChecked ?? nconf.get('controls:audioChecked') ?? true)
    nconf.set('controls:videoChecked', itemsObject.videoChecked ?? nconf.get('controls:videoChecked') ?? true)
    nconf.set('controls:limitChecked', itemsObject.limitChecked ?? nconf.get('controls:limitChecked') ?? false)
    nconf.set('controls:selectedCollection', itemsObject.selectedCollection ?? nconf.get('controls:selectedCollection') ?? '')
    nconf.save('user')
  }); // items:collection

  ipcMain.on('item:setCollection', (_, link) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    accessionClass.toggleItemInCollection(nconf.get('controls:selectedCollection'), link)
  }); // item:setCollection

  ipcMain.on('item:Play', (_, playString) => {
    // This fires when requesting AV for a filename attached to a photo
    const playObject = JSON.parse(playString)
    verifyAccessions();
    const accessionClass = getAccessionClass();
    let itemView = accessionClass.getItemView(null, playObject.ref);
    if (itemView) {
      itemView.getViewObject((viewObject) => {
        const mainWindow = getMainWindow();
        if (itemView.getType() === 'photo') {
          mainWindow.send('item:detail', JSON.stringify(viewObject))
        } else {
          // console.log('audioPlay ' + playObject.ref + ' start ' + playObject.start + ' secs ' + playObject.startSeconds)
          viewObject.entry = {
            startSeconds: hmsToSeconds(playObject.start),
            durationSeconds: hmsToSeconds(playObject.duration)
          }
          createMediaWindow(JSON.stringify(viewObject));
        }
      })
    }
  }); // item:Play

  ipcMain.on('items:reload', (_, itemsString) => {
    // reload on main window causes a reload of accessions in case it changed.
    resetAccessions();
  }); // items:reload

  ipcMain.on('item:edit', (_, keyData) => {
    // This fires when requesting to edit an item
    let editObject = JSON.parse(keyData);
    // Use the new Media Manager window instead of old Add Media window
    createMediaManagerWindow(editObject.keyData.link);
  }); // item:Edit

  // Get current playback time from Media Player window
  ipcMain.handle('mediaPlayer:getCurrentTime', async () => {
    try {
      // Find the media player window
      const allWindows = BrowserWindow.getAllWindows();
      const mediaPlayerWindow = allWindows.find(win => 
        win.getTitle().includes('Shoebox Media') || 
        win.webContents.getURL().includes('mediaPlayer')
      );
      
      if (mediaPlayerWindow) {
        // Execute JavaScript in the media player window to get playback info
        const playbackInfo = await mediaPlayerWindow.webContents.executeJavaScript(
          'window.getCurrentPlaybackTime ? window.getCurrentPlaybackTime() : { time: "00:00:00.0", link: "", currentSeconds: 0 }'
        );
        return { success: true, ...playbackInfo };
      }
      
      return { success: false, error: 'Media Player window not found or not open' };
    } catch (error) {
      console.error('Error getting current playback time:', error);
      return { success: false, error: error.message };
    }
  }); // mediaPlayer:getCurrentTime
}
