#!/usr/bin/env node

/**
 * Convert numeric months to three-character month abbreviations in accessions.json
 * 
 * This script processes the accessions.json file and converts any numeric month values
 * (e.g., "01", "1", "12") to three-character month abbreviations (e.g., "Jan", "Dec").
 * 
 * Processes according to data-structure.md:
 * - item.date.month (when media was created)
 * - item.source[].received.month (when item was acquired)
 * 
 * Usage:
 *   node scripts/convert-numeric-months.js <path-to-accessions.json>
 * 
 * Example:
 *   node scripts/convert-numeric-months.js app/resource/accessions.json
 */

import fs from 'fs';
import path from 'path';

// Month mapping from numeric to three-character abbreviation
const MONTH_MAP = {
  '1': 'Jan', '01': 'Jan',
  '2': 'Feb', '02': 'Feb',
  '3': 'Mar', '03': 'Mar',
  '4': 'Apr', '04': 'Apr',
  '5': 'May', '05': 'May',
  '6': 'Jun', '06': 'Jun',
  '7': 'Jul', '07': 'Jul',
  '8': 'Aug', '08': 'Aug',
  '9': 'Sep', '09': 'Sep',
  '10': 'Oct',
  '11': 'Nov',
  '12': 'Dec'
};

/**
 * Check if a month value is numeric and needs conversion
 */
function isNumericMonth(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return MONTH_MAP.hasOwnProperty(trimmed);
}

/**
 * Convert a numeric month to three-character abbreviation
 */
function convertMonth(value) {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim();
  return MONTH_MAP[trimmed] || value;
}

/**
 * Process a date object (has year, month, day properties)
 */
function processDate(dateObj, pathDesc) {
  if (!dateObj || typeof dateObj !== 'object') return { changed: false };
  
  let changed = false;
  
  if (dateObj.month && isNumericMonth(dateObj.month)) {
    const oldValue = dateObj.month;
    dateObj.month = convertMonth(dateObj.month);
    console.log(`  ${pathDesc}: "${oldValue}" → "${dateObj.month}"`);
    changed = true;
  }
  
  return { changed };
}

/**
 * Process an item (accession entry)
 */
function processItem(item, itemIndex) {
  let changesInItem = 0;
  const itemPath = `item[${itemIndex}] (${item.accession || 'no-accession'})`;
  
  // Process item date (when media was created)
  if (item.date) {
    const result = processDate(item.date, `${itemPath}.date`);
    if (result.changed) changesInItem++;
  }
  
  // Process source received dates (when item was acquired)
  if (Array.isArray(item.source)) {
    item.source.forEach((source, sourceIndex) => {
      if (source.received) {
        const result = processDate(source.received, `${itemPath}.source[${sourceIndex}].received`);
        if (result.changed) changesInItem++;
      }
    });
  }
  
  return changesInItem;
}

/**
 * Main processing function
 */
function processAccessions(accessionsData) {
  let totalChanges = 0;
  
  console.log('\nProcessing items...');
  
  // Process all items
  if (accessionsData.accessions && Array.isArray(accessionsData.accessions.item)) {
    accessionsData.accessions.item.forEach((item, index) => {
      const changes = processItem(item, index);
      totalChanges += changes;
    });
  }
  
  return totalChanges;
}

/**
 * Create a backup of the file (without .json extension per project standards)
 */
function createBackup(filePath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const dir = path.dirname(filePath);
  const basename = path.basename(filePath, '.json');
  const backupPath = path.join(dir, `${basename}_backup_${timestamp}`);
  
  fs.copyFileSync(filePath, backupPath);
  console.log(`Backup created: ${backupPath}`);
  
  return backupPath;
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Error: Please provide the path to accessions.json');
    console.error('Usage: node scripts/convert-numeric-months.js <path-to-accessions.json>');
    console.error('Example: node scripts/convert-numeric-months.js app/resource/accessions.json');
    process.exit(1);
  }
  
  const filePath = args[0];
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }
  
  console.log(`\n=== Converting Numeric Months to Three-Character Abbreviations ===`);
  console.log(`File: ${filePath}\n`);
  
  try {
    // Read the file
    console.log('Reading file...');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const accessionsData = JSON.parse(fileContent);
    
    // Create backup
    console.log('Creating backup...');
    createBackup(filePath);
    
    // Process the data
    console.log('\nConverting months...');
    const totalChanges = processAccessions(accessionsData);
    
    if (totalChanges === 0) {
      console.log('\n✓ No numeric months found. All months are already in correct format.');
      return;
    }
    
    // Write the updated file
    console.log(`\nWriting updated file...`);
    const updatedContent = JSON.stringify(accessionsData, null, 2);
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    
    console.log(`\n✓ Successfully converted ${totalChanges} numeric month(s) to three-character format.`);
    console.log(`✓ File updated: ${filePath}`);
    
  } catch (error) {
    console.error('\n✗ Error processing file:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
