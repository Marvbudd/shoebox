import { existsSync, mkdirSync, readdirSync, renameSync } from 'fs';
import { join } from 'path';
import { CollectionClass } from './CollectionClass.js';

export class CollectionsClass {
  constructor(accessionsDir) {
    this.collectionsDir = join(accessionsDir, 'collections');
    this.collections = [];
  }

  // Return a comma separated list of collection keys for the accession
  getCollectionKeys(accession) {
    let collectionKeys = '';
    for (const collection of this.collections) {
      if (collection.itemKeys.find(item => item.accession === accession)) {
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
  addToCollection(collectionKey, accession, link) {
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
      collection.addItem(accession, link);
    } else {
      const oldCollection = oldCollections.find((c) => c.value === collectionKey);
      if (oldCollection) {
        collection = this.createCollection(collectionKey, oldCollection.text, oldCollection.title);
        collection.addItem(accession, link);
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
    collection.collectionChanged = true;
    return this.collections.push(collection);
  } // end of createCollection

  // Delete a collection (really archive it)
  deleteCollection(collectionKey) {
    const collection = this.collections.find((c) => c.key === collectionKey);
    if (collection) {
      const filePath = join(this.collectionsDir, `${collection.key}.json`);
      if (collection.collectionChanged) {
        collection.tofile(filePath);
      }
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const julianDay = Math.floor((currentDate - new Date(currentDate.getFullYear(), 0, 0)) / 86400000);
      const hour = currentDate.getHours();
      const minute = currentDate.getMinutes();

      const newKey = collection.key + `.${year}${julianDay}${hour}${minute}`;
      const newFilePath = join(this.collectionsDir, newKey);
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
} // end of CollectionsClass
