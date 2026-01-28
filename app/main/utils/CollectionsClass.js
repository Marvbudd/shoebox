import { existsSync, mkdirSync, readdirSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { CollectionClass } from './CollectionClass.js';
import { generateTimestamp } from './helpers.js';

/**
 * CollectionsClass - Manages all collections with proper encapsulation.
 * 
 * ARCHITECTURE PATTERN:
 * 
 * This class manages a set of CollectionClass instances, each following the
 * deferred-save pattern. Changes to individual collections set their
 * collectionChanged flags, and saveCollections() persists all modified collections.
 * 
 * FRIEND RELATIONSHIP WITH AccessionClass:
 * 
 * CollectionsClass is designed to be owned and managed by AccessionClass.
 * AccessionClass acts as a "friend" that controls the collections lifecycle:
 * 
 * - AccessionClass creates the CollectionsClass instance
 * - AccessionClass calls readCollections() during initialization
 * - AccessionClass calls saveCollections() from its saveAccessions() method
 * - This ensures collections are always persisted with their accessions
 * 
 * DO NOT create CollectionsClass instances outside of AccessionClass!
 * DO NOT call saveCollections() directly from IPC handlers or other external code!
 * 
 * IMPORTANT:
 * - Use collection mutation methods (addItem, removeItem) instead of direct access
 * - Use getLinks() method instead of accessing collection.itemKeys directly
 * - saveCollections() is called by parent AccessionClass, typically on app close
 * 
 * @class CollectionsClass
 */
export class CollectionsClass {
  constructor(accessionsDir) {
    this.collectionsDir = join(accessionsDir, 'collections');
    this.collections = [];
  }

  // Return a comma separated list of collection keys for the link
  getCollectionKeys(link) {
    let collectionKeys = '';
    for (const collection of this.collections) {
      if (collection.hasItem(link)) {
        collectionKeys += collection.key + ',';
      }
    }
    return collectionKeys.slice(0, -1);
  }

  getCollection(CollectionKey) {
    return this.collections.find(collection => collection.key === CollectionKey);
  }

  saveCollections() {
    try {
      // Check if collections directory exists
      if (!existsSync(this.collectionsDir)) {
        // Create collections directory
        mkdirSync(this.collectionsDir);
        console.log('Collections directory created.');
      } else {
        console.log('Collections directory already exists.');
      }
    } catch (err) {
      console.error('Error creating collections directory: ' + err.message);
    }
    for (const collection of this.collections) {
      // Generate the file path
      if (collection.collectionChanged) {
        const filePath = join(this.collectionsDir, `${collection.key}.json`);
        collection.tofile(filePath);
      }
    }
  }

  // Read files in collectionsDir
  readCollections() {
    if (this.collections.length > 0) {
      const clearCollections = confirm('There are existing collections. Do you want to clear them?');
      if (clearCollections) {
        this.collections = [];
      }
    }

    if (existsSync(this.collectionsDir)) {
      // Read json files in collectionsDir
      const files = readdirSync(this.collectionsDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = join(this.collectionsDir, file);
          try {
            this.collections.push(CollectionClass.fromFile(filePath));
          } catch (error) {
            console.error(`Error parsing collection file: ${file}\n${error}`);
          }
        }
      }
    } else {
      console.log('Collections directory does not exist.');
    }
  }

  // Add an item to the selected collection
  addToCollection(collectionKey, link) {
    const oldCollections = [
      { value: "demoSet", text: "Demo Media", title: "Demonstration Data Set" },
      { value: "buddc", text: "Chester Budd", title: "The Budd Family" },
      { value: "buddMarv", text: "Marvin Budd", title: "Everything Marvin Budd" },
      { value: "zntDeHart", text: "Zintz DeHart", title: "The Zintz and DeHart Family Collection" },
      { value: "hicks", text: "Hicks", title: "The Hicks Family" },
      { value: "brkErma", text: "Erma Barker", title: "The Erma Barker Collection" },
      { value: "barkerG", text: "George Barker", title: "The George Barker Collection" }
    ];
    
    let collection = this.collections.find((c) => c.key === collectionKey);
    if (collection) {
      collection.addItem(link);
    } else {
      const oldCollection = oldCollections.find((c) => c.value === collectionKey);
      if (oldCollection) {
        collection = this.createCollection(collectionKey, oldCollection.text, oldCollection.title);
        collection.addItem(link);
      } else {
        console.error(`Collection not found: ${collectionKey}`);
      }
    }
  } // end of addToCollection

  // Create a new collection
  createCollection(collectionKey, title, text) {
    if (this.collections.find((c) => c.key === collectionKey)) {
      console.error(`Collection already exists: ${collectionKey}`);
      return;
    }
    const collection = new CollectionClass(collectionKey, title, text);
    // Note: CollectionClass constructor already sets collectionChanged = true
    this.collections.push(collection);
    return collection;
  } // end of createCollection

  // Delete a collection (really archive it)
  deleteCollection(collectionKey) {
    const collection = this.collections.find((c) => c.key === collectionKey);
    if (collection) {
      const filePath = join(this.collectionsDir, `${collection.key}.json`);
      if (collection.collectionChanged) {
        collection.tofile(filePath);
      }
      
      // Generate timestamp for archival filename
      const timestamp = generateTimestamp();

      // Generate new file path with timestamp. 
      // Don't want this to have a .json extension, so it is not mistaken as an active collection.
      const newFilePath = join(this.collectionsDir, collection.key + `.${timestamp}`);
      // Rename the file
      try {
        renameSync(filePath, newFilePath);
        console.log(`File ${filePath} renamed successfully to ${newFilePath}.`);
      } catch (err) {
        console.error(`Error renaming ${filePath} to ${newFilePath}: ` + err.message);
      }

      const index = this.collections.indexOf(collection);
      this.collections.splice(index, 1);
    } else {
      console.error(`Collection not found: ${collectionKey}`);
    }
  } // end of deleteCollection

  /**
   * Backup all collections by creating timestamped copies
   * Delegates to each CollectionClass instance to handle its own backup
   * @returns {Object} Result with success status and array of backed up filenames
   */
  backupAllCollections() {
    if (!this.collections || this.collections.length === 0) {
      return { success: false, error: 'No collections to backup', backedUpFiles: [] };
    }

    // Generate timestamp once for all backups
    const timestamp = generateTimestamp();
    const backedUpFiles = [];
    const errors = [];

    // Delegate backup to each collection instance
    for (const collection of this.collections) {
      const collectionPath = join(this.collectionsDir, `${collection.key}.json`);
      const result = collection.backup(collectionPath, timestamp);
      
      if (result.success) {
        backedUpFiles.push(result.backupFilename);
        console.log(`Collection backed up: ${result.backupFilename}`);
      } else {
        console.error(`Failed to backup collection ${collection.key}:`, result.error);
        errors.push(`${collection.key}: ${result.error}`);
      }
    }

    if (backedUpFiles.length > 0) {
      return { success: true, backedUpFiles, errors };
    } else {
      return { success: false, error: 'Failed to backup any collections', errors };
    }
  } // end of backupAllCollections

  /**
   * Validate a specific collection
   * @param {string} collectionKey - The collection key to validate
   * @param {object} accessionClass - Reference to parent AccessionClass for validation
   * @returns {Promise<object>} Validation results and log file info
   */
  async validateCollection(collectionKey, accessionClass) {
    const collection = this.getCollection(collectionKey);
    if (!collection) {
      throw new Error(`Collection "${collectionKey}" not found`);
    }

    const path = await import('path');
    const ValidationService = (await import('./ValidationService.js')).ValidationService;
    const baseDir = path.dirname(accessionClass.accessionFilename);
    const validationService = new ValidationService(accessionClass, baseDir);
    const results = await validationService.validateCollection(collectionKey, collection);
    const logInfo = await validationService.writeCollectionLogFile(collectionKey, results);
    
    return {
      results,
      logInfo,
      collectionText: collection.text
    };
  } // end of validateCollection

  /**
   * Add items from source collection to target collection (union operation)
   * @param {string} targetKey - Target collection key
   * @param {string} sourceKey - Source collection key
   * @param {string} accessionsPath - Path to accessions file (for backup location)
   * @returns {Object} Result with addedCount and skippedCount
   */
  addItemsFromCollection(targetKey, sourceKey, accessionsPath) {
    const targetCollection = this.getCollection(targetKey);
    const sourceCollection = this.getCollection(sourceKey);
    
    if (!targetCollection) {
      throw new Error(`Target collection not found: ${targetKey}`);
    }
    if (!sourceCollection) {
      throw new Error(`Source collection not found: ${sourceKey}`);
    }
    
    // Backup target collection
    const collectionPath = join(dirname(accessionsPath), 'collections', `${targetKey}.json`);
    const backupResult = targetCollection.backup(collectionPath, generateTimestamp());
    
    if (!backupResult.success) {
      throw new Error(`Backup failed: ${backupResult.error}`);
    }
    
    // Add items using collection method
    const sourceLinks = sourceCollection.getLinks();
    let addedCount = 0;
    
    for (const link of sourceLinks) {
      if (!targetCollection.hasItem(link)) {
        targetCollection.addItem(link);
        addedCount++;
      }
    }
    
    return {
      success: true,
      addedCount,
      skippedCount: sourceLinks.length - addedCount,
      totalSourceItems: sourceLinks.length,
      backupFile: backupResult.backupFilename
    };
  } // end of addItemsFromCollection

  /**
   * Remove items that are in source collection from target collection (difference operation)
   * @param {string} targetKey - Target collection key
   * @param {string} sourceKey - Source collection key  
   * @param {string} accessionsPath - Path to accessions file (for backup location)
   * @returns {Object} Result with removedCount
   */
  removeItemsFromCollection(targetKey, sourceKey, accessionsPath) {
    const targetCollection = this.getCollection(targetKey);
    const sourceCollection = this.getCollection(sourceKey);
    
    if (!targetCollection) {
      throw new Error(`Target collection not found: ${targetKey}`);
    }
    if (!sourceCollection) {
      throw new Error(`Source collection not found: ${sourceKey}`);
    }
    
    // Find items to remove - create Set of source links for efficient lookup
    const sourceLinks = sourceCollection.getLinks();
    const sourceSet = new Set(sourceLinks);
    const targetLinks = targetCollection.getLinks();
    const toRemove = targetLinks.filter(link => sourceSet.has(link));
    
    if (toRemove.length === 0) {
      return {
        success: true,
        removedCount: 0,
        message: 'No matching items found'
      };
    }
    
    // Backup target collection
    const collectionPath = join(dirname(accessionsPath), 'collections', `${targetKey}.json`);
    const backupResult = targetCollection.backup(collectionPath, generateTimestamp());
    
    if (!backupResult.success) {
      throw new Error(`Backup failed: ${backupResult.error}`);
    }
    
    // Remove items using collection method
    for (const link of toRemove) {
      targetCollection.removeItem(link);
    }
    
    return {
      success: true,
      removedCount: toRemove.length,
      backupFile: backupResult.backupFilename
    };
  } // end of removeItemsFromCollection

  /**
   * Keep only items in both collections (intersection operation)
   * @param {string} targetKey - Target collection key
   * @param {string} sourceKey - Source collection key
   * @param {string} accessionsPath - Path to accessions file (for backup location)
   * @returns {Object} Result with keptCount and removedCount
   */
  intersectWithCollection(targetKey, sourceKey, accessionsPath) {
    const targetCollection = this.getCollection(targetKey);
    const sourceCollection = this.getCollection(sourceKey);
    
    if (!targetCollection) {
      throw new Error(`Target collection not found: ${targetKey}`);
    }
    if (!sourceCollection) {
      throw new Error(`Source collection not found: ${sourceKey}`);
    }
    
    // Find intersection
    const sourceLinks = sourceCollection.getLinks();
    const targetLinks = targetCollection.getLinks();
    const sourceSet = new Set(sourceLinks);
    const intersection = targetLinks.filter(link => sourceSet.has(link));
    const toRemove = targetLinks.filter(link => !sourceSet.has(link));
    
    if (intersection.length === 0) {
      return {
        success: true,
        keptCount: 0,
        removedCount: 0,
        message: 'No common items found'
      };
    }
    
    // Backup target collection
    const collectionPath = join(dirname(accessionsPath), 'collections', `${targetKey}.json`);
    const backupResult = targetCollection.backup(collectionPath, generateTimestamp());
    
    if (!backupResult.success) {
      throw new Error(`Backup failed: ${backupResult.error}`);
    }
    
    // Remove items not in intersection
    for (const link of toRemove) {
      targetCollection.removeItem(link);
    }
    
    return {
      success: true,
      keptCount: intersection.length,
      removedCount: toRemove.length,
      backupFile: backupResult.backupFilename
    };
  } // end of intersectWithCollection

  /**
   * Add all items from archive to target collection
   * @param {string} targetKey - Target collection key
   * @param {object} accessionClass - Reference to AccessionClass for accessing items
   * @param {string} accessionsPath - Path to accessions file (for backup location)
   * @returns {Object} Result with addedCount and skippedCount
   */
  addAllArchiveItems(targetKey, accessionClass, accessionsPath) {
    const targetCollection = this.getCollection(targetKey);
    
    if (!targetCollection) {
      throw new Error(`Target collection not found: ${targetKey}`);
    }
    
    const allItems = accessionClass.accessionJSON.accessions.item;
    const currentLinks = targetCollection.getLinks();
    // Create Set of current links for efficient lookup
    const currentSet = new Set(currentLinks);
    const newItems = allItems.filter(item => !currentSet.has(item.link));
    
    if (newItems.length === 0) {
      return {
        success: true,
        addedCount: 0,
        skippedCount: allItems.length,
        message: 'All archive items already in collection'
      };
    }
    
    // Backup target collection
    const collectionPath = join(dirname(accessionsPath), 'collections', `${targetKey}.json`);
    const backupResult = targetCollection.backup(collectionPath, generateTimestamp());
    
    if (!backupResult.success) {
      throw new Error(`Backup failed: ${backupResult.error}`);
    }
    
    // Add all new items
    for (const item of newItems) {
      targetCollection.addItem(item.link);
    }
    
    return {
      success: true,
      addedCount: newItems.length,
      skippedCount: allItems.length - newItems.length,
      totalItems: allItems.length,
      backupFile: backupResult.backupFilename
    };
  } // end of addAllArchiveItems

} // end of CollectionsClass
