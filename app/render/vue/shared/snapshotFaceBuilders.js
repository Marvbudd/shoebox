/**
 * Build snapshot face entries from MainWindow face tags.
 */
export function buildSnapshotFacesFromFaceTags(faceTags = []) {
  return (faceTags || []).map((tag) => ({
    faceIndex: Number(tag.index) - 1,
    numberText: String(tag.index),
    label: tag.name || null,
    state: 'matched',
    region: {
      x: Number(tag?.region?.x || 0),
      y: Number(tag?.region?.y || 0),
      w: Number(tag?.region?.w || 0),
      h: Number(tag?.region?.h || 0)
    }
  }));
}

/**
 * Build snapshot face entries from MediaManager detected/matched state.
 */
export function buildSnapshotFacesFromDetected({
  detectedFaces = [],
  matchedFaces = [],
  unmatchedFaces = [],
  getLabelForFaceIndex
}) {
  const matchedIndexSet = new Set((matchedFaces || []).map((m) => Number(m.faceIndex)));
  const unmatchedIndexSet = new Set((unmatchedFaces || []).map((u) => Number(u.faceIndex)));

  return (detectedFaces || [])
    .map((face, index) => {
      if (!face || !face.region) {
        return null;
      }

      const isMatched = matchedIndexSet.has(Number(index));
      const isUnmatched = unmatchedIndexSet.has(Number(index));
      if (!isMatched && !isUnmatched) {
        return null;
      }

      return {
        faceIndex: index,
        numberText: String(index + 1),
        label: isMatched && typeof getLabelForFaceIndex === 'function'
          ? (getLabelForFaceIndex(index) || null)
          : null,
        state: isMatched ? 'matched' : 'unmatched',
        region: {
          x: Number(face.region.x || 0),
          y: Number(face.region.y || 0),
          w: Number(face.region.w || 0),
          h: Number(face.region.h || 0)
        }
      };
    })
    .filter(Boolean);
}

/**
 * Build a single highlighted snapshot face entry.
 */
export function buildSingleSnapshotFace({
  label,
  region,
  faceIndex = 0,
  numberText = '1'
}) {
  if (!region) {
    return [];
  }

  return [
    {
      faceIndex,
      numberText: String(numberText),
      label: label || null,
      state: 'matched',
      region: {
        x: Number(region.x || 0),
        y: Number(region.y || 0),
        w: Number(region.w || 0),
        h: Number(region.h || 0)
      }
    }
  ];
}
