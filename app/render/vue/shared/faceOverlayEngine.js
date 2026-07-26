export const FACE_OVERLAY_MODE = {
  OFF: 'off',
  ON: 'on',
  REGIONS: 'regions',
  ALL: 'all'
};

export const FACE_OVERLAY_MODE_SEQUENCE = [
  FACE_OVERLAY_MODE.OFF,
  FACE_OVERLAY_MODE.ON,
  FACE_OVERLAY_MODE.REGIONS,
  FACE_OVERLAY_MODE.ALL
];

const LEGACY_FACE_OVERLAY_MODE_MAP = {
  'labels-smart': FACE_OVERLAY_MODE.ON,
  smart: FACE_OVERLAY_MODE.REGIONS
};

export const FACE_OVERLAY_STYLE = {
  borderWidth: 3,
  numberFontSize: 13,
  numberFont: 'bold 13px sans-serif',
  numberBoxHeight: 20,
  numberTextYOffset: 15,
  labelFontSize: 14,
  labelFont: '14px sans-serif',
  labelTextYOffset: 18,
  labelBoxHeight: 24,
  labelHorizontalPadding: 12
};

export function getNextFaceOverlayMode(currentMode) {
  const normalizedMode = normalizeFaceOverlayMode(currentMode);
  const idx = FACE_OVERLAY_MODE_SEQUENCE.indexOf(normalizedMode);
  if (idx === -1) {
    return FACE_OVERLAY_MODE.OFF;
  }
  return FACE_OVERLAY_MODE_SEQUENCE[(idx + 1) % FACE_OVERLAY_MODE_SEQUENCE.length];
}

export function normalizeFaceOverlayMode(mode) {
  if (!mode) {
    return FACE_OVERLAY_MODE.OFF;
  }

  if (FACE_OVERLAY_MODE_SEQUENCE.includes(mode)) {
    return mode;
  }

  return LEGACY_FACE_OVERLAY_MODE_MAP[mode] || FACE_OVERLAY_MODE.OFF;
}

function rectsOverlap(a, b) {
  return !(
    a.x + a.w <= b.x
    || b.x + b.w <= a.x
    || a.y + a.h <= b.y
    || b.y + b.h <= a.y
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function estimateTextWidth(text) {
  return Math.max(24, String(text || '').length * 8 + 8);
}

function tryPlaceLabelRect(baseRect, placedLabels, faceRects, renderBounds, ownFaceRect) {
  if (!baseRect) {
    return null;
  }

  const candidateRects = [];
  const verticalOffsets = [0, -8, 8, -16, 16, -24, 24, -32, 32];
  const horizontalOffsets = [0, -10, 10, -18, 18];

  for (const yOffset of verticalOffsets) {
    for (const xOffset of horizontalOffsets) {
      candidateRects.push({
        x: clamp(baseRect.x + xOffset, renderBounds.minX, renderBounds.maxX - baseRect.w),
        y: clamp(baseRect.y + yOffset, renderBounds.minY, renderBounds.maxY - baseRect.h),
        w: baseRect.w,
        h: baseRect.h
      });
    }
  }

  for (const rect of candidateRects) {
    const overlapsLabel = placedLabels.some(existing => rectsOverlap(existing, rect));
    const overlapsOtherFace = faceRects.some(faceRect => faceRect !== ownFaceRect && rectsOverlap(faceRect, rect));
    if (!overlapsLabel && !overlapsOtherFace) {
      return rect;
    }
  }

  return {
    ...baseRect,
    x: clamp(baseRect.x, renderBounds.minX, renderBounds.maxX - baseRect.w),
    y: clamp(baseRect.y, renderBounds.minY, renderBounds.maxY - baseRect.h)
  };
}

export function computeFaceOverlayLayout({
  faces = [],
  renderWidth,
  renderHeight,
  offsetX = 0,
  offsetY = 0,
  mode = FACE_OVERLAY_MODE.OFF,
  hoveredFaceIndex = null,
  measureText
}) {
  if (!Number.isFinite(renderWidth) || !Number.isFinite(renderHeight) || renderWidth <= 0 || renderHeight <= 0) {
    return [];
  }

  const resolvedMode = normalizeFaceOverlayMode(mode);

  const hoveredIndex = hoveredFaceIndex === null || hoveredFaceIndex === undefined
    ? null
    : Number(hoveredFaceIndex);

  const hasHoveredFace = hoveredIndex !== null && !Number.isNaN(hoveredIndex);
  const candidates = [];
  for (const face of faces) {
    if (!face || !face.region) continue;

    const faceIndex = Number(face.faceIndex);
    if (Number.isNaN(faceIndex)) continue;

    const region = face.region;
    const centerX = Number(region.x || 0) * renderWidth;
    const centerY = Number(region.y || 0) * renderHeight;
    const width = Number(region.w || 0) * renderWidth;
    const height = Number(region.h || 0) * renderHeight;
    const x = offsetX + centerX - (width / 2);
    const y = offsetY + centerY - (height / 2);

    const rect = {
      x,
      y,
      w: width,
      h: height
    };

    const labelText = face.label ? String(face.label) : null;
    const textWidth = labelText
      ? Math.ceil((typeof measureText === 'function' ? measureText(labelText) : estimateTextWidth(labelText)))
      : 0;

    const labelWidth = labelText ? textWidth + FACE_OVERLAY_STYLE.labelHorizontalPadding : 0;
    const labelHeight = labelText ? FACE_OVERLAY_STYLE.labelBoxHeight : 0;

    let labelX = x + 2;
    labelX = clamp(labelX, offsetX, offsetX + renderWidth - labelWidth);

    // Keep labels farther from the face box so the top-left number badge stays visible.
    let labelY = y - (labelHeight + 12);
    if (labelY < offsetY) {
      labelY = y + height + 10;
    }
    labelY = clamp(labelY, offsetY, offsetY + renderHeight - labelHeight);

    candidates.push({
      faceIndex,
      numberText: face.numberText || String(faceIndex + 1),
      state: face.state || 'matched',
      labelText,
      rect,
      labelRect: labelText
        ? {
          x: labelX,
          y: labelY,
          w: labelWidth,
          h: labelHeight
        }
        : null,
      isHovered: hasHoveredFace && faceIndex === hoveredIndex
    });
  }

  // Keep deterministic order by index for stable drawing.
  candidates.sort((a, b) => a.faceIndex - b.faceIndex);

  const placedLabels = [];
  const faceRects = candidates.map(c => c.rect);
  const renderBounds = {
    minX: offsetX,
    minY: offsetY,
    maxX: offsetX + renderWidth,
    maxY: offsetY + renderHeight
  };

  const shouldIsolateHoveredFace = hasHoveredFace
    && (resolvedMode === FACE_OVERLAY_MODE.ON
      || resolvedMode === FACE_OVERLAY_MODE.REGIONS
      || resolvedMode === FACE_OVERLAY_MODE.ALL);

  return candidates.map(candidate => {
    const isHoveredFace = candidate.isHovered;
    const suppressedByHoverIsolation = shouldIsolateHoveredFace && !isHoveredFace;

    let resolvedRegionVisible = false;
    let resolvedLabelVisible = false;
    let resolvedLabelRect = candidate.labelRect;

    if (!suppressedByHoverIsolation) {
      if (resolvedMode === FACE_OVERLAY_MODE.REGIONS || resolvedMode === FACE_OVERLAY_MODE.ALL) {
        resolvedRegionVisible = true;
      }

      if (resolvedMode === FACE_OVERLAY_MODE.ON && isHoveredFace) {
        resolvedRegionVisible = true;
      }

      if (resolvedMode === FACE_OVERLAY_MODE.ON || resolvedMode === FACE_OVERLAY_MODE.ALL) {
        resolvedLabelVisible = Boolean(candidate.labelText);
      }

      if (resolvedMode === FACE_OVERLAY_MODE.OFF && isHoveredFace) {
        resolvedLabelVisible = Boolean(candidate.labelText);
      }

      if ((resolvedMode === FACE_OVERLAY_MODE.REGIONS || resolvedMode === FACE_OVERLAY_MODE.ALL) && isHoveredFace) {
        resolvedLabelVisible = Boolean(candidate.labelText);
      }
    }

    if (resolvedLabelVisible && resolvedLabelRect) {
      if (resolvedMode === FACE_OVERLAY_MODE.ON || resolvedMode === FACE_OVERLAY_MODE.ALL) {
        resolvedLabelRect = tryPlaceLabelRect(resolvedLabelRect, placedLabels, faceRects, renderBounds, candidate.rect);
      }
      placedLabels.push(resolvedLabelRect);
    }

    return {
      ...candidate,
      labelVisible: resolvedLabelVisible,
      regionVisible: resolvedRegionVisible,
      labelRect: resolvedLabelRect
    };
  });
}
