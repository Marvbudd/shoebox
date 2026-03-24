/**
 * Shared video codec detection utility
 * Detects if a video has an unsupported codec (e.g., HEVC/H.265)
 * 
 * A video with an unsupported codec will have:
 * - videoWidth === 0
 * - videoHeight === 0  
 * - duration > 0 (has audio track)
 * 
 * This indicates the audio decoded but video codec is not supported by the browser.
 */

/**
 * Check if a video element has an unsupported codec
 * @param {HTMLVideoElement} videoElement - The video element to check
 * @returns {boolean} True if codec is unsupported, false otherwise
 */
export function hasUnsupportedCodec(videoElement) {
  if (!videoElement || videoElement.tagName !== 'VIDEO') {
    return false;
  }
  
  // If video hasn't loaded metadata yet, can't determine codec support
  if (videoElement.readyState < 1) {
    return false;
  }
  
  // If video has dimensions, codec is supported
  if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
    return false;
  }
  
  // If no duration yet, not loaded enough to determine
  if (!videoElement.duration || videoElement.duration === 0) {
    return false;
  }
  
  // At this point: videoWidth=0, videoHeight=0, duration>0
  // This means either audio-only file OR unsupported video codec
  
  // Check for media errors - audio-only files won't have errors
  if (videoElement.error) {
    // Has an error, likely codec issue
    return true;
  }
  
  // Use track APIs to distinguish (if available)
  const hasAudioTracks = videoElement.audioTracks && videoElement.audioTracks.length > 0;
  const hasVideoTracksAPI = videoElement.videoTracks !== undefined && videoElement.videoTracks !== null;
  
  if (hasVideoTracksAPI) {
    // If videoTracks API is available, use it
    if (videoElement.videoTracks.length === 0 && hasAudioTracks) {
      // Audio-only file (has audio tracks but no video tracks)
      return false;
    } else if (videoElement.videoTracks.length > 0) {
      // Has video tracks but can't display them = unsupported codec
      return true;
    }
  }
  
  // Fallback heuristic: Check file extension as a hint
  // MP4 containers with no video dimensions are more likely audio-only
  // MOV containers with no video dimensions are more likely HEVC (unsupported)
  const src = videoElement.currentSrc || videoElement.src || '';
  if (src.toLowerCase().endsWith('.mp4')) {
    // MP4 with no video dimensions is likely audio-only (MP4 container supports pure audio)
    return false;
  }
  
  // For MOV and other formats: assume unsupported video codec (HEVC)
  // This is the safer default for detecting HEVC in MOV files
  return true;
}

/**
 * Create an event handler that checks for unsupported codec
 * @param {HTMLVideoElement} videoElement - The video element to monitor
 * @param {Function} onCodecError - Callback when unsupported codec detected
 * @param {Function} onCodecOk - Callback when codec is supported
 * @returns {Function} Event handler function
 */
export function createCodecCheckHandler(videoElement, onCodecError, onCodecOk) {
  return () => {
    if (hasUnsupportedCodec(videoElement)) {
      onCodecError();
    } else {
      onCodecOk();
    }
  };
}
