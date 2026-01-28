import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { basename } from 'path';

/**
 * CollectionClass - Manages individual collection data with proper encapsulation and persistence.
 * 
 * CRITICAL ARCHITECTURE PATTERN:
 * 
 * This class uses a deferred-save pattern to improve performance and ensure data integrity:
 * 
 * 1. ALL data mutations MUST go through class methods (never modify itemKeys directly)
 * 2. Mutation methods set `this.collectionChanged = true` to flag pending changes
 * 3. tofile() is called ONLY when:
 *    - Parent CollectionsClass.saveCollections() is invoked (typically on app close)
 *    - Deleting a collection (to archive the current state)
 *    - Switching to different accessions
 * 
 * DO NOT call tofile() from external code or after individual changes!
 * This would cause:
 * - Poor performance (disk write on every change)
 * - Broken encapsulation (external code controlling persistence)
 * - Potential data loss (incomplete transactions)
 * 
 * CORRECT PATTERN:
 *   // In code using CollectionClass
 *   collection.addItem(link);  // Method sets collectionChanged flag
 *   // Do NOT call collection.tofile() here
 * 
 * INCORRECT PATTERN:
 *   // DON'T DO THIS!
 *   collection.itemKeys.push(link);  // Direct mutation
 *   collection.tofile(filePath);     // Immediate save
 * 
 * DATA STRUCTURE:
 * Collections now use link as the primary identifier (simplified from previous {accession, link} pairs).
 * itemKeys is an array of link strings: ['photo1.jpg', 'photo2.jpg', ...]
 * 
 * Mutation Methods (all set collectionChanged flag):
 * - addItem(link)
 * - removeItem(link)
 * - deleteCollection() (marks for archival)
 * 
 * Read-Only Methods (do NOT modify state):
 * - hasItem(link)
 * - getLinks() (use instead of direct itemKeys access)
 * 
 * @class CollectionClass
 */
// CollectionClass.js
export class CollectionClass {
  constructor(key, text, title) {
      // key is the unique identifier for the collection. No embedded spaces or special characters.
      this.key = key;
      // text is the shorter description of the collection - for display in a dropdown
      this.text = text;
      // title is a more human readable description of the collection
      this.title = title;
      // set to true if the collection has been changed
      this.collectionChanged = true;
  }
  // itemKeys is an array of link strings that compose the collection
  // Using link as the primary identifier (link is unique per item)
  itemKeys = [];
  
  /**
   * Flag indicating whether collection has been modified since last save.
   * Set to true by any mutation method, reset to false after tofile() completes.
   * @type {boolean}
   * @private
   */
  collectionChanged = false; // set to true if the collection has been changed
  
  /**
   * Create a collection from a file.
   * The filename is the key with a .json extension. Previous key is ignored.
   * Sets collectionChanged to false since data is freshly loaded.
   * 
   * @param {string} filePath - Path to the collection JSON file
   * @returns {CollectionClass} Newly created collection instance
   * AUTO-MIGRATION: Detects old format [{accession, link}] and converts to new format [link].
   * 
   * @param {string} filePath - Path to the collection JSON file
   * @returns {CollectionClass} Newly created collection instance
   * @static
   */
  static fromFile(filePath) {
    const fileContent = readFileSync(filePath, 'utf8');
    const json = JSON.parse(fileContent);
    const collection = new CollectionClass(basename(filePath, '.json'), json.text, json.title);
    
    // Auto-migrate from old format to new format
    if (json.itemKeys && json.itemKeys.length > 0) {
      if (typeof json.itemKeys[0] === 'object' && json.itemKeys[0].link) {
        // Old format: [{accession, link}] -> extract links
        collection.itemKeys = json.itemKeys.map(item => item.link);
        collection.collectionChanged = true; // Mark as changed to save in new format
        console.log(`Migrated collection ${collection.key} from old format (${json.itemKeys.length} items)`);
      } else {
        // New format: [link1, link2, ...]
        collection.itemKeys = json.itemKeys;
        collection.collectionChanged = false; // false because it was just read from file
      }
    } else {
      collection.itemKeys = [];
      collection.collectionChanged = false;
    }
    
    return collection;
  } // end of fromFile

  /**
   * Persist collection to disk if changes have been made.
   * 
   * IMPORTANT: This should ONLY be called when:
   * - Parent CollectionsClass.saveCollections() is invoked (app closing)
   * - Deleting/archiving a collection
   * - Switching to different accessions file
   * 
   * DO NOT call this from external code or after individual changes!
   * Individual mutations should only set collectionChanged = true.
   * 
   * @param {string} filePath - Path where collection should be saved
   */
  tofile(filePath) {
    // Convert the collection object to JSON string
    delete this.collectionChanged;
    const collectionJson = JSON.stringify(this);

    // Write the JSON string to the file
    // the file name is the key with a .json extension
    writeFileSync(filePath, collectionJson);
    this.collectionChanged = false;
    console.log(`${this instanceof CollectionClass ? 'CollectionClass' : typeof this} ${this.key} saved to file: ${filePath}`);
  } // end of tofile

  /**
   * Add an item to the collection by link.
   * Sets collectionChanged flag to mark pending changes.
   * 
   * @param {string} link - The item's file link
   */
  addItem(link) {
    if (this.itemKeys.includes(link)) {
      console.error(`Link ${link} already exists in collection ${this.key}`);
      return;
    }
    this.itemKeys.push(link);
    this.collectionChanged = true;
  } // end of addItem

  /**
   * Remove an item from the collection by link.
   * Sets collectionChanged flag to mark pending changes.
   * 
   * @param {string} link - The link of the item to remove
   */
  removeItem(link) {
    this.itemKeys = this.itemKeys.filter(item => item !== link);
    this.collectionChanged = true;
  } // end of removeItem

  /**
   * Check if an item exists in the collection by link.
   * Read-only operation - does NOT modify state.
   * 
   * @param {string} link - The link to check
   * @returns {boolean} True if the item exists in the collection
   */
  hasItem(link) {
    return this.itemKeys.includes(link);
  } // end of hasItem

  /**
   * Get all links in the collection.
   * Returns a copy to prevent external modification of internal state.
   * Read-only operation - does NOT modify state.
   * 
   * USE THIS instead of accessing collection.itemKeys directly!
   * 
   * @returns {Array<string>} Array of link strings
   */
  getLinks() {
    return [...this.itemKeys];
  } // end of getLinks

  /**
   * Create a timestamped backup of this collection.
   * Saves pending changes first if necessary.
   * 
   * @param {string} filePath - Path to the collection JSON file
   * @param {string} timestamp - Timestamp string to append to filename
   * @returns {Object} Result with success status and backup filename
   */
  backup(filePath, timestamp) {
    try {
      // Save pending changes first
      if (this.collectionChanged) {
        this.tofile(filePath);
      }

      // Create backup path (no .json extension to prevent ingestion)
      const backupPath = filePath.replace(/\.json$/, `.${timestamp}`);
      
      // Copy file to backup location
      copyFileSync(filePath, backupPath);
      
      return {
        success: true,
        backupFilename: basename(backupPath)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  } // end of backup

  /**
   * Mark collection for deletion/archival.
   * Sets collectionChanged flag - actual deletion happens in CollectionsClass.
   */
  deleteCollection() {
    // set the collectionChanged flag to true
    this.collectionChanged = true;
  } // end of deleteCollection
} // end of CollectionClass
