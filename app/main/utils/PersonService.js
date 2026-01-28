import crypto from 'crypto';

/**
 * PersonService - Centralized service for person data management
 * 
 * Provides utilities for:
 * - Person Library migration (legacy to centralized format)
 * - Type normalization (converts "tape" to "audio")
 * - Person key generation (deterministic hashing)
 * - PersonID migration (hash-based to UUID-based identifiers)
 * - Person name formatting
 * 
 * Legacy: Person data embedded in each item
 * Current: Centralized persons object with personKey references (hash-based)
 * Future: UUID-based personID for stable, unique identifiers
 * 
 * Key changes during migration:
 * - Converts any "tape" types to "audio" (simple normalization)
 * - Extracts all unique persons from items
 * - Creates PersonKey by hashing all person attributes
 * - Preserves existing TMGID values or sets to null
 * - Updates item.person[] to use personKey references
 * - Updates source[].person to use personKey references
 * 
 * PersonID migration (Phase 1):
 * - Generates UUID for each person
 * - Adds personID field to person records
 * - Updates all item/source references to use personID
 * - Keeps personKey for reference/debugging
 */
export class PersonService {
  constructor(accessionJSON) {
    this.accessionJSON = accessionJSON;
    this.warnings = [];
    this.stats = {
      personsExtracted: 0,
      itemsUpdated: 0
    };
  }

  /**
   * Check if data needs migration to Person Library format
   * @returns {boolean} True if migration needed
   */
  needsMigration() {
    // Check if any items have legacy person structure (array of objects without personID)
    const items = this.accessionJSON.accessions?.item || [];
    if (items.length === 0) {
      return false;
    }

    // Sample first few items to check structure
    const sampleSize = Math.min(10, items.length);
    for (let i = 0; i < sampleSize; i++) {
      const item = items[i];
      if (item.person && Array.isArray(item.person) && item.person.length > 0) {
        const firstPerson = item.person[0];
        // If has first/last directly (not personID reference), needs migration
        if (firstPerson.first || firstPerson.last) {
          return true;
        }
        // If has personID, already migrated
        if (firstPerson.personID) {
          return false;
        }
      }
    }

    // If we get here, no person data was found in items - no migration needed
    return false;
  }

  /**
   * Perform migration from legacy to Person Library format with PersonID
   * @returns {Object} Result with persons, items, and warnings
   */
  migrate() {
    const items = this.accessionJSON.accessions?.item || [];
    
    // Step 1: Convert any "tape" types to "audio" (simple type normalization)
    let tapeCount = 0;
    items.forEach(item => {
      if (item.type === 'tape') {
        item.type = 'audio';
        tapeCount++;
      }
    });
    
    // Step 2: Extract all unique persons (using PersonKey for deduplication)
    const personMap = this._extractPersons(items);
    this.stats.personsExtracted = personMap.size;

    // Step 3: Generate PersonIDs and build persons object
    const { persons, personKeyToIDMap } = this._buildPersonsObjectWithIDs(personMap);
    
    // Step 4: Update item.person arrays to use PersonID
    const updatedItems = this._updateItemReferences(items, personKeyToIDMap);
    
    // Step 5: Update source[] references to use PersonID
    this._updateSourceReferences(updatedItems, personKeyToIDMap);
    
    // Step 6: Validate integrity
    this._validateIntegrity(persons, updatedItems);
    
    // Step 7: Clean up personKey (no longer needed after migration)
    this._removePersonKeys(persons);

    return {
      persons,
      items: updatedItems,
      warnings: this.warnings
    };
  }

  /**
   * Extract all unique persons from items
   * Creates map of personKey -> person data
   * @private
   */
  _extractPersons(items) {
    const personMap = new Map();

    items.forEach((item, itemIndex) => {
      // Extract from item.person[]
      if (item.person && Array.isArray(item.person)) {
        item.person.forEach((person, personIndex) => {
          if (person.first || person.last) {
            this._addPersonToMap(personMap, person);
          } else {
            this.warnings.push(
              `Item ${item.accession}: person entry at index ${personIndex} has no first/last name, skipping`
            );
          }            
        });
      } else if (item.person) {
        this.warnings.push(
          `Item ${item.accession}: person field is not an array, skipping`
        );
      }

      // Extract from source[].person
      if (item.source && Array.isArray(item.source)) {
        item.source.forEach((source, sourceIndex) => {
          if (source.person && (source.person.first || source.person.last)) {
            this._addPersonToMap(personMap, source.person);
          } else if (source.person) {
            this.warnings.push(
              `Item ${item.accession}: source.person at index ${sourceIndex} has no first/last name, skipping`
            );
          }
        });
      } else if (item.source) {
        this.warnings.push(
          `Item ${item.accession}: source field is not an array, skipping`
        );
      }
    });

    return personMap;
  }

  /**
   * Add person to map, checking for duplicates
   * @private
   */
  _addPersonToMap(personMap, person) {
    const personKey = PersonService.createPersonKey(person);
    
    if (!personMap.has(personKey)) {
      // First occurrence of this person
      personMap.set(personKey, this._normalizePersonData(person));
    }
    // If person already exists, no need to do anything - we already have their data
  }

  /**
   * Create PersonKey by hashing all person attributes
   * Uses original person data without modification to preserve significant ordering
   * @static
   */
  static createPersonKey(person) {
    // Create stable JSON string for hashing using original data
    // Last name order is chronologically significant and must be preserved
    // Normalize last name representation to avoid inconsistent handling of "no last name"
    const hasLast = Object.prototype.hasOwnProperty.call(person, 'last');
    let normalizedLast = hasLast ? person.last : null;

    if (Array.isArray(normalizedLast)) {
      // already an array; keep as-is
    } else if (normalizedLast != null) {
      // wrap scalar last name in an array
      normalizedLast = [normalizedLast];
    } else {
      // leave as null when there is no last name
      normalizedLast = null;
    }

    const dataString = JSON.stringify({
      first: person.first || null,
      last: normalizedLast
    });

    // Generate hash using full SHA-256 hex digest to minimize collision risk
    const hash = crypto
      .createHash('sha256')
      .update(dataString)
      .digest('hex');
    return `PK-${hash}`;
  }

  /**
   * Format person's full name from person object
   * @param {Object} person - Person object with first and last[] properties
   * @returns {string} Formatted full name (e.g., "John Smith Doe")
   * @static
   */
  static getPersonFullName(person) {
    const first = person.first || '';
    const lastNames = person.last || [];
    const lastName = lastNames.map(ln => ln.last).join(' ');
    return `${first} ${lastName}`.trim();
  }

  /**
   * Extract biographical data for storage
   * Preserves original structure including chronologically significant last name order
   * Excludes item-specific attributes like position
   * @private
   */
  _normalizePersonData(person) {
    const normalized = {
      TMGID: person.TMGID || null,
      first: person.first || null,
      last: person.last || []
    };

    // Ensure last is an array (for consistency)
    if (normalized.last && !Array.isArray(normalized.last)) {
      normalized.last = [normalized.last];
    }

    return normalized;
  }

  /**
   * Build persons object from person map with PersonIDs
   * PersonKey used for deduplication, PersonID used for references
   * @private
   * @returns {Object} { persons: object keyed by PersonID, personKeyToIDMap: Map }
   */
  _buildPersonsObjectWithIDs(personMap) {
    const persons = {};
    const personKeyToIDMap = new Map();

    personMap.forEach((personData, personKey) => {
      // Generate UUID for this person
      const personID = crypto.randomUUID();
      personKeyToIDMap.set(personKey, personID);

      // Store person with PersonID as key
      persons[personID] = {
        personID,           // UUID - stable identifier
        personKey,          // Hash - for reference/deduplication history
        ...personData       // TMGID, first, last, etc.
      };

      // Ensure TMGID is null if not present
      if (!persons[personID].TMGID) {
        persons[personID].TMGID = null;
      }
    });

    return { persons, personKeyToIDMap };
  }

  /**
   * Update item.person arrays to reference PersonID
   * @private
   */
  _updateItemReferences(items, personKeyToIDMap) {
    let itemsUpdated = 0;

    const updatedItems = items.map(item => {
      if (!item.person || !Array.isArray(item.person)) {
        return item;
      }

      let itemModified = false;
      const updatedPersons = item.person.map(person => {
        // If already has personID, skip (already migrated)
        if (person.personID) {
          return person;
        }

        // If no biographical data, skip
        if (!person.first && !person.last) {
          this.warnings.push(
            `Item ${item.accession}: person entry has no first/last name, skipping`
          );
          return null;
        }

        // Create personKey for lookup (deduplication)
        const personKey = PersonService.createPersonKey(person);
        const personID = personKeyToIDMap.get(personKey);

        if (!personID) {
          this.warnings.push(
            `Item ${item.accession}: personKey ${personKey} not found in person map`
          );
          return null;
        }

        itemModified = true;

        // Build reference object with PersonID only
        const reference = { 
          personID         // UUID reference
        };

        // Preserve item-specific attributes
        if (person.position) {
          reference.position = person.position;
        }

        return reference;
      }).filter(p => p !== null);

      if (itemModified) {
        itemsUpdated++;
      }

      return {
        ...item,
        person: updatedPersons
      };
    });

    this.stats.itemsUpdated = itemsUpdated;
    return updatedItems;
  }

  /**
   * Update source[] to reference PersonID
   * @private
   */
  _updateSourceReferences(items, personKeyToIDMap) {
    items.forEach(item => {
      if (!item.source || !Array.isArray(item.source)) {
        return;
      }

      item.source = item.source.map(source => {
        if (!source.person) {
          return source;
        }

        // If already migrated (has personID at source level), skip
        if (source.personID) {
          return source;
        }

        // If no biographical data, skip
        if (!source.person.first && !source.person.last) {
          this.warnings.push(
            `Item ${item.accession}: source.person has no first/last name, skipping`
          );
          return source;
        }

        // Create personKey for lookup (deduplication)
        const personKey = PersonService.createPersonKey(source.person);
        const personID = personKeyToIDMap.get(personKey);

        if (!personID) {
          this.warnings.push(
            `Item ${item.accession}: source personKey ${personKey} not found in person map`
          );
          return source;
        }

        // Create new source object with PersonID, excluding person property
        const { person, ...restOfSource } = source;
        
        return {
          ...restOfSource,
          personID        // UUID reference
        };
      });
    });
  }

  /**
   * Remove personKey from all persons (cleanup after migration)
   * personKey was only needed for deduplication during migration
   * @param {Object} persons - The persons object
   */
  _removePersonKeys(persons) {
    Object.values(persons).forEach(person => {
      delete person.personKey;
    });
  }

  /**
   * Validate referential integrity
   * @private
   */
  _validateIntegrity(persons, items) {
    const personIDs = new Set(Object.keys(persons));
    const missingIDs = new Set();

    items.forEach(item => {
      // Check item.person references
      if (item.person && Array.isArray(item.person)) {
        item.person.forEach(personRef => {
          if (personRef.personID && !personIDs.has(personRef.personID)) {
            missingIDs.add(personRef.personID);
            this.warnings.push(
              `Item ${item.accession}: references missing personID ${personRef.personID}`
            );
          }
        });
      }

      // Check source[] references
      if (item.source && Array.isArray(item.source)) {
        item.source.forEach(source => {
          if (source.personID && !personIDs.has(source.personID)) {
            missingIDs.add(source.personID);
            this.warnings.push(
              `Item ${item.accession}: source references missing personID ${source.personID}`
            );
          }
        });
      }
    });

    if (missingIDs.size > 0) {
      console.error(`PersonService: Found ${missingIDs.size} missing person references!`);
    }
  }

  /**
   * Add or update a face descriptor for a person
   * Removes any existing descriptor for the same link before adding
   * @param {Object} persons - The persons object
   * @param {string} personID - The person's UUID
   * @param {string} type - Media type ("photo", "video", "audio")
   * @param {string} link - The item filename
   * @param {string} model - Detection model ("ssd", "mtcnn", "tinyFace", "manual")
   * @param {Object} region - Face region {x, y, w, h}
   * @param {Array} descriptor - 128-float face embedding
   * @param {number} confidence - Detection confidence (0-1)
   */
  addDescriptor(persons, personID, type, link, model, region, descriptor, confidence) {
    if (!persons[personID]) {
      console.error(`PersonService: Cannot add descriptor, personID ${personID} not found`);
      return;
    }

    const person = persons[personID];
    
    // Initialize faceBioData as array if it doesn't exist
    if (!person.faceBioData) {
      person.faceBioData = [];
    }

    // Remove any existing descriptor for this link (one descriptor per link constraint)
    this.removeDescriptorByLink(persons, personID, link);

    // Add the new descriptor
    person.faceBioData.push({
      link,
      model,
      region,
      descriptor,
      confidence
    });
  }

  /**
   * Remove descriptor(s) for a specific link from a person
   * @param {Object} persons - The persons object
   * @param {string} personID - The person's UUID
   * @param {string} link - The item filename
   * @returns {number} Number of descriptors removed
   */
  removeDescriptorByLink(persons, personID, link) {
    if (!persons[personID] || !persons[personID].faceBioData || !Array.isArray(persons[personID].faceBioData)) {
      return 0;
    }

    const person = persons[personID];
    const initialLength = person.faceBioData.length;
    
    person.faceBioData = person.faceBioData.filter(d => d.link !== link);
    
    const removedCount = initialLength - person.faceBioData.length;
    
    return removedCount;
  }

  /**
   * Remove all orphaned face descriptors
   * Orphaned descriptors are those where:
   * 1. The link doesn't exist in items, OR
   * 2. The person is not in that item's person array
   * 
   * @param {Object} persons - The persons object
   * @param {Array} items - Array of all items
   * @returns {Object} { totalRemoved, byReason: { noItem: count, notInPersonArray: count } }
   */
  removeOrphanedDescriptors(persons, items) {
    // Build lookup maps for efficiency
    const itemsByLink = new Map();
    items.forEach(item => {
      if (item.link) {
        itemsByLink.set(item.link, item);
      }
    });
    
    let totalRemoved = 0;
    let removedNoItem = 0;
    let removedNotInPersonArray = 0;
    
    Object.entries(persons).forEach(([personID, person]) => {
      if (!person.faceBioData || !Array.isArray(person.faceBioData)) {
        return;
      }
      
      const validDescriptors = [];
      
      person.faceBioData.forEach(desc => {
        const link = desc.link;
        
        // Check if link exists
        if (!link) {
          totalRemoved++;
          removedNoItem++;
          return; // Skip this descriptor
        }
        
        const item = itemsByLink.get(link);
        
        // Check if item exists
        if (!item) {
          totalRemoved++;
          removedNoItem++;
          return; // Skip this descriptor
        }
        
        // Check if person is in item's person array
        const isInPersonArray = item.person?.some(p => p.personID === personID);
        if (!isInPersonArray) {
          totalRemoved++;
          removedNotInPersonArray++;
          return; // Skip this descriptor
        }
        
        // Keep this descriptor - it's valid
        validDescriptors.push(desc);
      });
      
      person.faceBioData = validDescriptors;
    });
    
    const result = {
      totalRemoved,
      byReason: {
        noItem: removedNoItem,
        notInPersonArray: removedNotInPersonArray
      }
    };
    
    return result;
  }

  /**
   * Remove all face descriptors for a specific link across all persons
   * Used when deleting an item to clean up orphaned descriptors
   * @param {Object} persons - The persons object
   * @param {string} link - The item filename
   * @returns {number} Total number of descriptors removed
   */
  removeAllDescriptorsForLink(persons, link) {
    let totalRemoved = 0;
    
    Object.entries(persons).forEach(([personID, person]) => {
      if (person.faceBioData && Array.isArray(person.faceBioData)) {
        const initialLength = person.faceBioData.length;
        person.faceBioData = person.faceBioData.filter(d => d.link !== link);
        const removed = initialLength - person.faceBioData.length;
        totalRemoved += removed;
      }
    });
    
    return totalRemoved;
  }

  /**
   * Get all descriptors for a specific link across all persons
   * Used for model pre-selection
   * @param {Object} persons - The persons object
   * @param {string} link - The item filename
   * @returns {Array} Array of {personID, model, region, descriptor, confidence}
   */
  getDescriptorsForLink(persons, link) {
    const descriptors = [];
    
    Object.entries(persons).forEach(([personID, person]) => {
      if (person.faceBioData) {
        person.faceBioData.forEach(desc => {
          if (desc.link === link) {
            descriptors.push({
              personID,
              model: desc.model,
              region: desc.region,
              descriptor: desc.descriptor,
              confidence: desc.confidence
            });
          }
        });
      }
    });
    
    return descriptors;
  }

  /**
   * Get descriptors for specific persons on a specific link
   * @param {Object} persons - The persons object
   * @param {Array} personIDs - Array of person UUIDs to check
   * @param {string} link - The item filename
   * @returns {Map} Map of personID -> descriptor object
   */
  getDescriptorsForPersonsOnLink(persons, personIDs, link) {
    const results = new Map();
    
    personIDs.forEach(personID => {
      if (persons[personID] && persons[personID].faceBioData) {
        const descriptor = persons[personID].faceBioData.find(d => d.link === link);
        if (descriptor) {
          results.set(personID, descriptor);
        }
      }
    });
    
    return results;
  }
}
