import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';

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
  // itemKeys is an array of objects that compose the collection
  //  Each object has the accession, and the link.
  //  These duplicate each other, but lend some redundancy if the link is broken.
  //  They also help detect duplicate uses of the same accession.
  itemKeys = [];
  collectionChanged = false; // set to true if the collection has been changed
  
  // create a collection from a file
  // the filename is the key with a .json extension. Previous key is ignored.
  // force collectionChanged to false
  static fromFile(filePath) {
    const fileContent = readFileSync(filePath, 'utf8');
    const json = JSON.parse(fileContent);
    const collection = new CollectionClass(basename(filePath, '.json'), json.text, json.title);
    collection.itemKeys = json.itemKeys;
    // console.log(`${collection instanceof CollectionClass ? 'CollectionClass' : typeof collection} ${collection.key} read from file: ${filePath}`);
    collection.collectionChanged = false; // false because it was just read from file
    return collection;
  } // end of fromFile

  // save the collection to a file
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

  // add an item to the collection
  addItem(accession, link) {
    const item = this.itemKeys.find(item => item.accession === accession);
    if (item) {
      if (item.link === link) {
        console.error(`Accession ${accession} already exists in collection ${this.key}`);
      } else {
        console.error(`Accession ${accession} already exists in collection ${this.key} with a different link, ${item.link}.`);
      }
      return;
    }
    this.itemKeys.push({accession, link});
    this.collectionChanged = true;
  } // end of addItem

  // remove an item from the collection
  removeAccession(accession) {
    this.itemKeys = this.itemKeys.filter(item => item.accession !== accession);
    this.collectionChanged = true;
  } // end of removeAccession

  // get the item from the collection
  getItem(accession) {
    return this.itemKeys.find(item => item.accession === accession);
  } // end of getItem

  // delete the collection (really archive it)
  deleteCollection() {
    // set the collectionChanged flag to true
    this.collectionChanged = true;
  } // end of deleteCollection
} // end of CollectionClass
