import { existsSync, mkdirSync, readdirSync } from 'fs';
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
      console.log('Error creating collections directory: ' + err.message);
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
      // Read files in collectionsDir
      const files = readdirSync(this.collectionsDir);

      for (const file of files) {
        const filePath = join(this.collectionsDir, file);
        try {
          this.collections.push(CollectionClass.fromFile(filePath));
        } catch (error) {
          console.error(`Error parsing collection file: ${file}\n${error}`);
        }
      }
    } else {
      console.log('Collections directory does not exist.');
    }
  }

  // Add an item to the selected collection
  addToCollection(collectionKey, accession, link) {
    const oldCategories = [
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
      const category = oldCategories.find((c) => c.value === collectionKey);
      if (category) {
        collection = new CollectionClass(collectionKey, category.text, category.title);
        collection.addItem(accession, link);
        this.collections.push(collection);
      } else {
        console.error(`Collection not found: ${collectionKey}`);
      }
    }
  }
} // end of CollectionsClass
