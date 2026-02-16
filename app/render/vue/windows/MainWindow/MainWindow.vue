<template>
  <div id="main" class="container" :class="{ 'photo-frame-mode': isPhotoFrameMode }" tabindex="0" @keydown="handleKeyDown">
    <!-- Header with navigation columns and preview title -->
    <header id="mainHeader" class="header" v-show="!isPhotoFrameMode">
      <div id="navHeader" v-html="navHeader"></div>
      <div id="previewHeader">Preview</div>
    </header>

    <!-- Left side: Navigation table and controls -->
    <div id="selectDiv" class="contentLeft" v-show="!isPhotoFrameMode">
      <div id="tableDiv" v-html="tableBody" @mouseover="handleMouseOver" @click="handleTableClick" @dblclick="handleDoubleClick"></div>
      
      <div id="playerDiv" class="bottomLeft">
        <form id="tableSort">
          <label class="select" for="selectSort">
            Filter:
            <select v-model="sortBy" id="selectSort" @change="handleSortChange">
              <option value="1">By Date</option>
              <option value="2">By Person</option>
              <option value="3">By Location</option>
              <option value="4">By File</option>
              <option value="5">By Source</option>
              <option value="6">By Accession</option>
            </select>
          </label>

          <input type="checkbox" id="photo" v-model="photoChecked" @change="handleControlsChanged" />
          <label class="photoInput" for="photo">Photo?</label>

          <input type="checkbox" id="tape" v-model="audioChecked" @change="handleControlsChanged" />
          <label class="tapeInput" for="tape">Audio?</label>

          <input type="checkbox" id="video" v-model="videoChecked" @change="handleControlsChanged" />
          <label class="videoInput" for="video">Video?</label>

          <label v-show="collections.length > 0" for="selectCollection" id="selectCollectionLabel">
            Collection:
            <select v-model="selectedCollection" id="selectCollection" @change="handleControlsChanged">
              <option v-for="collection in collections" :key="collection.value" :value="collection.value">
                {{ collection.text }}
              </option>
            </select>
          </label>

          <label v-show="collections.length > 0" class="limitLabel" id="limitLabel">
            <input type="checkbox" v-model="limitChecked" id="limit" @change="handleControlsChanged" />
            Limit?
          </label>

          <label class="faceTagsLabel" id="faceTagsLabel">
            <input type="checkbox" v-model="showFaceTags" id="showFaceTags" @change="handleFaceRegionsChange" />
            Show Face Tags
          </label>
        </form>
      </div>
    </div>

    <!-- Right side: Preview and details -->
    <div id="detailDiv" class="contentRight" @click="restoreFocus">
      <div id="previewDiv" v-html="previewContent"></div>
      <div id="prevDataDiv" v-html="detailContent" @dblclick="toggleDetailVisibility"></div>
    </div>
    
    <!-- Reference banner - positioned outside contentRight with fixed positioning -->
    <div v-if="referenceInfo.isViewing" class="reference-banner reference-banner-mainwindow">
      <span class="reference-banner-icon">📷</span>
      <span class="reference-banner-text">
        Viewing reference from <strong>{{ referenceInfo.sourceName }}</strong> at {{ referenceInfo.timeDisplay }}
      </span>
      <button class="reference-banner-close" @click="dismissReference" title="Dismiss reference">×</button>
    </div>
    
    <!-- Slideshow indicator overlay -->
    <div v-if="showSlideshowIndicator" class="slideshow-indicator">
      <span v-if="isRandomMode" class="slideshow-icon">🔀</span>
      <span v-else-if="isAutoCycling && cycleDirection === -1" class="slideshow-icon">◀</span>
      <span v-else-if="isAutoCycling" class="slideshow-icon">▶</span>
      <span v-else class="slideshow-icon">⏸</span>
      <span class="slideshow-speed">{{ cycleInterval }}s</span>
    </div>
    
    <!-- Slideshow keyboard shortcuts tooltip -->
    <div v-if="showSlideshowTooltip" class="slideshow-tooltip">
      <div class="slideshow-tooltip-title">Slideshow Controls</div>
      <div class="slideshow-tooltip-shortcuts">
        <div><kbd>Space</kbd> = Pause/Resume</div>
        <div><kbd>←</kbd> / <kbd>→</kbd> = Adjust Speed</div>
        <div><kbd>Backspace</kbd> = Reverse Direction</div>
        <div><kbd>R</kbd> = Random/Sequential</div>
        <div><kbd>↑</kbd> / <kbd>↓</kbd> = Stop &amp; Navigate</div>
        <div><kbd>Esc</kbd> = Exit Photo Frame</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';

// Reactive state
const sortBy = ref('1'); // By Date
const photoChecked = ref(true);
const audioChecked = ref(true);
const videoChecked = ref(true);
const limitChecked = ref(false);
const selectedCollection = ref('');
const collections = ref([]);
const showFaceTags = ref(false);

const navHeader = ref('<div id="column1" class="Date">Col1</div><div id="column2">Col2</div>');
const tableBody = ref('');
const previewContent = ref('Move mouse over the left column to select something to display.');
const detailContent = ref('');
const currentFaceTags = ref(null);

const detailsExpanded = ref(false);

// Reference state - tracks when viewing a playlist reference
const referenceInfo = ref({
  isViewing: false,
  sourceName: '',
  timeDisplay: '',
  sourceAccession: ''
});

// Keyboard navigation state
const selectedRowIndex = ref(-1); // Track currently selected row for keyboard nav
const lastMouseX = ref(-1); // Track mouse position to detect actual movement
const lastMouseY = ref(-1);

// Slideshow state
const isAutoCycling = ref(false);
const cycleInterval = ref(5); // seconds
const cycleTimer = ref(null);
const showSlideshowIndicator = ref(false);
const slideshowIndicatorTimeout = ref(null);
const isPhotoFrameMode = ref(false);
const showSlideshowTooltip = ref(false);
const slideshowTooltipTimeout = ref(null);
const cycleDirection = ref(1); // 1 = forward, -1 = backward
const isRandomMode = ref(false);
const visitedIndices = ref(new Set()); // Track visited photos in random mode

// Load items from main process
const loadItems = async (preserveSort = false) => {
  try {
    // Always send the current sortBy value, unless it's initial load where we want server's saved value
    const requestParams = preserveSort ? {} : { sort: sortBy.value };
    const response = await window.electronAPI.getItemsList(requestParams);
    renderItems(response, preserveSort); // Pass preserveSort through to renderItems
    
    // Save sort selection
    const controls = {
      photoChecked: photoChecked.value,
      audioChecked: audioChecked.value,
      videoChecked: videoChecked.value,
      limitChecked: collections.value.length > 0 ? limitChecked.value : false,
      selectedCollection: collections.value.length > 0 ? selectedCollection.value : '',
      showFaceTags: showFaceTags.value,
      sortBy: sortBy.value
    };
    await window.electronAPI.updateControls(controls);
    
    // Restore focus to main container
    nextTick(() => {
      const mainContainer = document.getElementById('main');
      if (mainContainer) {
        mainContainer.focus();
      }
    });
  } catch (error) {
    console.error('Error loading items:', error);
  }
};

// Handle sort change from dropdown
const handleSortChange = async (event) => {
  sortBy.value = event.target.value;
  await nextTick(); // Ensure v-model has updated
  await loadItems(false); // preserveSort=false sends the new sort to server
};

// Render items received from main process
const renderItems = (listObject, preserveSort = false) => {
  document.title = listObject.accessionTitle;
  
  // Use ?? to provide defaults for undefined values
  photoChecked.value = listObject.photoChecked ?? true;
  audioChecked.value = listObject.audioChecked ?? true;
  videoChecked.value = listObject.videoChecked ?? true;
  limitChecked.value = listObject.limitChecked ?? false;
  showFaceTags.value = listObject.showFaceTags ?? false;
  
  // Always update sortBy from server (server is source of truth)
  sortBy.value = listObject.sortBy || '1';
  
  collections.value = listObject.collections;
  selectedCollection.value = listObject.selectedCollection || '';
  
  navHeader.value = listObject.navHeader;
  tableBody.value = listObject.tableBody;
  
  // Reset keyboard selection
  selectedRowIndex.value = -1;
  
  // Apply filters after DOM updates
  nextTick(() => {
    hideHighlightFilter();
  });
};

// Handle controls change (filters, collection selection)
const handleControlsChanged = async () => {
  hideHighlightFilter();
  
  const controls = {
    photoChecked: photoChecked.value,
    audioChecked: audioChecked.value,
    videoChecked: videoChecked.value,
    limitChecked: collections.value.length > 0 ? limitChecked.value : false,
    selectedCollection: collections.value.length > 0 ? selectedCollection.value : '',
    showFaceTags: showFaceTags.value
  };
  
  try {
    await window.electronAPI.updateControls(controls);
  } catch (error) {
    console.error('Error in handleControlsChanged:', error);
  }
  
  // Restore focus to main container for keyboard shortcuts
  nextTick(() => {
    const mainContainer = document.getElementById('main');
    if (mainContainer) {
      mainContainer.focus();
    }
  });
};

// Filter and highlight items based on selections
const hideHighlightFilter = () => {
  const tableDiv = document.querySelector('#tableDiv');
  if (!tableDiv) return;
  
  const selectedColl = collections.value.length > 0 ? selectedCollection.value : '';
  const limit = collections.value.length > 0 ? limitChecked.value : false;
  
  const showClassArray = [
    { class: "photo", show: photoChecked.value },
    { class: "audio", show: audioChecked.value },
    { class: "video", show: videoChecked.value }
  ];
  
  const detailElements = tableDiv.getElementsByTagName('tr');
  for (let i = 0; i < detailElements.length; i++) {
    const row = detailElements[i];
    const classList = row.classList;
    
    // Find matching media type in classList (photo, audio, or video)
    const showClass = showClassArray.find(sc => classList.contains(sc.class))?.show;
    
    if (selectedColl && row.hasAttribute('collections')) {
      const rowCollections = row.getAttribute('collections').split(',');
      if (rowCollections.some(c => c === selectedColl)) {
        row.firstChild.style.color = 'green';
        row.hidden = !showClass;
      } else {
        row.firstChild.style.color = '';
        row.hidden = limit || !showClass;
      }
    } else {
      row.hidden = !showClass;
    }
  }
  
  // Reset keyboard selection when filters change
  selectedRowIndex.value = -1;
  
  // Remove all highlights
  const allRows = tableDiv.getElementsByTagName('tr');
  for (let i = 0; i < allRows.length; i++) {
    allRows[i].classList.remove('keyboard-selected');
  }
};

// Handle mouseover on table rows
const handleMouseOver = async (event) => {
  // Only handle mouseover if the mouse actually moved
  // This prevents scroll-triggered mouseover events from interfering with keyboard navigation
  if (event.clientX === lastMouseX.value && event.clientY === lastMouseY.value) {
    return;
  }
  lastMouseX.value = event.clientX;
  lastMouseY.value = event.clientY;
  
  const target = event.target;
  if (target.nodeName === 'DIV' && target.parentElement.nodeName === 'TD') {
    const row = target.closest('tr');
    if (row && row.hasAttribute('accession')) {
      const visibleRows = getVisibleRows();
      
      // Remove highlight from all rows
      visibleRows.forEach(r => r.classList.remove('keyboard-selected'));
      
      // Add highlight to current row
      row.classList.add('keyboard-selected');
      
      // Update keyboard selection to match mouse position
      const rowIndex = visibleRows.indexOf(row);
      if (rowIndex >= 0) {
        selectedRowIndex.value = rowIndex;
      }
      
      // Check item type - only show preview for photos on hover
      // Audio/video require a click to open
      const itemType = row.classList.contains('photo') ? 'photo' : 
                      row.classList.contains('audio') ? 'audio' : 
                      row.classList.contains('video') ? 'video' : null;
      
      if (itemType === 'photo') {
        const accession = row.getAttribute('accession');
        try {
          const itemData = await window.electronAPI.getItemDetail(accession);
          if (itemData) {
            showItemDetail(itemData);
          }
        } catch (error) {
          console.error('Error getting item detail:', error);
        }
      } else if (itemType === 'audio' || itemType === 'video') {
        // Show tooltip to indicate click is required
        target.title = 'Click to open in Media Player';
      }
    }
  }
};

// Handle click on table rows (for audio/video items)
const handleTableClick = async (event) => {
  const target = event.target;
  if (target.nodeName === 'DIV' && target.parentElement.nodeName === 'TD') {
    const row = target.closest('tr');
    if (row && row.hasAttribute('accession')) {
      // Check if this is an audio or video item
      const isAudioOrVideo = row.classList.contains('audio') || row.classList.contains('video');
      
      if (isAudioOrVideo) {
        const accession = row.getAttribute('accession');
        try {
          const itemData = await window.electronAPI.getItemDetail(accession);
          if (itemData) {
            showItemDetail(itemData);
          }
        } catch (error) {
          console.error('Error getting item detail:', error);
        }
      }
    }
  }
};

// Handle double-click on table rows (toggle collection membership)
const handleDoubleClick = async (event) => {
  const target = event.target;
  if (target.nodeName === 'DIV' && target.parentElement.nodeName === 'TD') {
    const row = target.closest('tr');
    if (row && row.hasAttribute('link')) {
      const link = row.getAttribute('link');
      try {
        await window.electronAPI.toggleItemInCollection(link);
        // Reload items to update collection status
        await loadItems();
      } catch (error) {
        console.error('Error toggling collection:', error);
      }
    }
  }
};

// Show item detail in preview and detail areas
const showItemDetail = (itemObject) => {
  detailContent.value = itemObject.descDetail;
  previewContent.value = itemObject.mediaTag;
  currentFaceTags.value = itemObject.faceTags || null;
  // Don't reset detailsExpanded - preserve user's choice
  
  // Clear banner if this photo is NOT from a MediaPlayer reference
  if (!itemObject.referenceSource) {
    referenceInfo.value.isViewing = false;
    referenceInfo.value.sourceName = '';
    referenceInfo.value.timeDisplay = '';
    referenceInfo.value.sourceAccession = '';
  }
  
  // Set up event listeners after DOM updates
  nextTick(() => {
    setupDetailEventListeners();
    
    // Apply current detail visibility state to new content
    const detailElements = document.getElementsByClassName('detail');
    for (let i = 0; i < detailElements.length; i++) {
      detailElements[i].hidden = detailsExpanded.value;
    }
    
    if (showFaceTags.value && currentFaceTags.value) {
      renderFaceRegions();
    }
  });
};

// Handle edit media action (from button or menu)
const handleEditMedia = async () => {
  const linkEl = document.getElementById('link');
  if (!linkEl) {
    alert('Please select an item to edit first.');
    return;
  }
  
  const link = linkEl.innerText;
  const includeQueue = limitChecked.value; // Use Limit checkbox to determine queue
  const collectionKey = (includeQueue && selectedCollection.value) ? selectedCollection.value : null;
  const sortByValue = includeQueue ? sortBy.value : null; // Pass sort order when including queue
  await window.electronAPI.editItem(link, collectionKey, includeQueue, sortByValue);
};

// Setup event listeners for dynamically added content
const setupDetailEventListeners = () => {
  const editMediaBtn = document.getElementById('editMedia');
  if (editMediaBtn) {
    editMediaBtn.addEventListener('click', async () => {
      await handleEditMedia();
    });
  }
  
  const openWebsiteBtn = document.getElementById('openWebsite');
  if (openWebsiteBtn) {
    openWebsiteBtn.addEventListener('click', async () => {
      await window.electronAPI.openWebsite();
    });
  }
  
  // Setup person link listeners
  const personLinks = document.querySelectorAll('.person-link');
  personLinks.forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const tmgid = e.currentTarget.getAttribute('data-tmgid');
      console.log('Person link clicked, TMGID:', tmgid);
      if (tmgid && window.electronAPI.openPersonLink) {
        try {
          const result = await window.electronAPI.openPersonLink(tmgid);
          console.log('openPersonLink result:', result);
        } catch (error) {
          console.error('Error opening person link:', error);
        }
      } else {
        console.error('openPersonLink not available or no TMGID');
      }
    });
  });
  
  // Setup playlist entry listeners
  const playEntries = document.querySelectorAll('.playEntry');
  playEntries.forEach(entry => {
    entry.addEventListener('click', handlePlayEntry);
    entry.style.cursor = 'pointer';
  });
};

// Handle playlist entry click (changed from mouseover)
const handlePlayEntry = async (event) => {
  const row = event.currentTarget.closest('tr');
  if (row) {
    // Get source item link from the current display
    const linkElement = document.getElementById('link');
    const sourceLink = linkElement ? linkElement.innerText : '';
    
    const entry = {
      ref: row.querySelector('#playlink')?.innerText || '',
      start: row.querySelector('#playstart')?.innerText || '',
      duration: row.querySelector('#playduration')?.innerText || '',
      sourceLink: sourceLink  // Pass source link for MediaPlayer banner
    };
    
    // Don't show banner in MainWindow when clicking playlist locally
    // Banner only shows when photo comes FROM MediaPlayer
    
    try {
      await window.electronAPI.playItem(entry);
    } catch (error) {
      console.error('Error playing item:', error);
    }
  }
};

// Dismiss reference banner and return to normal viewing
const dismissReference = () => {
  referenceInfo.value.isViewing = false;
  referenceInfo.value.sourceName = '';
  referenceInfo.value.timeDisplay = '';
  referenceInfo.value.sourceAccession = '';
};

// Toggle detail visibility
const toggleDetailVisibility = () => {
  const detailElements = document.getElementsByClassName('detail');
  detailsExpanded.value = !detailsExpanded.value;
  
  for (let i = 0; i < detailElements.length; i++) {
    // detailsExpanded = false means show all details (default/full view)
    // detailsExpanded = true means hide details (shortened view)
    detailElements[i].hidden = detailsExpanded.value;
  }
};

// Face tags rendering
const renderFaceRegions = () => {
  // Remove existing container if any
  const existingContainer = document.getElementById('faceRegionsContainer');
  if (existingContainer) {
    existingContainer.remove();
  }
  
  // Don't render if face tags are disabled
  if (!showFaceTags.value) {
    return;
  }
  
  if (!currentFaceTags.value || currentFaceTags.value.length === 0) {
    return;
  }
  
  const img = document.getElementById('previewImg');
  if (!img) {
    return; // Not a photo
  }
  
  // Wait for image to load to get dimensions
  if (!img.complete) {
    img.onload = () => renderFaceRegions();
    return;
  }
  
  // Create overlay container
  const container = document.createElement('div');
  container.id = 'faceRegionsContainer';
  
  // Get natural image dimensions (original size)
  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;
  
  // Get displayed dimensions and position
  const imgRect = img.getBoundingClientRect();
  const previewDiv = document.getElementById('previewDiv');
  const previewRect = previewDiv.getBoundingClientRect();
  
  // Calculate scale factor - object-fit: contain uses uniform scale (the minimum)
  const scale = Math.min(imgRect.width / naturalWidth, imgRect.height / naturalHeight);
  
  // Calculate actual displayed image size
  const displayedWidth = naturalWidth * scale;
  const displayedHeight = naturalHeight * scale;
  
  // Calculate offset - image is centered within the img element
  const offsetLeft = imgRect.left - previewRect.left + (imgRect.width - displayedWidth) / 2;
  const offsetTop = imgRect.top - previewRect.top + (imgRect.height - displayedHeight) / 2;
  
  // Render each face tag
  currentFaceTags.value.forEach(tag => {
    const { index, name, region } = tag;
    
    // MWG region format: center point (x, y) + width/height, all normalized 0-1
    // Convert from center to top-left for CSS positioning
    const centerX = region.x * naturalWidth;
    const centerY = region.y * naturalHeight;
    const boxWidth = region.w * naturalWidth;
    const boxHeight = region.h * naturalHeight;
    
    // Calculate top-left corner from center point
    const leftNatural = centerX - (boxWidth / 2);
    const topNatural = centerY - (boxHeight / 2);
    
    // Scale to displayed size and add offset
    const left = offsetLeft + (leftNatural * scale);
    const top = offsetTop + (topNatural * scale);
    const width = boxWidth * scale;
    const height = boxHeight * scale;
    
    // Create box element
    const box = document.createElement('div');
    box.className = 'face-tag-box';
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    
    // Create number badge
    const number = document.createElement('div');
    number.className = 'face-tag-number';
    number.textContent = index;
    box.appendChild(number);
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'face-tag-tooltip';
    tooltip.textContent = name;
    box.appendChild(tooltip);
    
    container.appendChild(box);
  });
  
  if (previewDiv) {
    previewDiv.appendChild(container);
  }
};

// Handle face tags checkbox change
const handleFaceRegionsChange = async () => {
  if (showFaceTags.value && currentFaceTags.value) {
    nextTick(() => renderFaceRegions());
  } else {
    const container = document.getElementById('faceRegionsContainer');
    if (container) {
      container.remove();
    }
  }
  
  // Save the state
  const controls = {
    photoChecked: photoChecked.value,
    audioChecked: audioChecked.value,
    videoChecked: videoChecked.value,
    limitChecked: collections.value.length > 0 ? limitChecked.value : false,
    selectedCollection: collections.value.length > 0 ? selectedCollection.value : '',
    showFaceTags: showFaceTags.value
  };
  
  try {
    await window.electronAPI.updateControls(controls);
  } catch (error) {
    console.error('Error saving face tags state:', error);
  }
  
  // Restore focus to main container
  nextTick(() => {
    const mainContainer = document.getElementById('main');
    if (mainContainer) {
      mainContainer.focus();
    }
  });
};

// Slideshow functions
const getPhotoIndices = () => {
  const visibleRows = getVisibleRows();
  const photoIndices = [];
  
  visibleRows.forEach((row, index) => {
    if (row.classList.contains('photo')) {
      photoIndices.push(index);
    }
  });
  
  return photoIndices;
};

const getNextPhotoIndex = () => {
  const photoIndices = getPhotoIndices();
  if (photoIndices.length === 0) return -1;
  
  // Random mode
  if (isRandomMode.value) {
    // If we've seen all photos, reset
    if (visitedIndices.value.size >= photoIndices.length) {
      visitedIndices.value.clear();
    }
    
    // Find unvisited photos
    const unvisited = photoIndices.filter(idx => !visitedIndices.value.has(idx));
    
    if (unvisited.length === 0) {
      // All visited, pick random
      const randomIdx = Math.floor(Math.random() * photoIndices.length);
      visitedIndices.value.add(photoIndices[randomIdx]);
      return photoIndices[randomIdx];
    }
    
    // Pick random from unvisited
    const randomIdx = Math.floor(Math.random() * unvisited.length);
    const selectedIndex = unvisited[randomIdx];
    visitedIndices.value.add(selectedIndex);
    return selectedIndex;
  }
  
  // Sequential mode
  const currentPhotoIdx = photoIndices.indexOf(selectedRowIndex.value);
  
  if (currentPhotoIdx === -1) {
    // Current row is not a photo, start from beginning or end based on direction
    return cycleDirection.value === 1 ? photoIndices[0] : photoIndices[photoIndices.length - 1];
  }
  
  // Forward direction
  if (cycleDirection.value === 1) {
    const nextIdx = currentPhotoIdx + 1;
    return nextIdx >= photoIndices.length ? photoIndices[0] : photoIndices[nextIdx];
  }
  
  // Backward direction
  const prevIdx = currentPhotoIdx - 1;
  return prevIdx < 0 ? photoIndices[photoIndices.length - 1] : photoIndices[prevIdx];
};

const cycleToNextPhoto = async () => {
  const nextIndex = getNextPhotoIndex();
  if (nextIndex !== -1) {
    highlightRow(nextIndex);
    await selectCurrentRow();
  } else {
    // No photos to cycle through, stop slideshow
    stopAutoCycle();
  }
};

const startAutoCycle = () => {
  if (isAutoCycling.value) return; // Already cycling
  
  const visibleRows = getVisibleRows();
  if (visibleRows.length === 0) return;
  
  // If no row selected, start from first photo
  if (selectedRowIndex.value === -1) {
    const firstPhotoIndex = getNextPhotoIndex();
    if (firstPhotoIndex !== -1) {
      highlightRow(firstPhotoIndex);
      selectCurrentRow();
    } else {
      return; // No photos to cycle
    }
  }
  
  isAutoCycling.value = true;
  isPhotoFrameMode.value = true; // Enter photo frame mode
  showSlideshowIndicator.value = true;

  if (window.electronAPI?.setSlideshowDisplaySleepBlock) {
    window.electronAPI.setSlideshowDisplaySleepBlock(true).catch(() => {});
  }
  
  // Hide face tags during slideshow
  if (showFaceTags.value) {
    showFaceTags.value = false;
    handleFaceRegionsChange();
  }
  
  // Show tooltip with keyboard shortcuts
  showSlideshowTooltip.value = true;
  clearTimeout(slideshowTooltipTimeout.value);
  slideshowTooltipTimeout.value = setTimeout(() => {
    showSlideshowTooltip.value = false;
  }, 4000); // Show for 4 seconds
  
  cycleTimer.value = setInterval(cycleToNextPhoto, cycleInterval.value * 1000);
  
  // Auto-hide speed indicator after 3 seconds
  clearTimeout(slideshowIndicatorTimeout.value);
  slideshowIndicatorTimeout.value = setTimeout(() => {
    showSlideshowIndicator.value = false;
  }, 3000);
};

const stopAutoCycle = () => {
  isAutoCycling.value = false;
  isPhotoFrameMode.value = false; // Exit photo frame mode
  showSlideshowIndicator.value = true;

  if (window.electronAPI?.setSlideshowDisplaySleepBlock) {
    window.electronAPI.setSlideshowDisplaySleepBlock(false).catch(() => {});
  }
  
  // Hide tooltip if showing
  showSlideshowTooltip.value = false;
  clearTimeout(slideshowTooltipTimeout.value);
  
  if (cycleTimer.value) {
    clearInterval(cycleTimer.value);
    cycleTimer.value = null;
  }
  
  // Show indicator briefly when stopped
  clearTimeout(slideshowIndicatorTimeout.value);
  slideshowIndicatorTimeout.value = setTimeout(() => {
    showSlideshowIndicator.value = false;
  }, 2000);
};

const reverseDirection = () => {
  cycleDirection.value *= -1; // Toggle between 1 and -1
  showSlideshowIndicator.value = true;
  
  // Auto-hide indicator after 2 seconds
  clearTimeout(slideshowIndicatorTimeout.value);
  slideshowIndicatorTimeout.value = setTimeout(() => {
    showSlideshowIndicator.value = false;
  }, 2000);
};

const toggleRandomMode = () => {
  isRandomMode.value = !isRandomMode.value;
  
  // Clear visited indices when toggling mode
  if (isRandomMode.value) {
    visitedIndices.value.clear();
    visitedIndices.value.add(selectedRowIndex.value); // Mark current as visited
  }
  
  showSlideshowIndicator.value = true;
  
  // Auto-hide indicator after 2 seconds
  clearTimeout(slideshowIndicatorTimeout.value);
  slideshowIndicatorTimeout.value = setTimeout(() => {
    showSlideshowIndicator.value = false;
  }, 2000);
};

const adjustCycleSpeed = (delta) => {
  const newInterval = Math.max(1, Math.min(30, cycleInterval.value + delta));
  if (newInterval === cycleInterval.value) return; // No change
  
  cycleInterval.value = newInterval;
  showSlideshowIndicator.value = true;
  
  // Restart timer with new interval if currently cycling
  if (isAutoCycling.value && cycleTimer.value) {
    clearInterval(cycleTimer.value);
    cycleTimer.value = setInterval(cycleToNextPhoto, cycleInterval.value * 1000);
  }
  
  // Auto-hide indicator after 2 seconds
  clearTimeout(slideshowIndicatorTimeout.value);
  slideshowIndicatorTimeout.value = setTimeout(() => {
    showSlideshowIndicator.value = false;
  }, 2000);
};

// Keyboard navigation functions
const getVisibleRows = () => {
  const tableDiv = document.querySelector('#tableDiv');
  if (!tableDiv) return [];
  
  const allRows = Array.from(tableDiv.getElementsByTagName('tr'));
  return allRows.filter(row => !row.hidden && row.hasAttribute('accession'));
};

const highlightRow = (index) => {
  const visibleRows = getVisibleRows();
  
  // Remove previous highlight from all rows
  visibleRows.forEach(row => row.classList.remove('keyboard-selected'));
  
  if (index >= 0 && index < visibleRows.length) {
    const row = visibleRows[index];
    
    // Add highlight class
    row.classList.add('keyboard-selected');
    
    // Scroll into view if needed
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    
    selectedRowIndex.value = index;
  }
};

const selectCurrentRow = async () => {
  const visibleRows = getVisibleRows();
  const row = visibleRows[selectedRowIndex.value];
  
  if (row && row.hasAttribute('accession')) {
    // Check item type - only show preview for photos on keyboard navigation
    // Audio/video require Enter key to open
    const itemType = row.classList.contains('photo') ? 'photo' : 
                    row.classList.contains('audio') ? 'audio' : 
                    row.classList.contains('video') ? 'video' : null;
    
    if (itemType === 'photo') {
      const accession = row.getAttribute('accession');
      try {
        const itemData = await window.electronAPI.getItemDetail(accession);
        if (itemData) {
          showItemDetail(itemData);
        }
      } catch (error) {
        console.error('Error getting item detail:', error);
      }
    } else if (itemType === 'audio' || itemType === 'video') {
      // Set tooltip for audio/video items
      row.title = 'Press Enter to open in Media Player';
    }
  }
};

// Restore focus to main container for keyboard shortcuts
const restoreFocus = () => {
  const mainContainer = document.getElementById('main');
  if (mainContainer) {
    mainContainer.focus();
  }
};

const handleKeyDown = async (event) => {
  // Don't handle if user is typing in an input/select
  const target = event.target;
  if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
    return;
  }
  
  // F1 - Open documentation
  if (event.key === 'F1') {
    event.preventDefault();
    window.electronAPI.openDocumentation();
    return;
  }
  
  // Escape key - exit photo frame mode (and stop slideshow if active)
  if (event.key === 'Escape') {
    if (isPhotoFrameMode.value || isAutoCycling.value) {
      event.preventDefault();
      if (isAutoCycling.value) {
        stopAutoCycle();
      } else {
        isPhotoFrameMode.value = false;
      }
      return;
    }
  }
  
  // Backspace - reverse direction (only when slideshow is active)
  if (event.key === 'Backspace') {
    if (isAutoCycling.value) {
      event.preventDefault();
      reverseDirection();
      return;
    }
  }
  
  // Slideshow controls - spacebar to toggle
  if (event.key === ' ') {
    event.preventDefault();
    if (isAutoCycling.value) {
      stopAutoCycle();
    } else {
      startAutoCycle();
    }
    return;
  }
  
  // Ctrl+Shift+R for random mode toggle
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'r') {
    event.preventDefault();
    toggleRandomMode();
    return;
  }
  
  // Ctrl+Shift+P/A/V/F for filter toggles
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'p') {
    event.preventDefault();
    photoChecked.value = !photoChecked.value;
    await handleControlsChanged();
    return;
  }
  
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    audioChecked.value = !audioChecked.value;
    await handleControlsChanged();
    return;
  }
  
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'v') {
    event.preventDefault();
    videoChecked.value = !videoChecked.value;
    await handleControlsChanged();
    return;
  }
  
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'l') {
    event.preventDefault();
    limitChecked.value = !limitChecked.value;
    await handleControlsChanged();
    return;
  }
  
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    showFaceTags.value = !showFaceTags.value;
    handleFaceRegionsChange();
    return;
  }
  
  // Navigation keys - only process if we have visible rows
  const visibleRows = getVisibleRows();
  if (visibleRows.length === 0) return;
  
  switch(event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      // When slideshow is active, decrease speed
      if (isAutoCycling.value) {
        adjustCycleSpeed(-1); // Slower
      }
      break;
      
    case 'ArrowRight':
      event.preventDefault();
      // When slideshow is active, increase speed
      if (isAutoCycling.value) {
        adjustCycleSpeed(1); // Faster
      }
      break;
      
    case 'ArrowDown':
      event.preventDefault();
      // Stop slideshow if active, then navigate
      if (isAutoCycling.value) {
        stopAutoCycle();
      }
      if (selectedRowIndex.value < visibleRows.length - 1) {
        highlightRow(selectedRowIndex.value + 1);
        await selectCurrentRow();
      }
      break;
      
    case 'ArrowUp':
      event.preventDefault();
      // Stop slideshow if active, then navigate
      if (isAutoCycling.value) {
        stopAutoCycle();
      }
      if (selectedRowIndex.value > 0) {
        highlightRow(selectedRowIndex.value - 1);
        await selectCurrentRow();
      } else if (selectedRowIndex.value === -1 && visibleRows.length > 0) {
        highlightRow(0);
        await selectCurrentRow();
      }
      break;
      
    case 'PageDown':
      event.preventDefault();
      const nextIndex = Math.min(selectedRowIndex.value + 15, visibleRows.length - 1);
      highlightRow(nextIndex);
      await selectCurrentRow();
      break;
      
    case 'PageUp':
      event.preventDefault();
      const prevIndex = Math.max(selectedRowIndex.value - 15, 0);
      highlightRow(prevIndex);
      await selectCurrentRow();
      break;
      
    case 'Home':
      event.preventDefault();
      highlightRow(0);
      await selectCurrentRow();
      break;
      
    case 'End':
      event.preventDefault();
      highlightRow(visibleRows.length - 1);
      await selectCurrentRow();
      break;
      
    case 'Enter':
      event.preventDefault();
      // Open audio/video items in MediaPlayer, or show photo details
      const currentRow = visibleRows[selectedRowIndex.value];
      if (currentRow && currentRow.hasAttribute('accession')) {
        const itemType = currentRow.classList.contains('photo') ? 'photo' : 
                        currentRow.classList.contains('audio') ? 'audio' : 
                        currentRow.classList.contains('video') ? 'video' : null;
        
        if (itemType === 'audio' || itemType === 'video') {
          // Open audio/video in MediaPlayer
          const accession = currentRow.getAttribute('accession');
          try {
            await window.electronAPI.getItemDetail(accession);
          } catch (error) {
            console.error('Error opening item:', error);
          }
        } else if (itemType === 'photo') {
          // For photos, Enter just ensures preview is shown (already done by selectCurrentRow)
          await selectCurrentRow();
        }
      }
      break;
  }
};

// Initialize on mount
onMounted(() => {
  // Load items - preserveSort=true means don't send sort to server, let it use saved value
  loadItems(true);
  
  // Auto-focus the container for keyboard navigation
  nextTick(() => {
    const mainContainer = document.getElementById('main');
    if (mainContainer) {
      mainContainer.focus();
    }
  });
  
  // Listen for item detail messages (e.g., photo references from MediaPlayer)
  window.electronAPI.onItemDetail((viewObject) => {
    // Display the photo in the preview and detail areas
    previewContent.value = viewObject.mediaTag;
    detailContent.value = viewObject.descDetail;
    currentFaceTags.value = viewObject.faceTags || null;
    // Don't reset detailsExpanded - preserve user's choice
    
    // Show reference banner when photo comes from MediaPlayer
    if (viewObject.referenceSource) {
      referenceInfo.value = {
        isViewing: true,
        sourceName: viewObject.referenceSource.link || 'Unknown',
        timeDisplay: viewObject.referenceSource.time || '',
        sourceAccession: ''
      };
    }
    
    // Setup event listeners after DOM updates
    nextTick(() => {
      setupDetailEventListeners();
      
      // Apply current detail visibility state to new content
      const detailElements = document.getElementsByClassName('detail');
      for (let i = 0; i < detailElements.length; i++) {
        detailElements[i].hidden = detailsExpanded.value;
      }
      
      if (showFaceTags.value && currentFaceTags.value) {
        renderFaceRegions();
      }
    });
  });
  
  // Listen for items reload/refresh messages (preserves UI state)
  window.electronAPI.onItemsRender((data) => {
    // Parse if it's a string
    const listObject = typeof data === 'string' ? JSON.parse(data) : data;
    
    // If it's a reload signal, reload items with current sort
    if (listObject && listObject.reload) {
      loadItems();
    } else {
      // Otherwise render the provided list
      renderItems(listObject);
    }
  });
  
  // Listen for person saved event (to refresh person names in nav)
  window.electronAPI.onPersonSaved(() => {
    // Reload items to refresh person names in the navigation column
    loadItems();
  });
  
  // Listen for menu-triggered edit media command
  window.electronAPI.onEditMedia(async () => {
    await handleEditMedia();
  });
  
  // Rerender face tags on window resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    // Debounce resize events
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (showFaceTags.value && currentFaceTags.value) {
        renderFaceRegions();
      }
    }, 100);
  });
  
  // Pause slideshow when window loses focus
  let wasAutoCyclingBeforeBlur = false;
  window.addEventListener('blur', () => {
    if (isAutoCycling.value) {
      wasAutoCyclingBeforeBlur = true;
      // Pause cycling but keep photo frame mode active
      if (cycleTimer.value) {
        clearInterval(cycleTimer.value);
        cycleTimer.value = null;
      }
      isAutoCycling.value = false;
      showSlideshowIndicator.value = true;

      if (window.electronAPI?.setSlideshowDisplaySleepBlock) {
        window.electronAPI.setSlideshowDisplaySleepBlock(false).catch(() => {});
      }
      
      // Auto-hide indicator
      clearTimeout(slideshowIndicatorTimeout.value);
      slideshowIndicatorTimeout.value = setTimeout(() => {
        showSlideshowIndicator.value = false;
      }, 2000);
    }
  });
  
  // Resume slideshow when window regains focus
  window.addEventListener('focus', () => {
    if (wasAutoCyclingBeforeBlur && isPhotoFrameMode.value) {
      wasAutoCyclingBeforeBlur = false;
      isAutoCycling.value = true;
      showSlideshowIndicator.value = true;
      cycleTimer.value = setInterval(cycleToNextPhoto, cycleInterval.value * 1000);

      if (window.electronAPI?.setSlideshowDisplaySleepBlock) {
        window.electronAPI.setSlideshowDisplaySleepBlock(true).catch(() => {});
      }
      
      // Auto-hide indicator
      clearTimeout(slideshowIndicatorTimeout.value);
      slideshowIndicatorTimeout.value = setTimeout(() => {
        showSlideshowIndicator.value = false;
      }, 2000);
    }
  });
});

// Cleanup on unmount
onUnmounted(() => {
  // Stop slideshow and clear timers
  if (cycleTimer.value) {
    clearInterval(cycleTimer.value);
  }
  if (slideshowIndicatorTimeout.value) {
    clearTimeout(slideshowIndicatorTimeout.value);
  }
  if (slideshowTooltipTimeout.value) {
    clearTimeout(slideshowTooltipTimeout.value);
  }

  if (window.electronAPI?.setSlideshowDisplaySleepBlock) {
    window.electronAPI.setSlideshowDisplaySleepBlock(false).catch(() => {});
  }
});
</script>

<style>
/* Import the existing index.css styles */

/* Reference banner styles */
.reference-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: #E8F4F8;
  border: 1px solid #4A90A4;
  border-radius: 4px;
  padding: 8px 12px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #2C5F6F;
}

.reference-banner-mainwindow {
  position: fixed !important;
  top: 20px !important;
  left: 30% !important;
  right: auto !important;
  width: max-content !important;
  max-width: 70% !important;
  height: auto !important;
  margin: 0 !important;
  z-index: 99999 !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
  pointer-events: auto !important;
  display: flex !important;
  opacity: 1 !important;
  visibility: visible !important;
}

.reference-banner-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.reference-banner-text {
  flex-grow: 1;
}

.reference-banner-close {
  background: transparent;
  border: none;
  font-size: 20px;
  color: #2C5F6F;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  flex-shrink: 0;
}

.reference-banner-close:hover {
  background-color: #D0E8EF;
  color: #2C5F6F;
}

A:link {
  color: Navy;
}

A:visited {
  color: Navy;
}

#detailDiv {
  font-size: smaller;
  font-family: Arial, helvetica, sans-serif;
}

#previewDiv {
  position: sticky;
  height: 70%;
  width: 100%;
}

#previewImg {
  height: 100%;
  width: 100%;
  object-fit: contain;
}

#previewVideo {
  height: 100%;
  width: 100%;
}

#prevDataDiv {
  overflow-y: auto;
  height: 30%;
  transition: opacity 0.3s ease-in-out;
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
  white-space: nowrap;
}

.dateRight {
  width: 8%;
  float: right;
}

.dateData {
  text-align: right;
  white-space: nowrap;
}

.descData {
  word-wrap: normal;
}

.photo {
  background: #eeeeff;
}

.bottomLeft .photoInput {
  background: #eeeeff;
  accent-color: #eeeeff;
}

.audio {
  background: #f1e6c2;
}

.bottomLeft .tapeInput {
  background: #f1e6c2;
  accent-color: #f1e6c2;
}

.video {
  background: #fab2b8;
}

.bottomLeft .videoInput {
  background: #fab2b8;
  accent-color: #fab2b8;
}

.emphasize {
  font-weight: bold;
}

.firstRow {
  height: 20px;
  font-weight: bolder;
}

.container {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}

.header {
  position: absolute;
  height: 20px;
  width: 100%;
  text-align: center;
  font-weight: bold;
  background: #aabbff;
}

.hidden {
  display: none;
}

#tableDiv table {
  color: Black;
  font-size: smaller;
  font-family: Arial, helvetica, sans-serif;
  border-spacing: 0;
}

.maintable {
  width: 100%;
}

#navHeader {
  float: left;
  width: 30%;
}

#column1 {
  float: left;
}

#column2 {
  margin-right: 20px;
}

#previewHeader {
  float: right;
  width: 70%;
}

.contentLeft {
  position: absolute;
  top: 20px;
  bottom: 20px;
  left: 0;
  width: 30%;
  overflow: auto;
  background: #CCCCFF;
}

.contentRight {
  position: absolute;
  top: 20px;
  bottom: 20px;
  right: 0;
  width: 70%;
  overflow: auto;
  background: #eeeeff;
}

.bottomLeft {
  position: fixed;
  bottom: 0;
  left: 0;
  height: 20px;
  background: #aabbff;
}

#tableSort {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

#tableSort label {
  display: flex;
  align-items: center;
  gap: 5px;
}

/* Face Tags Overlay */
#faceTagsContainer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.face-tag-box {
  position: absolute;
  border: 2px solid #FF6600;
  background: rgba(255, 102, 0, 0.1);
  pointer-events: all;
  cursor: pointer;
}

.face-tag-number {
  position: absolute;
  top: -20px;
  left: 0;
  background: #FF6600;
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: bold;
  font-family: Arial, sans-serif;
}

.face-tag-box:hover {
  background: rgba(255, 102, 0, 0.3);
  border-color: #FF3300;
}

.face-tag-tooltip {
  position: absolute;
  top: -45px;
  left: 0;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  display: none;
  pointer-events: none;
  z-index: 1000;
}

.face-tag-box:hover .face-tag-tooltip {
  display: block;
}

/* Make preview div relative for absolute positioning */
#previewDiv {
  position: relative;
}

/* Keyboard/mouse navigation highlight */
.keyboard-selected {
  outline: 2px solid #4A90E2 !important;
  outline-offset: -2px;
}

/* Remove focus outline from main container */
.container:focus {
  outline: none;
}

/* Slideshow indicator overlay */
.slideshow-indicator {
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.75);
  color: white;
  padding: 12px 20px;
  border-radius: 6px;
  font-size: 18px;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: opacity 0.3s ease;
}

.slideshow-icon {
  font-size: 20px;
}

.slideshow-speed {
  font-family: monospace;
  min-width: 3ch;
}

/* Slideshow keyboard shortcuts tooltip */
.slideshow-tooltip {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 20px 30px;
  border-radius: 8px;
  z-index: 1001;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  animation: fadeIn 0.3s ease, fadeOut 0.5s ease 3.5s forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

.slideshow-tooltip-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 12px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  padding-bottom: 8px;
}

.slideshow-tooltip-shortcuts {
  display: grid;
  gap: 8px;
  font-size: 14px;
}

.slideshow-tooltip-shortcuts div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slideshow-tooltip kbd {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  padding: 2px 8px;
  font-family: monospace;
  font-size: 12px;
  min-width: 60px;
  text-align: center;
  display: inline-block;
}

/* Photo frame mode - full screen preview */
.photo-frame-mode #detailDiv {
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  width: 100%;
}

.photo-frame-mode #previewDiv {
  height: 85%;
}

.photo-frame-mode #prevDataDiv {
  height: 15%;
}
</style>
