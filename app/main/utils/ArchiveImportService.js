import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { formatPersonName } from '../../shared/personHelpers.js';
import { PersonService } from './PersonService.js';

/**
 * ArchiveImportService - Full archive import with persons and items
 * 
 * Implements Phase 1: Full Archive Import
 * 
 * Features:
 * - Two-stage import: persons first (without face descriptors), then items (with descriptors)
 * - File verification using size + SHA-256 hash
 * - Complete item metadata comparison (all fields)
 * - Conflict detection and logging
 * - _ImportConflicts collection creation
 * - Detailed log file generation
 * 
 * Key Principles:
 * - Never overwrite target items with conflicts
 * - Preserve all existing face descriptors in target
 * - Only import face descriptors for successfully imported items
 * - Log all conflicts for manual resolution
 */
export class ArchiveImportService {
  /**
   * @param {Object} sourceData - Parsed source accessions.json
   * @param {Object} targetData - Target accessions.json (will be modified)
   * @param {string} sourceFilePath - Path to source accessions.json
   * @param {string} targetFilePath - Path to target accessions.json (for resource path resolution)
   * @param {Object} options - Import options
   * @param {boolean} options.dryRun - Preview mode: analyze but don't modify target
   */
  constructor(sourceData, targetData, sourceFilePath, targetFilePath, options = {}) {
    this.sourceData = sourceData;
    this.targetData = targetData;
    this.sourceFilePath = sourceFilePath;
    this.targetFilePath = targetFilePath;
    this.dryRun = options.dryRun || false;
    
    // Get resource base directories
    this.sourceResourceDir = path.dirname(sourceFilePath);
    this.targetResourceDir = path.dirname(targetFilePath);
    
    // Results tracking
    this.results = {
      persons: {
        imported: [],
        skipped: [],
        conflicts: []
      },
      items: {
        imported: [],
        skipped: [],
        conflicts: [],
        filesRestored: []  // Items where missing target file was copied from source
      },
      files: {
        verified: [],
        sizeMismatches: [],
        hashMismatches: [],
        symlinkDetected: false
      }
    };
    
    // Build lookups for O(1) access
    this.targetPersonMap = new Map();
    this.targetItemMap = new Map();
    this.buildTargetMaps();
  }
  
  /**
   * Build lookup maps for target archive (O(1) checking)
   */
  buildTargetMaps() {
    // Person lookup by UUID
    if (this.targetData.persons) {
      Object.keys(this.targetData.persons).forEach(personID => {
        this.targetPersonMap.set(personID, this.targetData.persons[personID]);
      });
    }
    
    // Item lookup by type+link key
    if (this.targetData.accessions?.item) {
      this.targetData.accessions.item.forEach(item => {
        const key = `${item.type}:${item.link}`;
        this.targetItemMap.set(key, item);
      });
    }
  }
  
  /**
   * Main import execution
   * @returns {Object} Import results with statistics and conflicts
   */
  async execute() {
    // Stage 1: Import persons (without face descriptors)
    await this.importPersons();
    
    // Stage 2: Import items (with face descriptors for successful imports)
    await this.importItems();
    
    // Create conflict collection if needed
    if (this.results.items.conflicts.length > 0 && !this.dryRun) {
      this.createConflictCollection();
    }
    
    // Generate log file
    const logContent = this.generateLogFile();
    
    return {
      success: true,
      results: this.results,
      logContent: logContent,
      modified: !this.dryRun
    };
  }
  
  /**
   * Stage 1: Import persons without face descriptors
   * Uses PersonService logic from Phase 0 but strips face descriptors
   */
  async importPersons() {
    const sourcePersons = this.sourceData.persons || {};
    const targetPersons = this.targetData.persons || {};
    
    const personService = new PersonService(this.targetData);
    
    // Import with face descriptors stripped
    const personImportResult = personService.importPersons(
      sourcePersons,
      targetPersons,
      { includeFaceDescriptors: false }
    );
    
    // Copy results
    this.results.persons.imported = personImportResult.imported || [];
    this.results.persons.skipped = personImportResult.skipped || [];
    
    // Handle UUID collisions and TMGID conflicts
    const uuidCollisions = personImportResult.uuidCollisions || [];
    const tmgidConflicts = personImportResult.tmgidConflicts || [];
    
    this.results.persons.conflicts = [
      ...uuidCollisions.map(c => ({ type: 'UUID_COLLISION', ...c })),
      ...tmgidConflicts.map(c => ({ type: 'TMGID_CONFLICT', ...c }))
    ];
  }
  
  /**
   * Stage 2: Import items with file verification and face descriptors
   */
  async importItems() {
    const sourceItems = this.sourceData.accessions?.item || [];
    const targetItems = this.targetData.accessions?.item || [];
    
    for (const sourceItem of sourceItems) {
      const itemKey = `${sourceItem.type}:${sourceItem.link}`;
      const targetItem = this.targetItemMap.get(itemKey);
      
      if (!targetItem) {
        // New item - verify file and import
        await this.importNewItem(sourceItem);
      } else {
        // Item exists - verify file and compare metadata
        await this.handleExistingItem(sourceItem, targetItem);
      }
    }
  }
  
  /**
   * Import a new item (doesn't exist in target)
   */
  async importNewItem(sourceItem) {
    // Verify file exists and get properties
    const fileInfo = await this.verifyFile(sourceItem);
    
    if (!fileInfo.exists) {
      this.results.items.conflicts.push({
        type: 'FILE_NOT_FOUND',
        link: sourceItem.link,
        itemType: sourceItem.type,
        reason: 'Source file does not exist'
      });
      return;
    }
    
    // Copy physical file from source to target (if not dry run)
    if (!this.dryRun) {
      const sourceFilePath = path.join(this.sourceResourceDir, sourceItem.type, sourceItem.link);
      const targetFilePath = path.join(this.targetResourceDir, sourceItem.type, sourceItem.link);
      const targetDir = path.dirname(targetFilePath);
      
      try {
        // Ensure target directory exists
        await fs.promises.mkdir(targetDir, { recursive: true });
        
        // Copy file
        await fs.promises.copyFile(sourceFilePath, targetFilePath);
      } catch (error) {
        this.results.items.conflicts.push({
          type: 'FILE_COPY_ERROR',
          link: sourceItem.link,
          itemType: sourceItem.type,
          reason: `Failed to copy file: ${error.message}`
        });
        return;
      }
    }
    
    // Import item with face descriptors from source
    const importedItem = { ...sourceItem };
    
    // Attach face descriptors from source persons for this item
    importedItem.person = await this.attachFaceDescriptorsForItem(sourceItem);
    
    if (!this.dryRun) {
      this.targetData.accessions.item.push(importedItem);
    }
    
    this.results.items.imported.push({
      link: sourceItem.link,
      type: sourceItem.type,
      accession: sourceItem.accession,
      description: sourceItem.description
    });
  }
  
  /**
   * Handle item that exists in both archives
   */
  async handleExistingItem(sourceItem, targetItem) {
    const itemKey = `${sourceItem.type}:${sourceItem.link}`;
    
    // Verify files are identical
    const fileComparison = await this.compareFiles(sourceItem, targetItem);
    
    if (!fileComparison.identical) {
      // Special case: target file missing but source exists - copy the file
      if (fileComparison.reason === 'FILE_ACCESS_ERROR' && fileComparison.fileLocation === 'target') {
        // Verify source file exists
        const sourceFileInfo = await this.verifyFile(sourceItem);
        if (sourceFileInfo.exists && !this.dryRun) {
          // Copy missing file from source to target
          const sourceFilePath = path.join(this.sourceResourceDir, sourceItem.type, sourceItem.link);
          const targetFilePath = path.join(this.targetResourceDir, targetItem.type, targetItem.link);
          const targetDir = path.dirname(targetFilePath);
          
          try {
            await fs.promises.mkdir(targetDir, { recursive: true });
            await fs.promises.copyFile(sourceFilePath, targetFilePath);
            
            // Track that file was restored
            this.results.items.filesRestored.push({
              link: sourceItem.link,
              type: sourceItem.type
            });
            
            // File copied - now compare metadata
            const metadataMatch = this.compareItemMetadata(sourceItem, targetItem);
            if (metadataMatch) {
              this.results.items.skipped.push({
                link: sourceItem.link,
                type: sourceItem.type
              });
            } else {
              // Metadata differs - still a conflict but file is restored
              const differences = this.getMetadataDifferences(sourceItem, targetItem);
              this.results.items.conflicts.push({
                type: 'METADATA_MISMATCH',
                link: sourceItem.link,
                itemType: sourceItem.type,
                sourceItem: sourceItem,
                targetItem: targetItem,
                differences: differences
              });
            }
            return;
          } catch (copyError) {
            // Copy failed - log original conflict with additional context
            this.results.items.conflicts.push({
              type: 'FILE_MISMATCH',
              link: sourceItem.link,
              itemType: sourceItem.type,
              reason: fileComparison.reason,
              sourceStat: fileComparison.sourceStat,
              targetStat: fileComparison.targetStat,
              error: `${fileComparison.error}; Copy attempt failed: ${copyError.message}`,
              errorCode: fileComparison.errorCode,
              fileLocation: fileComparison.fileLocation
            });
            return;
          }
        }
      }
      
      // Different files with same link - conflict
      this.results.items.conflicts.push({
        type: 'FILE_MISMATCH',
        link: sourceItem.link,
        itemType: sourceItem.type,
        reason: fileComparison.reason,
        sourceStat: fileComparison.sourceStat,
        targetStat: fileComparison.targetStat,
        error: fileComparison.error,
        errorCode: fileComparison.errorCode,
        fileLocation: fileComparison.fileLocation
      });
      return;
    }
    
    // Files are identical - compare metadata
    const metadataMatch = this.compareItemMetadata(sourceItem, targetItem);
    
    if (metadataMatch) {
      // Perfect match - skip
      this.results.items.skipped.push({
        link: sourceItem.link,
        type: sourceItem.type
      });
    } else {
      // Metadata differs - conflict (preserve target)
      const differences = this.getMetadataDifferences(sourceItem, targetItem);
      this.results.items.conflicts.push({
        type: 'METADATA_MISMATCH',
        link: sourceItem.link,
        itemType: sourceItem.type,
        sourceItem: sourceItem,
        targetItem: targetItem,
        differences: differences
      });
    }
  }
  
  /**
   * Verify file exists and get stats
   */
  async verifyFile(item) {
    const filePath = path.join(this.sourceResourceDir, item.type, item.link);
    
    try {
      const stats = await fs.promises.lstat(filePath);
      
      // Check if symlink
      if (stats.isSymbolicLink()) {
        this.results.files.symlinkDetected = true;
      }
      
      return {
        exists: true,
        size: stats.size,
        isSymlink: stats.isSymbolicLink()
      };
    } catch (error) {
      return { exists: false };
    }
  }
  
  /**
   * Compare files using size + SHA-256 hash
   */
  async compareFiles(sourceItem, targetItem) {
    const sourceFilePath = path.join(this.sourceResourceDir, sourceItem.type, sourceItem.link);
    const targetFilePath = path.join(this.targetResourceDir, targetItem.type, targetItem.link);
    
    try {
      // Get file stats
      const sourceStats = await fs.promises.lstat(sourceFilePath);
      const targetStats = await fs.promises.lstat(targetFilePath);
      
      // Check symlinks
      if (sourceStats.isSymbolicLink() || targetStats.isSymbolicLink()) {
        this.results.files.symlinkDetected = true;
      }
      
      // Get actual file stats (follow symlinks)
      const sourceRealStats = await fs.promises.stat(sourceFilePath);
      const targetRealStats = await fs.promises.stat(targetFilePath);
      
      // Compare sizes first (fast check)
      if (sourceRealStats.size !== targetRealStats.size) {
        this.results.files.sizeMismatches.push(sourceItem.link);
        return {
          identical: false,
          reason: 'FILE_SIZE_MISMATCH',
          sourceStat: { size: sourceRealStats.size },
          targetStat: { size: targetRealStats.size }
        };
      }
      
      // Compare hashes (SHA-256)
      const sourceHash = await this.calculateFileHash(sourceFilePath);
      const targetHash = await this.calculateFileHash(targetFilePath);
      
      if (sourceHash !== targetHash) {
        this.results.files.hashMismatches.push(sourceItem.link);
        return {
          identical: false,
          reason: 'FILE_HASH_MISMATCH',
          sourceStat: { size: sourceRealStats.size, hash: sourceHash },
          targetStat: { size: targetRealStats.size, hash: targetHash }
        };
      }
      
      // Files are identical
      this.results.files.verified.push(sourceItem.link);
      return { identical: true };
      
    } catch (error) {
      // Determine which file caused the error
      let fileLocation = 'unknown';
      if (error.path) {
        if (error.path.includes(this.targetResourceDir)) {
          fileLocation = 'target';
        } else if (error.path.includes(this.sourceResourceDir)) {
          fileLocation = 'source';
        }
      }
      
      return {
        identical: false,
        reason: 'FILE_ACCESS_ERROR',
        error: error.message,
        errorCode: error.code,
        fileLocation: fileLocation
      };
    }
  }
  
  /**
   * Calculate SHA-256 hash of file
   */
  async calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
  
  /**
   * Compare all item metadata fields
   * Returns true only if ALL fields match
   */
  compareItemMetadata(sourceItem, targetItem) {
    // Compare all fields - any difference returns false
    const fieldsToCompare = [
      'accession', 'description', 'type', 'link',
      'date', 'city', 'state', 'gps', 'person', 'source',
      'playlist', 'faceTag'
    ];
    
    for (const field of fieldsToCompare) {
      if (!this.fieldEquals(sourceItem[field], targetItem[field])) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Deep comparison of field values
   */
  fieldEquals(a, b) {
    // Handle undefined/null
    if (a === undefined && b === undefined) return true;
    if (a === null && b === null) return true;
    if (a === undefined || b === undefined) return false;
    if (a === null || b === null) return false;
    
    // Handle primitives
    if (typeof a !== 'object' || typeof b !== 'object') {
      return a === b;
    }
    
    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => this.fieldEquals(item, b[index]));
    }
    
    // Handle objects
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    
    return aKeys.every(key => this.fieldEquals(a[key], b[key]));
  }
  
  /**
   * Get human-readable list of metadata differences
   */
  getMetadataDifferences(sourceItem, targetItem) {
    const differences = [];
    const fieldsToCompare = [
      'accession', 'description', 'date', 'city', 'state', 'gps',
      'person', 'source', 'playlist', 'faceTag'
    ];
    
    for (const field of fieldsToCompare) {
      if (!this.fieldEquals(sourceItem[field], targetItem[field])) {
        differences.push({
          field: field,
          sourceValue: this.stringifyValue(sourceItem[field]),
          targetValue: this.stringifyValue(targetItem[field])
        });
      }
    }
    
    return differences;
  }
  
  /**
   * Convert value to readable string for logging
   */
  stringifyValue(value) {
    if (value === undefined) return '[undefined]';
    if (value === null) return '[null]';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
  
  /**
   * Attach face descriptors from source persons for successfully imported item
   * This is Stage 2 of the two-stage process
   */
  async attachFaceDescriptorsForItem(item) {
    // Get person assignments from item
    const persons = item.person || [];
    
    // For each person, check if they have face descriptors for this item in source
    const personsWithDescriptors = persons.map(personAssignment => {
      const person = this.sourceData.persons[personAssignment.personID];
      if (!person || !person.faceBioData) {
        return personAssignment;
      }
      
      // Find face descriptors that match this item's link
      const matchingDescriptors = person.faceBioData.filter(
        descriptor => descriptor.link === item.link
      );
      
      // If face descriptors exist for this item, we need to add them to target person
      if (matchingDescriptors.length > 0 && !this.dryRun) {
        this.addFaceDescriptorsToTargetPerson(personAssignment.personID, matchingDescriptors);
      }
      
      return personAssignment;
    });
    
    return personsWithDescriptors;
  }
  
  /**
   * Add face descriptors to target person (only for successfully imported items)
   */
  addFaceDescriptorsToTargetPerson(personID, descriptors) {
    if (!this.targetData.persons[personID]) {
      return; // Person doesn't exist in target (shouldn't happen after Stage 1)
    }
    
    if (!this.targetData.persons[personID].faceBioData) {
      this.targetData.persons[personID].faceBioData = [];
    }
    
    // Add descriptors (avoid duplicates)
    for (const descriptor of descriptors) {
      const exists = this.targetData.persons[personID].faceBioData.some(
        existing => existing.link === descriptor.link && 
        JSON.stringify(existing.region) === JSON.stringify(descriptor.region)
      );
      
      if (!exists) {
        this.targetData.persons[personID].faceBioData.push(descriptor);
      }
    }
  }
  
  /**
   * Create _ImportConflicts collection with conflicting target items
   */
  createConflictCollection() {
    if (!this.targetData.collections) {
      this.targetData.collections = {};
    }
    
    const conflictItems = this.results.items.conflicts
      .filter(c => c.type === 'METADATA_MISMATCH')
      .map(c => ({ link: c.link, type: c.itemType }));
    
    if (conflictItems.length === 0) {
      return;
    }
    
    const sourceBasename = path.basename(this.sourceFilePath);
    
    this.targetData.collections['_ImportConflicts'] = {
      key: '_ImportConflicts',
      Title: `Import Conflicts from: ${sourceBasename}`,
      text: 'Import Conflicts',
      item: conflictItems
    };
  }
  
  /**
   * Generate detailed log file content
   */
  generateLogFile() {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const sourceBasename = path.basename(this.sourceFilePath);
    const targetBasename = path.basename(this.targetFilePath);
    
    let log = '';
    log += '========================================\n';
    log += 'SHOEBOX ARCHIVE IMPORT LOG\n';
    log += '========================================\n';
    log += `Date: ${timestamp}\n`;
    log += `Source: ${this.sourceFilePath}\n`;
    log += `Target: ${this.targetFilePath}\n`;
    log += `Mode: ${this.dryRun ? 'DRY RUN (Preview Only)' : 'FULL IMPORT'}\n`;
    log += '\n';
    
    // Summary
    log += 'IMPORT SUMMARY\n';
    log += '--------------\n';
    log += `Persons: ${this.results.persons.imported.length} imported, `;
    log += `${this.results.persons.skipped.length} skipped (exact match), `;
    log += `${this.results.persons.conflicts.length} conflicts\n`;
    log += `Items: ${this.results.items.imported.length} imported, `;
    log += `${this.results.items.skipped.length} skipped (exact match), `;
    log += `${this.results.items.conflicts.length} conflicts\n`;
    log += `File Verification: ${this.results.files.verified.length} verified identical, `;
    log += `${this.results.files.sizeMismatches.length} size mismatches, `;
    log += `${this.results.files.hashMismatches.length} hash mismatches\n`;
    if (this.results.items.filesRestored.length > 0) {
      log += `Files Restored: ${this.results.items.filesRestored.length} missing target files copied from source\n`;
    }
    log += '\n';
    
    // Person conflicts
    if (this.results.persons.conflicts.length > 0) {
      log += 'PERSON CONFLICTS (Review Required)\n';
      log += '-----------------------------------\n';
      for (const conflict of this.results.persons.conflicts) {
        log += `UUID: ${conflict.personID}\n`;
        log += `  Type: ${conflict.type}\n`;
        log += `  Source: ${conflict.sourceName}\n`;
        log += `  Target: ${conflict.targetName || '[not in target]'}\n`;
        
        if (conflict.type === 'UUID_COLLISION' && conflict.sourcePerson && conflict.targetPerson) {
          // Show detailed differences for UUID collisions
          const src = conflict.sourcePerson;
          const tgt = conflict.targetPerson;
          const diffs = [];
          
          if (src.first !== tgt.first) {
            diffs.push(`    first: "${src.first}" vs "${tgt.first}"`);
          }
          if (JSON.stringify(src.last) !== JSON.stringify(tgt.last)) {
            diffs.push(`    last: ${JSON.stringify(src.last)} vs ${JSON.stringify(tgt.last)}`);
          }
          const srcTMGID = src.TMGID || null;
          const tgtTMGID = tgt.TMGID || null;
          if (srcTMGID !== tgtTMGID) {
            diffs.push(`    TMGID: ${srcTMGID} vs ${tgtTMGID}`);
          }
          if ((src.notes || '') !== (tgt.notes || '')) {
            diffs.push(`    notes: "${src.notes || ''}" vs "${tgt.notes || ''}"`);
          }
          if ((src.living || false) !== (tgt.living || false)) {
            diffs.push(`    living: ${src.living || false} vs ${tgt.living || false}`);
          }
          
          if (diffs.length > 0) {
            log += `  Differences:\n`;
            diffs.forEach(d => log += d + '\n');
          }
        } else if (conflict.type === 'TMGID_CONFLICT') {
          log += `  TMGID: ${conflict.tmgid}\n`;
        }
        log += '\n';
      }
      log += '\n';
    }
    
    // Item conflicts
    if (this.results.items.conflicts.length > 0) {
      log += 'ITEM CONFLICTS (Target Items Preserved)\n';
      log += '----------------------------------------\n';
      for (const conflict of this.results.items.conflicts) {
        log += `Link: ${conflict.link}\n`;
        log += `  Type: ${conflict.itemType}\n`;
        log += `  Conflict Type: ${conflict.type}\n`;
        
        if (conflict.type === 'FILE_MISMATCH') {
          log += `  Reason: ${conflict.reason}\n`;
          
          if (conflict.reason === 'FILE_ACCESS_ERROR') {
            // Provide clearer explanation for access errors
            log += `  Details: Item exists in target metadata but `;
            if (conflict.fileLocation === 'target') {
              log += `physical file missing from target ${conflict.itemType}/ directory\n`;
            } else if (conflict.fileLocation === 'source') {
              log += `physical file missing from source ${conflict.itemType}/ directory\n`;
            } else {
              log += `file access error occurred\n`;
            }
            log += `  Error: ${conflict.error || 'Unknown error'}\n`;
            if (conflict.errorCode) {
              log += `  Error Code: ${conflict.errorCode}\n`;
            }
          } else if (conflict.sourceStat && conflict.targetStat) {
            log += `  Source: ${JSON.stringify(conflict.sourceStat)}\n`;
            log += `  Target: ${JSON.stringify(conflict.targetStat)}\n`;
          }
        } else if (conflict.type === 'METADATA_MISMATCH') {
          log += `  Metadata Differences:\n`;
          for (const diff of conflict.differences) {
            log += `    ${diff.field}:\n`;
            log += `      Source: ${diff.sourceValue}\n`;
            log += `      Target: ${diff.targetValue}\n`;
          }
        } else if (conflict.type === 'FILE_NOT_FOUND') {
          log += `  Reason: ${conflict.reason}\n`;
        }
        
        // Add note if present
        if (conflict.note) {
          log += `  Note: ${conflict.note}\n`;
        }
        
        log += '\n';
      }
      log += '\n';
    }
    
    // Files restored
    if (this.results.items.filesRestored.length > 0) {
      log += 'FILES RESTORED (Missing target files copied from source)\n';
      log += '-------------------------------------------------------\n';
      log += 'The following items existed in target metadata but were missing physical files.\n';
      log += 'Files were automatically copied from source archive during import.\n';
      log += '\n';
      for (const item of this.results.items.filesRestored) {
        log += `${item.type}/${item.link}\n`;
      }
      log += '\n';
    }
    
    // Symlink detection
    if (this.results.files.symlinkDetected) {
      log += 'SYMLINK DETECTION\n';
      log += '-----------------\n';
      log += '⚠️  Symlinks detected in source or target resource directories\n';
      log += '   All file references treated as links uniformly\n';
      log += '   File verification compared actual file content/size\n';
      log += '\n';
    }
    
    // Footer
    log += '========================================\n';
    log += 'END OF IMPORT LOG\n';
    log += '========================================\n';
    
    return log;
  }
}
