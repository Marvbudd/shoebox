export function regionKey(region, precision = 6) {
  if (!region) return '';
  return [
    Number(region.x || 0).toFixed(precision),
    Number(region.y || 0).toFixed(precision),
    Number(region.w || 0).toFixed(precision),
    Number(region.h || 0).toFixed(precision)
  ].join(':');
}

function findFaceIndexByRegion(detectedFaces, region) {
  const targetKey = regionKey(region);
  if (!targetKey) return -1;
  return detectedFaces.findIndex(face => regionKey(face?.region) === targetKey);
}

function toBounds(region) {
  if (!region) return null;

  const x = Number(region.x || 0);
  const y = Number(region.y || 0);
  const w = Number(region.w || 0);
  const h = Number(region.h || 0);

  return {
    left: x - (w / 2),
    right: x + (w / 2),
    top: y - (h / 2),
    bottom: y + (h / 2),
    area: Math.max(0, w) * Math.max(0, h)
  };
}

function calculateIoU(a, b) {
  const boxA = toBounds(a);
  const boxB = toBounds(b);
  if (!boxA || !boxB || boxA.area <= 0 || boxB.area <= 0) {
    return 0;
  }

  const interLeft = Math.max(boxA.left, boxB.left);
  const interTop = Math.max(boxA.top, boxB.top);
  const interRight = Math.min(boxA.right, boxB.right);
  const interBottom = Math.min(boxA.bottom, boxB.bottom);

  const interW = Math.max(0, interRight - interLeft);
  const interH = Math.max(0, interBottom - interTop);
  const interArea = interW * interH;
  if (interArea <= 0) {
    return 0;
  }

  const unionArea = boxA.area + boxB.area - interArea;
  if (unionArea <= 0) {
    return 0;
  }

  return interArea / unionArea;
}

function findBestFaceIndexByRegion(detectedFaces, region, usedFaceIndices) {
  const exactIndex = findFaceIndexByRegion(detectedFaces, region);
  if (exactIndex >= 0 && !usedFaceIndices.has(exactIndex)) {
    return exactIndex;
  }

  let bestIndex = -1;
  let bestIoU = 0;
  detectedFaces.forEach((face, index) => {
    if (usedFaceIndices.has(index)) return;
    const iou = calculateIoU(face?.region, region);
    if (iou > bestIoU) {
      bestIoU = iou;
      bestIndex = index;
    }
  });

  // Require strong overlap to treat as the same face region.
  return bestIoU >= 0.85 ? bestIndex : -1;
}

/**
 * Merge assigned face detections into the current unresolved candidate state.
 * Expected invariant: assigned and unresolved regions are disjoint.
 * Defensive behavior: if overlap is found, assigned wins and overlapping unresolved entry is removed.
 */
export function mergeAssignedFacesIntoCurrent({
  currentDetectedFaces,
  currentMatchedFaces,
  currentUnmatchedFaces,
  loadedDetectedFaces,
  loadedMatchedFaces
}) {
  const nextDetectedFaces = [...currentDetectedFaces];
  const nextMatchedFaces = [...currentMatchedFaces];
  let nextUnmatchedFaces = [...currentUnmatchedFaces];
  let overlapCount = 0;
  const usedFaceIndices = new Set();

  loadedMatchedFaces.forEach((loadedMatch, idx) => {
    const loadedFace = loadedDetectedFaces[idx];
    if (!loadedFace) return;

    let faceIndex = findBestFaceIndexByRegion(nextDetectedFaces, loadedFace.region, usedFaceIndices);

    if (faceIndex === -1) {
      faceIndex = nextDetectedFaces.length;
      nextDetectedFaces.push(loadedFace);
    }

    usedFaceIndices.add(faceIndex);

    const existingMatchIndex = nextMatchedFaces.findIndex(match => match.personID === loadedMatch.personID);
    const mergedMatch = {
      ...loadedMatch,
      faceIndex,
      region: loadedFace.region
    };

    if (existingMatchIndex >= 0) {
      nextMatchedFaces[existingMatchIndex] = mergedMatch;
    } else {
      nextMatchedFaces.push(mergedMatch);
    }

    const before = nextUnmatchedFaces.length;
    nextUnmatchedFaces = nextUnmatchedFaces.filter(unmatched => {
      if (unmatched.faceIndex === faceIndex) {
        return false;
      }

      const unmatchedRegion = unmatched.region || nextDetectedFaces[Number(unmatched.faceIndex)]?.region;
      const iou = calculateIoU(unmatchedRegion, loadedFace.region);
      // Only remove unresolved entries that are almost certainly the same region.
      return iou < 0.9;
    });
    overlapCount += before - nextUnmatchedFaces.length;
  });

  return {
    detectedFaces: nextDetectedFaces,
    matchedFaces: nextMatchedFaces,
    unmatchedFaces: nextUnmatchedFaces,
    overlapCount
  };
}
