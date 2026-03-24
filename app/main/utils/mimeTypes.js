/**
 * Single authoritative source for media MIME type detection.
 * 
 * IMPORTANT: All code that needs to determine MIME types for media files
 * MUST use this utility. Do NOT duplicate MIME type logic elsewhere.
 * This includes: protocol handlers, IPC handlers, and HTML tag generation.
 *
 * @param {string} type - Media type: 'photo', 'audio', or 'video'
 * @param {string} link - Filename (used to determine extension)
 * @returns {string} MIME type string
 */
export function getMimeType(type, link) {
  const ext = link.split('.').pop().toLowerCase();

  if (type === 'photo') {
    if (ext === 'png') return 'image/png';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'webp') return 'image/webp';
    return 'image/jpeg'; // default for .jpg, .jpeg
  }

  if (type === 'audio') {
    if (ext === 'mp3') return 'audio/mpeg';
    if (ext === 'wav') return 'audio/wav';
    if (ext === 'ogg') return 'audio/ogg';
    if (ext === 'm4a') return 'audio/mp4';
    if (ext === 'aac') return 'audio/aac';
    return 'audio/mpeg'; // default
  }

  if (type === 'video') {
    if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
    if (ext === 'mov' || ext === 'qt') return 'video/quicktime';
    if (ext === 'webm') return 'video/webm';
    if (ext === 'ogv') return 'video/ogg';
    if (ext === 'avi') return 'video/x-msvideo';
    return 'video/mp4'; // default
  }

  return 'application/octet-stream';
}
