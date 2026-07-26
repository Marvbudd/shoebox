/**
 * Person-related IPC handlers
 * 
 * Handles all IPC communication for person management:
 * - Getting persons (all, by ID, by TMGID)
 * - Saving persons
 * - Creating person keys
 * - Updating TMGID
 * - Getting items for persons
 * - Getting persons from accessions
 * - Getting descriptors for model pre-selection
 */

import fs from 'fs';
import path from 'path';
import { BrowserWindow } from 'electron';
import { PersonService } from '../utils/PersonService.js';
import { applyPendingFaceAssignments } from '../utils/faceAssignment.js';
import { resolveAccessionsFilePath } from '../utils/helpers.js';

/**
 * Register all person-related IPC handlers
 * 
 * @param {Electron.IpcMain} ipcMain - The Electron IPC main instance
 * @param {Function} getAccessionClass - Function that returns the current AccessionClass instance
 * @param {Function} verifyAccessions - Function to ensure AccessionClass is initialized
 */
export function registerPersonHandlers(ipcMain, getAccessionClass, verifyAccessions) {
  const isExcludedFromMatching = (entry) => entry?.ExcludeFromMatching === true;

  const euclideanDistance = (descriptor1, descriptor2) => {
    if (!Array.isArray(descriptor1) || !Array.isArray(descriptor2)) return Infinity;
    if (descriptor1.length !== 128 || descriptor2.length !== 128) return Infinity;

    let sum = 0;
    for (let i = 0; i < 128; i++) {
      const diff = descriptor1[i] - descriptor2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  };

  const getPersonDescriptors = (personData, options = {}) => {
    const includeExcluded = options?.includeExcluded === true;

    if (!personData || !Array.isArray(personData.faceBioData)) {
      return [];
    }

    const descriptors = [];
    personData.faceBioData.forEach((entry, sourceIndex) => {
      const excluded = isExcludedFromMatching(entry);
      if (excluded && !includeExcluded) {
        return;
      }

      if (!Array.isArray(entry?.descriptor) || entry.descriptor.length !== 128) {
        return;
      }

      descriptors.push({
        descriptorIndex: sourceIndex,
        descriptorKey: `${entry.link || 'unknown'}:${sourceIndex}`,
        descriptor: entry.descriptor,
        model: entry.model || 'ssd',
        link: entry.link || null,
        region: entry.region || null,
        excluded
      });
    });

    return descriptors;
  };

  const getUnresolvedCandidates = (accessionClass) => {
    return accessionClass.getCandidateFaces().filter(candidate => (
      candidate
      && candidate.resolved !== true
      && candidate.ExcludeFromMatching !== true
      && Array.isArray(candidate.descriptor)
      && candidate.descriptor.length === 128
      && typeof candidate.link === 'string'
      && candidate.link.length > 0
    ));
  };

  const buildDescriptorGroupForIndex = (accessionClass, personID, descriptorIndex = 0, options = {}) => {
    const minConfidence = Number.isFinite(options.minConfidence)
      ? Number(options.minConfidence)
      : 0.6;
    const maxDistance = 1 - Math.max(0, Math.min(1, minConfidence));
    const perDescriptorLimit = Math.max(1, Number(options.perDescriptorLimit) || 60);
    const maxDescriptors = Math.max(1, Number(options.maxDescriptors) || 250);

    const persons = accessionClass.accessionJSON?.persons || {};
    const personData = persons[personID];
    if (!personData) {
      return {
        success: false,
        error: 'Person not found'
      };
    }

    const descriptors = getPersonDescriptors(personData, { includeExcluded: true }).slice(0, maxDescriptors);
    const activeDescriptorCount = descriptors.filter(descriptor => descriptor.excluded !== true).length;
    const descriptorCount = descriptors.length;
    const candidates = getUnresolvedCandidates(accessionClass);
    const normalizedIndex = Math.max(0, Math.min(descriptorCount - 1, Number(descriptorIndex) || 0));

    if (descriptorCount === 0) {
      return {
        success: true,
        descriptorIndex: 0,
        descriptorCount: 0,
        activeDescriptorCount: 0,
        excludedDescriptorCount: 0,
        totalUnresolvedCandidates: candidates.length,
        minConfidence,
        perDescriptorLimit,
        descriptorGroup: null
      };
    }

    const descriptorRef = descriptors[normalizedIndex];

    if (descriptorRef.excluded === true) {
      return {
        success: true,
        descriptorIndex: normalizedIndex,
        descriptorCount,
        activeDescriptorCount,
        excludedDescriptorCount: descriptorCount - activeDescriptorCount,
        totalUnresolvedCandidates: candidates.length,
        minConfidence,
        perDescriptorLimit,
        descriptorGroup: {
          descriptorKey: descriptorRef.descriptorKey,
          descriptorIndex: Number.isFinite(descriptorRef.descriptorIndex)
            ? descriptorRef.descriptorIndex
            : null,
          descriptorLink: descriptorRef.link,
          descriptorRegion: descriptorRef.region || null,
          excluded: true,
          matchCount: 0,
          hasMoreMatches: false,
          items: []
        }
      };
    }

    const groupItems = [];

    for (const candidate of candidates) {
      const distance = euclideanDistance(candidate.descriptor, descriptorRef.descriptor);
      if (!Number.isFinite(distance)) {
        continue;
      }

      const modelPenalty = descriptorRef.model === (candidate.model || 'ssd') ? 0 : 0.01;
      const adjustedDistance = distance + modelPenalty;
      const confidence = 1 - adjustedDistance;

      if (adjustedDistance > maxDistance || confidence < minConfidence) {
        continue;
      }

      const percentMatch = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
      groupItems.push({
        candidateID: candidate.candidateID || null,
        link: candidate.link,
        percentMatch,
        confidence,
        adjustedDistance,
        descriptorKey: descriptorRef.descriptorKey,
        descriptorLink: descriptorRef.link,
        descriptorRegion: descriptorRef.region || null,
        descriptorIndex: Number.isFinite(descriptorRef.descriptorIndex)
          ? descriptorRef.descriptorIndex
          : null,
        candidateRegion: candidate.region || null
      });
    }

    groupItems.sort((a, b) => {
      if (b.percentMatch !== a.percentMatch) {
        return b.percentMatch - a.percentMatch;
      }
      if (a.adjustedDistance !== b.adjustedDistance) {
        return a.adjustedDistance - b.adjustedDistance;
      }
      return a.link.localeCompare(b.link);
    });

    const trimmedItems = groupItems.slice(0, perDescriptorLimit);
    const descriptorGroup = {
      descriptorKey: descriptorRef.descriptorKey,
      descriptorIndex: Number.isFinite(descriptorRef.descriptorIndex)
        ? descriptorRef.descriptorIndex
        : null,
      descriptorLink: descriptorRef.link,
      descriptorRegion: descriptorRef.region || null,
      excluded: false,
      matchCount: trimmedItems.length,
      hasMoreMatches: groupItems.length > trimmedItems.length,
      items: trimmedItems
    };

    return {
      success: true,
      descriptorIndex: normalizedIndex,
      descriptorCount,
      activeDescriptorCount,
      excludedDescriptorCount: descriptorCount - activeDescriptorCount,
      totalUnresolvedCandidates: candidates.length,
      minConfidence,
      perDescriptorLimit,
      descriptorGroup
    };
  };

  const buildUnassignedDescriptorGroups = (accessionClass, personID, options = {}) => {
    const minConfidence = Number.isFinite(options.minConfidence)
      ? Number(options.minConfidence)
      : 0.6;
    const maxDistance = 1 - Math.max(0, Math.min(1, minConfidence));
    const perDescriptorLimit = Math.max(1, Number(options.perDescriptorLimit) || 60);
    const maxDescriptors = Math.max(1, Number(options.maxDescriptors) || 250);

    const persons = accessionClass.accessionJSON?.persons || {};
    const personData = persons[personID];
    if (!personData) {
      return {
        success: false,
        error: 'Person not found'
      };
    }

    const descriptors = getPersonDescriptors(personData);
    if (descriptors.length === 0) {
      return {
        success: true,
        totalUnresolvedCandidates: 0,
        descriptorCount: 0,
        minConfidence,
        perDescriptorLimit,
        descriptorGroups: []
      };
    }

    const candidates = getUnresolvedCandidates(accessionClass);

    const descriptorGroups = [];
    for (const descriptorRef of descriptors.slice(0, maxDescriptors)) {
      const groupItems = [];

      for (const candidate of candidates) {
        const distance = euclideanDistance(candidate.descriptor, descriptorRef.descriptor);
        if (!Number.isFinite(distance)) {
          continue;
        }

        const modelPenalty = descriptorRef.model === (candidate.model || 'ssd') ? 0 : 0.01;
        const adjustedDistance = distance + modelPenalty;
        const confidence = 1 - adjustedDistance;

        if (adjustedDistance > maxDistance || confidence < minConfidence) {
          continue;
        }

        const percentMatch = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
        groupItems.push({
          candidateID: candidate.candidateID || null,
          link: candidate.link,
          percentMatch,
          confidence,
          adjustedDistance,
          descriptorKey: descriptorRef.descriptorKey,
          descriptorLink: descriptorRef.link,
          descriptorRegion: descriptorRef.region || null,
          descriptorIndex: Number.isFinite(descriptorRef.descriptorIndex)
            ? descriptorRef.descriptorIndex
            : null,
          candidateRegion: candidate.region || null
        });
      }

      groupItems.sort((a, b) => {
        if (b.percentMatch !== a.percentMatch) {
          return b.percentMatch - a.percentMatch;
        }
        if (a.adjustedDistance !== b.adjustedDistance) {
          return a.adjustedDistance - b.adjustedDistance;
        }
        return a.link.localeCompare(b.link);
      });

      const trimmedItems = groupItems.slice(0, perDescriptorLimit);

      descriptorGroups.push({
        descriptorKey: descriptorRef.descriptorKey,
        descriptorIndex: Number.isFinite(descriptorRef.descriptorIndex)
          ? descriptorRef.descriptorIndex
          : null,
        descriptorLink: descriptorRef.link,
        descriptorRegion: descriptorRef.region || null,
        matchCount: trimmedItems.length,
        hasMoreMatches: groupItems.length > trimmedItems.length,
        items: trimmedItems
      });
    }

    return {
      success: true,
      totalUnresolvedCandidates: candidates.length,
      descriptorCount: descriptors.length,
      minConfidence,
      perDescriptorLimit,
      descriptorGroups
    };
  };
  
  // Getting all persons
  ipcMain.handle('person:getAll', async () => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    const personsObject = accessionClass.accessionJSON.persons;
    
    // Convert persons object to array with item reference counts
    return Object.entries(personsObject).map(([personID, person]) => {
      const itemCount = accessionClass.getItemsForPerson(personID).length;
      return {
        personID,
        ...person,
        itemCount
      };
    });
  });

  ipcMain.handle('person:get', async (_event, personKey) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    const person = accessionClass.getPerson(personKey);
    return person;
  }); // person:get

  ipcMain.handle('person:getByTMGID', async (_event, tmgid) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    const personData = accessionClass.getPersonByTMGID(tmgid);
    return personData;
  }); // person:getByTMGID

  ipcMain.handle('person:save', async (_event, person) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    try {
      const personID = accessionClass.savePerson(person);
      
      // Broadcast to all windows that a person was saved
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('person:saved', personID);
      });
      
      return { success: true, personID }; // Return success status and personID
    } catch (error) {
      const message = error?.message || String(error);
      const isExpectedValidationError = message.includes('TMGID "') && message.includes('is already assigned to personID');

      if (!isExpectedValidationError) {
        console.error('Failed to save person:', error);
      }

      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle('person:delete', async (_event, personID) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    try {
      const success = accessionClass.deletePerson(personID);
      
      if (!success) {
        return { success: false, error: 'Person not found or is referenced by items' };
      }
      
      // Broadcast to all windows that a person was deleted
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('person:deleted', personID);
      });
      
      return { success: true };
    } catch (error) {
      console.error('Failed to delete person:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle('person:getMatchUnassignedQueue', async (_event, personID, options = {}) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      return buildUnassignedDescriptorGroups(accessionClass, personID, options);
    } catch (error) {
      console.error('Failed to build Match Unassigned queue:', error);
      return {
        success: false,
        error: error.message || String(error),
        totalUnresolvedCandidates: 0,
        descriptorCount: 0,
        descriptorGroups: []
      };
    }
  });

  ipcMain.handle('person:getMatchUnassignedDescriptor', async (_event, personID, descriptorIndex = 0, options = {}) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      return buildDescriptorGroupForIndex(accessionClass, personID, descriptorIndex, options);
    } catch (error) {
      console.error('Failed to build Match Unassigned descriptor group:', error);
      return {
        success: false,
        error: error.message || String(error),
        descriptorIndex: 0,
        descriptorCount: 0,
        totalUnresolvedCandidates: 0,
        descriptorGroup: null
      };
    }
  });

  ipcMain.handle('person:assignFaceMatchingSelections', async (_event, payload = {}) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();

      const personID = typeof payload.personID === 'string' ? payload.personID : '';
      const person = accessionClass.getPerson(personID);
      if (!personID || !person) {
        return { success: false, error: 'Person not found', assignedCount: 0, skippedCount: 0 };
      }

      const matches = Array.isArray(payload.matches) ? payload.matches : [];
      if (matches.length === 0) {
        return {
          success: true,
          assignedCount: 0,
          skippedCount: 0,
          duplicateAssignedSkips: 0,
          conflictSelectionSkips: 0,
          invalidSelectionSkips: 0,
          processedLinks: 0,
          assignedLinks: []
        };
      }

      const personAssignedLinks = new Set();
      if (Array.isArray(person.faceBioData)) {
        for (const descriptor of person.faceBioData) {
          if (typeof descriptor?.link === 'string' && descriptor.link.length > 0) {
            personAssignedLinks.add(descriptor.link);
          }
        }
      }

      const candidateByID = new Map(
        accessionClass.getCandidateFaces()
          .filter(candidate => (
            candidate
            && candidate.resolved !== true
            && candidate.ExcludeFromMatching !== true
            && typeof candidate.candidateID === 'string'
          ))
          .map(candidate => [candidate.candidateID, candidate])
      );

      const byLink = new Map();
      let skippedCount = 0;
      let invalidSelectionSkips = 0;

      for (const rawMatch of matches) {
        const candidateID = typeof rawMatch?.candidateID === 'string' ? rawMatch.candidateID : '';
        const link = typeof rawMatch?.link === 'string' ? rawMatch.link : '';
        if (!candidateID || !link) {
          skippedCount += 1;
          invalidSelectionSkips += 1;
          continue;
        }

        const candidate = candidateByID.get(candidateID);
        if (!candidate || candidate.link !== link || !Array.isArray(candidate.descriptor) || candidate.descriptor.length !== 128) {
          skippedCount += 1;
          invalidSelectionSkips += 1;
          continue;
        }

        if (!byLink.has(link)) {
          byLink.set(link, []);
        }
        byLink.get(link).push(candidate);
      }

      let assignedCount = 0;
      let processedLinks = 0;
      let duplicateAssignedSkips = 0;
      let conflictSelectionSkips = 0;
      const assignedLinks = [];

      for (const [link, candidates] of byLink.entries()) {
        if (!Array.isArray(candidates) || candidates.length === 0) {
          continue;
        }

        if (personAssignedLinks.has(link)) {
          skippedCount += candidates.length;
          duplicateAssignedSkips += candidates.length;
          continue;
        }

        const itemView = accessionClass.getItemView(null, link);
        if (!itemView?.itemJSON) {
          skippedCount += candidates.length;
          continue;
        }

        const itemData = JSON.parse(JSON.stringify(itemView.itemJSON));
        if (!Array.isArray(itemData.person)) {
          itemData.person = [];
        }

        let personRef = itemData.person.find(entry => entry?.personID === personID);
        if (!personRef) {
          personRef = { personID };
          itemData.person.push(personRef);
        }

        const preferredCandidate = candidates
          .slice()
          .sort((a, b) => Number(b?.confidence || 0) - Number(a?.confidence || 0))[0];

        if (!preferredCandidate) {
          skippedCount += candidates.length;
          invalidSelectionSkips += candidates.length;
          continue;
        }

        if (candidates.length > 1) {
          skippedCount += (candidates.length - 1);
          conflictSelectionSkips += (candidates.length - 1);
        }

        personRef.faceTag = {
          pending: true,
          model: preferredCandidate.model || 'ssd',
          region: preferredCandidate.region || null,
          descriptor: preferredCandidate.descriptor,
          confidence: typeof preferredCandidate.confidence === 'number' ? preferredCandidate.confidence : null,
          candidateID: preferredCandidate.candidateID
        };

        const processed = applyPendingFaceAssignments(accessionClass, itemData);
        accessionClass.saveItem(itemData);

        assignedCount += Number(processed.processed || 0);
        if (Number(processed.processed || 0) > 0) {
          personAssignedLinks.add(link);
          assignedLinks.push(link);
        }
        processedLinks += 1;
      }

      if (assignedCount > 0) {
        BrowserWindow.getAllWindows().forEach((window) => {
          if (window?.webContents) {
            window.webContents.send('persons:refresh');
          }
        });
      }

      return {
        success: true,
        assignedCount,
        skippedCount,
        duplicateAssignedSkips,
        conflictSelectionSkips,
        invalidSelectionSkips,
        processedLinks,
        assignedLinks
      };
    } catch (error) {
      console.error('Failed to assign Face Matching selections:', error);
      return {
        success: false,
        error: error.message || String(error),
        assignedCount: 0,
        skippedCount: 0,
        processedLinks: 0
      };
    }
  });

  ipcMain.on('person:createKey', (event, personData) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    try {
      const person = JSON.parse(personData);
      const personKey = accessionClass.createPersonKey(person);
      event.returnValue = personKey;
    } catch (error) {
      console.error('Failed to parse person data in person:createKey:', error);
      event.returnValue = null;
    }
  }); // person:createKey

  ipcMain.on('person:updateTMGID', (event, data) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    try {
      const { personKey, tmgid } = JSON.parse(data);
      const success = accessionClass.updatePersonTMGID(personKey, tmgid);
      event.returnValue = success;
    } catch (error) {
      console.error('Failed to update TMGID in person:updateTMGID:', error);
      event.returnValue = false;
    }
  }); // person:updateTMGID

  ipcMain.on('person:getItems', (event, personKey) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    const items = accessionClass.getItemsForPerson(personKey);
    event.returnValue = items;
  }); // person:getItems

  ipcMain.on('person:getWithItems', (event, personKey) => {
    verifyAccessions();
    const accessionClass = getAccessionClass();
    const personWithItems = accessionClass.getPersonWithItems(personKey);
    event.returnValue = personWithItems;
  }); // person:getWithItems

  ipcMain.handle('persons:getExisting', async (_event, directoryPath) => {
    try {
      if (!directoryPath) {
        return [];
      }

      const accessionsPath = resolveAccessionsFilePath(directoryPath);
      if (!accessionsPath || !fs.existsSync(accessionsPath)) {
        return [];
      }

      const data = fs.readFileSync(accessionsPath, 'utf8');
      const json = JSON.parse(data);

      if (json.persons && typeof json.persons === 'object') {
        return Object.values(json.persons);
      }

      return [];
    } catch (error) {
      console.error('Failed to get existing persons:', error);
      return [];
    }
  });

  ipcMain.handle('persons:getFromAccessions', async () => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      if (!accessionClass || !accessionClass.accessionJSON.persons) {
        return [];
      }
      return Object.values(accessionClass.accessionJSON.persons);
    } catch (error) {
      console.error('Failed to get persons from accessions:', error);
      return [];
    }
  });

  // Get persons with face descriptors for similarity search
  ipcMain.handle('persons:getWithDescriptors', async () => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      if (!accessionClass || !accessionClass.accessionJSON.persons) {
        return [];
      }
      
      // Collect face descriptors from persons.faceBioData (new centralized structure)
      const personsWithDescriptors = [];
      
      const persons = accessionClass.accessionJSON.persons;
      Object.entries(persons).forEach(([personID, personData]) => {
        // Check if person has faceBioData
        if (personData.faceBioData && 
            Array.isArray(personData.faceBioData) &&
            personData.faceBioData.length > 0) {

          const activeDescriptors = personData.faceBioData.filter(d => d?.ExcludeFromMatching !== true);
          if (activeDescriptors.length === 0) {
            return;
          }
          
          personsWithDescriptors.push({
            personID,
            first: personData.first || '',
            last: personData.last || [],
            descriptors: activeDescriptors.map(d => ({
              link: d.link,
              model: d.model || 'ssd',
              descriptor: d.descriptor,
              region: d.region || null,
              confidence: d.confidence || 0
            }))
          });
        }
      });
      
      return personsWithDescriptors;
    } catch (error) {
      console.error('Failed to get persons with descriptors:', error);
      return [];
    }
  });

  // Get descriptors for a specific link (for model pre-selection)
  ipcMain.handle('persons:getDescriptorsForLink', async (_event, link) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      if (!accessionClass || !accessionClass.accessionJSON.persons) {
        return [];
      }

      const personService = new PersonService(accessionClass.accessionJSON);
      const descriptors = personService.getDescriptorsForLink(
        accessionClass.accessionJSON.persons,
        link
      ).filter(d => d?.ExcludeFromMatching !== true);
      
      return descriptors;
    } catch (error) {
      console.error('Failed to get descriptors for link:', error);
      return [];
    }
  });

  // Add a face descriptor to a person's faceBioData
  ipcMain.handle('persons:addFaceDescriptor', async (_event, personID, link, model, region, descriptor, confidence) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      if (!accessionClass || !accessionClass.accessionJSON.persons) {
        return { success: false, error: 'No accessions loaded' };
      }

      const personService = new PersonService(accessionClass.accessionJSON);
      
      // Determine type from link extension
      const type = link.toLowerCase().endsWith('.mp4') || link.toLowerCase().endsWith('.avi') ? 'video' :
                   link.toLowerCase().endsWith('.mp3') || link.toLowerCase().endsWith('.wav') ? 'audio' :
                   'photo';
      
      personService.addDescriptor(
        accessionClass.accessionJSON.persons,
        personID,
        type,
        link,
        model,
        region,
        descriptor,
        confidence
      );
      
      // Mark accessions as changed so it gets saved
      accessionClass.accessionsChanged = true;
      
      return { success: true };
    } catch (error) {
      console.error('Failed to add face descriptor:', error);
      return { success: false, error: error.message };
    }
  });

  // Remove a face descriptor from a person's faceBioData
  ipcMain.handle('persons:removeFaceDescriptor', async (_event, personID, link) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      if (!accessionClass || !accessionClass.accessionJSON.persons) {
        return { success: false, error: 'No accessions loaded' };
      }

      const personService = new PersonService(accessionClass.accessionJSON);
      const removed = personService.removeDescriptorByLink(
        accessionClass.accessionJSON.persons,
        personID,
        link
      );
      
      if (removed > 0) {
        accessionClass.accessionsChanged = true;
      }
      
      return { success: true, removed };
    } catch (error) {
      console.error('Failed to remove face descriptor:', error);
      return { success: false, error: error.message };
    }
  });

  // Mark a specific face descriptor entry as excluded from matching
  ipcMain.handle('persons:excludeDescriptorFromMatching', async (_event, personID, descriptorKey) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      if (!accessionClass || !accessionClass.accessionJSON.persons) {
        return { success: false, error: 'No accessions loaded' };
      }

      const person = accessionClass.accessionJSON.persons[personID];
      if (!person || !Array.isArray(person.faceBioData)) {
        return { success: false, error: 'Person or descriptors not found' };
      }

      const normalizedKey = typeof descriptorKey === 'string' ? descriptorKey : '';
      if (!normalizedKey) {
        return { success: false, error: 'Descriptor key is required' };
      }

      const matchIndex = person.faceBioData.findIndex((entry, index) => {
        const key = `${entry?.link || 'unknown'}:${index}`;
        return key === normalizedKey;
      });

      if (matchIndex < 0) {
        return { success: false, error: 'Descriptor not found' };
      }

      if (person.faceBioData[matchIndex]?.ExcludeFromMatching !== true) {
        person.faceBioData[matchIndex].ExcludeFromMatching = true;
        accessionClass.accessionsChanged = true;
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to exclude descriptor from matching:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  ipcMain.handle('persons:cleanupOrphanedDescriptors', async () => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      if (!accessionClass || !accessionClass.accessionJSON.persons) {
        return { success: false, error: 'No accessions loaded' };
      }

      const personService = new PersonService(accessionClass.accessionJSON);
      const items = accessionClass.accessionJSON.accessions?.item || [];
      const result = personService.removeOrphanedDescriptors(
        accessionClass.accessionJSON.persons,
        items
      );
      
      if (result.totalRemoved > 0) {
        accessionClass.accessionsChanged = true;
      }
      
      return { success: true, ...result };
    } catch (error) {
      console.error('Failed to cleanup orphaned descriptors:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('persons:cleanupUnreferencedPersons', async () => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      if (!accessionClass || !accessionClass.accessionJSON.persons) {
        return { success: false, error: 'No accessions loaded' };
      }

      const personService = new PersonService(accessionClass.accessionJSON);
      const items = accessionClass.accessionJSON.accessions?.item || [];
      const result = personService.removeUnreferencedPersons(
        accessionClass.accessionJSON.persons,
        items
      );
      
      if (result.totalRemoved > 0) {
        accessionClass.accessionsChanged = true;
      }
      
      return { success: true, ...result };
    } catch (error) {
      console.error('Failed to cleanup unreferenced persons:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('persons:import', async (_event, sourceFilePath, options) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      if (!accessionClass || !accessionClass.accessionJSON.persons) {
        return { success: false, error: 'No accessions loaded' };
      }

      const fs = await import('fs');
      const path = await import('path');
      
      // Read and parse source accessions.json
      let sourceData;
      try {
        const fileContent = await fs.promises.readFile(sourceFilePath, 'utf8');
        sourceData = JSON.parse(fileContent);
      } catch (error) {
        return { 
          success: false, 
          error: `Failed to read source file: ${error.message}` 
        };
      }
      
      // Validate source file has persons object
      if (!sourceData.persons || typeof sourceData.persons !== 'object') {
        return { 
          success: false, 
          error: 'Source file does not contain a valid persons object' 
        };
      }
      
      // Perform import
      const personService = new PersonService(accessionClass.accessionJSON);
      const results = personService.importPersons(
        sourceData.persons,
        accessionClass.accessionJSON.persons,
        options
      );
      
      // Mark as changed if any persons were imported
      if (results.imported.length > 0) {
        accessionClass.accessionsChanged = true;
      }
      
      return { 
        success: true, 
        sourceFile: path.basename(sourceFilePath),
        ...results 
      };
    } catch (error) {
      console.error('Failed to import persons:', error);
      return { success: false, error: error.message };
    }
  });
}
