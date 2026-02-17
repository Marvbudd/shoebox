<template>
  <div id="detailDiv" class="mediaContentRight">
    <!-- Reference banner - shown when opened from a playlist reference -->
    <div v-if="referenceInfo.isReferenced" class="reference-banner">
      <span class="reference-banner-icon">🎵</span>
      <span class="reference-banner-text">
        Referenced by <strong>{{ referenceInfo.sourceName }}</strong> at {{ referenceInfo.timeDisplay }}
      </span>
      <button class="reference-banner-close" @click="dismissReference" title="Dismiss reference">×</button>
    </div>
    
    <div id="previewDiv" v-html="previewContent"></div>
    
    <!-- Playback controls (only show when audio/video is present) -->
    <div v-if="hasMediaElement" class="playback-controls">
      <button @click="seekBackward" class="control-btn" title="Go back 10 seconds">⏪ -10s</button>
      <span class="current-time">{{ currentTimeDisplay }}</span>
      <button @click="seekForward" class="control-btn" title="Go forward 10 seconds">⏩ +10s</button>
    </div>
    
    <div id="prevDataDiv" v-html="detailContent" @dblclick="toggleDetailVisibility"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';

const previewContent = ref('Move mouse over the left column of the main window to select something to display.');
const detailContent = ref('');
const detailsExpanded = ref(false);
const hasMediaElement = ref(false);
const currentTimeDisplay = ref('00:00:00.0');
let mediaElement = null;
let updateInterval = null;
let durationTimer = null;  // Store timeout for playlist duration auto-pause
let currentMediaLink = null;
let playlistEntries = [];  // Store playlist entries for auto-display
let lastDisplayedEntry = null;  // Track last auto-displayed entry to avoid duplicates

// Reference state - tracks when media was opened from a playlist reference
const referenceInfo = ref({
  isReferenced: false,
  timeDisplay: '',
  sourceName: ''
});

// Format seconds to HH:MM:SS.s
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '00:00:00.0';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
};

// Update current time display
const updateCurrentTime = () => {
  if (mediaElement && !isNaN(mediaElement.currentTime)) {
    currentTimeDisplay.value = formatTime(mediaElement.currentTime);
    
    // Check if we've crossed into a playlist entry time
    checkPlaylistEntries(mediaElement.currentTime);
  }
};

// Seek backward 10 seconds
const seekBackward = () => {
  if (mediaElement) {
    mediaElement.currentTime = Math.max(0, mediaElement.currentTime - 10);
    updateCurrentTime();
    
    // Clear duration timer when seeking - user is manually controlling playback
    if (durationTimer) {
      clearTimeout(durationTimer);
      durationTimer = null;
    }
  }
};

// Seek forward 10 seconds
const seekForward = () => {
  if (mediaElement) {
    mediaElement.currentTime = Math.min(mediaElement.duration || 0, mediaElement.currentTime + 10);
    updateCurrentTime();
    
    // Clear duration timer when seeking - user is manually controlling playback
    if (durationTimer) {
      clearTimeout(durationTimer);
      durationTimer = null;
    }
  }
};

// Get current playback time and media info (for IPC call from MediaManager)
const getCurrentPlaybackInfo = () => {
  return {
    time: (mediaElement && !isNaN(mediaElement.currentTime)) ? formatTime(mediaElement.currentTime) : '00:00:00.0',
    link: currentMediaLink || '',
    currentSeconds: (mediaElement && !isNaN(mediaElement.currentTime)) ? mediaElement.currentTime : 0
  };
};

// Expose to window for IPC
window.getCurrentPlaybackTime = getCurrentPlaybackInfo;

// Receive media display data from main process
const handleMediaDisplay = (mediaData) => {
  const itemObject = typeof mediaData === 'string' ? JSON.parse(mediaData) : mediaData;
  
  detailContent.value = itemObject.descDetail;
  previewContent.value = itemObject.mediaTag;
  document.title = itemObject.link || 'Shoebox Media';
  currentMediaLink = itemObject.link || null;
  detailsExpanded.value = false;
  
  // Check if this was opened from a playlist reference
  if (itemObject.entry && itemObject.entry.startSeconds !== undefined) {
    referenceInfo.value = {
      isReferenced: true,
      timeDisplay: formatTime(itemObject.entry.startSeconds),
      sourceName: itemObject.entry.sourceLink || 'Unknown source'
    };
  } else {
    // Clear reference info when opening normally
    referenceInfo.value = {
      isReferenced: false,
      timeDisplay: '',
      sourceName: ''
    };
  }
  
  // Clear any existing interval and duration timer
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  if (durationTimer) {
    clearTimeout(durationTimer);
    durationTimer = null;
  }
  
  // Wait for DOM update to find media element
  nextTick(() => {
    mediaElement = document.querySelector('#previewAudio') || document.querySelector('#previewVideo');
    hasMediaElement.value = !!mediaElement;
    
    if (mediaElement) {
      // Start updating current time display
      updateInterval = setInterval(updateCurrentTime, 100);
      
      // Add event listeners to clear duration timer when user manually controls playback
      const handlePause = () => {
        // Clear timer if it exists (means user paused, not timer)
        // If timer paused it, durationTimer will already be null
        if (durationTimer) {
          clearTimeout(durationTimer);
          durationTimer = null;
        }
      };
      
      mediaElement.addEventListener('pause', handlePause);
      
      // Handle auto-play with start time and duration
      if (itemObject.entry) {
        mediaElement.currentTime = itemObject.entry.startSeconds;
        mediaElement.play();
        
        // Store timer ID so it can be cleared later
        durationTimer = setTimeout(() => {
          // Clear timer ID before pausing to avoid race with pause event listener
          durationTimer = null;
          if (mediaElement) {
            mediaElement.pause();
          }
        }, itemObject.entry.durationSeconds * 1000);
      }
    } else {
      currentTimeDisplay.value = '00:00:00.0';
    }
    
    // Setup event listeners after DOM updates
    setupEventListeners();
    
    // Auto-display first playlist reference if present
    // Only do this if NOT opened from a reference (to avoid recursion)
    // Use nextTick to ensure playlistEntries have been extracted
    if (!itemObject.entry) {
      nextTick(() => {
        autoDisplayFirstPlaylistReference();
      });
    }
  });
};

// Setup event listeners for dynamically added content
const setupEventListeners = () => {
  const editMediaBtn = document.getElementById('editMedia');
  if (editMediaBtn) {
    editMediaBtn.addEventListener('click', async () => {
      const accessionEl = document.getElementById('accession');
      if (accessionEl) {
        const accession = accessionEl.innerText;
        await window.electronAPI.editItem(accession);
      }
    });
  }
  
  const openWebsiteBtn = document.getElementById('openWebsite');
  if (openWebsiteBtn) {
    openWebsiteBtn.addEventListener('click', async () => {
      await window.electronAPI.openWebsite();
    });
  }
  
  // Setup playlist entry listeners
  const playEntries = document.querySelectorAll('.playEntry');
  playEntries.forEach(entry => {
    entry.style.cursor = 'pointer';
    entry.addEventListener('click', handlePlayEntry);
  });
  
  // Extract playlist entries for auto-display during playback
  extractPlaylistEntries();
};

// Dismiss reference banner
const dismissReference = () => {
  referenceInfo.value = {
    isReferenced: false,
    timeDisplay: '',
    sourceName: ''
  };
};

// Extract playlist entries from DOM
const extractPlaylistEntries = () => {
  playlistEntries = [];
  lastDisplayedEntry = null;
  
  const playEntryElements = document.querySelectorAll('.playEntry');
  playEntryElements.forEach(entryElement => {
    const row = entryElement.closest('tr');
    if (row) {
      const ref = row.querySelector('#playlink')?.innerText || '';
      const start = row.querySelector('#playstart')?.innerText || '';
      const duration = row.querySelector('#playduration')?.innerText || '';
      
      if (ref && start) {
        // Convert HH:MM:SS to seconds
        const timeParts = start.split(':');
        let startSeconds = 0;
        if (timeParts.length === 3) {
          startSeconds = parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseFloat(timeParts[2]);
        }
        
        playlistEntries.push({
          ref,
          start,
          duration,
          startSeconds
        });
      }
    }
  });
  
  // Sort by start time
  playlistEntries.sort((a, b) => a.startSeconds - b.startSeconds);
};

// Check if current playback time crosses a playlist entry
const checkPlaylistEntries = (currentTime) => {
  if (!mediaElement || playlistEntries.length === 0) return;
  
  // Don't auto-display if media is paused
  if (mediaElement.paused) return;
  
  // Find entries that should be displayed at current time
  for (const entry of playlistEntries) {
    // Check if we're within 0.5 seconds of the start time (to avoid missing it)
    if (currentTime >= entry.startSeconds - 0.5 && currentTime < entry.startSeconds + 1) {
      // Don't display same entry twice
      if (lastDisplayedEntry === entry.ref) continue;
      
      lastDisplayedEntry = entry.ref;
      
      // Display the referenced photo
      window.electronAPI.playItem({
        ref: entry.ref,
        start: entry.start,
        duration: entry.duration,
        sourceLink: currentMediaLink || ''
      });
      
      break;  // Only display one at a time
    }
  }
};

// Auto-display first playlist reference
const autoDisplayFirstPlaylistReference = () => {
  // Wait for DOM to be ready and playlistEntries to be extracted
  if (playlistEntries.length === 0) return;
  
  // Get the first entry from our parsed list
  const firstEntry = playlistEntries[0];
  if (firstEntry && firstEntry.ref) {
    try {
      window.electronAPI.playItem({
        ref: firstEntry.ref,
        start: firstEntry.start,
        duration: firstEntry.duration,
        sourceLink: currentMediaLink || ''
      });
    } catch (error) {
      console.error('Error auto-playing first reference:', error);
    }
  }
};

// Handle playlist entry click (changed from mouseover)
const handlePlayEntry = async (event) => {
  const row = event.currentTarget.closest('tr');
  if (row) {
    const entry = {
      ref: row.querySelector('#playlink')?.innerText || '',
      start: row.querySelector('#playstart')?.innerText || '',
      duration: row.querySelector('#playduration')?.innerText || '',
      sourceLink: currentMediaLink || ''  // Pass current media link as source
    };
    try {
      await window.electronAPI.playItem(entry);
    } catch (error) {
      console.error('Error playing item:', error);
    }
  }
};

// Toggle detail visibility
const toggleDetailVisibility = () => {
  const detailElements = document.getElementsByClassName('detail');
  detailsExpanded.value = !detailsExpanded.value;
  
  for (let i = 0; i < detailElements.length; i++) {
    detailElements[i].style.display = detailsExpanded.value ? 'table-row' : 'none';
  }
};

// Initialize on mount
onMounted(() => {
  // Listen for media display messages
  window.electronAPI.onMediaDisplay(handleMediaDisplay);
});

// Cleanup on unmount
onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  if (durationTimer) {
    clearTimeout(durationTimer);
    durationTimer = null;
  }
});
</script>

<style>
/* Media player specific styles */
.mediaContentRight {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  left: 0;
  overflow: auto;
  background: #eeeeff;
}

#detailDiv {
  font-size: smaller;
  font-family: Arial, helvetica, sans-serif;
  height: 100%;
  display: flex;
  flex-direction: column;
}

#previewDiv {
  flex: 3 1 0;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

#previewVideo {
  max-height: 100%;
  max-width: 100%;
  height: auto;
  width: auto;
  object-fit: contain;
}

#previewAudio {
  width: 100%;
}

.playback-controls {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  padding: 10px;
  background: #f5f5ff;
  border-top: 1px solid #ccc;
  border-bottom: 1px solid #ccc;
}

.control-btn {
  padding: 8px 16px;
  font-size: 14px;
  background: #4a5568;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.control-btn:hover {
  background: #2d3748;
}

.control-btn:active {
  background: #1a202c;
}

.current-time {
  font-family: 'Courier New', monospace;
  font-size: 16px;
  font-weight: bold;
  color: #2d3748;
  min-width: 100px;
  text-align: center;
}

#prevDataDiv {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  border-top: 1px solid #ccc;
}

#prevData,
#prevData tbody {
  width: 100%;
  vertical-align: bottom;
  border-spacing: 0;
}

#prevData .detailCol2 {
  column-width: 1000px;
}

#prevData .copyright {
  color: Red;
  font-weight: normal;
  font-size: x-small;
}

.prevDataCaption {
  display: flex;
  justify-content: space-between;
  font-weight: bold;
  padding: 0 20px;
}

.date {
  text-align: left;
}

.dateRight {
  width: 8%;
  float: right;
}

.dateData {
  text-align: right;
}

.descData {
  word-wrap: normal;
}

.emphasize {
  font-weight: bold;
}

A:link {
  color: Navy;
}

A:visited {
  color: Navy;
}
</style>
