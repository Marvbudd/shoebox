/**
 * ValidationService
 * 
 * Validates the entire accessions.json archive for data integrity issues.
 * Generates a detailed report of errors and warnings.
 */

import fs from 'fs';
import path from 'path';
import { generateTimestamp } from './helpers.js';
import { formatPersonName } from '../../shared/personHelpers.js';

// Map item types to their subdirectories (same as AccessionClass)
const subdirectories = {
  photo: 'photo',
  audio: 'audio',
  video: 'video'
};

export class ValidationService {
  constructor(accessionClass, baseDirectory) {
    this.accessionClass = accessionClass;
    this.baseDirectory = baseDirectory;
    this.errors = [];
    this.warnings = [];
    this.info = [];
  }

  /**
   * Run all validation checks and return results
   */
  async validate() {
    this.errors = [];
    this.warnings = [];
    this.info = [];

    await this.validatePersonReferences();
    await this.validateMediaFiles();
    await this.validateOrphanedFiles();
    await this.validatePlaylistReferences();
    this.validateAccessionNumbers();
    this.validatePersonLastNames();
    this.validateUnreferencedPersons();
    this.validateOrphanedFaceDescriptors();

    return {
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      infoCount: this.info.length,
      errors: this.errors,
      warnings: this.warnings,
      info: this.info
    };
  }

  /**
   * Check for invalid personID references
   */
  validatePersonReferences() {
    const persons = this.accessionClass.accessionJSON.persons || {};
    const validPersonIDs = new Set(Object.keys(persons));
    const items = this.accessionClass.accessionJSON.accessions?.item || [];

    items.forEach((item, index) => {
      // Check person array
      if (item.person && Array.isArray(item.person)) {
        item.person.forEach((personRef, pIndex) => {
          // Check if personID is present
          if (!personRef.personID) {
            this.errors.push({
              type: 'PERSON_NO_ID',
              accession: item.accession,
              link: item.link,
              itemIndex: index,
              message: `Item ${item.link || item.accession} has person without personID`,
              location: `item.person[${pIndex}]`
            });
          } else if (!validPersonIDs.has(personRef.personID)) {
            // Check if personID exists in persons library
            this.errors.push({
              type: 'INVALID_PERSON_REFERENCE',
              accession: item.accession,
              link: item.link,
              itemIndex: index,
              message: `Item ${item.link || item.accession} references non-existent personID: ${personRef.personID}`,
              location: `item.person[${pIndex}]`,
              personID: personRef.personID
            });
          }
        });
      }

      // Check source array
      if (item.source && Array.isArray(item.source)) {
        item.source.forEach((source, sIndex) => {
          if (source.personID && !validPersonIDs.has(source.personID)) {
            this.errors.push({
              type: 'INVALID_SOURCE_REFERENCE',
              accession: item.accession,
              link: item.link,
              itemIndex: index,
              message: `Item ${item.link || item.accession} source references non-existent personID: ${source.personID}`,
              location: `item.source[${sIndex}]`,
              personID: source.personID
            });
          }
        });
      }
    });
  }

  /**
   * Check if media files exist in the file system
   */
  async validateMediaFiles() {
    const items = this.accessionClass.accessionJSON.accessions?.item || [];

    for (const item of items) {
      if (!item.link || !item.type) {
        this.warnings.push({
          type: 'MISSING_MEDIA_INFO',
          accession: item.accession,
          message: `Item ${item.accession} missing link or type`,
          link: item.link,
          itemType: item.type
        });
        continue;
      }

      // Map item type to directory
      const directory = subdirectories[item.type] || item.type;
      const mediaPath = path.join(this.baseDirectory, directory, item.link);
      
      try {
        await fs.promises.access(mediaPath, fs.constants.F_OK);
      } catch (err) {
        this.errors.push({
          type: 'MISSING_MEDIA_FILE',
          accession: item.accession,
          message: `Item ${item.accession} media file not found: ${item.link}`,
          link: item.link,
          itemType: item.type,
          expectedPath: mediaPath
        });
      }
    }
  }

  /**
   * Check for orphaned media files (files in directories not in accessions.json)
   */
  async validateOrphanedFiles() {
    const items = this.accessionClass.accessionJSON.accessions?.item || [];
    
    // Build set of all files referenced in accessions.json
    const referencedFiles = new Map(); // Map of type -> Set of filenames
    referencedFiles.set('photo', new Set());
    referencedFiles.set('audio', new Set());
    referencedFiles.set('video', new Set());
    
    items.forEach(item => {
      if (item.link && item.type && referencedFiles.has(item.type)) {
        referencedFiles.get(item.type).add(item.link);
      }
    });
    
    // Check each media directory for orphaned files
    for (const [type, dirname] of Object.entries(subdirectories)) {
      const dirPath = path.join(this.baseDirectory, dirname);
      
      try {
        await fs.promises.access(dirPath, fs.constants.F_OK);
      } catch (err) {
        // Directory doesn't exist, skip
        continue;
      }
      
      try {
        const files = await fs.promises.readdir(dirPath);
        const referenced = referencedFiles.get(type);
        
        files.forEach(filename => {
          // Skip hidden files and directories
          if (filename.startsWith('.')) {
            return;
          }
          
          if (!referenced.has(filename)) {
            this.warnings.push({
              type: 'ORPHANED_MEDIA_FILE',
              mediaType: type,
              filename: filename,
              message: `Orphaned ${type} file found (not in accessions.json): ${filename}`,
              path: path.join(dirPath, filename)
            });
          }
        });
      } catch (err) {
        this.errors.push({
          type: 'DIRECTORY_READ_ERROR',
          directory: dirname,
          message: `Failed to read ${type} directory: ${err.message}`,
          path: dirPath
        });
      }
    }
  }

  /**
   * Check playlist references
   */
  validatePlaylistReferences() {
    const items = this.accessionClass.accessionJSON.accessions?.item || [];
    const validLinks = new Set(items.map(item => item.link).filter(link => link));
    const timeFormat = /^\d{1,2}:\d{2}:\d{2}\.\d$/;

    items.forEach((item, index) => {
      if (!item.playlist || !item.playlist.entry) {
        return;
      }

      item.playlist.entry.forEach((entry, eIndex) => {
        // Check if referenced file exists in accessions
        if (!entry.ref) {
          this.errors.push({
            type: 'PLAYLIST_MISSING_REF',
            accession: item.accession,
            link: item.link,
            itemIndex: index,
            message: `Item ${item.link || item.accession} playlist entry missing ref field`,
            location: `item.playlist.entry[${eIndex}]`
          });
        } else if (!validLinks.has(entry.ref)) {
          this.errors.push({
            type: 'PLAYLIST_INVALID_REF',
            accession: item.accession,
            link: item.link,
            itemIndex: index,
            message: `Item ${item.link || item.accession} playlist references non-existent file: ${entry.ref}`,
            location: `item.playlist.entry[${eIndex}]`,
            ref: entry.ref
          });
        }

        // Check time format
        if (!entry.starttime) {
          this.errors.push({
            type: 'PLAYLIST_MISSING_STARTTIME',
            accession: item.accession,
            link: item.link,
            itemIndex: index,
            message: `Item ${item.link || item.accession} playlist entry missing starttime`,
            location: `item.playlist.entry[${eIndex}]`
          });
        } else if (!timeFormat.test(entry.starttime)) {
          this.errors.push({
            type: 'PLAYLIST_INVALID_TIME_FORMAT',
            accession: item.accession,
            link: item.link,
            itemIndex: index,
            message: `Item ${item.link || item.accession} playlist invalid starttime format: ${entry.starttime} (expected HH:MM:SS.s)`,
            location: `item.playlist.entry[${eIndex}]`,
            value: entry.starttime
          });
        }

        if (!entry.duration) {
          this.errors.push({
            type: 'PLAYLIST_MISSING_DURATION',
            accession: item.accession,
            link: item.link,
            itemIndex: index,
            message: `Item ${item.link || item.accession} playlist entry missing duration`,
            location: `item.playlist.entry[${eIndex}]`
          });
        } else if (!timeFormat.test(entry.duration)) {
          this.errors.push({
            type: 'PLAYLIST_INVALID_TIME_FORMAT',
            accession: item.accession,
            link: item.link,
            itemIndex: index,
            message: `Item ${item.link || item.accession} playlist invalid duration format: ${entry.duration} (expected HH:MM:SS.s)`,
            location: `item.playlist.entry[${eIndex}]`,
            value: entry.duration
          });
        }
      });
    });
  }



  /**
   * Check for duplicate accession numbers
   */
  validateAccessionNumbers() {
    const items = this.accessionClass.accessionJSON.accessions?.item || [];
    const accessionMap = new Map();

    items.forEach((item, index) => {
      if (!item.accession) {
        this.errors.push({
          type: 'MISSING_ACCESSION',
          itemIndex: index,
          message: `Item at index ${index} has no accession number`,
          link: item.link
        });
        return;
      }

      if (accessionMap.has(item.accession)) {
        this.errors.push({
          type: 'DUPLICATE_ACCESSION',
          accession: item.accession,
          link: item.link,
          itemIndex: index,
          message: `Duplicate accession number: ${item.accession} (also at index ${accessionMap.get(item.accession)})`,
          duplicateIndex: accessionMap.get(item.accession)
        });
      } else {
        accessionMap.set(item.accession, index);
      }
    });
  }

  /**
   * Check for people with multiple maiden names
   * A person should only have one maiden name but can have multiple married names
   */
  validatePersonLastNames() {
    const persons = this.accessionClass.accessionJSON.persons || {};

    Object.entries(persons).forEach(([personID, person]) => {
      if (!person.last || !Array.isArray(person.last)) {
        return;
      }

      // Count maiden names (entries without type or with type === 'maiden')
      const maidenNames = person.last.filter(nameObj => 
        !nameObj.type || nameObj.type === 'maiden'
      );

      if (maidenNames.length > 1) {
        const maidenNamesList = maidenNames.map(n => n.last).join(', ');
        const fullName = `${person.first || ''} ${person.last[0]?.last || ''}`.trim();
        
        this.errors.push({
          type: 'MULTIPLE_MAIDEN_NAMES',
          personID: personID,
          personName: fullName,
          message: `Person "${fullName}" (${personID}) has ${maidenNames.length} maiden names: ${maidenNamesList}. Only one maiden name allowed.`,
          maidenNames: maidenNamesList,
          count: maidenNames.length
        });
      }
    });
  }

  /**
   * Check for orphaned face descriptors (person has faceBioData for items where they're not listed)
   */
  validateOrphanedFaceDescriptors() {
    const persons = this.accessionClass.accessionJSON.persons || {};
    const items = this.accessionClass.accessionJSON.accessions?.item || [];
    
    // Build a map of item links for quick lookup
    const itemsByLink = new Map();
    items.forEach(item => {
      if (item.link) {
        itemsByLink.set(item.link, item);
      }
    });

    Object.entries(persons).forEach(([personID, person]) => {
      if (!person.faceBioData || !Array.isArray(person.faceBioData)) return;
      
      person.faceBioData.forEach((faceData, faceIndex) => {
        const link = faceData.link;
        const personName = formatPersonName(person);
        
        if (!link) {
          this.warnings.push({
            type: 'FACE_DESCRIPTOR_NO_LINK',
            personID: personID,
            personName: personName,
            message: `Person "${personName}" has face descriptor without link`,
            location: `persons[${personID}].faceBioData[${faceIndex}]`
          });
          return;
        }
        
        const item = itemsByLink.get(link);
        
        if (!item) {
          this.warnings.push({
            type: 'ORPHANED_FACE_DESCRIPTOR_NO_ITEM',
            personID: personID,
            personName: personName,
            link: link,
            message: `Person "${personName}" has face descriptor for non-existent item: ${link}`,
            location: `persons[${personID}].faceBioData[${faceIndex}]`
          });
        } else {
          // Check if person is actually listed in the item's person array
          const isInItemPersonList = item.person?.some(p => p.personID === personID);
          
          if (!isInItemPersonList) {
            this.warnings.push({
              type: 'ORPHANED_FACE_DESCRIPTOR',
              personID: personID,
              personName: personName,
              link: link,
              accession: item.accession,
              message: `Person "${personName}" has face descriptor for item ${link}, but is not listed in that item's person array`,
              location: `persons[${personID}].faceBioData[${faceIndex}]`
            });
          }
        }
      });
    });
  }
  
  /**
   * Check for persons with no item references
   * This is informational only - not an error
   */
  validateUnreferencedPersons() {
    const persons = this.accessionClass.accessionJSON.persons || {};

    Object.entries(persons).forEach(([personID, person]) => {
      const items = this.accessionClass.getItemsForPerson(personID);
      
      if (items.length === 0) {
        const fullName = formatPersonName(person);
        const tmgid = person.TMGID ? ` (TMGID: ${person.TMGID})` : '';
        
        this.info.push({
          type: 'UNREFERENCED_PERSON',
          personID: personID,
          personName: fullName,
          message: `Person "${fullName}"${tmgid} has no item references. Can be deleted in Person Manager if no longer needed.`,
          TMGID: person.TMGID || null
        });
      }
    });
  }

  /**
   * Generate a formatted validation report
   */
  generateReport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const lines = [];

    lines.push('================================================================================');
    lines.push('SHOEBOX ARCHIVE VALIDATION REPORT');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Archive: ${path.join(this.baseDirectory, 'app', 'resource', 'accessions.json')}`);
    lines.push('================================================================================');
    lines.push('');

    // Summary
    lines.push('SUMMARY');
    lines.push('--------');
    lines.push(`Total Errors: ${this.errors.length}`);
    lines.push(`Total Warnings: ${this.warnings.length}`);
    lines.push(`Informational: ${this.info.length}`);
    lines.push('');

    // Error breakdown
    if (this.errors.length > 0) {
      const errorTypes = {};
      this.errors.forEach(err => {
        errorTypes[err.type] = (errorTypes[err.type] || 0) + 1;
      });

      lines.push('ERROR BREAKDOWN:');
      Object.entries(errorTypes).forEach(([type, count]) => {
        lines.push(`  ${type}: ${count}`);
      });
      lines.push('');
    }

    // Detailed errors
    if (this.errors.length > 0) {
      lines.push('================================================================================');
      lines.push('ERRORS');
      lines.push('================================================================================');
      lines.push('');

      this.errors.forEach((err, index) => {
        lines.push(`[${index + 1}] ${err.type}`);
        lines.push(`    Message: ${err.message}`);
        if (err.accession) lines.push(`    Accession: ${err.accession}`);
        if (err.location) lines.push(`    Location: ${err.location}`);
        if (err.personID) lines.push(`    PersonID: ${err.personID}`);
        if (err.personName) lines.push(`    Person: ${err.personName}`);
        if (err.link) lines.push(`    Link: ${err.link}`);
        if (err.ref) lines.push(`    Reference: ${err.ref}`);
        if (err.value) lines.push(`    Value: ${err.value}`);
        if (err.expectedPath) lines.push(`    Expected Path: ${err.expectedPath}`);
        lines.push('');
      });
    }

    // Warnings
    if (this.warnings.length > 0) {
      lines.push('================================================================================');
      lines.push('WARNINGS');
      lines.push('================================================================================');
      lines.push('');

      this.warnings.forEach((warn, index) => {
        lines.push(`[${index + 1}] ${warn.type}`);
        lines.push(`    Message: ${warn.message}`);
        if (warn.accession) lines.push(`    Accession: ${warn.accession}`);
        if (warn.link) lines.push(`    Link: ${warn.link}`);
        if (warn.personID) lines.push(`    PersonID: ${warn.personID}`);
        if (warn.personName) lines.push(`    Person: ${warn.personName}`);
        if (warn.location) lines.push(`    Location: ${warn.location}`);
        lines.push('');
      });
      
      // Add cleanup instructions for orphaned face descriptors
      const orphanedFaceWarnings = this.warnings.filter(w => 
        w.type === 'ORPHANED_FACE_DESCRIPTOR' || 
        w.type === 'ORPHANED_FACE_DESCRIPTOR_NO_ITEM' ||
        w.type === 'FACE_DESCRIPTOR_NO_LINK'
      );
      
      if (orphanedFaceWarnings.length > 0) {
        lines.push('');
        lines.push('HOW TO FIX ORPHANED FACE DESCRIPTORS:');
        lines.push('--------------------------------------');
        lines.push('Option 1: Open the Validation window in Shoebox and click "Cleanup Orphaned');
        lines.push('          Face Descriptors" button to automatically remove all orphaned data.');
        lines.push('');
        lines.push('Option 2: For each orphaned descriptor, either:');
        lines.push('          - Add the person back to the item if they should be there, OR');
        lines.push('          - Delete the orphaned descriptor manually in the person record');
        lines.push('');
      }
    }

    // Informational messages
    if (this.info.length > 0) {
      lines.push('================================================================================');
      lines.push('INFORMATIONAL (Not Problems)');
      lines.push('================================================================================');
      lines.push('');

      this.info.forEach((info, index) => {
        lines.push(`[${index + 1}] ${info.type}`);
        lines.push(`    Message: ${info.message}`);
        if (info.personID) lines.push(`    PersonID: ${info.personID}`);
        if (info.personName) lines.push(`    Person: ${info.personName}`);
        if (info.TMGID) lines.push(`    TMGID: ${info.TMGID}`);
        lines.push('');
      });
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      lines.push('No errors or warnings found. Archive is valid!');
      lines.push('');
    }

    lines.push('================================================================================');
    lines.push('END OF REPORT');
    lines.push('================================================================================');

    return lines.join('\n');
  }

  /**
   * Write validation report to log file
   */
  async writeLogFile() {
    const timestamp = generateTimestamp();
    const filename = `validation-${timestamp}.log`;
    const logPath = path.join(this.baseDirectory, filename);
    const report = this.generateReport();

    await fs.promises.writeFile(logPath, report, 'utf8');

    return {
      filename,
      path: logPath,
      errorCount: this.errors.length,
      warningCount: this.warnings.length
    };
  }

  /**
   * Validate a specific collection
   * Checks that all items in the collection exist in the database
   * and that accession numbers match links
   * 
   * @param {string} collectionKey - The collection key to validate
   * @param {Object} collection - The collection object from CollectionsClass
   * @returns {Object} Validation results with errors and warnings
   */
  async validateCollection(collectionKey, collection) {
    const collectionErrors = [];
    const collectionWarnings = [];
    
    const items = this.accessionClass.accessionJSON.accessions?.item || [];
    
    // Build maps for quick lookup
    const linkToItem = new Map();
    const accessionToItem = new Map();
    
    items.forEach(item => {
      if (item.link) {
        linkToItem.set(item.link, item);
      }
      if (item.accession) {
        accessionToItem.set(item.accession, item);
      }
    });
    
    // Validate each item in collection
    const itemLinks = collection.getLinks();
    
    itemLinks.forEach((link, index) => {
      
      // Check if link exists in database
      const itemByLink = linkToItem.get(link);
      if (!itemByLink) {
        collectionErrors.push({
          type: 'COLLECTION_LINK_NOT_FOUND',
          collectionKey,
          index,
          message: `Collection "${collectionKey}" item ${index + 1}: link "${link}" not found in database`,
          link
        });
      }
    });
    
    return {
      collectionKey,
      itemCount: itemLinks.length,
      errorCount: collectionErrors.length,
      warningCount: collectionWarnings.length,
      errors: collectionErrors,
      warnings: collectionWarnings
    };
  }
  
  /**
   * Write collection validation report to log file
   * Saves in collections directory with collection key prefix
   */
  async writeCollectionLogFile(collectionKey, results) {
    const timestamp = generateTimestamp();
    const filename = `${collectionKey}.${timestamp}.log`;
    const collectionsDir = path.join(this.baseDirectory, 'collections');
    const logPath = path.join(collectionsDir, filename);
    
    const lines = [];
    lines.push('================================================================================');
    lines.push(`COLLECTION VALIDATION REPORT: ${collectionKey}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Database: ${path.join(this.baseDirectory, 'app', 'resource', 'accessions.json')}`);
    lines.push('================================================================================');
    lines.push('');
    
    // Summary
    lines.push('SUMMARY');
    lines.push('--------');
    lines.push(`Collection: ${results.collectionKey}`);
    lines.push(`Total Items: ${results.itemCount}`);
    lines.push(`Errors: ${results.errorCount}`);
    lines.push(`Warnings: ${results.warningCount}`);
    lines.push('');
    
    // Errors
    if (results.errors.length > 0) {
      lines.push('================================================================================');
      lines.push('ERRORS');
      lines.push('================================================================================');
      lines.push('');
      
      results.errors.forEach((err, index) => {
        lines.push(`[${index + 1}] ${err.type}`);
        lines.push(`    Message: ${err.message}`);
        if (err.link) lines.push(`    Link: ${err.link}`);
        if (err.accession) lines.push(`    Collection Accession: ${err.accession}`);
        if (err.databaseAccession) lines.push(`    Database Accession: ${err.databaseAccession}`);
        lines.push('');
      });
    }
    
    // Warnings
    if (results.warnings.length > 0) {
      lines.push('================================================================================');
      lines.push('WARNINGS');
      lines.push('================================================================================');
      lines.push('');
      
      results.warnings.forEach((warn, index) => {
        lines.push(`[${index + 1}] ${warn.type}`);
        lines.push(`    Message: ${warn.message}`);
        if (warn.link) lines.push(`    Link: ${warn.link}`);
        if (warn.accession) lines.push(`    Accession: ${warn.accession}`);
        lines.push('');
      });
    }
    
    if (results.errors.length === 0 && results.warnings.length === 0) {
      lines.push('No errors or warnings found. Collection is valid!');
      lines.push('');
    }
    
    lines.push('================================================================================');
    lines.push('END OF REPORT');
    lines.push('================================================================================');
    
    const report = lines.join('\n');
    await fs.promises.writeFile(logPath, report, 'utf8');
    
    return {
      filename,
      path: logPath,
      errorCount: results.errorCount,
      warningCount: results.warningCount
    };
  }
}
