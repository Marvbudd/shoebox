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

function overlapArea(a, b) {
  const width = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return width * height;
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

  const maxX = Math.max(renderBounds.minX, renderBounds.maxX - baseRect.w);
  const maxY = Math.max(renderBounds.minY, renderBounds.maxY - baseRect.h);
  const candidateRects = [];
  const seen = new Set();
  const addCandidate = (x, y) => {
    const candidate = {
      x: clamp(x, renderBounds.minX, maxX),
      y: clamp(y, renderBounds.minY, maxY),
      w: baseRect.w,
      h: baseRect.h
    };
    const key = `${candidate.x}:${candidate.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      candidateRects.push(candidate);
    }
  };

  const labelCenterX = ownFaceRect.x + (ownFaceRect.w / 2) - (baseRect.w / 2);
  const gap = 10;
  addCandidate(labelCenterX, ownFaceRect.y - baseRect.h - gap);
  addCandidate(labelCenterX, ownFaceRect.y + ownFaceRect.h + gap);
  addCandidate(ownFaceRect.x - baseRect.w - gap, ownFaceRect.y + (ownFaceRect.h / 2) - (baseRect.h / 2));
  addCandidate(ownFaceRect.x + ownFaceRect.w + gap, ownFaceRect.y + (ownFaceRect.h / 2) - (baseRect.h / 2));

  const horizontalSearchRadius = Math.max(128, ownFaceRect.w * 2);
  const verticalSearchRadius = Math.max(320, ownFaceRect.h * 6);
  for (let yOffset = -verticalSearchRadius; yOffset <= verticalSearchRadius; yOffset += 16) {
    for (let xOffset = -horizontalSearchRadius; xOffset <= horizontalSearchRadius; xOffset += 16) {
      addCandidate(baseRect.x + xOffset, baseRect.y + yOffset);
    }
  }

  for (const yOffset of [-verticalSearchRadius, verticalSearchRadius]) {
    for (const xOffset of [-horizontalSearchRadius, 0, horizontalSearchRadius]) {
      addCandidate(baseRect.x + xOffset, baseRect.y + yOffset);
    }
  }

  const scoredCandidates = candidateRects.map(rect => {
    const overlappingLabels = placedLabels.filter(label => rectsOverlap(label, rect));
    const overlappingFaces = faceRects.filter(faceRect => rectsOverlap(faceRect, rect));
    const overlapScore = overlappingFaces.reduce((score, faceRect) => score + overlapArea(faceRect, rect), 0);
    return {
      rect,
      overlappingLabels: overlappingLabels.length,
      overlappingFaces: overlappingFaces.length,
      overlapScore,
      distance: Math.abs(rect.x - baseRect.x) + Math.abs(rect.y - baseRect.y)
    };
  });

  scoredCandidates.sort((a, b) =>
    a.overlappingFaces - b.overlappingFaces
    || a.overlappingLabels - b.overlappingLabels
    || a.overlapScore - b.overlapScore
    || a.distance - b.distance
  );

  return scoredCandidates[0]?.rect || {
    ...baseRect,
    x: clamp(baseRect.x, renderBounds.minX, maxX),
    y: clamp(baseRect.y, renderBounds.minY, maxY)
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

/**
 * Draw face overlay layout entries onto a 2D canvas context.
 * Shared by on-screen overlay canvas (scale = 1) and full-resolution snapshot rendering (scale >= 1).
 */
export function drawFaceOverlaysToCanvas(ctx, entriesToDraw = [], { scale = 1 } = {}) {
  if (!ctx || !Array.isArray(entriesToDraw)) {
    return;
  }

  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;

  for (const entry of entriesToDraw) {
    if (!entry) continue;

    const color = entry.state === 'matched'
      ? '#0080ff'
      : (entry.state === 'excluded' ? '#f59e0b' : '#00ff00');

    if (entry.regionVisible && entry.rect) {
      const rx = entry.rect.x * s;
      const ry = entry.rect.y * s;
      const rw = entry.rect.w * s;
      const rh = entry.rect.h * s;

      ctx.strokeStyle = color;
      ctx.lineWidth = FACE_OVERLAY_STYLE.borderWidth * s;
      ctx.strokeRect(rx, ry, rw, rh);

      ctx.font = `bold ${Math.max(1, Math.round(FACE_OVERLAY_STYLE.numberFontSize * s))}px sans-serif`;
      const faceNumMetrics = ctx.measureText(String(entry.numberText || ''));
      const numBoxW = faceNumMetrics.width + (8 * s);
      const numBoxH = FACE_OVERLAY_STYLE.numberBoxHeight * s;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(rx + (2 * s), ry + (2 * s), numBoxW, numBoxH);

      ctx.fillStyle = color;
      ctx.fillText(String(entry.numberText || ''), rx + (6 * s), ry + (FACE_OVERLAY_STYLE.numberTextYOffset * s));
    }

    if (entry.labelVisible && entry.labelText && entry.labelRect) {
      const lx = entry.labelRect.x * s;
      const ly = entry.labelRect.y * s;
      const lw = entry.labelRect.w * s;
      const lh = entry.labelRect.h * s;

      ctx.font = `${Math.max(1, Math.round(FACE_OVERLAY_STYLE.labelFontSize * s))}px sans-serif`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.fillRect(lx, ly, lw, lh);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(entry.labelText), lx + (5 * s), ly + (FACE_OVERLAY_STYLE.labelTextYOffset * s));
    }
  }
}
