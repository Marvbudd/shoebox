import path from 'path';
import fs from 'fs';
import url from 'url';
import exifr from 'exifr';
import { ItemViewClass } from './ItemViewClass.js';
import { CollectionsClass } from './CollectionsClass.js';
import { AccessionSorter } from './AccessionSorter.js';
import { AccessionHTMLBuilder } from './AccessionHTMLBuilder.js';
import { PersonService } from './PersonService.js';
import { generateTimestamp } from './helpers.js';

const subdirectories = {
  photo: 'photo',
  audio: 'audio',
  video: 'video'
};

/**
 * AccessionClass - Manages accession data with proper encapsulation and persistence.
 * 
 * CRITICAL ARCHITECTURE PATTERN:
 * 
 * This class uses a deferred-save pattern to improve performance and ensure data integrity:
 * 
 * 1. ALL data mutations MUST go through class methods (never modify accessionJSON directly)
 * 2. Mutation methods set `this.accessionsChanged = true` to flag pending changes
 * 3. saveAccessions() is called ONLY when:
 *    - Main window closes (automatic save on app exit)
 *    - Switching to a different accessions file
 *    - Creating new accessions
 * 
 * DO NOT call saveAccessions() from IPC handlers or after individual changes!
 * This would cause:
 * - Poor performance (disk write on every change)
 * - Broken encapsulation (external code controlling persistence)
 * - Potential data loss (incomplete transactions)
 * 
 * CORRECT PATTERN:
 *   // In IPC handler
 *   accessionClass.saveItem(itemData);  // Method sets accessionsChanged flag
 *   return { success: true };           // Return immediately, no save
 * 
 * INCORRECT PATTERN:
 *   // In IPC handler - DON'T DO THIS!
 *   accessionClass.accessionJSON.accessions.item[index] = itemData;  // Direct mutation
 *   accessionClass.saveAccessions();                                 // Immediate save
 * 
 * Mutation Methods (all set accessionsChanged flag):
 * - saveItem(itemData)
 * - deleteItem(link)
 * - bulkUpdateCollectionItems(collectionKey, updates, onlyIfEmpty)
 * - updateAccession(formJSON)
 * - createItem(file, directoryPath, type, formJSON)
 * - savePerson(person)
 * - updatePersonTMGID(personID, tmgid)
 * - toggleItemInCollection(collectionKey, link)
 * 
 * @class AccessionClass
 */
export class AccessionClass {
  constructor(accessionFilename, title) {
    if (!title) {
      const tempDate = new Date();
      title = 'Accessions ' + tempDate.getFullYear() + tempDate.toLocaleString('default', { month: 'short' }) + tempDate.getDate();
    }
    if (!fs.existsSync(accessionFilename)) {
      console.error(`AccessionClass: Accessions don't exist in ${accessionFilename}`)
      this.accessionJSON = {
        persons: {},
        accessions: {
          title, 
          item: []
        }};
    } else {
      this.accessionJSON = JSON.parse(fs.readFileSync(accessionFilename).toString())
    }
    
    /**
     * Flag indicating whether accessionJSON has been modified since last save.
     * Set to true by any mutation method, reset to false after saveAccessions() completes.
     * @type {boolean}
     * @private
     */
    this.accessionsChanged = false
    this.accessionFilename = accessionFilename
    
    // Check if migration is needed and perform it
    const migrator = new PersonService(this.accessionJSON);
    if (migrator.needsMigration()) {
      console.log('AccessionClass: Legacy person structure detected. Beginning migration...');
      // Create backup before migration
      const timestamp = generateTimestamp();      // Generate new file path with timestamp.
      // Don't want this to have a .json extension, so it is not mistaken as an active accession file.
      const backupPath = accessionFilename.replace(/\.json$/, `.${timestamp}`);
      try {
        fs.copyFileSync(accessionFilename, backupPath);
        console.log(`AccessionClass: Backup created at ${backupPath}`);
      } catch (error) {
        console.error(`AccessionClass: Failed to create backup at ${backupPath}. Aborting migration.`, error);
        throw error;
      }
      
      // Perform migration
      try {
        const result = migrator.migrate();
        
        // Update accessionJSON with migrated data
        this.accessionJSON.persons = result.persons;
        this.accessionJSON.accessions.item = result.items;
        
        console.log('AccessionClass: Migration complete.');
        console.log(`  - ${Object.keys(result.persons).length} unique persons identified`);
        console.log(`  - ${result.items.length} items processed`);
        if (result.warnings.length > 0) {
          console.warn('AccessionClass: Migration warnings:');
          result.warnings.forEach(warning => console.warn(`  - ${warning}`));
        }
        this.accessionsChanged = true; // Mark for save
      } catch (error) {
        console.error('AccessionClass: Migration failed. Application state may be inconsistent.', error);
        throw error;
      }
    }
    
    /**
     * Collections manager - owned and controlled by this AccessionClass instance.
     * AccessionClass acts as a "friend" to CollectionsClass, managing its lifecycle:
     * - Creates CollectionsClass instance with appropriate directory
     * - Calls readCollections() during initialization
     * - Calls saveCollections() during saveAccessions() to ensure synchronized persistence
     * This tight coupling ensures collections are always saved with their accessions.
     * @type {CollectionsClass}
     * @private
     */
    this.collections = new CollectionsClass(path.dirname(accessionFilename))
    this.collections.readCollections()
    this.accessionSorter = new AccessionSorter()
    this.accessionHTMLBuilder = new AccessionHTMLBuilder(this.collections, this)
    this.personService = new PersonService(this.accessionJSON)
    // find the highest accession number. We only use the first numeric part of the accession
    this.maxAccession = this.accessionJSON.accessions.item.length > 0 ? Math.max(...this.accessionJSON.accessions.item.map(item => parseInt(item.accession.match(/\d+/)[0]))) : 0;
  } // constructor

  /**
   * Persist accessions to disk if changes have been made.
   * 
   * IMPORTANT: This should ONLY be called when:
   * - Application is closing (main window close event)
   * - Switching to a different accessions file
   * - Creating new accessions and saving old ones
   * 
   * DO NOT call this from IPC handlers or after individual changes!
   * Individual mutations should only set accessionsChanged = true.
   * 
   * FRIEND RELATIONSHIP: This method also calls collections.saveCollections()
   * to ensure collections are persisted at the same time as accessions data.
   * This tight coupling maintains data consistency across related files.
   * 
   * @returns {boolean} True if data was written to disk, false if no changes
   */
  saveAccessions() {
    this.collections.saveCollections();
    if (this.accessionsChanged) {
      // Sort persons by maiden/unmarried last name, then first name to facilitate manual review
      this.accessionJSON.persons = this._sortPersonsForSave(this.accessionJSON.persons);
      fs.writeFileSync(this.accessionFilename, JSON.stringify(this.accessionJSON, null, 2))
      this.accessionsChanged = false
      return true;
    }
    return false;
  } // saveAccessions
  
  /**
   * Create a timestamped backup of the accessions file
   * Saves pending changes first if necessary
   * @returns {Object} Result with success status and backup filename
   */
  backupAccessions() {
    try {
      // Force save if there are pending changes
      if (this.accessionsChanged) {
        this.saveAccessions();
      }

      // Generate timestamp and backup path (no .json extension)
      const timestamp = generateTimestamp();
      const backupPath = this.accessionFilename.replace(/\.json$/, `.${timestamp}`);

      // Create backup
      fs.copyFileSync(this.accessionFilename, backupPath);
      console.log(`Archive backed up to: ${backupPath}`);

      return { 
        success: true, 
        backupPath,
        backupFilename: path.basename(backupPath)
      };
    } catch (error) {
      console.error('Failed to backup archive:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  } // backupAccessions
  
  // Helper method to sort persons object by maiden last name, then first name
  _sortPersonsForSave(persons) {
    // Convert to array of [personID, person] entries
    const entries = Object.entries(persons);
    
    // Sort by maiden/unmarried last name, then first name
    entries.sort((a, b) => {
      const [keyA, personA] = a;
      const [keyB, personB] = b;
      
      // Get maiden/unmarried last names
      const lastNameA = this._getMaidenLastName(personA);
      const lastNameB = this._getMaidenLastName(personB);
      
      // Compare last names
      const lastComparison = lastNameA.localeCompare(lastNameB);
      if (lastComparison !== 0) {
        return lastComparison;
      }
      
      // Compare first names
      const firstA = personA.first || '';
      const firstB = personB.first || '';
      return firstA.localeCompare(firstB);
    });
    
    // Convert back to object with sorted keys
    const sorted = {};
    entries.forEach(([key, person]) => {
      sorted[key] = person;
    });
    
    return sorted;
  }
  
  // Get the first maiden/unmarried last name for sorting
  _getMaidenLastName(person) {
    if (!person.last || !Array.isArray(person.last) || person.last.length === 0) {
      return '';
    }
    
    // Find first maiden/unmarried name
    const maidenName = person.last.find(ln => ln.type !== 'married');
    if (maidenName && maidenName.last) {
      return maidenName.last;
    }
    
    // Fallback to first last name if no maiden name found
    return person.last[0].last || '';
  }
  
  // adds or remove an item from a collection - called on double click
  toggleItemInCollection(collectionKey, link) {
    const collection = this.collections.getCollection(collectionKey)
    if (collection) {
      let itemView = this.getItemView(null, link)
      if (!itemView) {
        console.error('AccessionClass:toggleItemIncollection - Item not found: ' + link)
        return
      }
      collection.hasItem(link) ? collection.removeItem(link) : collection.addItem(link)
      this.accessionsChanged = true;
    } else {
      console.error('AccessionClass:toggleItemIncollection - Collection not found: ' + collectionKey)
    }
  } // toggleItemInCollection
    /**
   * Check if an item (by link) is referenced in any playlist
   * @param {string} link - The item's link to check
   * @returns {boolean} True if item is referenced in any playlist
   */
  isItemReferencedInPlaylists(link) {
    if (!this.accessionJSON.accessions?.item) {
      return false;
    }
    
    return this.accessionJSON.accessions.item.some(item => {
      if (item.playlist && Array.isArray(item.playlist.entry)) {
        return item.playlist.entry.some(entry => entry.ref === link);
      }
      return false;
    });
  }
    // getcollections returns an array of unique collections in the accessionJSON
  getCollections() {
    let collections = [];
    this.collections.collections.forEach(collection => {
      collections.push({value: collection.key, text: collection.text});
    })
    // Sort collections alphabetically by their display text
    collections.sort((a, b) => a.text.localeCompare(b.text));
    return collections
  } // getCollections

  // getTitle returns accessionJSON title
  getTitle() {
    return this.accessionJSON.accessions.title
  } // getTitle

  getWebsite() {
    return url.pathToFileURL(path.resolve(path.dirname(this.accessionFilename), 'website', 'index.htm')).href
  } // getWebsite

  // Get the website URL for a specific person by TMGID
  getPersonWebsiteUrl(tmgID) {
    if (!tmgID) return null;
    // Append .htm if not already present (supports both "123" and "123.htm" formats)
    const filename = tmgID.endsWith('.htm') ? tmgID : `${tmgID}.htm`;
    // Prepend 'p' to the filename (Second Site person page naming convention)
    const personPage = `p${filename}`;
    return url.pathToFileURL(path.resolve(path.dirname(this.accessionFilename), 'website', personPage)).href
  } // getPersonWebsiteUrl

  // getMediaDirectory returns the path to the provided type and link
  getMediaPath(type, link) {
    return path.resolve(path.dirname(this.accessionFilename), subdirectories[type], link);
  } // getMediaPath

  // addMediaFiles adds media files to the accessionJSON 
  async addMediaFiles(formJSON) {
    try {
      const subdirectoryKeys = Object.keys(subdirectories);
      await Promise.all(subdirectoryKeys.map(async (type) => {
        const directoryPath = path.join(formJSON.updateFocus, subdirectories[type]);
        const files = fs.readdirSync(directoryPath);
        for (const file of files) {
          try {
            await this.createItem(file, directoryPath, type, formJSON);
          }
          catch (error) {
            console.error('Error in addMediaFiles: ', error);
          }
        }
      }));
    } catch (error) {
      console.error('Error in addMediaFiles: ', error);
    }
  } // End of addMediaFiles function

  // createItem creates an item in the accessionJSON
  //  NOTE: formJSON must never be changed by this function!!! Results will be unexpected
  async createItem(file, directoryPath, type, formJSON) {
    const filePath = path.join(directoryPath, file);
    const stats = fs.statSync(filePath);
    const link = path.basename(file);
    // Use the exifr library to extract metadata
    let linkExists = this.accessionJSON.accessions.item.some(item => item.link === link);
    if (!linkExists) {
      try {
        let date;
        let metadata;
        if (type === 'photo') {
          // Enhanced metadata extraction - supports EXIF, IPTC, XMP, TIFF
          metadata = await exifr.parse(filePath, {
            tiff: true,      // TIFF tags (common in many cameras)
            exif: true,      // EXIF tags
            gps: true,       // GPS tags
            iptc: true,      // IPTC metadata (professional photography)
            xmp: true,       // Adobe XMP (Lightroom/Photoshop)
            ifd0: true       // Primary image data
          });
        }
        
        // Enhanced date extraction with multiple fallbacks
        date = 
          metadata?.DateTimeOriginal ||      // When photo was taken (best)
          metadata?.DateCreated ||            // IPTC date created
          metadata?.CreateDate ||             // XMP create date  
          metadata?.DateTimeDigitized ||      // When digitized
          metadata?.ModifyDate ||             // Last modified
          metadata?.DateTime ||               // Generic date/time
          stats.mtime ||                      // File modification
          stats.birthtime;                    // File creation
          
        let dateProperty = {};
        if (date.getFullYear()) {
          dateProperty.year = date.getFullYear();
        }
        if (date.toLocaleString('default', { month: 'short' })) {
          dateProperty.month = date.toLocaleString('default', { month: 'short' });
        }
        if (date.getDate()) {
          dateProperty.day = date.getDate();
        }
        
        // GPS coordinates stored as separate latitude/longitude numeric fields
        let location = [];
        if (metadata?.latitude && metadata?.longitude) {
          const locationObj = {
            latitude: metadata.latitude,
            longitude: metadata.longitude
          };
          
          // Future enhancement: Add altitude if available
          // if (metadata?.GPSAltitude !== undefined) {
          //   locationObj.altitude = metadata.GPSAltitudeRef === 1 
          //     ? -metadata.GPSAltitude 
          //     : metadata.GPSAltitude;
          // }
          
          // Optional: Extract city/state from metadata if available
          if (metadata?.City || metadata?.LocationShownCity) {
            locationObj.city = metadata.City || metadata.LocationShownCity;
          }
          if (metadata?.State || metadata?.ProvinceState || metadata?.LocationShownProvinceState) {
            locationObj.state = metadata.State || metadata.ProvinceState || metadata.LocationShownProvinceState;
          }
          
          location.push(locationObj);
        }
        
        // Enhanced description extraction with multiple sources
        const description = 
          metadata?.ImageDescription ||       // EXIF description
          metadata?.Description ||            // XMP description
          metadata?.Caption ||                // IPTC caption
          metadata?.CaptionAbstract ||        // IPTC caption/abstract
          metadata?.Title ||                  // IPTC/XMP title
          metadata?.Headline ||               // IPTC headline
          '';
          
        this.maxAccession++;
        const item = {
          link,
          "person": [],
          description,
          "accession": this.maxAccession.toString(),
          type,
          "date": dateProperty,
          location,
          "source": []
        };
        let itemView = new ItemViewClass(item, this);
        itemView.updateItem(formJSON) // update the item with the formJSON
        this.accessionJSON.accessions.item.push(itemView.itemJSON);
        this.accessionsChanged = true
      }
      catch (error) {
        console.error('Error in createItem: ', error);
      }
    }
  } // End of createItem function

  /**
   * Transforms the data into HTML for the left hand pane based on the selection criteria.
   * 
   * sortBy - The sorting criteria. 0 for sorting by date, 1 for sorting by person and date, 2 for sorting by location, 3 for sorting by file, 4 for sorting by source.
   * returns {string} The HTML output.
   */
    // prior to Jan2024 a transform method was used to create the HTML from xml/xslt but that was unreliable
  transformToHtml(sortBy) {
    try {
      let sortedItems;
      
      // Delegate sorting to AccessionSorter
      switch (sortBy) {
        case 0:
          sortedItems = this.accessionSorter.sortByDate(this.accessionJSON.accessions.item);
          break;
        case 1:
          sortedItems = this.accessionSorter.sortByPerson(this.accessionJSON.accessions.item, this);
          break;
        case 2:
          sortedItems = this.accessionSorter.sortByLocation(this.accessionJSON.accessions.item);
          break;
        case 3:
          sortedItems = this.accessionSorter.sortByFile(this.accessionJSON.accessions.item);
          break;
        case 4:
          sortedItems = this.accessionSorter.sortBySource(this.accessionJSON.accessions.item, this);
          break;
        case 5:
          sortedItems = this.accessionSorter.sortByAccession(this.accessionJSON.accessions.item);
          break;
        default:
          console.error('Invalid sortBy option');
          return { tableBody: '', navHeader: '' };
      }

      // Delegate HTML generation to AccessionHTMLBuilder
      return this.accessionHTMLBuilder.buildNavigationTable(sortedItems, sortBy);
    } catch (error) {
      console.error('Error in AccessionClass.transformToHtml. ', error);
      return { tableBody: '', navHeader: '' };
    }
  } // transformToHtml

  getAccessions(selectedCollection) {
    let accessionsOutput = {persons: {}, accessions: {item: []}};
    var sortedItems = '';
    let collection = this.collections.getCollection(selectedCollection)
    if (!collection) {
      throw new Error(`Collection "${selectedCollection}" not found`);
    }
    
    accessionsOutput.accessions.title = collection.title
    
    // Track unique person IDs referenced in the collection
    const referencedPersonIDs = new Set();
    
    sortedItems = collection.getLinks()
      .map(link => {
        const itemView = this.getItemView(null, link);
        if (!itemView) {
          // Item not found - skip it (will be reported as error in media export)
          console.warn(`Skipping missing item from accessions.json: ${link}`);
          return null;
        }
        
        // Collect person IDs from this item
        if (itemView.itemJSON.person) {
          itemView.itemJSON.person.forEach(personRef => {
            if (personRef.personID) {
              referencedPersonIDs.add(personRef.personID);
            }
          });
        }
        
        return {
          ...itemView.itemJSON
        };
      })
      .filter(item => item !== null) // Remove null entries for missing items
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        } else {
          return a.link.localeCompare(b.link);
        }
      });
      
    // Iterate over sorted items and build the accessions output
    sortedItems.forEach(item => {
      accessionsOutput.accessions.item.push(item)
    });
    
    // Add persons library - only persons referenced in the collection
    // and filter faceBioData to only include links in this collection
    const collectionLinks = new Set(collection.getLinks());
    
    referencedPersonIDs.forEach(personID => {
      const person = this.getPerson(personID);
      if (person) {
        // Clone person object to avoid modifying original
        const personCopy = JSON.parse(JSON.stringify(person));
        
        // Filter faceBioData to only include links in this collection
        if (personCopy.faceBioData && personCopy.faceBioData.length > 0) {
          personCopy.faceBioData = personCopy.faceBioData.filter(
            faceData => collectionLinks.has(faceData.link)
          );
        }
        
        accessionsOutput.persons[personID] = personCopy;
      }
    });
    
    return accessionsOutput;
  } // getAccessions

  getMonthNumber(monthAbbreviation) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.indexOf(monthAbbreviation) + 1;
  } // getMonthNumber

  // getItemView returns an ItemViewClass object for the given accession or link
  getItemView(accession, link) {
    let item;
    if (accession) {
      item = this.accessionJSON.accessions.item.find(item => item.accession === accession);
      if (link && item.link !== link) {
        console.error(`AccessionClass getItemView: item.link mismatch with collection. accession: ${accession}, collection link: ${link}, item: ${item.link}`);
      }
    } else if (link) {
      item = this.accessionJSON.accessions.item.find(item => item.link === link);
    }
    if (!item) {
      console.error(`AccessionClass.getItemView: item not found: ${accession}, ${link}`);
      return null;
    }
    return new ItemViewClass( item, this );
  } // getItemView
      
  // create an array of playlist items that refer to this link (photos that are described in audio or video)
  // enables showing the photo while the audio or video is playing
  getReferencesForLink(link) {
    let refs = []
    if (this.accessionJSON.accessions.item) {
      this.accessionJSON.accessions.item.forEach(item => {
        // playlist contains an entry array
        if (item.playlist) {
          item.playlist.entry.forEach(entry => {
            if (entry.ref === link) {
              refs.push({
                entry: {
                  ref: item.link,
                  starttime: entry.starttime,
                  duration: entry.duration
                }
              })
            }
          })
        }
      })
      refs.sort((a, b) => {
        let rv = 0
        if (a.entry.starttime < b.entry.starttime) { rv = -1 }
        if (a.entry.starttime > b.entry.starttime) { rv = 1 }
        return rv
      })
    }
    return refs
  } // getReferencesForLink

  // updateCollection updates all items in a collection from a formJSON
  updateCollection(formJSON) {
    let collection = this.collections.getCollection(formJSON.updateFocus)
    if (collection) {
      collection.getLinks().forEach(link => {
        // delegate as if only one was updated
        formJSON.accession = key.accession
        this.updateAccession(formJSON)
      });
    }
  } // updateCollection

  /**
   * Bulk update items in a collection with metadata
   * @param {string} collectionKey - The collection key
   * @param {object} updates - Object with fields to update: description, date, location, source
   * @param {boolean} onlyIfEmpty - Only update if field is empty
   * @returns {number} Number of items updated
   */
  bulkUpdateCollectionItems(collectionKey, updates, onlyIfEmpty = false) {
    const collection = this.collections.getCollection(collectionKey);
    if (!collection) {
      console.error(`AccessionClass.bulkUpdateCollectionItems: Collection not found: ${collectionKey}`);
      return 0;
    }
    
    const items = this.accessionJSON.accessions?.item || [];
    const collectionLinks = collection.getLinks();
    const itemsToUpdate = items.filter(item => collectionLinks.includes(item.link));
    
    let updatedCount = 0;
    
    itemsToUpdate.forEach(item => {
      let itemUpdated = false;
      
      // Update description
      if (updates.description !== undefined) {
        if (!onlyIfEmpty || !item.description) {
          item.description = updates.description;
          itemUpdated = true;
        }
      }
      
      // Update date
      if (updates.date) {
        if (!onlyIfEmpty || !item.date || (!item.date.year && !item.date.month && !item.date.day)) {
          item.date = {
            year: updates.date.year || '',
            month: updates.date.month || '',
            day: updates.date.day || ''
          };
          itemUpdated = true;
        }
      }
      
      // Add location (always adds, doesn't replace)
      if (updates.location) {
        if (!item.location) {
          item.location = [];
        }
        // Only add if at least one field is filled
        if (updates.location.detail || updates.location.city || updates.location.state || 
            (updates.location.latitude && updates.location.longitude)) {
          const locationEntry = {
            detail: updates.location.detail || '',
            city: updates.location.city || '',
            state: updates.location.state || ''
          };
          // Add GPS coordinates if provided
          if (updates.location.latitude && updates.location.longitude) {
            locationEntry.latitude = updates.location.latitude;
            locationEntry.longitude = updates.location.longitude;
          }
          item.location.push(locationEntry);
          itemUpdated = true;
        }
      }
      
      // Add source (always adds, doesn't replace)
      if (updates.source && updates.source.personID) {
        if (!item.source) {
          item.source = [];
        }
        
        // receivedDate is now already an object {year, month, day}
        const receivedDate = updates.source.receivedDate || { year: '', month: '', day: '' };
        
        item.source.push({
          personID: updates.source.personID,
          received: receivedDate
        });
        itemUpdated = true;
      }
      
      if (itemUpdated) {
        updatedCount++;
      }
    });
    
    if (updatedCount > 0) {
      this.accessionsChanged = true;
    }
    
    return updatedCount;
  }

  // updateItem updates an item from a formJSON
  updateAccession(formJSON) {
    let itemView = this.getItemView(formJSON.accession)
    if (itemView) {
      itemView.updateItem(formJSON)
      // replace the item in accessionJSON
      let index = this.accessionJSON.accessions.item.findIndex(item => item.accession === formJSON.accession)
      if (index >= 0) {
        this.accessionJSON.accessions.item[index] = itemView.itemJSON
        this.accessionsChanged = true
      } else {
        console.error('AccessionClass:updateItem - item not found: ' + formJSON.accession)
      }
    }
  } // updateItem  

  // Create a new collection
  createCollection(collectionKey, title, text) {
    this.collections.createCollection(collectionKey, title, text)
  }

  // Delete existing collection
  deleteCollection(collectionKey, title, text) {
    this.collections.deleteCollection(collectionKey, title, text)
  }

  // ===== Item Mutation Methods =====

  /**
   * Save an item by replacing it in the accessions array
   * @param {object} itemData - Complete item object with accession property
   * @returns {boolean} Success status
   */
  saveItem(itemData) {
    if (!itemData || typeof itemData !== 'object') {
      throw new Error('AccessionClass.saveItem: itemData is null or not an object');
    }
    if (!itemData.accession) {
      throw new Error('AccessionClass.saveItem: Item must have accession property');
    }
    const items = this.accessionJSON.accessions?.item || [];
    const index = items.findIndex(i => i.accession === itemData.accession);
    if (index === -1) {
      throw new Error(`AccessionClass.saveItem: Item not found: ${itemData.accession}`);
    }
    items[index] = itemData;
    this.accessionsChanged = true;
    return true;
  }

  /**
   * Delete an item from accessions
   * @param {string} link - The item's link (primary key)
   * @returns {boolean} Success status
   */
  deleteItem(link) {
    const items = this.accessionJSON.accessions?.item || [];
    const index = items.findIndex(i => i.link === link);
    
    if (index === -1) {
      console.error(`AccessionClass.deleteItem: Item not found: ${link}`);
      return false;
    }
    
    // Clean up all faceBioData for this link across all persons
    const persons = this.accessionJSON.persons || {};
    this.personService.removeAllDescriptorsForLink(persons, link);
    
    items.splice(index, 1);
    this.accessionsChanged = true;
    return true;
  }

  // ===== Person Library Methods =====

  /**
   * Get person by their personID
   * @param {string} personID - The person's UUID
   * @returns {object|null} Person object or null if not found
   */
  getPerson(personID) {
    if (!this.accessionJSON.persons) {
      return null;
    }
    return this.accessionJSON.persons[personID] || null;
  }

  /**
   * Get person by TMGID
   * @param {string} tmgid - The person's TMGID
   * @returns {object|null} Person object with personID or null if not found
   */
  getPersonByTMGID(tmgid) {
    if (!this.accessionJSON.persons) {
      return null;
    }
    for (const [personID, person] of Object.entries(this.accessionJSON.persons)) {
      if (person.TMGID === tmgid) {
        return { personID, ...person };
      }
    }
    return null;
  }

  /**
   * Save or update a person in the library
   * Note: After PersonID migration, persons are keyed by UUID.
   * This method is deprecated - person creation should go through PersonService.
   * @param {object} person - Person object with all attributes
   * @returns {string} The personID for the saved person
   */
  savePerson(person) {
    // After migration, persons should already have a personID
    // This method is mainly for backward compatibility
    if (!person.personID) {
      console.warn('AccessionClass.savePerson: Creating person without personID is deprecated');
      return null;
    }
    
    const personID = person.personID;
    
    // Initialize persons object if needed
    if (!this.accessionJSON.persons) {
      this.accessionJSON.persons = {};
    }
    
    // Check if person already exists
    const existingPerson = this.accessionJSON.persons[personID];
    if (existingPerson) {
      // Merge with existing, preserving TMGID if present
      this.accessionJSON.persons[personID] = {
        ...person,
        TMGID: person.TMGID || existingPerson.TMGID
      };
    } else {
      this.accessionJSON.persons[personID] = person;
    }
    
    this.accessionsChanged = true;
    return personID;
  }

  /**
   * Create a personKey from person attributes
   * Uses PersonService's key generation algorithm
   * @param {object} person - Person object
   * @returns {string} The generated personKey
   */
  createPersonKey(person) {
    return PersonService.createPersonKey(person);
  }

  /**
   * Update or add TMGID to an existing person
   * @param {string} personID - The person's UUID
   * @param {string} tmgid - The TMGID to assign
   * @returns {boolean} Success status
   */
  updatePersonTMGID(personID, tmgid) {
    if (!this.accessionJSON.persons || !this.accessionJSON.persons[personID]) {
      console.error(`AccessionClass.updatePersonTMGID: Person not found: ${personID}`);
      return false;
    }
    
    this.accessionJSON.persons[personID].TMGID = tmgid;
    this.accessionsChanged = true;
    return true;
  }

  /**
   * Delete a person from the library
   * @param {string} personID - The person's UUID
   * @returns {boolean} Success status
   */
  deletePerson(personID) {
    if (!this.accessionJSON.persons || !this.accessionJSON.persons[personID]) {
      console.error(`AccessionClass.deletePerson: Person not found: ${personID}`);
      return false;
    }
    
    // Check if person is referenced by any items
    const items = this.getItemsForPerson(personID);
    if (items.length > 0) {
      console.error(`AccessionClass.deletePerson: Person is referenced by ${items.length} item(s)`);
      return false;
    }
    
    delete this.accessionJSON.persons[personID];
    this.accessionsChanged = true;
    return true;
  }

  /**
   * Find all items that reference a person
   * @param {string} personID - The person's UUID
   * @returns {array} Array of item accession numbers
   */
  getItemsForPerson(personID) {
    const items = [];
    
    if (!this.accessionJSON.accessions || !this.accessionJSON.accessions.item) {
      return items;
    }
    
    this.accessionJSON.accessions.item.forEach(item => {
      // Check item.person array
      if (item.person && Array.isArray(item.person)) {
        const hasPerson = item.person.some(p => {
          return p.personID === personID;
        });
        if (hasPerson) {
          items.push(item.accession);
        }
      }
      
      // Check item.source array
      if (item.source && Array.isArray(item.source)) {
        const hasPersonInSource = item.source.some(s => {
          return s.personID === personID;
        });
        if (hasPersonInSource && !items.includes(item.accession)) {
          items.push(item.accession);
        }
      }
    });
    
    return items;
  }

  /**
   * Get person data along with all items referencing them
   * @param {string} personID - The person's UUID
   * @returns {object|null} Object with personID, person data, and items array
   */
  getPersonWithItems(personID) {
    const person = this.getPerson(personID);
    if (!person) {
      return null;
    }
    
    const items = this.getItemsForPerson(personID);
    
    return {
      personID,
      person,
      items
    };
  }

  /**
   * Clean up orphaned face descriptors
   * Removes faceBioData entries that don't match any items or person assignments
   * @returns {Object} Result with totalRemoved count
   */
  cleanupOrphanedDescriptors() {
    const persons = this.accessionJSON.persons || {};
    const items = this.accessionJSON.accessions?.item || [];
    
    const result = this.personService.removeOrphanedDescriptors(persons, items);
    
    if (result.totalRemoved > 0) {
      this.accessionsChanged = true;
    }
    
    return result;
  }

  /**
   * Validate the entire archive
   * @returns {Promise<object>} Validation results and log file info
   */
  async validateArchive() {
    const ValidationService = (await import('./ValidationService.js')).ValidationService;
    const baseDir = path.dirname(this.accessionFilename);
    const validationService = new ValidationService(this, baseDir);
    const results = await validationService.validate();
    const logInfo = await validationService.writeLogFile();
    
    // Count orphaned face descriptors
    const orphanedDescriptors = results.warnings.filter(w => 
      w.type === 'ORPHANED_FACE_DESCRIPTOR' || w.type === 'ORPHANED_FACE_DESCRIPTOR_NO_ITEM'
    );
    
    return {
      ...logInfo,
      orphanedDescriptorCount: orphanedDescriptors.length
    };
  }

  /**
   * Get list of existing maintenance collections
   * @returns {Array<Object>} Array of {key, text} for existing maintenance collections
   */
  getExistingMaintenanceCollections() {
    // Maintenance collection configurations - SINGLE SOURCE OF TRUTH
    const maintenanceCollections = [
      { key: '_nolocation', text: 'Missing Loc', title: 'Items Missing Location Data' },
      { key: '_nopersons', text: 'Missing Person', title: 'Items Missing Person Data' },
      { key: '_nosource', text: 'Missing Source', title: 'Items Missing Source Data' },
      { key: '_nodescription', text: 'Missing Desc', title: 'Items Missing Description Data' },
      { key: '_living', text: 'Living People', title: 'Items with Living People' }
    ];
    
    return maintenanceCollections
      .filter(config => this.collections.getCollection(config.key))
      .map(config => ({ key: config.key, text: config.text }));
  }

  /**
   * Create maintenance collections for items missing critical data
   * Scans all items and creates collections for those missing location, persons, source, or description
   * @returns {Object} Result with created array of collection summaries and existingCollections info
   */
  createMaintenanceCollections() {
    // Maintenance collection configurations - SINGLE SOURCE OF TRUTH
    const maintenanceCollections = [
      { key: '_nolocation', text: 'Missing Loc', title: 'Items Missing Location Data' },
      { key: '_nopersons', text: 'Missing Person', title: 'Items Missing Person Data' },
      { key: '_nosource', text: 'Missing Source', title: 'Items Missing Source Data' },
      { key: '_nodescription', text: 'Missing Desc', title: 'Items Missing Description Data' },
      { key: '_living', text: 'Living People', title: 'Items with Living People' }
    ];
    
    // Check if any maintenance collections already exist
    const existingCollections = maintenanceCollections
      .filter(config => this.collections.getCollection(config.key))
      .map(config => config.key);
    
    // Delete existing maintenance collections
    for (const collectionKey of existingCollections) {
      this.collections.deleteCollection(collectionKey);
    }
    
    // Scan all items for missing data
    const items = this.accessionJSON.accessions.item;
    const missingData = {
      _nolocation: [],
      _nopersons: [],
      _nosource: [],
      _nodescription: [],
      _living: []
    };
    
    for (const item of items) {
      // Missing location
      if (!item.location || item.location.length === 0) {
        missingData._nolocation.push(item.accession);
      }
      
      // Missing persons
      if (!item.person || item.person.length === 0) {
        missingData._nopersons.push(item.accession);
      }
      
      // Missing source
      if (!item.source || item.source.length === 0) {
        missingData._nosource.push(item.accession);
      }
      
      // Missing description (empty, missing, or whitespace only)
      if (!item.description || item.description.trim() === '') {
        missingData._nodescription.push(item.accession);
      }
      
      // Items with living people
      if (item.person && Array.isArray(item.person)) {
        const hasLivingPerson = item.person.some(personRef => {
          if (personRef.personID) {
            const person = this.getPerson(personRef.personID);
            return person && person.living === true;
          }
          return false;
        });
        
        if (hasLivingPerson) {
          missingData._living.push(item.accession);
        }
      }
    }
    
    // Create new maintenance collections (skip empty ones)
    const created = [];
    for (const config of maintenanceCollections) {
      const itemCount = missingData[config.key].length;
      
      if (itemCount === 0) {
        continue; // Skip empty collections
      }
      
      // Create collection
      const collection = this.collections.createCollection(
        config.key,
        config.title,
        config.text
      );
      
      // Add all missing items to the collection
      for (const accession of missingData[config.key]) {
        const itemView = this.getItemView(accession);
        if (itemView) {
          collection.addItem(itemView.getLink());
        }
      }
      
      created.push(`${config.text}: ${itemCount} items`);
    }
    
    return {
      success: true,
      created,
      existingCollections
    };
  }

} // AccessionClass
