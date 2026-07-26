import { computeFaceOverlayLayout, FACE_OVERLAY_STYLE } from './faceOverlayEngine.js';

function getSourceDimensions(imageSource) {
  const naturalWidth = Number(imageSource?.naturalWidth || imageSource?.width || 0);
  const naturalHeight = Number(imageSource?.naturalHeight || imageSource?.height || 0);

  if (!Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight) || naturalWidth <= 0 || naturalHeight <= 0) {
    return null;
  }

  return {
    naturalWidth: Math.max(1, Math.round(naturalWidth)),
    naturalHeight: Math.max(1, Math.round(naturalHeight))
  };
}

/**
 * Render snapshot image from a loaded image source while using shared overlay layout rules.
 * Returns { success, dataUrl?, error? }.
 */
export function renderSnapshotDataUrlFromImageSource({
  imageSource,
  faces = [],
  mode,
  hoveredFaceIndex = null,
  layoutWidth,
  layoutHeight
}) {
  if (!imageSource) {
    return { success: false, error: 'Snapshot image source is not available.' };
  }

  const dims = getSourceDimensions(imageSource);
  if (!dims) {
    return { success: false, error: 'Snapshot image source dimensions are invalid.' };
  }

  const naturalWidth = dims.naturalWidth;
  const naturalHeight = dims.naturalHeight;

  const resolvedLayoutWidth = Number.isFinite(layoutWidth) && layoutWidth > 0
    ? Math.max(1, Math.round(layoutWidth))
    : naturalWidth;
  const resolvedLayoutHeight = Number.isFinite(layoutHeight) && layoutHeight > 0
    ? Math.max(1, Math.round(layoutHeight))
    : naturalHeight;

  const scaleX = naturalWidth / resolvedLayoutWidth;
  const scaleY = naturalHeight / resolvedLayoutHeight;
  const fontScale = Math.min(scaleX, scaleY);

  const canvas = document.createElement('canvas');
  canvas.width = naturalWidth;
  canvas.height = naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { success: false, error: 'Failed to prepare snapshot canvas.' };
  }

  ctx.drawImage(imageSource, 0, 0, naturalWidth, naturalHeight);

  const layout = computeFaceOverlayLayout({
    faces,
    renderWidth: resolvedLayoutWidth,
    renderHeight: resolvedLayoutHeight,
    offsetX: 0,
    offsetY: 0,
    mode,
    hoveredFaceIndex,
    measureText: (text) => {
      ctx.font = FACE_OVERLAY_STYLE.labelFont;
      return ctx.measureText(String(text || '')).width;
    }
  });

  ctx.textBaseline = 'alphabetic';

  const scaleRect = (rectValue) => {
    return {
      x: rectValue.x * scaleX,
      y: rectValue.y * scaleY,
      w: rectValue.w * scaleX,
      h: rectValue.h * scaleY
    };
  };

  layout.forEach((entry) => {
    if (entry.regionVisible) {
      const regionRect = scaleRect(entry.rect);
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = FACE_OVERLAY_STYLE.borderWidth * fontScale;
      ctx.strokeRect(regionRect.x, regionRect.y, regionRect.w, regionRect.h);

      const numberText = String(entry.numberText || '');
      ctx.font = `bold ${Math.max(1, Math.round(FACE_OVERLAY_STYLE.numberFontSize * fontScale))}px sans-serif`;
      const numberWidth = Math.ceil(ctx.measureText(numberText).width) + (10 * fontScale);
      const numberHeight = FACE_OVERLAY_STYLE.numberBoxHeight * fontScale;
      const numberX = regionRect.x + (2 * scaleX);
      const numberY = regionRect.y - numberHeight;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.fillRect(numberX, numberY, numberWidth, numberHeight);
      ctx.fillStyle = '#ff6600';
      ctx.fillText(numberText, numberX + (4 * scaleX), numberY + (FACE_OVERLAY_STYLE.numberTextYOffset * fontScale));
    }

    if (entry.labelVisible && entry.labelText && entry.labelRect) {
      const labelRect = scaleRect(entry.labelRect);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
      ctx.fillRect(labelRect.x, labelRect.y, labelRect.w, labelRect.h);
      ctx.font = `${Math.max(1, Math.round(FACE_OVERLAY_STYLE.labelFontSize * fontScale))}px sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(
        String(entry.labelText),
        labelRect.x + (5 * scaleX),
        labelRect.y + (FACE_OVERLAY_STYLE.labelTextYOffset * fontScale)
      );
    }
  });

  return {
    success: true,
    dataUrl: canvas.toDataURL('image/png')
  };
}

/**
 * Render a snapshot image that matches the on-screen preview overlay style.
 * Returns { success, dataUrl?, error? }.
 */
export function renderPreviewSnapshotDataUrl({
  imageElement,
  faces = [],
  mode,
  hoveredFaceIndex = null
}) {
  if (!imageElement) {
    return { success: false, error: 'Preview image is not available.' };
  }

  if (!imageElement.complete || !imageElement.naturalWidth || !imageElement.naturalHeight) {
    return { success: false, error: 'Image is still loading.' };
  }

  const rect = imageElement.getBoundingClientRect();

  return renderSnapshotDataUrlFromImageSource({
    imageSource: imageElement,
    faces,
    mode,
    hoveredFaceIndex,
    layoutWidth: rect.width,
    layoutHeight: rect.height
  });
}
