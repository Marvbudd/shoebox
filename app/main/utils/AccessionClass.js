import path from 'path';
import fs from 'fs';
import url from 'url';
import exifr from 'exifr';
import { ItemViewClass } from './ItemViewClass.js';
import { CollectionsClass } from './CollectionsClass.js';
import { AccessionSorter } from './AccessionSorter.js';
import { AccessionHTMLBuilder } from './AccessionHTMLBuilder.js';
import { PersonService } from './PersonService.js';
import { buildDateParts, enrichExistingDateWithTime, generateTimestamp, normalizeDateValue, resolveAccessionsFilePath } from './helpers.js';

const subdirectories = {
  photo: 'photo',
  audio: 'audio',
  video: 'video'
};

/**
 * AccessionClass - Manages accession data with proper encapsulation and persistence.
 * 
 * DEFERRED-SAVE PATTERN:
 * 
 * 1. ALL mutations go through class methods (never modify accessionJSON directly)
 * 2. Mutation methods set `this.accessionsChanged = true`
 * 3. saveAccessions() called ONLY when:
 *    - Main window closes
 *    - Switching archives
 *    - Creating new accessions
 * 
 * DO NOT call saveAccessions() from IPC handlers!
 * 
 * Example:
 *   accessionClass.saveItem(itemData);  // Sets accessionsChanged flag
 *   return { success: true };           // No save call
 * 
 * Mutation Methods (set accessionsChanged flag):
 * - saveItem(itemData)
 * - deleteItem(link)
 * - bulkUpdateCollectionItems(collectionKey, updates, onlyIfEmpty)
 * - createItem(file, directoryPath, type, formJSON)
 * - savePerson(person)
 * - updatePersonTMGID(personID, tmgid)
 * - toggleItemInCollection(collectionKey, link)
 * - importPersonsFromArchive(sourcePersons, options)
 * - importArchive(sourceData, sourceFilePath, options)
 * 
 * See docs/guide/architecture.md for architectural rationale.
 * 
 * @class AccessionClass
 */
export class AccessionClass {
  constructor(accessionFilename, title) {
    if (!title) {
      const tempDate = new Date();
      title = 'Accessions ' + tempDate.getFullYear() + tempDate.toLocaleString('default', { month: 'short' }) + tempDate.getDate();
    }

    const resolvedAccessionFilename = accessionFilename
      ? resolveAccessionsFilePath(accessionFilename)
      : null;
    const safeAccessionFilename = resolvedAccessionFilename || path.join(process.cwd(), 'accessions.json');

    if (!resolvedAccessionFilename || !fs.existsSync(safeAccessionFilename)) {
      console.warn(`AccessionClass: Accessions file not found at ${safeAccessionFilename}; creating a new archive structure.`);
      this.accessionJSON = {
        persons: {},
        candidatefaces: [],
        accessions: {
          title,
          item: []
        }
      };
    } else {
      this.accessionJSON = JSON.parse(fs.readFileSync(safeAccessionFilename).toString());
      if (!Array.isArray(this.accessionJSON.candidatefaces)) {
        this.accessionJSON.candidatefaces = [];
      }
    }
    
    /**
     * Flag indicating whether accessionJSON has been modified since last save.
     * Set to true by any mutation method, reset to false after saveAccessions() completes.
     * @type {boolean}
     * @private
     */
    this.accessionsChanged = false
    this.accessionFilename = safeAccessionFilename
    
    // Check if migration is needed and perform it
    const migrator = new PersonService(this.accessionJSON);
    if (migrator.needsMigration()) {
      console.log('AccessionClass: Legacy person structure detected. Beginning migration...');
      // Create backup before migration
      const timestamp = generateTimestamp();      // Generate new file path with timestamp.
      // Don't want this to have a .json extension, so it is not mistaken as an active accession file.
      const backupPath = safeAccessionFilename.replace(/\.json$/, `.${timestamp}`);
      try {
        fs.copyFileSync(safeAccessionFilename, backupPath);
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
    this.collections = new CollectionsClass(path.dirname(safeAccessionFilename))
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
    try {
      if (tmgID === undefined || tmgID === null) return null;
      // Ensure we have a string (numbers or other types may be passed)
      const tmgStr = String(tmgID);
      // Append .htm if not already present (supports both "123" and "123.htm" formats)
      const filename = tmgStr.endsWith('.htm') ? tmgStr : `${tmgStr}.htm`;
      // Prepend 'p' to the filename (Second Site person page naming convention)
      const personPage = `p${filename}`;
      return url.pathToFileURL(path.resolve(path.dirname(this.accessionFilename), 'website', personPage)).href;
    } catch (err) {
      console.error('Error generating person website URL for TMGID:', tmgID, err);
      return null;
    }
  } // getPersonWebsiteUrl

  // getMediaDirectory returns the path to the provided type and link
  getMediaPath(type, link) {
    return path.resolve(path.dirname(this.accessionFilename), subdirectories[type], link);
  } // getMediaPath

  getPhotoMetadata(filePath) {
    return exifr.parse(filePath, {
      tiff: true,
      exif: true,
      gps: true,
      iptc: true,
      xmp: true,
      ifd0: true
    });
  }

  getMetadataDateInfo(metadata, stats) {
    const metadataCandidates = [
      { value: metadata?.DateTimeOriginal, hasTime: true },
      { value: metadata?.DateCreated, hasTime: false },
      { value: metadata?.CreateDate, hasTime: true },
      { value: metadata?.DateTimeDigitized, hasTime: true },
      { value: metadata?.ModifyDate, hasTime: true },
      { value: metadata?.DateTime, hasTime: true }
    ];

    for (const candidate of metadataCandidates) {
      const normalizedDate = normalizeDateValue(candidate.value);
      if (normalizedDate) {
        return {
          date: normalizedDate,
          hasTime: candidate.hasTime,
          fromMetadata: true
        };
      }
    }

    const fallbackCandidates = [stats?.mtime, stats?.birthtime];
    for (const candidate of fallbackCandidates) {
      const normalizedDate = normalizeDateValue(candidate);
      if (normalizedDate) {
        return {
          date: normalizedDate,
          hasTime: true,
          fromMetadata: false
        };
      }
    }

    return {
      date: new Date(),
      hasTime: true,
      fromMetadata: false
    };
  }

  maybeAddTimeToExistingItem(existingItem, metadataDateInfo) {
    if (!existingItem?.date || !metadataDateInfo?.fromMetadata) {
      return false;
    }

    const updatedDate = enrichExistingDateWithTime(
      existingItem.date,
      metadataDateInfo.date,
      metadataDateInfo.hasTime
    );

    if (!updatedDate) {
      return false;
    }

    existingItem.date = updatedDate;
    this.accessionsChanged = true;
    return true;
  }

  // addMediaFiles adds media files to the accessionJSON 
  async addMediaFiles(formJSON) {
    try {
      const subdirectoryKeys = Object.keys(subdirectories);
      await Promise.all(subdirectoryKeys.map(async (type) => {
        const directoryPath = path.join(formJSON.updateFocus, subdirectories[type]);
        if (!fs.existsSync(directoryPath)) {
          console.warn(`Skipping missing media directory for ${type}: ${directoryPath}`);
          return;
        }

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
    const existingItem = this.accessionJSON.accessions.item.find(item => item.link === link);

    try {
      let metadata;
      if (type === 'photo') {
        metadata = await this.getPhotoMetadata(filePath);
      }

      const metadataDateInfo = this.getMetadataDateInfo(metadata, stats);

      if (existingItem) {
        this.maybeAddTimeToExistingItem(existingItem, metadataDateInfo);
        return;
      }

      const dateProperty = buildDateParts(metadataDateInfo.date, {
        includeTime: metadataDateInfo.hasTime
      });
        
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

  buildDateTimeKey(item) {
    const date = item?.date;
    if (!date || !date.time || typeof date.time !== 'string') {
      return null;
    }

    // Reuse the same interpretation used by date sorting to avoid drift in behavior.
    const normalizedTime = date.time.trim();
    if (!normalizedTime.includes(':')) {
      return null;
    }

    const interpretedDate = this.accessionSorter._createDateSort({
      ...date,
      time: normalizedTime
    });

    if (!(interpretedDate instanceof Date) || Number.isNaN(interpretedDate.getTime())) {
      return null;
    }

    // Compare duplicate items by interpreted date/time.
    return String(interpretedDate.getTime());
  }

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
            day: updates.date.day || '',
            ...(item.date?.time ? { time: item.date.time } : {})
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
   * @param {object} itemData - Complete item object with link and accession properties
   * @returns {boolean} Success status
   */
  saveItem(itemData) {
    if (!itemData || typeof itemData !== 'object') {
      throw new Error('AccessionClass.saveItem: itemData is null or not an object');
    }
    if (!itemData.link) {
      throw new Error('AccessionClass.saveItem: Item must have link property');
    }
    if (!itemData.accession) {
      throw new Error('AccessionClass.saveItem: Item must have accession property');
    }
    const items = this.accessionJSON.accessions?.item || [];
    const index = items.findIndex(i => i.link === itemData.link);
    if (index === -1) {
      throw new Error(`AccessionClass.saveItem: Item not found: ${itemData.link}`);
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

    // Clean up unresolved/excluded candidatefaces for this link so Face Manager
    // cannot surface ghost candidate rows after the backing item is deleted.
    const existingCandidates = this.getCandidateFaces();
    const retainedCandidates = existingCandidates.filter(candidate => candidate?.link !== link);
    if (retainedCandidates.length !== existingCandidates.length) {
      this.accessionJSON.candidatefaces = retainedCandidates;
    }

    // Remove the item from every collection that still references it.
    for (const collection of this.collections.collections) {
      if (collection.hasItem(link)) {
        collection.removeItem(link);
      }
    }
    
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
    const normalizedTMGID = this._normalizeTMGID(tmgid);
    if (!normalizedTMGID) {
      return null;
    }

    if (!this.accessionJSON.persons) {
      return null;
    }

    for (const [personID, person] of Object.entries(this.accessionJSON.persons)) {
      if (this._normalizeTMGID(person.TMGID) === normalizedTMGID) {
        return { personID, ...person };
      }
    }
    return null;
  }

  _normalizeTMGID(tmgid) {
    if (tmgid === undefined || tmgid === null) {
      return '';
    }

    return String(tmgid).trim();
  }

  _assertUniqueTMGID(personID, tmgid) {
    const normalizedTMGID = this._normalizeTMGID(tmgid);
    if (!normalizedTMGID || !this.accessionJSON.persons) {
      return;
    }

    for (const [existingPersonID, existingPerson] of Object.entries(this.accessionJSON.persons)) {
      if (existingPersonID === personID) {
        continue;
      }

      if (this._normalizeTMGID(existingPerson.TMGID) === normalizedTMGID) {
        throw new Error(`TMGID \"${normalizedTMGID}\" is already assigned to personID ${existingPersonID}`);
      }
    }
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
    const hasTMGIDField = Object.prototype.hasOwnProperty.call(person, 'TMGID');
    const requestedTMGID = this._normalizeTMGID(person.TMGID);
    const preservedTMGID = this._normalizeTMGID(existingPerson?.TMGID);
    // Explicit blank means remove TMGID; preserve only when the field is omitted.
    const tmgidToStore = hasTMGIDField ? requestedTMGID : preservedTMGID;

    this._assertUniqueTMGID(personID, tmgidToStore);

    const personToStore = { ...person };
    if (tmgidToStore) {
      personToStore.TMGID = tmgidToStore;
    } else {
      delete personToStore.TMGID;
    }

    this.accessionJSON.persons[personID] = personToStore;
    
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
    
    const normalizedTMGID = this._normalizeTMGID(tmgid);
    this._assertUniqueTMGID(personID, normalizedTMGID);

    if (normalizedTMGID) {
      this.accessionJSON.persons[personID].TMGID = normalizedTMGID;
    } else {
      delete this.accessionJSON.persons[personID].TMGID;
    }

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
   * Import persons from a source persons object
   * Properly encapsulates PersonService and sets accessionsChanged flag
   * @param {Object} sourcePersons - Source persons object from another archive
   * @param {Object} options - Import options
   * @param {boolean} options.includeFaceDescriptors - Whether to include faceBioData
   * @returns {Object} Import results with statistics
   */
  importPersonsFromArchive(sourcePersons, options = {}) {
    const personService = new PersonService(this.accessionJSON);
    const result = personService.importPersons(
      sourcePersons,
      this.accessionJSON.persons,
      options
    );
    
    // Mark as changed if any persons were imported
    if (result.imported.length > 0) {
      this.accessionsChanged = true;
    }
    
    return result;
  }

  /**
   * Import full archive (persons + items) from source archive
   * Properly encapsulates ArchiveImportService and sets accessionsChanged flag
   * @param {Object} sourceData - Parsed source accessions.json
   * @param {string} sourceFilePath - Path to source accessions.json
   * @param {Object} options - Import options
   * @param {boolean} options.dryRun - Preview mode: analyze but don't modify
   * @param {boolean} options.hashVerification - Use SHA-256 hash for file verification
   * @returns {Promise<Object>} Import results with statistics and log content
   */
  async importArchive(sourceData, sourceFilePath, options = {}) {
    // Dynamic import to avoid circular dependencies
    const { ArchiveImportService } = await import('./ArchiveImportService.js');
    
    const importService = new ArchiveImportService(
      sourceData,
      this.accessionJSON,
      sourceFilePath,
      this.accessionFilename,
      options
    );
    
    const result = await importService.execute();
    
    // Mark as changed if any modifications were made
    if (result.modified && (result.results.persons.imported.length > 0 || result.results.items.imported.length > 0)) {
      this.accessionsChanged = true;
    }
    
    return result;
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
   * Clean up unreferenced persons
   * Removes persons not linked to any items
   * @returns {Object} Result with totalRemoved count and removedPersons array
   */
  cleanupUnreferencedPersons() {
    const persons = this.accessionJSON.persons || {};
    const items = this.accessionJSON.accessions?.item || [];
    
    const result = this.personService.removeUnreferencedPersons(persons, items);
    
    if (result.totalRemoved > 0) {
      this.accessionsChanged = true;
    }
    
    return result;
  }

  /**
   * Get unresolved face candidates.
   * @returns {Array<Object>} candidatefaces array from archive
   */
  getCandidateFaces() {
    if (!Array.isArray(this.accessionJSON.candidatefaces)) {
      this.accessionJSON.candidatefaces = [];
    }
    return this.accessionJSON.candidatefaces;
  }

  /**
   * Replace all candidatefaces for a specific item link.
   * This keeps batch runs idempotent for each photo and avoids duplicate unresolved entries.
   * @param {string} link - Item link
   * @param {Array<Object>} candidates - Candidate face objects for this link
   * @returns {{removed:number,added:number,total:number}} mutation summary
   */
  replaceCandidateFacesForLink(link, candidates = []) {
    if (!link) {
      return {
        removed: 0,
        added: 0,
        total: this.getCandidateFaces().length
      };
    }

    const existing = this.getCandidateFaces();
    const retained = existing.filter(candidate => candidate?.link !== link);
    const removed = existing.length - retained.length;

    const dedupedByID = new Map();
    for (const candidate of candidates) {
      if (!candidate || !candidate.link || !candidate.region || !Array.isArray(candidate.descriptor)) {
        continue;
      }

      const x = Number(candidate.region.x || 0).toFixed(6);
      const y = Number(candidate.region.y || 0).toFixed(6);
      const w = Number(candidate.region.w || 0).toFixed(6);
      const h = Number(candidate.region.h || 0).toFixed(6);
      const model = candidate.model || 'ssd';
      const candidateID = candidate.candidateID || `${candidate.link}:${model}:${x}:${y}:${w}:${h}`;

      dedupedByID.set(candidateID, {
        candidateID,
        link: candidate.link,
        accession: candidate.accession || null,
        type: candidate.type || 'photo',
        region: {
          x: Number(candidate.region.x || 0),
          y: Number(candidate.region.y || 0),
          w: Number(candidate.region.w || 0),
          h: Number(candidate.region.h || 0)
        },
        descriptor: Array.from(candidate.descriptor),
        model,
        confidence: typeof candidate.confidence === 'number' ? candidate.confidence : null,
        quality: candidate.quality || null,
        ExcludeFromMatching: candidate?.ExcludeFromMatching === true,
        resolved: false,
        detectedAt: candidate.detectedAt || new Date().toISOString()
      });
    }

    const normalizedCandidates = Array.from(dedupedByID.values());
    this.accessionJSON.candidatefaces = retained.concat(normalizedCandidates);

    if (removed > 0 || normalizedCandidates.length > 0) {
      this.accessionsChanged = true;
    }

    return {
      removed,
      added: normalizedCandidates.length,
      total: this.accessionJSON.candidatefaces.length
    };
  }

  /**
   * Get unresolved candidatefaces for an item link.
   * @param {string} link - Item link
   * @returns {Array<Object>} Candidate faces for the link
   */
  getCandidateFacesForLink(link) {
    if (!link) {
      return [];
    }

    return this.getCandidateFaces().filter(candidate => (
      candidate
      && candidate.link === link
      && candidate.resolved !== true
      && candidate.ExcludeFromMatching !== true
    ));
  }

  /**
   * Remove one candidateface by candidateID.
   * @param {string} candidateID - Candidate face identifier
   * @returns {boolean} True if removed
   */
  removeCandidateFace(candidateID) {
    if (!candidateID) {
      return false;
    }

    const before = this.getCandidateFaces().length;
    this.accessionJSON.candidatefaces = this.getCandidateFaces().filter(candidate => candidate?.candidateID !== candidateID);
    const removed = before - this.accessionJSON.candidatefaces.length;

    if (removed > 0) {
      this.accessionsChanged = true;
      return true;
    }

    return false;
  }

  /**
   * Clean up orphaned or invalid candidatefaces.
   * Removes entries that cannot be resolved in Face Manager workflows.
   * @returns {{totalRemoved:number, removedByReason:Object<string, number>}}
   */
  cleanupOrphanedCandidateFaces() {
    const candidates = this.getCandidateFaces();
    const items = this.accessionJSON.accessions?.item || [];
    const itemsByLink = new Map();
    items.forEach(item => {
      if (item?.link) {
        itemsByLink.set(item.link, item);
      }
    });

    const isFiniteNumber = (value) => Number.isFinite(Number(value));
    const removedByReason = {
      invalidEntry: 0,
      missingLink: 0,
      missingItem: 0,
      invalidRegion: 0,
      invalidDescriptor: 0
    };

    const retained = [];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') {
        removedByReason.invalidEntry += 1;
        continue;
      }

      const link = typeof candidate.link === 'string' ? candidate.link : '';
      if (!link) {
        removedByReason.missingLink += 1;
        continue;
      }

      if (!itemsByLink.has(link)) {
        removedByReason.missingItem += 1;
        continue;
      }

      const region = candidate.region;
      const validRegion = region
        && isFiniteNumber(region.x)
        && isFiniteNumber(region.y)
        && isFiniteNumber(region.w)
        && isFiniteNumber(region.h)
        && Number(region.w) > 0
        && Number(region.h) > 0;
      if (!validRegion) {
        removedByReason.invalidRegion += 1;
        continue;
      }

      if (!Array.isArray(candidate.descriptor) || candidate.descriptor.length !== 128) {
        removedByReason.invalidDescriptor += 1;
        continue;
      }

      retained.push(candidate);
    }

    const totalRemoved = candidates.length - retained.length;
    if (totalRemoved > 0) {
      this.accessionJSON.candidatefaces = retained;
      this.accessionsChanged = true;
    }

    return {
      totalRemoved,
      removedByReason
    };
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

    const orphanedCandidateFaces = results.warnings.filter(w => (
      w.type === 'ORPHANED_CANDIDATE_FACE_NO_ITEM'
      || w.type === 'CANDIDATE_FACE_NO_LINK'
      || w.type === 'CANDIDATE_FACE_INVALID_REGION'
      || w.type === 'CANDIDATE_FACE_INVALID_DESCRIPTOR'
      || w.type === 'CANDIDATE_FACE_INVALID_ENTRY'
    ));
    
    // Count unreferenced persons
    const unreferencedPersons = results.info.filter(i => 
      i.type === 'UNREFERENCED_PERSON'
    );
    
    return {
      ...logInfo,
      orphanedDescriptorCount: orphanedDescriptors.length,
      orphanedCandidateFaceCount: orphanedCandidateFaces.length,
      unreferencedPersonCount: unreferencedPersons.length
    };
  }

  parseMklinksSourceDirectory() {
    const archiveRoot = path.dirname(this.accessionFilename);
    const mklinksConfigPath = path.join(archiveRoot, 'mklinks.conf');

    if (!fs.existsSync(mklinksConfigPath)) {
      return {
        success: false,
        warning: `mklinks.conf was not found at ${mklinksConfigPath}.` 
      };
    }

    const lines = fs.readFileSync(mklinksConfigPath, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    if (lines.length < 2 || !lines[1]) {
      return {
        success: false,
        warning: 'mklinks.conf is missing line 2 (source directory to scan).'
      };
    }

    const configuredSource = lines[1];
    const resolvedSource = path.isAbsolute(configuredSource)
      ? path.resolve(configuredSource)
      : path.resolve(archiveRoot, configuredSource);

    if (!fs.existsSync(resolvedSource) || !fs.statSync(resolvedSource).isDirectory()) {
      return {
        success: false,
        warning: `Source directory from mklinks.conf line 2 does not exist or is not a directory: ${resolvedSource}`
      };
    }

    return {
      success: true,
      sourceDirectory: resolvedSource,
      configPath: mklinksConfigPath
    };
  }

  buildCollectionKeyFromDirectoryName(directoryName) {
    const noSpaces = String(directoryName || '').replace(/\s+/g, '');
    const sanitized = noSpaces.replace(/[^A-Za-z0-9_-]/g, '');
    return sanitized || 'symlinkCollection';
  }

  createSymlinkNamedCollections() {
    const parseResult = this.parseMklinksSourceDirectory();
    if (!parseResult.success) {
      return {
        success: false,
        warning: parseResult.warning,
        created: [],
        updated: [],
        skipped: []
      };
    }

    const sourceDirectory = path.resolve(parseResult.sourceDirectory);
    const groupMap = new Map();
    let symlinkItemsProcessed = 0;

    const items = this.accessionJSON?.accessions?.item || [];
    for (const item of items) {
      if (!item?.link || !item?.type || !subdirectories[item.type]) {
        continue;
      }

      const mediaPath = this.getMediaPath(item.type, item.link);
      let lstat;
      try {
        lstat = fs.lstatSync(mediaPath);
      } catch (_error) {
        continue;
      }

      if (!lstat.isSymbolicLink()) {
        continue;
      }

      symlinkItemsProcessed++;

      let symlinkTarget;
      try {
        const rawTarget = fs.readlinkSync(mediaPath);
        symlinkTarget = path.isAbsolute(rawTarget)
          ? path.resolve(rawTarget)
          : path.resolve(path.dirname(mediaPath), rawTarget);
      } catch (_error) {
        continue;
      }

      const relativeTarget = path.relative(sourceDirectory, symlinkTarget);
      if (!relativeTarget || relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
        continue;
      }

      const pathParts = relativeTarget.split(path.sep).filter(Boolean);
      if (pathParts.length < 2) {
        // Target file is at source root, not in a source directory.
        continue;
      }

      const topLevelDirectory = pathParts[0];
      if (!groupMap.has(topLevelDirectory)) {
        groupMap.set(topLevelDirectory, new Set());
      }
      groupMap.get(topLevelDirectory).add(item.link);
    }

    if (symlinkItemsProcessed === 0) {
      return {
        success: true,
        created: [],
        updated: [],
        skipped: ['No symlink-backed archive items were found.']
      };
    }

    const created = [];
    const updated = [];
    const skipped = [];
    const generatedKeys = new Set();

    const sortedGroups = Array.from(groupMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [directoryName, linksSet] of sortedGroups) {
      const links = Array.from(linksSet);
      if (links.length === 0) {
        continue;
      }

      const text = directoryName;
      const title = directoryName;

      let key = this.buildCollectionKeyFromDirectoryName(directoryName);
      let suffix = 2;
      while (generatedKeys.has(key) && this.collections.getCollection(key)?.text !== text) {
        key = `${this.buildCollectionKeyFromDirectoryName(directoryName)}_${suffix}`;
        suffix++;
      }
      generatedKeys.add(key);

      let collection = this.collections.getCollection(key);
      let wasCreated = false;
      if (!collection) {
        collection = this.collections.createCollection(key, title, text);
        wasCreated = true;
      }

      if (!collection) {
        skipped.push(`${directoryName}: unable to create or load collection key ${key}`);
        continue;
      }

      if (collection.text !== text) {
        collection.setText(text);
      }
      if (collection.title !== title) {
        collection.setTitle(title);
      }

      let addedCount = 0;
      for (const link of links) {
        if (!collection.hasItem(link)) {
          collection.addItem(link);
          addedCount++;
        }
      }

      if (wasCreated) {
        created.push(`${text} (${key}): ${links.length} item(s)`);
      } else {
        updated.push(`${text} (${key}): +${addedCount} item(s), ${links.length} total matched`);
      }
    }

    return {
      success: true,
      created,
      updated,
      skipped
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
      { key: '_living', text: 'Living People', title: 'Items with Living People' },
      { key: '_facecandidates', text: 'Face Candidates', title: 'Face Candidates: Unresolved' },
      { key: '_samedatetime', text: 'Items with the same date/time', title: 'Items with the same date/time' }
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
      { key: '_living', text: 'Living People', title: 'Items with Living People' },
      { key: '_facecandidates', text: 'Face Candidates', title: 'Face Candidates: Unresolved' },
      { key: '_samedatetime', text: 'Items with the same date/time', title: 'Items with the same date/time' }
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
      _living: [],
      _facecandidates: [],
      _samedatetime: []
    };
    const dateTimeGroups = new Map();
    
    for (const item of items) {
      // Missing location
      if (!item.location || item.location.length === 0) {
        missingData._nolocation.push(item.link);
      }
      
      // Missing persons
      // Criteria: item has person data only if at least one person entry has a non-empty personID.
      const hasValidPersonData = Array.isArray(item.person) && item.person.some((personRef) => {
        const personID = typeof personRef?.personID === 'string'
          ? personRef.personID.trim()
          : '';
        return personID !== '';
      });

      if (!hasValidPersonData) {
        missingData._nopersons.push(item.link);
      }
      
      // Missing source
      if (!item.source || item.source.length === 0) {
        missingData._nosource.push(item.link);
      }
      
      // Missing description (empty, missing, or whitespace only)
      if (!item.description || item.description.trim() === '') {
        missingData._nodescription.push(item.link);
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
          missingData._living.push(item.link);
        }
      }

      // Duplicate date/time match (requires date.time and complete date)
      const dateTimeKey = this.buildDateTimeKey(item);
      if (dateTimeKey && item.link) {
        if (!dateTimeGroups.has(dateTimeKey)) {
          dateTimeGroups.set(dateTimeKey, []);
        }
        dateTimeGroups.get(dateTimeKey).push(item.link);
      }
    }

    // Unresolved face candidates (single review queue driven by candidatefaces)
    const unresolvedCandidateLinks = this.getCandidateFaces()
      .filter(candidate => candidate && candidate.link && candidate.resolved !== true)
      .map(candidate => candidate.link);
    missingData._facecandidates = Array.from(new Set(unresolvedCandidateLinks));

    const duplicateDateTimeLinks = [];
    dateTimeGroups.forEach((links) => {
      if (links.length > 1) {
        duplicateDateTimeLinks.push(...links);
      }
    });
    missingData._samedatetime = Array.from(new Set(duplicateDateTimeLinks));
    
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
      for (const link of missingData[config.key]) {
        collection.addItem(link);
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
