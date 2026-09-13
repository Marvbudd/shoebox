import { computeFaceOverlayLayout, drawFaceOverlaysToCanvas, FACE_OVERLAY_STYLE } from './faceOverlayEngine.js';

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

export function getDisplayedImageSize(imageElement) {
  const dims = getSourceDimensions(imageElement);
  if (!dims) {
    return null;
  }

  const rect = imageElement?.getBoundingClientRect ? imageElement.getBoundingClientRect() : null;
  const rectWidth = Number(rect?.width || 0);
  const rectHeight = Number(rect?.height || 0);

  if (Number.isFinite(rectWidth) && Number.isFinite(rectHeight) && rectWidth > 0 && rectHeight > 0) {
    // Calculate uniform scale under object-fit: contain
    const scale = Math.min(rectWidth / dims.naturalWidth, rectHeight / dims.naturalHeight);
    return {
      width: Math.max(1, Math.round(dims.naturalWidth * scale)),
      height: Math.max(1, Math.round(dims.naturalHeight * scale))
    };
  }

  return {
    width: dims.naturalWidth,
    height: dims.naturalHeight
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

  // Derive uniform layout dimensions preserving natural image aspect ratio
  let resolvedLayoutWidth = naturalWidth;
  let resolvedLayoutHeight = naturalHeight;

  if (Number.isFinite(layoutWidth) && layoutWidth > 0 && Number.isFinite(layoutHeight) && layoutHeight > 0) {
    const scale = Math.min(layoutWidth / naturalWidth, layoutHeight / naturalHeight);
    resolvedLayoutWidth = Math.max(1, Math.round(naturalWidth * scale));
    resolvedLayoutHeight = Math.max(1, Math.round(naturalHeight * scale));
  } else if (Number.isFinite(layoutWidth) && layoutWidth > 0) {
    const scale = layoutWidth / naturalWidth;
    resolvedLayoutWidth = Math.max(1, Math.round(layoutWidth));
    resolvedLayoutHeight = Math.max(1, Math.round(naturalHeight * scale));
  } else if (Number.isFinite(layoutHeight) && layoutHeight > 0) {
    const scale = layoutHeight / naturalHeight;
    resolvedLayoutWidth = Math.max(1, Math.round(naturalWidth * scale));
    resolvedLayoutHeight = Math.max(1, Math.round(layoutHeight));
  }

  const uniformScale = naturalWidth / resolvedLayoutWidth;

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

  drawFaceOverlaysToCanvas(ctx, layout, { scale: uniformScale });

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

  const displayed = getDisplayedImageSize(imageElement);

  return renderSnapshotDataUrlFromImageSource({
    imageSource: imageElement,
    faces,
    mode,
    hoveredFaceIndex,
    layoutWidth: displayed?.width,
    layoutHeight: displayed?.height
  });
}
