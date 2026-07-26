import { PersonService } from './PersonService.js';

function isFaceDebugEnabled() {
  const value = String(process.env.SHOEBOX_FACE_DEBUG || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function euclideanDistance128(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== 128 || b.length !== 128) {
    return null;
  }

  let sum = 0;
  for (let i = 0; i < 128; i++) {
    const diff = Number(a[i]) - Number(b[i]);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function getRegionDelta(oldRegion, newRegion) {
  if (!oldRegion || !newRegion) {
    return null;
  }

  const dx = Number(newRegion.x) - Number(oldRegion.x);
  const dy = Number(newRegion.y) - Number(oldRegion.y);
  const dw = Number(newRegion.w) - Number(oldRegion.w);
  const dh = Number(newRegion.h) - Number(oldRegion.h);

  if (![dx, dy, dw, dh].every(Number.isFinite)) {
    return null;
  }

  return {
    dx,
    dy,
    dw,
    dh,
    centerShift: Math.sqrt((dx * dx) + (dy * dy)),
    areaDelta: (Number(newRegion.w) * Number(newRegion.h)) - (Number(oldRegion.w) * Number(oldRegion.h))
  };
}

function inferMediaType(itemData) {
  if (itemData?.type === 'photo' || itemData?.type === 'audio' || itemData?.type === 'video') {
    return itemData.type;
  }

  const link = String(itemData?.link || '').toLowerCase();
  if (link.endsWith('.mp4') || link.endsWith('.avi')) {
    return 'video';
  }
  if (link.endsWith('.mp3') || link.endsWith('.wav')) {
    return 'audio';
  }
  return 'photo';
}

/**
 * Apply pending faceTag assignments in item.person[] to person faceBioData,
 * remove resolved candidate faces, and strip transient faceTag before saving.
 */
export function applyPendingFaceAssignments(accessionClass, itemData) {
  if (!accessionClass || !itemData || !Array.isArray(itemData.person)) {
    return { processed: 0, removedCandidates: 0 };
  }

  const personService = new PersonService(accessionClass.accessionJSON);
  const type = inferMediaType(itemData);
  const link = itemData.link;
  const debugEnabled = isFaceDebugEnabled();
  let processed = 0;
  let removedCandidates = 0;

  for (const person of itemData.person) {
    if (!person?.personID || !person.faceTag?.pending) {
      continue;
    }

    const existingDescriptor = accessionClass.accessionJSON?.persons?.[person.personID]?.faceBioData
      ?.find(entry => entry?.link === link) || null;

    const descriptorDistance = euclideanDistance128(existingDescriptor?.descriptor, person.faceTag.descriptor);
    const regionDelta = getRegionDelta(existingDescriptor?.region, person.faceTag.region);
    const modelBefore = existingDescriptor?.model || null;
    const modelAfter = person.faceTag.model || null;

    personService.addDescriptor(
      accessionClass.accessionJSON.persons,
      person.personID,
      type,
      link,
      person.faceTag.model,
      person.faceTag.region,
      person.faceTag.descriptor,
      person.faceTag.confidence
    );

    if (debugEnabled) {
      console.log('[FACE ASSIGNMENT DEBUG] descriptor replacement', {
        link,
        personID: person.personID,
        hadExistingDescriptor: Boolean(existingDescriptor),
        modelBefore,
        modelAfter,
        modelChanged: modelBefore !== null && modelAfter !== null ? modelBefore !== modelAfter : null,
        descriptorDistance,
        regionDelta,
        candidateID: person.faceTag.candidateID || null,
        confidence: person.faceTag.confidence
      });
    }

    if (person.faceTag.candidateID && accessionClass.removeCandidateFace(person.faceTag.candidateID)) {
      removedCandidates += 1;
    }

    delete person.faceTag;
    processed += 1;
  }

  return { processed, removedCandidates };
}
