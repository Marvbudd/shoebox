<template>
  <div id="media-manager" class="container">
    <!-- Confirmation Modal -->
    <div v-if="showConfirmModal" class="modal-overlay" @click="handleModalCancel">
      <div class="modal-dialog" @click.stop>
        <div class="modal-header">
          <h3>{{ confirmModalTitle }}</h3>
        </div>
        <div class="modal-body">
          {{ confirmModalMessage }}
        </div>
        <div class="modal-footer">
          <button @click="handleModalOk" class="btn-modal-ok">{{ confirmOkText }}</button>
          <button @click="handleModalCancel" class="btn-modal-cancel">{{ confirmCancelText }}</button>
        </div>
      </div>
    </div>

    <!-- Delete Review Modal -->
    <div v-if="showDeleteModal" class="modal-overlay" @click="closeDeleteModal">
      <div class="modal-dialog delete-modal" @click.stop>
        <div class="modal-header">
          <h3>Delete Item</h3>
        </div>
        <div class="modal-body delete-modal-body">
          <p class="delete-modal-warning">This cannot be undone.</p>
          <div class="delete-modal-detail">
            <strong>Archive path:</strong>
            <div class="delete-modal-path">{{ deleteInfo.mediaPath }}</div>
          </div>
          <div v-if="deleteInfo.isSymlink" class="delete-modal-detail">
            <strong>Symlink:</strong>
            <div class="delete-modal-path">{{ deleteInfo.symlinkPath }}</div>
          </div>
          <div v-if="deleteInfo.isSymlink && deleteInfo.targetExists" class="delete-modal-detail">
            <strong>Target:</strong>
            <div class="delete-modal-path">{{ deleteInfo.targetPath }}</div>
          </div>
          <div class="delete-modal-detail">
            <strong>File size:</strong>
            <span>{{ formattedFileSize }}</span>
          </div>
          <p v-if="!deleteInfo.fileExists" class="delete-modal-missing">The file is already missing from the filesystem.</p>
        </div>
        <div class="modal-footer delete-modal-footer">
          <button
            v-if="!deleteInfo.archiveEntryExists"
            @click="confirmDelete('metadata-only')"
            class="btn-modal-ok"
            :disabled="deleting"
          >
            Delete Metadata
          </button>
          <template v-else-if="deleteInfo.isSymlink">
            <button
              @click="confirmDelete('trash-symlink')"
              class="btn-modal-alt-danger"
              :disabled="deleting"
            >
              Delete Item + Symlink
            </button>
            <button
              v-if="deleteInfo.targetExists"
              @click="confirmDelete('trash-symlink-and-target')"
              class="btn-modal-ok"
              :disabled="deleting"
            >
              Delete Item + Symlink + Target
            </button>
          </template>
          <button
            v-else
            @click="confirmDelete('trash-file')"
            class="btn-modal-ok"
            :disabled="deleting"
          >
            Delete Item + File
          </button>
          <button @click="closeDeleteModal" class="btn-modal-cancel" :disabled="deleting">Cancel</button>
        </div>
      </div>
    </div>

    <header>
      <h1>Media Manager</h1>
      <p class="subtitle">Edit media item metadata</p>
    </header>

    <div class="content" :class="{ 'content-batch-locked': faceProcessingControlsDisabled }">
      <div v-if="loading" class="loading">Loading item...</div>
      
      <div v-else-if="error" class="error-box">
        <strong>Error:</strong> {{ error }}
      </div>

      <form v-else @submit.prevent="handleSave" class="media-form">
        <div class="two-column-layout">
          <!-- LEFT COLUMN: Form Fields and People -->
          <div class="left-column">
            <!-- Unresolved/excluded faces section -->
            <div v-if="item.type === 'photo' && getFaceCandidatesLeftToRight().length > 0" class="unassigned-faces-section">
              <div class="unassigned-faces-header">
                <strong>⚠️ {{ getFaceCandidatesLeftToRight().length }} face(s) not yet assigned</strong>
                <div class="unassigned-faces-header-actions">
                  <span class="unassigned-faces-hint">L→R order • Hover to preview • Click to search</span>
                  <button
                    v-if="showClearFaceData"
                    type="button"
                    class="btn-danger btn-clear-compact"
                    @click="clearFaceData"
                    title="Discard unresolved/excluded face candidate work from this item"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div class="face-badges">
                <div
                  v-for="face in getFaceCandidatesLeftToRight()"
                  :key="face.faceIndex"
                  class="face-badge-group"
                >
                  <button
                    @click="handleFaceBadgeClick(face.faceIndex)"
                    @mouseenter="handleFaceBadgeHover(face.faceIndex)"
                    @mouseleave="handleFaceBadgeLeave()"
                    class="face-badge-button"
                    :disabled="faceProcessingControlsDisabled"
                    :class="{ excluded: face.isExcluded }"
                    type="button"
                    :title="face.isExcluded ? 'Excluded from matching (still assignable)' : 'Unresolved face candidate'"
                  >
                    Face #{{ face.faceIndex + 1 }}
                    <span v-if="typeof face.confidence === 'number'"> ({{ Math.round(face.confidence * 100) }}%)</span>
                    <span v-if="face.isExcluded"> Excluded</span>
                  </button>
                  <button
                    class="face-badge-discard"
                    type="button"
                    :disabled="faceProcessingControlsDisabled"
                    @click="discardUnassignedFace(face.faceIndex)"
                    @mouseenter="handleFaceBadgeHover(face.faceIndex)"
                    @mouseleave="handleFaceBadgeLeave()"
                    title="Discard this face candidate"
                  >
                    Discard
                  </button>
                  <button
                    v-if="getCandidateIDForFaceIndex(face.faceIndex)"
                    class="face-badge-discard"
                    type="button"
                    :disabled="faceProcessingControlsDisabled"
                    @click="face.isExcluded ? includeUnassignedFace(face.faceIndex) : excludeUnassignedFace(face.faceIndex)"
                    @mouseenter="handleFaceBadgeHover(face.faceIndex)"
                    @mouseleave="handleFaceBadgeLeave()"
                    :title="face.isExcluded ? 'Re-enable this face candidate for matching' : 'Exclude this face candidate from matching without deleting it'"
                  >
                    {{ face.isExcluded ? 'Include' : 'Exclude' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- People List -->
            <div class="face-people-section">
            <div class="face-people-header">
              <h3>People in This Item</h3>
              <div class="people-header-actions">
                <button
                  v-if="item.type === 'photo' && selectedFaceAssignmentsCount > 0"
                  type="button"
                  class="btn-assign-selected"
                  @click="assignSelectedFaces"
                >
                  Assign selected faces ({{ selectedFaceAssignmentsCount }})
                </button>
                <button
                  v-if="showClearUnassignedPersons"
                  type="button"
                  class="btn-danger btn-clear-face-data btn-clear-compact"
                  @click="clearUnassignedPersons"
                  title="Remove person rows that do not currently have face assignments from this item"
                >
                  Clear Unassigned
                </button>
              </div>
            </div>
            <p v-if="item.type === 'photo'" class="hint">Click "+ Add Person" below, select who they are, then use the "Assign Face" dropdown to match detected faces. {{ detectedFaces.length > 0 ? 'Match confidence shown in %.': 'Use "Detect Faces (This Photo)" in the controls below the photo preview to enable face matching.' }}</p>
            <p v-else class="hint">Click "+ Add Person" below to add people appearing or speaking in this {{ item.type }}. Use the position field to note their role or appearance.</p>
            
            <!-- People list rendered without its own scrollbar -->
            <div class="people-list-container">
              <div v-for="(person, index) in item.person" :key="`person-${index}-${person.personID || 'new'}`" class="person-face-row">
              <div class="person-reorder-controls">
                <button 
                  type="button" 
                  @click.stop.prevent="movePersonUp(index)" 
                  :disabled="index === 0"
                  class="btn-reorder"
                  title="Move up"
                >
                  ▲
                </button>
                <button 
                  type="button" 
                  @click.stop.prevent="movePersonDown(index)" 
                  :disabled="index === item.person.length - 1"
                  class="btn-reorder"
                  title="Move down"
                >
                  ▼
                </button>
              </div>
              <div class="person-info">
                <PersonSelectButton
                  :text="person.personID ? getPersonDisplayName(persons.find(p => p.personID === person.personID)) : '-- Select Person --'"
                  :hasValue="!!person.personID"
                  :disabled="faceProcessingControlsDisabled || getMatchForPerson(person.personID) !== undefined"
                  @click="!faceProcessingControlsDisabled && getMatchForPerson(person.personID) === undefined ? openPersonManagerForSelection(index) : null"
                />
                <button 
                  type="button"
                  @click="openPersonManager(person.personID)"
                  class="btn-open-person"
                  :disabled="faceProcessingControlsDisabled"
                  :title="person.personID ? 'Open this person in Person Manager' : 'Open Person Manager'"
                >
                  👤
                </button>
                <input 
                  v-model="person.position" 
                  type="text"
                  placeholder="Position"
                  class="person-context"
                  :disabled="false"
                />
              </div>
              
              <div v-if="item.type === 'photo'" class="face-match-indicator" :class="{ 'face-controls-disabled': detectedFaces.length === 0 }">
                <div class="face-info-display">
                  <span 
                    v-if="getMatchForPerson(person.personID)" 
                    class="matched-indicator"
                    @mouseenter="handleFaceFieldHover(getMatchForPerson(person.personID).faceIndex)"
                    @mouseleave="handleFaceFieldLeave()"
                  >
                    Face #{{ getMatchForPerson(person.personID).faceIndex + 1 }} ({{ Math.round((getMatchForPerson(person.personID).confidence || 0) * 100) }}%)
                  </span>
                  <span v-else-if="person.personID && detectedFaces.length > 0" class="unmatched-indicator">
                    <select 
                      v-model.number="faceAssignments[person.personID]" 
                      class="face-select-small"
                      :disabled="faceProcessingControlsDisabled"
                      @mouseenter="handleFaceFieldHover(faceAssignments[person.personID])"
                      @mouseleave="handleFaceFieldLeave()"
                    >
                      <option value="">-- Assign Face --</option>
                      <option v-for="face in getUnassignedFaces()" :key="face.faceIndex" :value="face.faceIndex">
                        Face #{{ face.faceIndex + 1 }} ({{ Math.round(face.confidence * 100) }}%)
                      </option>
                    </select>
                  </span>
                  <span v-else-if="detectedFaces.length === 0" class="no-faces-indicator">
                    No faces detected
                  </span>
                  <span v-else-if="!person.personID" class="no-person-indicator">
                    Select a person first
                  </span>
                </div>
                
                <button 
                  v-if="getMatchForPerson(person.personID)"
                  type="button"
                  @click="unmatchPersonFace(person.personID)"
                  :disabled="faceProcessingControlsDisabled"
                  class="btn-unmatch-inline"
                  title="Unassign this face"
                >
                  Unassign
                </button>
                <button 
                  v-else-if="person.personID && detectedFaces.length > 0"
                  type="button"
                  @click="assignFaceToPersonByID(person.personID)"
                  :disabled="faceProcessingControlsDisabled || (!faceAssignments[person.personID] && faceAssignments[person.personID] !== 0)"
                  class="btn-assign-inline"
                >
                  Assign
                </button>
              </div>
              
              <button type="button" @click="removePerson(index)" class="btn-remove" title="Remove person">×</button>
            </div>
            </div>
            
            <button type="button" @click="addPerson" :disabled="faceProcessingControlsDisabled" class="btn-add">+ Add Person</button>
            <small>Tip: Use Person Manager to add new people to the database</small>
          </div>

            <!-- Basic Info -->
            <div class="form-section">
              <div class="info-row">
                <div class="info-item">
                  <label>Accession:</label>
                  <span class="info-value">{{ item.accession }}</span>
                </div>
                <div class="info-item">
                  <label>File:</label>
                  <span class="info-value">{{ item.link }}</span>
                </div>
                <div class="info-item">
                  <label>Type:</label>
                  <span class="info-value">{{ item.type }}</span>
                </div>
              </div>
              <div class="file-detail-list">
                <div class="file-detail-row">
                  <label>Archive Path:</label>
                  <span class="info-value path-value">{{ deleteInfo.mediaPath }}</span>
                </div>
                <div v-if="deleteInfo.isSymlink" class="file-detail-row">
                  <label>Symlink:</label>
                  <span class="info-value path-value">{{ deleteInfo.symlinkPath }}</span>
                </div>
                <div class="file-detail-row">
                  <label>File Size:</label>
                  <span class="info-value">{{ formattedFileSize }}</span>
                </div>
                <div v-if="showFileStatus" class="file-detail-row">
                  <label>Status:</label>
                  <span class="file-status" :class="fileStatusClass">{{ fileStatusText }}</span>
                </div>
              </div>
            </div>

            <!-- Description -->
            <div class="form-section">
              <label for="description">Description</label>
              <textarea 
                id="description"
                v-model="item.description" 
                rows="4"
                placeholder="Describe the contents, context, or transcription..."
              ></textarea>
            </div>

            <!-- Date -->
            <div class="form-section">
              <label>Date (when media was created)</label>
              <DateInput
                v-model:year="item.date.year"
                v-model:month="item.date.month"
                v-model:day="item.date.day"
                v-model:time="item.date.time"
                :show-time="true"
              />
            </div>

            <!-- Location -->
            <div class="form-section">
              <label>Location (where media was taken)</label>
              <div v-for="(loc, index) in item.location" :key="index" class="location-entry">
                <div class="location-row">
                  <input 
                    v-model="loc.detail" 
                    type="text"
                    placeholder="Specific location (e.g., farm, living room)"
                    class="location-detail"
                  />
                  <input 
                    v-model="loc.city" 
                    type="text"
                    placeholder="City"
                    class="location-city"
                  />
                  <input 
                    v-model="loc.state" 
                    type="text"
                    placeholder="State/Region"
                    class="location-state"
                  />
                  <button type="button" @click="removeLocation(index)" class="btn-remove" title="Remove location">×</button>
                </div>
                <div class="location-row location-gps">
                  <input 
                    v-model.number="loc.latitude" 
                    type="number"
                    step="any"
                    placeholder="Latitude (e.g., 45.523064)"
                    class="location-coordinate"
                  />
                  <input 
                    v-model.number="loc.longitude" 
                    type="number"
                    step="any"
                    placeholder="Longitude (e.g., -122.676483)"
                    class="location-coordinate"
                  />
                  <button 
                    v-if="loc.latitude && loc.longitude"
                    type="button" 
                    @click="lookupLocation(index)" 
                    class="btn-lookup"
                    :disabled="isLookingUpLocation"
                    title="Look up city/state from GPS coordinates"
                  >
                    {{ isLookingUpLocation ? 'Looking up...' : '🌐 Look up location' }}
                  </button>
                  <span class="gps-hint" v-if="loc.latitude && loc.longitude">
                    📍 <a :href="`https://maps.google.com?q=${loc.latitude},${loc.longitude}&t=k`" target="_blank">View on Map</a>
                  </span>
                </div>
                <div v-if="geocodingAttribution && index === 0" class="geocoding-attribution">
                  Location data © OpenStreetMap contributors
                </div>
              </div>
              <button type="button" @click="addLocation" class="btn-add">+ Add Location</button>
            </div>

            <!-- Sources -->
            <div class="form-section">
              <label>Sources (who provided this item)</label>
              <div v-for="(source, index) in item.source" :key="index" class="source-entry">
                <div class="source-row">
                  <div class="source-person-section">
                    <PersonSelectButton
                      :text="source.personID ? getSourcePersonName(source.personID) : '-- Select Person --'"
                      :hasValue="!!source.personID"
                      @click="openPersonManagerForSourcePerson(index)"
                    />
                  </div>
                  <div class="source-date">
                    <label class="inline-label">Received:</label>
                    <DateInput
                      v-model:year="source.received.year"
                      v-model:month="source.received.month"
                      v-model:day="source.received.day"
                      size="small"
                      :show-hint="false"
                    />
                  </div>
                  <button type="button" @click="removeSource(index)" class="btn-remove" title="Remove source">×</button>
                </div>
              </div>
              <button type="button" @click="addSource" class="btn-add">+ Add Source</button>
            </div>

            <!-- Playlist -->
            <div class="form-section">
              <label>Playlist (references to other media)</label>
              <div v-for="(entry, index) in item.playlist.entry" :key="index" class="playlist-entry">
                <div class="playlist-row" :class="{ 'validation-error': playlistValidationErrors[index] }">
                  <select
                    v-model="entry.ref" 
                    class="playlist-ref"
                    @change="onPlaylistChange"
                  >
                    <option value="">-- Select Media --</option>
                    <option 
                      v-for="mediaItem in audioVideoItems" 
                      :key="mediaItem.link" 
                      :value="mediaItem.link"
                      :class="'option-' + (mediaItem.type === 'tape' ? 'tape' : mediaItem.type)"
                    >
                      {{ mediaItem.link }} ({{ mediaItem.type === 'tape' || mediaItem.type === 'audio' ? 'Audio' : 'Video' }})
                    </option>
                  </select>
                  <div class="time-input-group">
                    <input 
                      v-model="entry.starttime" 
                      type="text"
                      placeholder="00:00:00.0"
                      class="playlist-time"
                      title="Start time (HH:MM:SS.s)"
                      @input="onPlaylistChange"
                    />
                    <button 
                      type="button" 
                      @click="setStartTime(index)" 
                      class="btn-get-time"
                      title="Set media link and start time from current playback"
                    >
                      🕐 Start
                    </button>
                  </div>
                  <div class="time-input-group">
                    <input 
                      v-model="entry.duration" 
                      type="text"
                      placeholder="00:01:30.0"
                      class="playlist-time"
                      title="Duration (HH:MM:SS.s)"
                      @input="onPlaylistChange"
                    />
                    <button 
                      type="button" 
                      @click="setDuration(index)" 
                      class="btn-get-time"
                      title="Calculate duration from start time to current playback time"
                    >
                      🕐 End
                    </button>
                  </div>
                  <button type="button" @click="removePlaylistEntry(index)" class="btn-remove" title="Remove playlist entry">×</button>
                </div>
                <div v-if="playlistValidationErrors[index]" class="validation-errors">
                  <small class="error-text" v-for="(error, errorIdx) in playlistValidationErrors[index]" :key="errorIdx">
                    • {{ error }}
                  </small>
                </div>
              </div>
              <button type="button" @click="addPlaylistEntry" class="btn-add">+ Add Playlist Entry</button>
              <small class="format-hint">Time format: HH:MM:SS.s (e.g., 00:03:45.5 for 3 minutes 45.5 seconds)</small>
            </div>
          </div>

        <!-- RIGHT COLUMN: Preview and Face Controls -->
        <div class="right-column">
          <!-- Media Preview -->
          <div v-if="mediaPreviewPath || item.type === 'photo'" class="preview-section">
            <div class="preview-and-controls">
              <div class="preview-container">
                <img 
                  v-if="item.type === 'photo'" 
                  ref="imageElement"
                  :src="mediaPreviewPath" 
                  alt="Preview" 
                  class="media-preview"
                  @load="onImageLoad"
                  @click="handlePhotoPreviewClick"
                  @mousemove="handlePhotoPreviewMouseMove"
                  @mouseleave="handlePhotoPreviewMouseLeave"
                  style="cursor: pointer;"
                  title="Click to open in external viewer, Shift+click to open snapshot window"
                />
                <video 
                  v-else-if="item.type === 'video'" 
                  ref="videoElement"
                  :src="mediaPreviewPath" 
                  controls 
                  class="media-preview"
                  @click="openMediaInWindow"
                  @error="videoError = true"
                  @loadedmetadata="checkVideoLoaded"
                  style="cursor: pointer;"
                  title="Click to open in external window"
                ></video>
                <audio 
                  v-else-if="item.type === 'audio'" 
                  :src="mediaPreviewPath" 
                  controls 
                  class="media-preview"
                  @click="openMediaInWindow"
                  @error="videoError = true"
                  @loadeddata="videoError = false"
                  style="cursor: pointer;"
                  title="Click to open in external window"
                ></audio>
                
                <!-- Unsupported format overlay -->
                <div v-if="videoError && (item.type === 'video' || item.type === 'audio')" class="format-error-overlay">
                  <div class="format-error-content">
                    <div class="format-error-icon">⚠️</div>
                    <div class="format-error-title">Format Not Supported</div>
                    <div class="format-error-message">
                      This {{ item.type }} format ({{ item.link.split('.').pop().toUpperCase() }}) 
                      cannot be played in the browser.
                      <br>
                      Common unsupported formats: HEVC/H.265 video, some MOV codecs.
                    </div>
                    <button @click="openMediaInWindow" class="btn-open-external" type="button">
                      Open in External Player
                    </button>
                    <div class="format-error-hint">
                      Or click anywhere on the preview above
                    </div>
                  </div>
                </div>
                
                <!-- Face overlay canvas (only for photos) -->
                <canvas 
                  v-if="item.type === 'photo' && detectedFaces.length > 0"
                  ref="faceCanvas"
                  class="face-overlay-canvas"
                  :style="{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }"
                ></canvas>
              </div>
              
              <!-- Face Detection Controls (only for photos) - below preview -->
              <div v-if="item.type === 'photo'" class="face-detection-controls">
                <!-- Advanced Settings (collapsed by default) -->
                <div class="advanced-settings">
                  <button 
                    type="button" 
                    @click="showAdvancedSettings = !showAdvancedSettings"
                    class="btn-link"
                  >
                    {{ showAdvancedSettings ? '▼' : '▶' }} Advanced Settings
                  </button>
                  
                  <div v-if="showAdvancedSettings" class="settings-panel">
                    <!-- Model Selection -->
                    <div class="setting-group">
                      <label>Detection Model:</label>
                      <div class="model-checkboxes">
                        <label v-for="model in availableModels" :key="model.key" class="model-option">
                          <input 
                            type="radio" 
                            :value="model.key"
                            v-model="selectedModels[0]"
                            :disabled="!model.available"
                            name="detectionModel"
                          />
                          <span :class="{ disabled: !model.available }">
                            {{ model.name }}
                            <small class="model-desc">{{ model.description }}</small>
                          </span>
                        </label>
                      </div>
                      <p class="hint-small">MTCNN provides the best detection for profiles and difficult angles. SSD is faster and works well for most photos.</p>
                    </div>
                    
                    <!-- Confidence Threshold -->
                    <div class="setting-group">
                      <label>
                        Confidence Threshold: {{ confidenceThreshold.toFixed(2) }}
                      </label>
                      <input 
                        type="range" 
                        v-model.number="confidenceThreshold"
                        min="0.1"
                        max="0.8"
                        step="0.05"
                        class="confidence-slider"
                      />
                      <p class="hint-small">Lower = more faces detected (may include false positives), higher = fewer detections (more conservative)</p>
                    </div>
                    
                    <!-- Auto-Assign Threshold -->
                    <div class="setting-group">
                      <label>
                        Auto-Assign Threshold: {{ Math.round(autoAssignThreshold * 100) }}%
                      </label>
                      <input 
                        type="range" 
                        v-model.number="autoAssignThreshold"
                        min="0.5"
                        max="0.95"
                        step="0.05"
                        class="confidence-slider"
                      />
                      <p class="hint-small">Minimum confidence required for automatic face assignment from person library (lower = more auto-assignments, higher = more conservative)</p>
                    </div>

                    <!-- Phase 1 Match Threshold -->
                    <div class="setting-group">
                      <label title="Descriptor distance cutoff for Stage 1 same-photo re-match. Lower is stricter; higher tolerates more descriptor drift.">
                        Phase 1 Match Threshold: {{ phaseOneMatchThreshold.toFixed(3) }}
                      </label>
                      <input
                        type="range"
                        v-model.number="phaseOneMatchThreshold"
                        min="0.05"
                        max="0.20"
                        step="0.005"
                        class="confidence-slider"
                      />
                      <p class="hint-small">Stage 1 descriptor distance limit for restoring existing matches in this same photo (lower = stricter, higher = more tolerant)</p>
                      <p class="hint-small">Recommended starting range for family archives: <strong>0.08 - 0.11</strong></p>
                    </div>

                    <!-- Phase 1 Region Restore IoU Threshold -->
                    <div class="setting-group">
                      <label title="Geometry fallback for Stage 1 re-match. Higher values require tighter overlap between old and new face boxes.">
                        Phase 1 Region Restore IoU: {{ phaseOneRegionRestoreIoUThreshold.toFixed(2) }}
                      </label>
                      <input
                        type="range"
                        v-model.number="phaseOneRegionRestoreIoUThreshold"
                        min="0.55"
                        max="0.90"
                        step="0.01"
                        class="confidence-slider"
                      />
                      <p class="hint-small">Stage 1 geometry fallback threshold (IoU) when descriptor distance misses strict match (higher = stricter region overlap required)</p>
                      <p class="hint-small">Recommended starting range for family archives: <strong>0.70 - 0.80</strong></p>
                    </div>

                    <!-- Face Matching Debug -->
                    <div class="setting-group">
                      <label class="toggle-overlay" title="Enable detailed face re-match logging in the main process.">
                        <input
                          type="checkbox"
                          v-model="faceDebugEnabled"
                        />
                        Enable Face Matching Debug Logs (SHOEBOX_FACE_DEBUG)
                      </label>
                      <p class="hint-small">Writes detailed Stage 1 face re-match diagnostics in the app console. This is persisted in config and can be changed without restarting.</p>
                      <p class="hint-small">If the app was started with SHOEBOX_FACE_DEBUG=1, that environment setting still forces debug on for this run.</p>
                    </div>
                  </div>
                </div>
                
                <div class="face-summary-row">
                  <button
                    type="button"
                    class="faceTagsCycleBtn"
                    @click="cycleFaceTagsMode"
                    :disabled="faceProcessingControlsDisabled"
                    :title="'Face labels mode: ' + faceTagsModeLabel"
                  >
                    Face Labels: {{ faceTagsModeLabel }}
                  </button>

                  <div class="face-summary-center" v-if="faceDetectionStatus || detectedFaces.length > 0">
                    <span v-if="faceDetectionStatus" class="detection-status-inline">
                      <span v-if="facesLoadedFromBioData" title="Loaded from previous detection" class="status-icon">📂</span>
                      <span v-else-if="detectedFaces.length > 0" title="Newly detected" class="status-icon">🔍</span>
                      {{ faceDetectionStatus }}
                    </span>
                    <span v-if="detectedFaces.length > 0 && !faceDetectionStatus" class="face-summary-text">{{ faceAssignmentSummary }}</span>
                  </div>
                </div>

                <div class="detect-actions-row">
                  <button
                    type="button"
                    @click="handleDetectFaces"
                    :disabled="faceProcessingControlsDisabled || selectedModels.length === 0"
                    class="btn-secondary detect-action-btn"
                    title="Run face detection and matching for this photo"
                  >
                    {{ detectingFaces ? 'Detecting Faces...' : 'Detect Faces (This Photo)' }}
                  </button>

                  <button
                    v-if="hasQueue"
                    type="button"
                    class="btn-secondary detect-action-btn btn-batch-related"
                    :disabled="faceProcessingControlsDisabled"
                    @click="runBatchFacePhaseOne"
                    title="Run phase 1 face detection for all photos in this selected collection queue"
                  >
                    {{ batchPhaseOneRunning ? 'Batch Running...' : 'Batch Detect (Collection)' }}
                  </button>

                  <button
                    v-if="batchPhaseOneRunning"
                    type="button"
                    class="btn-danger detect-action-btn"
                    @click="cancelBatchFacePhaseOne"
                  >
                    {{ batchCancelRequested ? 'Cancel Requested...' : 'Cancel Batch' }}
                  </button>
                </div>

                <span v-if="batchPhaseOneProgressText" class="batch-progress-text">{{ batchPhaseOneProgressText }}</span>
                <div class="face-controls-status-slot">
                  <div v-if="statusMessage" :class="'status-message status-message-inline ' + statusMessage.type">
                    {{ statusMessage.text }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>

    <!-- Bottom Action Bar -->
    <div v-if="!loading && !error" class="action-bar" :class="{ 'action-bar-batch-locked': faceProcessingControlsDisabled }">
      <div v-if="hasQueue" class="action-group queue-action-group">
        <span class="action-group-label">Processing Collection:</span>
        <span class="collection-name" :title="processingCollectionTitle">{{ processingCollectionTitleShort }}</span>
        <span class="queue-position">{{ queuePosition }}</span>
        <button
          type="button"
          @click="handleSaveAndPrev"
          :disabled="faceProcessingControlsDisabled || saving || !hasPrevItem"
          class="btn-primary"
          title="Save and move to previous item in this processing collection"
        >
          ◀ Save and Previous
        </button>
        <button
          type="button"
          @click="handlePrevItem"
          :disabled="faceProcessingControlsDisabled || !hasPrevItem"
          class="btn-nav"
          title="Previous item in selected collection queue"
        >
          ◀ Previous
        </button>
        <button
          type="button"
          @click="handleNextItem"
          :disabled="faceProcessingControlsDisabled || !hasNextItem"
          class="btn-nav"
          title="Next item in selected collection queue"
        >
          Next ▶
        </button>
        <button
          type="button"
          @click="handleSaveAndNext"
          :disabled="faceProcessingControlsDisabled || saving || !hasNextItem"
          class="btn-primary"
          title="Save and move to next item in this processing collection"
        >
          Save and Next ▶
        </button>
      </div>

      <div class="action-group save-action-group">
        <button type="submit" @click="handleSave" :disabled="faceProcessingControlsDisabled || saving" class="btn-primary">
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
        <button
          type="button"
          @click="handleDelete"
          :disabled="faceProcessingControlsDisabled || saving || deleting || !deleteInfo.canDelete"
          class="btn-danger"
          :title="deleteButtonTitle"
        >
          {{ deleting ? 'Deleting...' : deleteButtonText }}
        </button>
        <button type="button" @click="handleCancel" :disabled="faceProcessingControlsDisabled || saving || deleting" class="btn-secondary">
          Cancel
        </button>
      </div>
      <div v-if="deleteInfo.deleteBlockReason" class="warning-message">
        ⚠️ {{ deleteInfo.deleteBlockReason }}
      </div>
      <div v-if="statusMessage && item.type !== 'photo'" :class="'status-message ' + statusMessage.type">
        {{ statusMessage.text }}
      </div>
    </div>
  </div>

    <!-- Face Selector Modal -->
    <div v-if="showFaceSelector" class="modal-overlay" @click="closeFaceSelector">
      <div class="modal-content modal-small" @click.stop>
        <div class="modal-header">
          <h2>Select Face to Search</h2>
          <button type="button" @click="closeFaceSelector" class="modal-close">&times;</button>
        </div>
        
        <div class="modal-body">
          <p class="face-selector-info">
            Choose which unmatched face to search for in the Person Library:
          </p>
          
          <div class="face-selector-list">
            <label 
              v-for="face in unmatchedFaces" 
              :key="face.faceIndex"
              class="face-selector-option"
            >
              <input 
                type="radio" 
                name="faceSelection" 
                :value="face.faceIndex"
                v-model="selectedFaceForSearch"
              />
              <span class="face-option-label">
                Face #{{ face.faceIndex + 1 }} 
                <span class="face-confidence">({{ Math.round(face.confidence * 100) }}%)</span>
              </span>
            </label>
          </div>
        </div>
        
        <div class="modal-footer">
          <button 
            type="button" 
            @click="searchSelectedFace"
            class="btn-primary"
          >
            Search This Face
          </button>
          <button type="button" @click="closeFaceSelector" class="btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Face Similarity Search Modal -->
    <div v-if="showSimilaritySearch" class="modal-overlay" @click="closeSimilaritySearch">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>Face Similarity Search</h2>
          <button type="button" @click="closeSimilaritySearch" class="modal-close">&times;</button>
        </div>
        
        <div class="modal-body">
          <p class="search-info">
            Searching for matches to <strong>Face #{{ currentSearchFaceIndex + 1 }}</strong>
            ({{ unmatchedFaces.findIndex(f => f.faceIndex === currentSearchFaceIndex) + 1 }} of {{ unmatchedFaces.length }} unmatched)
          </p>
          
          <div v-if="searchingFaces" class="searching">
            Searching Person Library...
          </div>
          
          <div v-else-if="similarityMatches.length === 0" class="no-matches">
            No similar faces found in Person Library above threshold.
            <br><small>Try tagging more photos to build the face library.</small>
          </div>
          
          <div v-else class="matches-list">
            <div class="matches-header">
              <strong>{{ similarityMatches.length }} potential match(es) found</strong>
              <small>Select one or more to add to this photo</small>
            </div>
            
            <div 
              v-for="match in similarityMatches" 
              :key="match.personID"
              class="match-item"
              :class="{ 
                'match-selected': selectedMatches.has(match.personID),
                'match-in-photo': match.alreadyInPhoto
              }"
              @click="toggleMatchSelection(match.personID)"
            >
              <div class="match-radio">
                <input 
                  type="radio" 
                  name="matchSelection"
                  :checked="selectedMatches.has(match.personID)"
                  @click.stop="toggleMatchSelection(match.personID)"
                />
              </div>
              
              <div class="match-info">
                <div class="match-name">
                  {{ getPersonDisplayName({ first: match.first, last: match.last }) }}
                  <span v-if="match.alreadyInPhoto" class="badge-in-photo">Already in photo</span>
                </div>
                <div class="match-details">
                  <span class="match-confidence">Confidence: {{ match.confidence }}%</span>
                  <a 
                    v-if="match.referenceLink"
                    href="#" 
                    @click.prevent.stop="openReferencePhoto(match)"
                    class="match-reference-link"
                  >
                    📷 View reference photo
                  </a>
                  <span v-else class="match-reference">Reference: {{ match.referenceLink }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button 
            type="button" 
            @click="addSelectedMatches"
            :disabled="selectedMatches.size === 0"
            class="btn-primary"
          >
            Select Match
          </button>
          
          <button 
            v-if="unmatchedFaces.length > 1 && unmatchedFaces.findIndex(f => f.faceIndex === currentSearchFaceIndex) < unmatchedFaces.length - 1"
            type="button" 
            @click="searchNextFace"
            class="btn-secondary"
          >
            Next Face →
          </button>
          
          <button type="button" @click="closeSimilaritySearch" class="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { formatPersonName, expandPersonsByLastName, getPersonDisplayName } from '../../../../shared/personHelpers.js';
import DateInput from '../../components/DateInput.vue';
import PersonSelectButton from '../../components/PersonSelectButton.vue';
import { hasUnsupportedCodec } from '../../shared/videoCodecDetection.js';
import { computeFaceOverlayLayout, FACE_OVERLAY_MODE, FACE_OVERLAY_STYLE, getNextFaceOverlayMode, normalizeFaceOverlayMode } from '../../shared/faceOverlayEngine.js';
import { renderPreviewSnapshotDataUrl, renderSnapshotDataUrlFromImageSource } from '../../shared/previewSnapshotRenderer.js';
import { buildSnapshotFacesFromDetected, buildSingleSnapshotFace } from '../../shared/snapshotFaceBuilders.js';
import { mergeAssignedFacesIntoCurrent } from './faceMergeHelper.js';

const item = ref({
  accession: '',
  link: '',
  type: '',
  description: '',
  date: { year: '', month: '', day: '', time: '' },
  location: [],
  person: [],
  source: [],
  playlist: { entry: [] }
});

const persons = ref([]);
const personListKey = ref(0); // Used to force re-render of person dropdowns
const loading = ref(true);
const saving = ref(false);
const deleting = ref(false);
const fileExists = ref(true);
const isReferencedInPlaylists = ref(false); // Track if item is referenced in playlists
const error = ref(null);
const statusMessage = ref(null);
const isMounted = ref(true);
const suppressUnsavedTracking = ref(false);
const mediaPreviewPath = ref(null);
const videoError = ref(false); // Track if video/audio failed to load
const videoElement = ref(null); // Reference to video element

const createEmptyDeleteInfo = () => ({
  mediaPath: '',
  archiveEntryExists: false,
  fileExists: true,
  isSymlink: false,
  symlinkPath: null,
  targetPath: null,
  targetExists: false,
  sizeBytes: null,
  deleteKind: 'metadata-only',
  canDelete: true,
  deleteBlockReason: null
});

const deleteInfo = ref(createEmptyDeleteInfo());

// Queue navigation state
const queueData = ref(null); // { collectionKey, collectionText, queue: [...links] }
const currentQueueIndex = ref(-1);
const hasUnsavedChanges = ref(false);
const batchPhaseOneRunning = ref(false);
const batchPhaseOneProgress = ref(null);
const batchCancelRequested = ref(false);
const batchPhaseOneSummary = ref('');

// Custom modal state
const showConfirmModal = ref(false);
const confirmModalTitle = ref('');
const confirmModalMessage = ref('');
const confirmOkText = ref('OK');
const confirmCancelText = ref('Cancel');
let confirmResolve = null;

const showDeleteModal = ref(false);

let statusMessageClearTimer = null;

const clearStatusMessageClearTimer = () => {
  if (statusMessageClearTimer) {
    clearTimeout(statusMessageClearTimer);
    statusMessageClearTimer = null;
  }
};

const scheduleStatusMessageClear = (delayMs = 3000) => {
  clearStatusMessageClearTimer();
  statusMessageClearTimer = setTimeout(() => {
    statusMessageClearTimer = null;

    if (!isMounted.value) {
      return;
    }

    // Keep errors visible until the operator explicitly triggers another action.
    if (statusMessage.value?.type === 'error') {
      return;
    }

    statusMessage.value = null;
  }, delayMs);
};

const scheduleSaveWindowCloseIfStillSuccessful = () => {
  if (saveCloseTimer) {
    clearTimeout(saveCloseTimer);
  }

  saveCloseTimer = setTimeout(async () => {
    saveCloseTimer = null;

    if (!isMounted.value) {
      return;
    }

    // Keep the window open only if a later explicit error replaced success.
    // Other status transitions (including stale clears) should not block close.
    if (statusMessage.value?.type === 'error') {
      saving.value = false;
      return;
    }

    try {
      await window.electronAPI.saveWindowGeometry();
      window.close();
    } catch (error) {
      statusMessage.value = { type: 'error', text: `Saved, but failed to close window: ${error?.message || String(error)}` };
      saving.value = false;
    }
  }, 1500);
};

// Face detection state
const imageElement = ref(null);
const faceCanvas = ref(null);
const detectedFaces = ref([]);
const detectingFaces = ref(false);
const faceTagsMode = ref(FACE_OVERLAY_MODE.OFF);
const isInitializingFaceTagsMode = ref(true);
const faceTagsModeLabel = computed(() => {
  switch (faceTagsMode.value) {
    case FACE_OVERLAY_MODE.ALL:
      return 'All';
    case FACE_OVERLAY_MODE.REGIONS:
      return 'Regions';
    case FACE_OVERLAY_MODE.ON:
      return 'On';
    default:
      return 'Off';
  }
});
const showFaceOverlays = computed(() => faceTagsMode.value !== FACE_OVERLAY_MODE.OFF);
const faceDetectionStatus = ref('');
const imageDimensions = ref({ width: 0, height: 0 });



// Face detection advanced settings
const showAdvancedSettings = ref(false);
const availableModels = ref([]);
const selectedModels = ref(['ssd']); // Default to SSD
const confidenceThreshold = ref(0.20); // Will be loaded from nconf
const autoAssignThreshold = ref(0.60); // Will be loaded from nconf
const phaseOneMatchThreshold = ref(0.085); // Will be loaded from nconf
const phaseOneRegionRestoreIoUThreshold = ref(0.72); // Will be loaded from nconf
const faceDebugEnabled = ref(false); // Persisted nconf override for face match debug logging
const isInitializingThresholds = ref(true);
const isInitializingFaceDebugSetting = ref(true);
const lastUsedModel = ref('ssd');
const hoveredFaceIndex = ref(null); // Track which face is being hovered over
const hoveringFaceControl = ref(false); // Track hover originating from badges/face fields
let hoverClearTimeout = null;
let saveCloseTimer = null;
const facesLoadedFromBioData = ref(false); // Track if faces were loaded vs detected

const clearFaceHoverState = () => {
  hoveringFaceControl.value = false;
  hoveredFaceIndex.value = null;
  if (hoverClearTimeout) {
    clearTimeout(hoverClearTimeout);
    hoverClearTimeout = null;
  }
};

const isValidFaceOverlayMode = (mode) => {
  return [
    FACE_OVERLAY_MODE.OFF,
    FACE_OVERLAY_MODE.ON,
    FACE_OVERLAY_MODE.REGIONS,
    FACE_OVERLAY_MODE.ALL
  ].includes(mode);
};

const persistFaceTagsMode = async (mode = faceTagsMode.value) => {
  await window.electronAPI.setConfig('mediaManager:faceTagsMode', mode);
  await window.electronAPI.setConfig('mediaManager:showFaceTags', mode !== FACE_OVERLAY_MODE.OFF);
};

const ensureFaceTagsVisible = () => {
  if (faceTagsMode.value === FACE_OVERLAY_MODE.OFF) {
    faceTagsMode.value = FACE_OVERLAY_MODE.REGIONS;
  }
};

const cycleFaceTagsMode = async () => {
  faceTagsMode.value = getNextFaceOverlayMode(faceTagsMode.value);
  if (!isInitializingFaceTagsMode.value) {
    try {
      await persistFaceTagsMode(faceTagsMode.value);
    } catch (err) {
      console.error('[FACE TAGS] Failed to persist face overlay mode:', err);
    }
  }
  drawFaceOverlays();
};

// Watch thresholds and save to nconf when changed
watch(confidenceThreshold, async (newValue) => {
  await window.electronAPI.setConfig('faceDetection:confidenceThreshold', newValue);
});

const reapplyAutoAssignAfterThresholdChange = async () => {
  if (isInitializingThresholds.value) return;
  if (item.value.type !== 'photo') return;
  if (!Array.isArray(detectedFaces.value) || detectedFaces.value.length === 0) return;
  if (!Array.isArray(unmatchedFaces.value) || unmatchedFaces.value.length === 0) return;

  try {
    const autoAssignResult = await autoAssignUnmatchedFaces();
    const selected = autoAssignResult?.selected || 0;

    if (selected > 0) {
      const matched = matchedFaces.value.length;
      const unresolved = unmatchedFaces.value.length;
      faceDetectionStatus.value = `Auto-assign threshold reapplied: ${selected} new match(es) selected (${matched} matched, ${unresolved} unresolved)`;
    }

    setTimeout(() => {
      drawFaceOverlays();
    }, 50);
  } catch (err) {
    console.error('[FACE AUTO-ASSIGN] Error reapplying threshold change:', err);
  }
};

watch(autoAssignThreshold, async (newValue) => {
  await window.electronAPI.setConfig('faceDetection:autoAssignThreshold', newValue);
  await reapplyAutoAssignAfterThresholdChange();
});

watch(phaseOneMatchThreshold, async (newValue) => {
  await window.electronAPI.setConfig('faceDetection:phaseOneMatchThreshold', newValue);
});

watch(phaseOneRegionRestoreIoUThreshold, async (newValue) => {
  await window.electronAPI.setConfig('faceDetection:phaseOneRegionRestoreIoUThreshold', newValue);
});

watch(faceDebugEnabled, async (newValue) => {
  if (isInitializingFaceDebugSetting.value) {
    return;
  }
  await window.electronAPI.setConfig('debug:faceMatching', newValue === true);
});

// Face matching state
const matchedFaces = ref([]);
const unmatchedFaces = ref([]);
const faceAssignments = ref({});
const selectedFaceAssignmentsCount = computed(() => {
  if (item.value.type !== 'photo') return 0;
  return item.value.person.filter(p => {
    const hasSelected = faceAssignments.value[p.personID] !== undefined && faceAssignments.value[p.personID] !== null && faceAssignments.value[p.personID] !== '';
    const hasAssigned = p.faceTag && p.faceTag.region;
    return p.personID && hasSelected && !hasAssigned;
  }).length;
});

// Face similarity search state
const showFaceSelector = ref(false);
const showSimilaritySearch = ref(false);
const searchingFaces = ref(false);
const similarityMatches = ref([]);
const selectedMatches = ref(new Set());
const currentSearchFaceIndex = ref(null);
const selectedFaceForSearch = ref(null);
const candidateFaceIDsByIndex = ref({});
const excludedFaceIndices = ref(new Set());
const excludedCandidatesPendingByID = ref({});

// Playlist validation state
const playlistValidationErrors = ref([]);

// Audio/video items for playlist dropdown
const audioVideoItems = ref([]);

// Reverse geocoding state
const isLookingUpLocation = ref(false);
const geocodingAttribution = ref(false);
const geocodingCache = new Map(); // Cache results to avoid duplicate requests
let lastGeocodingRequest = 0; // Timestamp of last request for rate limiting

const formatFileSize = (sizeBytes) => {
  if (sizeBytes === null || sizeBytes === undefined || Number.isNaN(sizeBytes)) {
    return 'Unknown';
  }

  const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
  let size = sizeBytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const decimals = unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
};

const formattedFileSize = computed(() => formatFileSize(deleteInfo.value.sizeBytes));

const showFileStatus = computed(() => !deleteInfo.value.fileExists || deleteInfo.value.sizeBytes === null);

const fileStatusClass = computed(() => {
  if (!deleteInfo.value.fileExists) {
    return 'missing';
  }

  return 'warning';
});

const fileStatusText = computed(() => {
  if (deleteInfo.value.archiveEntryExists && deleteInfo.value.isSymlink) {
    return 'Target Missing';
  }

  if (!deleteInfo.value.archiveEntryExists) {
    return 'File Missing';
  }

  if (deleteInfo.value.sizeBytes === null) {
    return 'Size Unavailable';
  }

  return '';
});

const deleteButtonText = computed(() => {
  if (!deleteInfo.value.archiveEntryExists) {
    return 'Delete Metadata (File Missing)';
  }

  if (deleteInfo.value.isSymlink) {
    return 'Delete Item';
  }

  return 'Delete Item + File';
});

const deleteButtonTitle = computed(() => {
  if (!deleteInfo.value.canDelete) {
    return deleteInfo.value.deleteBlockReason || 'Delete unavailable';
  }

  if (!deleteInfo.value.archiveEntryExists) {
    return 'Delete item metadata only because the archive file is missing';
  }

  if (deleteInfo.value.isSymlink) {
    return 'Review symlink delete options';
  }

  return 'Move file to trash and delete item metadata';
});

// Get available persons for face assignment (from item.person, excluding persons who already have faceTag assigned)
const getAvailablePersonsForFaceAssignment = (faceIndex) => {
  personListKey.value; // Force reactivity
  
  // Get personIDs that already have faceTags assigned (to prevent duplicates)
  const personsWithFaceTags = item.value.person
    .filter(p => p.faceTag && p.faceTag.region)
    .map(p => p.personID)
    .filter(id => id);
  
  // Return item.person entries that don't have faceTags yet
  return item.value.person.filter(p => p.personID && !personsWithFaceTags.includes(p.personID));
};

const addLocation = () => {
  item.value.location.push({ detail: '', city: '', state: '', latitude: null, longitude: null });
};

const removeLocation = (index) => {
  item.value.location.splice(index, 1);
};

// Reverse geocoding - look up city/state from GPS coordinates
const lookupLocation = async (index) => {
  const loc = item.value.location[index];
  if (!loc.latitude || !loc.longitude) return;

  // Check cache first
  const cacheKey = `${loc.latitude},${loc.longitude}`;
  if (geocodingCache.has(cacheKey)) {
    const cached = geocodingCache.get(cacheKey);
    if (cached.city) loc.city = cached.city;
    if (cached.state) loc.state = cached.state;
    geocodingAttribution.value = true;
    return;
  }

  // Rate limiting: Ensure at least 1 second between requests
  const now = Date.now();
  const timeSinceLastRequest = now - lastGeocodingRequest;
  if (timeSinceLastRequest < 1000) {
    await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
  }

  isLookingUpLocation.value = true;
  
  try {
    // Call IPC handler in main process (can set User-Agent header)
    const result = await window.electronAPI.reverseGeocode(loc.latitude, loc.longitude);

    lastGeocodingRequest = Date.now();

    if (result.success) {
      // Update location object
      if (result.city) loc.city = result.city;
      if (result.state) {
        // Try to extract state abbreviation (US only)
        const stateAbbrev = getStateAbbreviation(result.state);
        loc.state = stateAbbrev || result.state;
      }
      
      // Cache the result
      geocodingCache.set(cacheKey, { city: result.city, state: loc.state });
      geocodingAttribution.value = true;
      
      statusMessage.value = 'Location lookup successful';
      scheduleStatusMessageClear(3000);
    } else {
      throw new Error(result.error || 'Geocoding failed');
    }
  } catch (err) {
    console.error('Reverse geocoding error:', err);
    error.value = `Failed to look up location: ${err.message}`;
    setTimeout(() => error.value = null, 5000);
  } finally {
    isLookingUpLocation.value = false;
  }
};

// Helper function to get state abbreviation (US states only)
const getStateAbbreviation = (stateName) => {
  const stateMap = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
    'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
    'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
    'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
    'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
    'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
    'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
    'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
  };
  return stateMap[stateName.toLowerCase()] || null;
};

const addPerson = async () => {
  try {
    item.value.person.push({ personID: '', position: '' });
    
    // Scroll the newly added person into view
    await nextTick();
    const personRows = document.querySelectorAll('.person-face-row');
    if (personRows.length > 0) {
      const lastRow = personRows[personRows.length - 1];
      lastRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } catch (err) {
    console.error('Error adding person:', err);
  }
};

const removePerson = async (index) => {
  try {
    // Removing rows while a face-control hover is active can leave stale hover state,
    // which may filter overlay drawing down to zero entries.
    clearFaceHoverState();

    const person = item.value.person[index];
    
    // Always remove face descriptor for this person/item combination if it exists
    // This is important even if Face Detection UI isn't currently active
    if (person && person.personID && item.value.link) {
      const result = await window.electronAPI.removeFaceDescriptor(person.personID, item.value.link);
      
      // If face detection is active, also update the UI state
      const match = getMatchForPerson(person.personID);
      if (match) {
        const matchIndex = matchedFaces.value.findIndex(m => m.personID === person.personID);
        if (matchIndex !== -1) {
          // Move the face back to unmatched faces
          const matchedFace = matchedFaces.value[matchIndex];
          unmatchedFaces.value.push({
            faceIndex: matchedFace.faceIndex,
            region: matchedFace.region,
            descriptor: matchedFace.descriptor,
            confidence: matchedFace.confidence
          });
          matchedFaces.value.splice(matchIndex, 1);
          
          // Redraw face overlays to update colors
          if (showFaceOverlays.value) {
            setTimeout(() => {
              drawFaceOverlays();
            }, 50);
          }
        }
      }
    }
    
    item.value.person.splice(index, 1);
  } catch (err) {
    console.error('Error removing person:', err);
  }
};

const movePersonUp = (index) => {
  if (index > 0) {
    // Swap the array elements
    const temp = item.value.person[index];
    item.value.person[index] = item.value.person[index - 1];
    item.value.person[index - 1] = temp;
    
    // Force re-render by triggering reactivity
    item.value.person = [...item.value.person];
  }
};

const movePersonDown = (index) => {
  if (index < item.value.person.length - 1) {
    // Swap the array elements
    const temp = item.value.person[index];
    item.value.person[index] = item.value.person[index + 1];
    item.value.person[index + 1] = temp;
    
    // Force re-render by triggering reactivity
    item.value.person = [...item.value.person];
  }
};

const openPersonManager = async (personID) => {
  try {
    // If personID is provided and not empty, select that person
    // Otherwise just open the Person Manager window
    const id = personID || null;
    await window.electronAPI.openPersonManager(id);
  } catch (err) {
    console.error('Error opening Person Manager:', err);
  }
};

// State for tracking which person entry is being selected
const personSelectionIndex = ref(null);
const sourceSelectionIndex = ref(null);

// Open Person Manager in Select mode for choosing a person
const openPersonManagerForSelection = async (personIndex) => {
  try {
    // Store which person entry we're selecting for
    personSelectionIndex.value = personIndex;
    
    // Get already-assigned personIDs (excluding the current entry)
    const assignedPersonIDs = item.value.person
      .map((p, idx) => idx !== personIndex ? p.personID : null)
      .filter(id => id);
    
    // Open Person Manager with select mode and context
    await window.electronAPI.openPersonManagerForSelection(assignedPersonIDs);
  } catch (err) {
    console.error('Error opening Person Manager for selection:', err);
  }
};

// Open Person Manager in Select mode for choosing a source person
const openPersonManagerForSourcePerson = async (sourceIndex) => {
  try {
    sourceSelectionIndex.value = sourceIndex;
    await window.electronAPI.openPersonManagerForSelection([]);
  } catch (err) {
    console.error('Error opening Person Manager for source selection:', err);
  }
};

// Get display name for a source person
const getSourcePersonName = (personID) => {
  if (!personID) return '';
  const person = persons.value.find((p) => p.personID === personID);
  return person ? getPersonDisplayName(person) : `Person ${personID}`;
};

// Custom confirm dialog to avoid Electron focus bug
const showConfirm = (title, message, okText = 'OK', cancelText = 'Cancel') => {
  return new Promise((resolve) => {
    confirmModalTitle.value = title;
    confirmModalMessage.value = message;
    confirmOkText.value = okText;
    confirmCancelText.value = cancelText;
    confirmResolve = resolve;
    showConfirmModal.value = true;
  });
};

const handleModalOk = () => {
  showConfirmModal.value = false;
  if (confirmResolve) {
    confirmResolve(true);
    confirmResolve = null;
  }
};

const handleModalCancel = () => {
  showConfirmModal.value = false;
  if (confirmResolve) {
    confirmResolve(false);
    confirmResolve = null;
  }
};

const closeDeleteModal = () => {
  if (deleting.value) {
    return;
  }
  showDeleteModal.value = false;
};

const navigateAfterDelete = async () => {
  if (hasQueue.value && queueData.value?.queue) {
    queueData.value.queue = queueData.value.queue.filter(link => link !== item.value.link);

    if (queueData.value.queue.length > 0 && currentQueueIndex.value < queueData.value.queue.length) {
      navigateToQueueItem(currentQueueIndex.value);
      return;
    }
  }

  setTimeout(async () => {
    await window.electronAPI.saveWindowGeometry();
    window.close();
  }, 1200);
};

const confirmDelete = async (deleteMode) => {
  showDeleteModal.value = false;
  deleting.value = true;
  statusMessage.value = { type: 'info', text: 'Deleting item...' };

  try {
    const result = await window.electronAPI.deleteItem({
      link: item.value.link,
      deleteMode
    });

    if (result.success) {
      hasUnsavedChanges.value = false;
      statusMessage.value = { type: 'success', text: 'Item deleted successfully!' };
      await navigateAfterDelete();
    } else {
      statusMessage.value = { type: 'error', text: 'Error: ' + result.error };
      deleting.value = false;
    }
  } catch (err) {
    statusMessage.value = { type: 'error', text: 'Error deleting: ' + err.message };
    deleting.value = false;
  }
};

const addSource = () => {
  item.value.source.push({ 
    personID: '', 
    received: { year: '', month: '', day: '' } 
  });
};

const removeSource = (index) => {
  item.value.source.splice(index, 1);
};

const hydrateItemFromLoadedItem = (loadedItem) => {
  clearFaceHoverState();
  suppressUnsavedTracking.value = true;
  item.value = {
    accession: loadedItem.accession || '',
    link: loadedItem.link || '',
    type: loadedItem.type || '',
    description: loadedItem.description || '',
    date: loadedItem.date || { year: '', month: '', day: '', time: '' },
    location: loadedItem.location || [],
    person: (loadedItem.person || []).map(p => ({
      ...p,
      position: p.position || p.context || ''
    })),
    source: loadedItem.source || [],
    playlist: loadedItem.playlist || { entry: [] }
  };

  nextTick(() => {
    suppressUnsavedTracking.value = false;
  });
};

const addPlaylistEntry = () => {
  if (!item.value.playlist) {
    item.value.playlist = { entry: [] };
  }
  item.value.playlist.entry.push({ 
    ref: '', 
    starttime: '00:00:00.0', 
    duration: '00:01:30.0' 
  });
};

const removePlaylistEntry = (index) => {
  item.value.playlist.entry.splice(index, 1);
  validatePlaylist(); // Revalidate after removal
};

// Helper to parse time string (HH:MM:SS.s) to seconds
const parseTimeToSeconds = (timeString) => {
  if (!timeString) return 0;
  const parts = timeString.split(':');
  if (parts.length !== 3) return 0;
  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  const seconds = parseFloat(parts[2]) || 0;
  return hours * 3600 + minutes * 60 + seconds;
};

// Helper to format seconds to time string (HH:MM:SS.s)
const formatSecondsToTime = (totalSeconds) => {
  if (!totalSeconds || isNaN(totalSeconds)) return '00:00:00.0';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
};

// Set start time and media link from current playback
const setStartTime = async (entryIndex) => {
  try {
    const result = await window.electronAPI.getCurrentPlaybackTime();
    
    if (result.success) {
      // Set both the media link and start time
      item.value.playlist.entry[entryIndex].ref = result.link;
      item.value.playlist.entry[entryIndex].starttime = result.time;
      validatePlaylist();
    } else {
      alert(`Could not get playback info: ${result.error}\n\nMake sure Media Player window is open and playing media.`);
    }
  } catch (error) {
    console.error('Error getting playback info:', error);
    alert('Error getting playback info. Make sure Media Player window is open.');
  }
};

// Set duration by calculating current time minus start time
const setDuration = async (entryIndex) => {
  try {
    const result = await window.electronAPI.getCurrentPlaybackTime();
    
    if (result.success) {
      const entry = item.value.playlist.entry[entryIndex];
      const startSeconds = parseTimeToSeconds(entry.starttime);
      const currentSeconds = result.currentSeconds;
      const durationSeconds = Math.max(0, currentSeconds - startSeconds);
      
      entry.duration = formatSecondsToTime(durationSeconds);
      validatePlaylist();
    } else {
      alert(`Could not get playback info: ${result.error}\n\nMake sure Media Player window is open and playing media.`);
    }
  } catch (error) {
    console.error('Error calculating duration:', error);
    alert('Error calculating duration. Make sure Media Player window is open.');
  }
};

// Validate playlist entries
const validatePlaylist = () => {
  const errors = [];
  const timeFormat = /^\d{1,2}:\d{2}:\d{2}\.\d$/; // HH:MM:SS.s format
  
  if (!item.value.playlist || !item.value.playlist.entry) {
    playlistValidationErrors.value = [];
    return true;
  }
  
  item.value.playlist.entry.forEach((entry, index) => {
    const entryErrors = [];
    
    // Check if all fields are filled
    if (!entry.ref) {
      entryErrors.push('Missing filename');
    }
    if (!entry.starttime) {
      entryErrors.push('Missing start time');
    } else if (!timeFormat.test(entry.starttime)) {
      entryErrors.push('Invalid start time format (use HH:MM:SS.s)');
    }
    if (!entry.duration) {
      entryErrors.push('Missing duration');
    } else if (!timeFormat.test(entry.duration)) {
      entryErrors.push('Invalid duration format (use HH:MM:SS.s)');
    }
    
    if (entryErrors.length > 0) {
      errors[index] = entryErrors;
    }
  });
  
  playlistValidationErrors.value = errors;
  return errors.length === 0 || errors.every(e => !e);
};

// Validate playlist on input change
const onPlaylistChange = () => {
  validatePlaylist();
};

// Face Detection Functions
const onImageLoad = () => {
  try {
    if (imageElement.value) {
      imageDimensions.value = {
        width: imageElement.value.naturalWidth,
        height: imageElement.value.naturalHeight
      };
      
      // Set canvas size to match displayed image
      if (faceCanvas.value) {
        faceCanvas.value.width = imageElement.value.clientWidth;
        faceCanvas.value.height = imageElement.value.clientHeight;
        
        // Position canvas to overlay the centered image
        const img = imageElement.value;
        const containerRect = img.parentElement.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();
        faceCanvas.value.style.left = (imgRect.left - containerRect.left) + 'px';
        faceCanvas.value.style.top = (imgRect.top - containerRect.top) + 'px';
      }

      // If face data was loaded before the image finished rendering,
      // redraw now so overlays appear reliably.
      if (showFaceOverlays.value && detectedFaces.value.length > 0) {
        setTimeout(() => {
          drawFaceOverlays();
        }, 0);
      }
    }
  } catch (err) {
    console.error('Error in onImageLoad:', err);
  }
};

const handleWindowResize = () => {
  if (imageElement.value) {
    onImageLoad();
  }
  if (showFaceOverlays.value && detectedFaces.value.length > 0) {
    drawFaceOverlays();
  }
};

// Check if video has valid video track (not audio-only)
// Shared codec detection function
const checkVideoLoaded = (event) => {
  const videoEl = event.target;
  // Use shared utility to check for unsupported codec
  if (item.value.type === 'video' && hasUnsupportedCodec(videoEl)) {
    videoError.value = true;
  } else {
    videoError.value = false;
  }
};

const openMediaInWindow = async () => {
  if (!isMounted.value) {
    return;
  }

  if (item.value.type && item.value.link) {
    // Fire-and-forget launch: external viewer lifecycle is independent of this window.
    void window.electronAPI.openMediaExternal(item.value.type, item.value.link)
      .then((result) => {
        if (!isMounted.value) {
          return;
        }
        if (!result?.success) {
          console.error('Failed to open file:', result?.error);
          statusMessage.value = { type: 'error', text: 'Failed to open file: ' + (result?.error || 'unknown error') };
          scheduleStatusMessageClear(3000);
        }
      })
      .catch((error) => {
        if (!isMounted.value) {
          return;
        }
        if (isTransientMediaOpenInvokeError(error?.message || error)) {
          console.warn('Ignored transient media open IPC error:', error?.message || String(error));
          return;
        }
        if (saving.value) {
          console.warn('Ignored media open error while save is active:', error?.message || String(error));
          return;
        }
        console.error('Error opening file:', error);
        statusMessage.value = { type: 'error', text: 'Error opening file: ' + error.message };
        scheduleStatusMessageClear(3000);
      });
  }
};

const openMediaSnapshotWindow = async () => {
  if (!item.value.type || !item.value.link) {
    return;
  }

  try {
    const faces = buildSnapshotFacesFromDetected({
      detectedFaces: detectedFaces.value,
      matchedFaces: matchedFaces.value,
      unmatchedFaces: unmatchedFaces.value,
      getLabelForFaceIndex: getPersonLabelForFaceIndex
    });

    const snapshotResult = renderPreviewSnapshotDataUrl({
      imageElement: imageElement.value,
      faces,
      mode: faceTagsMode.value,
      hoveredFaceIndex: hoveredFaceIndex.value
    });

    if (!snapshotResult.success) {
      statusMessage.value = { type: 'error', text: `Failed to create snapshot: ${snapshotResult.error || 'unknown error'}` };
      scheduleStatusMessageClear(3000);
      return;
    }

    const result = await window.electronAPI.openMediaSnapshotImageExternal({
      dataUrl: snapshotResult.dataUrl,
      link: item.value.link,
    });

    if (!result?.success) {
      statusMessage.value = { type: 'error', text: `Failed to open snapshot: ${result?.error || 'unknown error'}` };
      scheduleStatusMessageClear(3000);
    }
  } catch (error) {
    console.error('Error opening snapshot window:', error);
    statusMessage.value = { type: 'error', text: `Error opening snapshot: ${error.message}` };
    scheduleStatusMessageClear(3000);
  }
};

const handlePhotoPreviewClick = (event) => {
  if (event?.shiftKey) {
    void openMediaSnapshotWindow();
    return;
  }

  void openMediaInWindow();
};

// Load existing faceBioData from persons on mount
const loadExistingFaceBioData = async ({ merge = false } = {}) => {
  if (!item.value.link || item.value.type !== 'photo') return;
  
  try {
    // Gather all faceBioData for this link from persons in the item
    const facesData = [];
    
    for (const personRef of (item.value.person || [])) {
      if (!personRef.personID) continue;
      
      // Get person from library
      const person = persons.value.find(p => p.personID === personRef.personID);
      if (!person || !person.faceBioData || !Array.isArray(person.faceBioData)) continue;
      
      // Find faceBioData for this link
      const bioData = person.faceBioData.filter(d => d.link === item.value.link);
      
      if (bioData.length > 0) {
        facesData.push({
          personID: personRef.personID,
          bioData: bioData
        });
      }
    }
    
    if (facesData.length === 0) {
      return;
    }
    
    // Determine which model to use (prefer most common)
    const modelCounts = {};
    facesData.forEach(fd => {
      fd.bioData.forEach(bd => {
        const model = bd.model || 'ssd';
        modelCounts[model] = (modelCounts[model] || 0) + 1;
      });
    });
    
    let selectedModel = 'ssd';
    let maxCount = 0;
    Object.entries(modelCounts).forEach(([model, count]) => {
      if (count > maxCount) {
        maxCount = count;
        selectedModel = model;
      }
    });
    
    // Reconstruct detectedFaces and matchedFaces
    const loadedDetectedFaces = [];
    const loadedMatchedFaces = [];
    let faceIndex = 0;
    
    for (const fd of facesData) {
      // Only use bioData matching the selected model
      const modelBioData = fd.bioData.find(bd => (bd.model || 'ssd') === selectedModel);
      if (!modelBioData) continue;
      
      // Add to detectedFaces (need this for edit operations)
      loadedDetectedFaces.push({
        region: modelBioData.region,
        descriptor: modelBioData.descriptor,
        confidence: modelBioData.confidence || 0.9,
        model: selectedModel
      });
      
      // Add to matchedFaces
      loadedMatchedFaces.push({
        faceIndex: faceIndex,
        personID: fd.personID,
        region: modelBioData.region,
        confidence: modelBioData.confidence || 0.9
      });
      
      faceIndex++;
    }
    
    if (loadedDetectedFaces.length > 0) {
      if (merge && detectedFaces.value.length > 0) {
        const merged = mergeAssignedFacesIntoCurrent({
          currentDetectedFaces: detectedFaces.value,
          currentMatchedFaces: matchedFaces.value,
          currentUnmatchedFaces: unmatchedFaces.value,
          loadedDetectedFaces,
          loadedMatchedFaces
        });

        detectedFaces.value = merged.detectedFaces;
        matchedFaces.value = merged.matchedFaces;
        unmatchedFaces.value = merged.unmatchedFaces;
        ensureFaceTagsVisible();
        facesLoadedFromBioData.value = true;
        lastUsedModel.value = selectedModel;

        if (merged.overlapCount > 0) {
          console.warn(`[FACE MERGE] Detected ${merged.overlapCount} overlapping assigned/unresolved face region(s). Assigned faces were prioritized.`);
        }

        const modelName = availableModels.value.find(m => m.key === selectedModel)?.name || selectedModel;
        faceDetectionStatus.value = `Loaded ${matchedFaces.value.length} assigned face(s) and ${unmatchedFaces.value.length} unresolved candidate(s) (${modelName})`;

        setTimeout(() => {
          drawFaceOverlays();
        }, 100);
        return;
      }

      detectedFaces.value = loadedDetectedFaces;
      matchedFaces.value = loadedMatchedFaces;
      unmatchedFaces.value = [];
      candidateFaceIDsByIndex.value = {};
      ensureFaceTagsVisible();
      facesLoadedFromBioData.value = true;
      lastUsedModel.value = selectedModel;
      
      const modelName = availableModels.value.find(m => m.key === selectedModel)?.name || selectedModel;
      faceDetectionStatus.value = `Loaded ${loadedDetectedFaces.length} ${loadedDetectedFaces.length === 1 ? 'face' : 'faces'} (${modelName})`;
      
      // Draw overlays after a short delay to ensure image is rendered
      setTimeout(() => {
        drawFaceOverlays();
      }, 100);
    }
  } catch (err) {
    console.error('[FACE LOAD] Error loading faceBioData:', err);
  }
};

const loadExistingCandidateFaces = async () => {
  if (!item.value.link || item.value.type !== 'photo') return false;

  try {
    const result = await window.electronAPI.getFaceCandidates(item.value.link);
    if (!result?.success || !Array.isArray(result.candidates) || result.candidates.length === 0) {
      return false;
    }

    const sortedCandidates = [...result.candidates].sort((a, b) => {
      const ax = Number(a?.region?.x || 0);
      const bx = Number(b?.region?.x || 0);
      return ax - bx;
    });

    const activeCandidates = sortedCandidates.filter(candidate => candidate?.ExcludeFromMatching !== true);
    const excludedCandidates = sortedCandidates.filter(candidate => candidate?.ExcludeFromMatching === true);

    detectedFaces.value = sortedCandidates.map(candidate => ({
      region: candidate.region,
      descriptor: candidate.descriptor,
      confidence: typeof candidate.confidence === 'number' ? candidate.confidence : 0,
      model: candidate.model || 'ssd',
      candidateID: candidate.candidateID,
      ExcludeFromMatching: candidate?.ExcludeFromMatching === true
    }));

    unmatchedFaces.value = [];
    sortedCandidates.forEach((candidate, index) => {
      if (candidate?.ExcludeFromMatching === true) {
        return;
      }

      unmatchedFaces.value.push({
        faceIndex: index,
        region: candidate.region,
        confidence: typeof candidate.confidence === 'number' ? candidate.confidence : 0,
        candidateID: candidate.candidateID
      });
    });

    matchedFaces.value = [];
    faceAssignments.value = {};
    candidateFaceIDsByIndex.value = {};
    excludedFaceIndices.value = new Set();
    excludedCandidatesPendingByID.value = {};
    sortedCandidates.forEach((candidate, index) => {
      if (candidate.candidateID) {
        candidateFaceIDsByIndex.value[index] = candidate.candidateID;
      }
      if (candidate?.ExcludeFromMatching === true) {
        excludedFaceIndices.value.add(index);
      }
    });

    if (detectedFaces.value.length > 0) {
      let autoSelected = 0;
      if (unmatchedFaces.value.length > 0) {
        try {
          const autoAssignResult = await autoAssignUnmatchedFaces();
          autoSelected = autoAssignResult?.selected || 0;
        } catch (autoErr) {
          console.error('[FACE CANDIDATES] Error auto-assigning rehydrated candidates:', autoErr);
        }
      }

      ensureFaceTagsVisible();
      facesLoadedFromBioData.value = false;
      const matched = matchedFaces.value.length;
      const unmatched = unmatchedFaces.value.length;
      if (autoSelected > 0) {
        faceDetectionStatus.value = `Loaded ${detectedFaces.value.length} unresolved candidate(s); auto-selected ${autoSelected} match(es), ${unmatched} still unresolved`;
      } else if (matched > 0) {
        faceDetectionStatus.value = `Loaded ${detectedFaces.value.length} unresolved candidate(s); ${matched} matched, ${unmatched} still unresolved`;
      } else {
        const excludedCount = excludedCandidates.length;
        faceDetectionStatus.value = excludedCount > 0
          ? `Loaded ${activeCandidates.length} unresolved face candidate(s), ${excludedCount} excluded`
          : `Loaded ${activeCandidates.length} unresolved face candidate(s)`;
      }

      setTimeout(() => {
        drawFaceOverlays();
      }, 100);
      return true;
    }

    return false;
  } catch (err) {
    console.error('[FACE CANDIDATES] Error loading candidatefaces:', err);
    return false;
  }
};

/**
 * FACE DETECTION & MATCHING WORKFLOW
 * 
 * TWO-TIER MATCHING SYSTEM:
 * 
 * Tier 1 - Backend Re-matching (strict, 0.05 threshold):
 *   - Only checks people ALREADY in item.person array
 *   - Uses saved faceBioData descriptors for THIS exact image
 *   - Purpose: Restore previous assignments when re-detecting
 *   - Auto-assigns matches by setting person.faceTag
 * 
 * Tier 2 - UI Library Search (user threshold, default 60%):
 *   - Searches ENTIRE person library for remaining unmatched faces
 *   - Can add NEW people to photo
 *   - Uses next-best-match fallback (tries 2nd, 3rd best if 1st already matched)
 * 
 * SINGLE SOURCE OF TRUTH:
 *   - person.faceTag.region = face is assigned (pending or saved)
 *   - faceAssignments[personID] = temporary UI state for dropdown selection
 *   - Always check person.faceTag.region, not faceAssignments
 * 
 * PENDING SAVE PATTERN:
 *   - UI sets person.faceTag.pending = true
 *   - Backend person library updated ONLY when user clicks Save
 *   - item:save handler processes pending face tags
 *   - Never directly modify backend person library from UI
 * 
 * WORKFLOW:
 *   1. Clear all person.faceTag entries (reset state)
 *   2. Detect faces with selected models
 *   3. Backend matches to people in photo (high confidence)
 *   4. Auto-assign backend matches (set person.faceTag)
 *   5. UI searches library for remaining unmatched faces
 *   6. UI auto-selects library matches (sets faceAssignments only)
 *   7. User manually assigns remaining faces via dropdown
 *   8. User clicks Save → backend updates person library
 */
const handleDetectFaces = async () => {
  if (!item.value.link) {
    faceDetectionStatus.value = 'Error: No item link';
    return;
  }
  
  if (selectedModels.value.length === 0) {
    faceDetectionStatus.value = 'Error: Select at least one detection model';
    return;
  }
  
  detectingFaces.value = true;
  const modelNames = selectedModels.value.map(key => {
    const model = availableModels.value.find(m => m.key === key);
    return model ? model.name : key;
  }).join(' + ');
  faceDetectionStatus.value = `Detecting faces using ${modelNames}...`;
  detectedFaces.value = [];
  matchedFaces.value = [];
  unmatchedFaces.value = [];
  faceAssignments.value = {};
  candidateFaceIDsByIndex.value = {};
  excludedFaceIndices.value = new Set();
  excludedCandidatesPendingByID.value = {};
  clearFaceHoverState();
  facesLoadedFromBioData.value = false; // Mark as newly detected, not loaded

  // Flush UI so operator immediately sees that processing has started.
  await nextTick();
  
  // Clear all existing face assignments from people since regions will be regenerated
  item.value.person.forEach(person => {
    if (person.faceTag) {
      delete person.faceTag;
    }
  });
  
  try {
    // Step 1: Detect faces with selected models
    const result = await window.electronAPI.detectFaces(item.value.link, {
      models: [...selectedModels.value], // Create plain array copy
      minConfidence: confidenceThreshold.value
    });
    
    if (result.success) {
      detectedFaces.value = result.faces || [];
      lastUsedModel.value = modelNames; // Store for display
      
      if (detectedFaces.value.length === 0) {
        faceDetectionStatus.value = `No faces detected (${modelNames})`;
        faceTagsMode.value = FACE_OVERLAY_MODE.OFF;
      } else {
        // Step 2: Try to match faces to existing persons in the item
        faceDetectionStatus.value = 'Matching faces to people...';
        
        // Send only necessary data for matching, ensuring it's JSON-serializable
        const facesForMatching = detectedFaces.value.map((face, index) => ({
          faceIndex: index,
          descriptor: [...face.descriptor], // Ensure it's a plain array
          region: { ...face.region }, // Clone object
          confidence: face.confidence,
          model: face.model || 'ssd'
        }));
        
        const matchResult = await window.electronAPI.matchFaces(
          item.value.link,
          facesForMatching
        );
        
        if (matchResult.success) {
          matchedFaces.value = matchResult.matches || [];
          unmatchedFaces.value = matchResult.unmatchedFaces || [];
          
          // Backend matches are high-confidence re-detections of faces in THIS image
          // Auto-assign them to restore previous assignments
          if (matchedFaces.value.length > 0) {
            for (const match of matchedFaces.value) {
              const face = detectedFaces.value[match.faceIndex];
              const person = item.value.person.find(p => p.personID === match.personID);
              
              if (person && face) {
                // Set faceTag directly (already high confidence from backend)
                person.faceTag = {
                  region: { ...match.region },
                  descriptor: [...face.descriptor],
                  model: face.model || 'ssd',
                  pending: true,
                  faceIndex: match.faceIndex
                };
              }
            }
          }
          
          const totalFaces = detectedFaces.value.length;
          let matched = matchedFaces.value.length;
          let unmatched = unmatchedFaces.value.length;
          
          // Step 3: Auto-assign unmatched faces from person library
          if (unmatched > 0) {
            faceDetectionStatus.value = 'Searching person library for unmatched faces...';
            
            const autoAssignResult = await autoAssignUnmatchedFaces();
            matched = matchedFaces.value.length;
            unmatched = unmatchedFaces.value.length;
            
            if (autoAssignResult.selected > 0) {
              faceDetectionStatus.value = `${modelNames}: ${totalFaces} ${totalFaces === 1 ? 'face' : 'faces'} (${matched} matched, ${autoAssignResult.selected} auto-selected, ${unmatched} need assignment)`;
            } else if (unmatched > 0) {
              faceDetectionStatus.value = `${modelNames}: ${totalFaces} ${totalFaces === 1 ? 'face' : 'faces'} (${matched} matched, ${unmatched} need assignment)`;
            } else {
              faceDetectionStatus.value = `${modelNames}: ${matched} ${matched === 1 ? 'face matched' : 'faces matched'}`;
            }
          } else {
            faceDetectionStatus.value = `${modelNames}: ${matched} ${matched === 1 ? 'face matched' : 'faces matched'}`;
          }
        } else {
          faceDetectionStatus.value = `${modelNames}: ${detectedFaces.value.length} ${detectedFaces.value.length === 1 ? 'face' : 'faces'} detected`;
        }
        
        ensureFaceTagsVisible();
        
        // Wait for next tick to ensure canvas is rendered
        setTimeout(() => {
          drawFaceOverlays();
        }, 50);
      }
    } else {
      faceDetectionStatus.value = `Error: ${result.error}`;
      detectedFaces.value = [];
      faceTagsMode.value = FACE_OVERLAY_MODE.OFF;
    }
  } catch (err) {
    faceDetectionStatus.value = `Error: ${err.message}`;
    detectedFaces.value = [];
    faceTagsMode.value = FACE_OVERLAY_MODE.OFF;
  } finally {
    detectingFaces.value = false;
  }
};

const unmatchFace = async (match) => {
  if (faceProcessingControlsDisabled.value) {
    return;
  }

  const confirmed = await showConfirm(
    'Unassign Face',
    `Are you sure you want to unassign Face #${match.faceIndex + 1} from this person? You can reassign it after.`,
    'Unassign',
    'Cancel'
  );
  
  if (!confirmed) {
    return;
  }
  
  // Find the person in the local item data
  const person = item.value.person.find(p => p.personID === match.personID);
  if (!person) {
    alert('Person not found');
    return;
  }
  
  // Remove the descriptor from faceBioData
  const result = await window.electronAPI.removeFaceDescriptor(match.personID, item.value.link);
  if (!result.success) {
    alert(`Failed to unassign face: ${result.error}`);
    return;
  }

  const generateCandidateID = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    const randomSuffix = Math.random().toString(36).slice(2, 10);
    return `candidate-${Date.now()}-${randomSuffix}`;
  };

  const getOrCreateCandidateIDForFaceIndex = (faceIndex, fallbackID = null) => {
    const numericFaceIndex = Number(faceIndex);
    if (Number.isNaN(numericFaceIndex)) {
      return null;
    }

    const fromMap = candidateFaceIDsByIndex.value[numericFaceIndex];
    if (typeof fromMap === 'string' && fromMap.length > 0) {
      return fromMap;
    }

    const fromDetected = detectedFaces.value[numericFaceIndex]?.candidateID;
    if (typeof fromDetected === 'string' && fromDetected.length > 0) {
      candidateFaceIDsByIndex.value[numericFaceIndex] = fromDetected;
      return fromDetected;
    }

    if (typeof fallbackID === 'string' && fallbackID.length > 0) {
      candidateFaceIDsByIndex.value[numericFaceIndex] = fallbackID;
      return fallbackID;
    }

    const generated = generateCandidateID();
    candidateFaceIDsByIndex.value[numericFaceIndex] = generated;
    return generated;
  };

  const priorCandidateID = person?.faceTag?.candidateID || null;
  
  // Remove the hasFace marker and any legacy faceTag
  
  delete person.faceTag;
  
  // Move from matched to unmatched
  matchedFaces.value = matchedFaces.value.filter(m => m.faceIndex !== match.faceIndex);
  
  // Add to unmatched faces
  const face = detectedFaces.value[match.faceIndex];
  if (face) {
    const candidateID = getOrCreateCandidateIDForFaceIndex(match.faceIndex, priorCandidateID);
    if (candidateID && (!face.candidateID || face.candidateID !== candidateID)) {
      face.candidateID = candidateID;
    }

    unmatchedFaces.value.push({
      faceIndex: match.faceIndex,
      region: match.region,
      confidence: face.confidence,
      candidateID
    });
  }
  
  // Force reactivity update
  personListKey.value++;
  
  // Update status
  const unmatched = unmatchedFaces.value.length;
  if (unmatched > 0) {
    faceDetectionStatus.value = `${matchedFaces.value.length} matched, ${unmatched} need assignment`;
  } else {
    faceDetectionStatus.value = matchedFaces.value.length > 0 
      ? `All ${matchedFaces.value.length} faces matched`
      : 'No faces detected';
  }
  
  // Redraw overlays
  if (showFaceOverlays.value) {
    drawFaceOverlays();
  }
};

// Unmatch by personID (for inline unmatch button)
const unmatchPersonFace = (personID) => {
  // Find the match directly from matchedFaces (no faceTag anymore)
  const match = matchedFaces.value.find(m => m.personID === personID);
  if (match) {
    unmatchFace(match);
  }
};

const getCandidateIDForFaceIndex = (faceIndex) => {
  const numericFaceIndex = Number(faceIndex);
  if (Number.isNaN(numericFaceIndex)) {
    return null;
  }

  const direct = candidateFaceIDsByIndex.value[numericFaceIndex];
  if (typeof direct === 'string' && direct.length > 0) {
    return direct;
  }

  const face = unmatchedFaces.value.find(f => Number(f.faceIndex) === numericFaceIndex);
  if (typeof face?.candidateID === 'string' && face.candidateID.length > 0) {
    return face.candidateID;
  }

  const detected = detectedFaces.value[numericFaceIndex];
  if (typeof detected?.candidateID === 'string' && detected.candidateID.length > 0) {
    return detected.candidateID;
  }

  return null;
};

const removeUnmatchedFaceFromUiState = (faceIndex, options = {}) => {
  const clearPendingAssignments = options.clearPendingAssignments !== false;
  const numericFaceIndex = Number(faceIndex);
  if (Number.isNaN(numericFaceIndex)) {
    return false;
  }

  const targetFace = unmatchedFaces.value.find(face => face.faceIndex === numericFaceIndex);
  if (!targetFace) {
    return false;
  }

  clearFaceHoverState();

  delete candidateFaceIDsByIndex.value[numericFaceIndex];

  unmatchedFaces.value = unmatchedFaces.value.filter(face => face.faceIndex !== numericFaceIndex);

  if (clearPendingAssignments) {
    Object.entries(faceAssignments.value).forEach(([personID, assignedFaceIndex]) => {
      if (Number(assignedFaceIndex) === numericFaceIndex) {
        delete faceAssignments.value[personID];
      }
    });
  }

  return true;
};

const buildExcludedCandidateForSave = (faceIndex, candidateID) => {
  const fullFace = detectedFaces.value[faceIndex];
  if (!fullFace || !fullFace.region || !Array.isArray(fullFace.descriptor)) {
    return null;
  }

  return {
    candidateID,
    link: item.value.link,
    accession: item.value.accession || null,
    type: 'photo',
    region: {
      x: fullFace.region.x,
      y: fullFace.region.y,
      w: fullFace.region.w,
      h: fullFace.region.h
    },
    descriptor: Array.from(fullFace.descriptor),
    model: fullFace.model || selectedModels.value[0] || 'ssd',
    confidence: typeof fullFace.confidence === 'number' ? fullFace.confidence : null,
    quality: null,
    detectedAt: new Date().toISOString(),
    ExcludeFromMatching: true
  };
};

const discardUnassignedFace = async (faceIndex) => {
  const numericFaceIndex = Number(faceIndex);
  if (Number.isNaN(numericFaceIndex)) {
    return;
  }

   const candidateID = getCandidateIDForFaceIndex(numericFaceIndex);
   const wasExcluded = excludedFaceIndices.value.has(numericFaceIndex);

  const removedFromUnmatched = removeUnmatchedFaceFromUiState(numericFaceIndex);
  if (!removedFromUnmatched && !wasExcluded) {
    return;
  }

  if (wasExcluded) {
    excludedFaceIndices.value.delete(numericFaceIndex);
    excludedFaceIndices.value = new Set(excludedFaceIndices.value);
  }

  if (candidateID && excludedCandidatesPendingByID.value[candidateID]) {
    const nextPending = { ...excludedCandidatesPendingByID.value };
    delete nextPending[candidateID];
    excludedCandidatesPendingByID.value = nextPending;
  }

  hasUnsavedChanges.value = true;

  const unmatched = unmatchedFaces.value.length;
  faceDetectionStatus.value = unmatched > 0
    ? `${matchedFaces.value.length} matched, ${unmatched} need assignment`
    : `${matchedFaces.value.length} matched, no unresolved faces`;

  statusMessage.value = { type: 'success', text: `Discarded Face #${numericFaceIndex + 1} (save to apply)` };
  scheduleStatusMessageClear(2500);

  drawFaceOverlays();
};

const includeUnassignedFace = async (faceIndex) => {
  const numericFaceIndex = Number(faceIndex);
  if (Number.isNaN(numericFaceIndex)) {
    return;
  }

  const candidateID = getCandidateIDForFaceIndex(numericFaceIndex);
  if (!candidateID) {
    statusMessage.value = { type: 'error', text: 'This face is not a persisted unresolved candidate.' };
    scheduleStatusMessageClear(2500);
    return;
  }

  const proceed = await showConfirm(
    'Include Face Candidate',
    `Re-enable Face #${numericFaceIndex + 1} for matching? It will remain available for assignment.`,
    'Include',
    'Cancel'
  );

  if (!proceed) {
    return;
  }

  excludedFaceIndices.value.delete(numericFaceIndex);
  excludedFaceIndices.value = new Set(excludedFaceIndices.value);

  if (excludedCandidatesPendingByID.value[candidateID]) {
    const nextPending = { ...excludedCandidatesPendingByID.value };
    delete nextPending[candidateID];
    excludedCandidatesPendingByID.value = nextPending;
  }

  const existing = unmatchedFaces.value.some(face => Number(face.faceIndex) === numericFaceIndex);
  const face = detectedFaces.value[numericFaceIndex];
  if (!existing && face?.region) {
    unmatchedFaces.value.push({
      faceIndex: numericFaceIndex,
      region: face.region,
      confidence: typeof face.confidence === 'number' ? face.confidence : 0,
      candidateID
    });
  }

  hasUnsavedChanges.value = true;

  const unmatched = unmatchedFaces.value.length;
  faceDetectionStatus.value = unmatched > 0
    ? `${matchedFaces.value.length} matched, ${unmatched} need assignment`
    : `${matchedFaces.value.length} matched, no unresolved faces`;

  statusMessage.value = { type: 'success', text: `Included Face #${numericFaceIndex + 1} for matching (save to apply)` };
  scheduleStatusMessageClear(2500);

  drawFaceOverlays();
};

const excludeUnassignedFace = async (faceIndex) => {
  const numericFaceIndex = Number(faceIndex);
  if (Number.isNaN(numericFaceIndex)) {
    return;
  }

  const candidateID = getCandidateIDForFaceIndex(numericFaceIndex);
  if (!candidateID) {
    statusMessage.value = { type: 'error', text: 'This face is not a persisted unresolved candidate.' };
    scheduleStatusMessageClear(2500);
    return;
  }

  const proceed = await showConfirm(
    'Exclude Face Candidate',
    `Exclude Face #${numericFaceIndex + 1} from matching? It will remain stored but will no longer be used by matching workflows.`,
    'Exclude',
    'Cancel'
  );

  if (!proceed) {
    return;
  }

  const excludedPayload = buildExcludedCandidateForSave(numericFaceIndex, candidateID);
  if (!excludedPayload) {
    statusMessage.value = { type: 'error', text: 'Unable to prepare excluded candidate for save.' };
    scheduleStatusMessageClear(2500);
    return;
  }

  excludedCandidatesPendingByID.value = {
    ...excludedCandidatesPendingByID.value,
    [candidateID]: excludedPayload
  };

  excludedFaceIndices.value.add(numericFaceIndex);
  excludedFaceIndices.value = new Set(excludedFaceIndices.value);

  removeUnmatchedFaceFromUiState(numericFaceIndex, { clearPendingAssignments: false });
  hasUnsavedChanges.value = true;

  const unmatched = unmatchedFaces.value.length;
  faceDetectionStatus.value = unmatched > 0
    ? `${matchedFaces.value.length} matched, ${unmatched} need assignment`
    : `${matchedFaces.value.length} matched, no unresolved faces`;

  statusMessage.value = { type: 'success', text: `Excluded Face #${numericFaceIndex + 1} from matching (save to apply)` };
  scheduleStatusMessageClear(2500);

  drawFaceOverlays();
};

const getRemovableUnassignedPersonIndices = () => {
  return item.value.person
    .map((person, index) => ({ person, index }))
    .filter(({ person }) => !getMatchForPerson(person.personID))
    .map(({ index }) => index);
};

const clearFaceData = async () => {
  const unresolvedCount = unmatchedFaces.value.length;
  const excludedCount = excludedFaceIndices.value.size;

  if (unresolvedCount === 0 && excludedCount === 0) {
    return;
  }

  const proceed = await showConfirm(
    'Clear Face Data',
    `This will discard ${unresolvedCount} unresolved face(s) and clear ${excludedCount} excluded face marker(s) from this item.\n\nThis does not save changes yet. Continue?`,
    'Clear Face Data',
    'Cancel'
  );

  if (!proceed) {
    return;
  }

  if (item.value.type === 'photo' && unresolvedCount > 0) {
    const faceIndicesToDiscard = unmatchedFaces.value.map(face => face.faceIndex);
    for (const faceIndex of faceIndicesToDiscard) {
      await discardUnassignedFace(faceIndex);
    }
  }

  if (excludedCount > 0) {
    excludedFaceIndices.value = new Set();
    excludedCandidatesPendingByID.value = {};
    hasUnsavedChanges.value = true;
  }

  const matched = matchedFaces.value.length;
  faceDetectionStatus.value = matched > 0
    ? `All ${matched} faces matched`
    : 'No faces detected';

  statusMessage.value = { type: 'success', text: 'Cleared face data (save to apply)' };
  scheduleStatusMessageClear(2500);

  if (showFaceOverlays.value) {
    drawFaceOverlays();
  }
};

const clearUnassignedPersons = async () => {
  const removablePersonIndices = getRemovableUnassignedPersonIndices();
  const unassignedPersonCount = removablePersonIndices.length;

  if (unassignedPersonCount === 0) {
    return;
  }

  const proceed = await showConfirm(
    'Clear Unassigned Persons',
    `This will remove ${unassignedPersonCount} person row(s) that do not currently have face assignments from this item.\n\nThis does not save changes yet. Continue?`,
    'Clear Persons',
    'Cancel'
  );

  if (!proceed) {
    return;
  }

  for (const index of [...removablePersonIndices].sort((a, b) => b - a)) {
    await removePerson(index);
  }

  hasUnsavedChanges.value = true;

  statusMessage.value = { type: 'success', text: 'Cleared unassigned people (save to apply)' };
  setTimeout(() => {
    if (isMounted.value) {
      statusMessage.value = null;
    }
  }, 2500);
};

// Assign face to person by personID (for inline assign)
const assignFaceToPersonByID = async (personID) => {
  if (faceProcessingControlsDisabled.value) {
    return;
  }

  // Ensure numeric index (faceAssignments may come from select v-model)
  const faceIndex = Number(faceAssignments.value[personID]);
  
  if (faceIndex === undefined || faceIndex === null || faceIndex === '') {
    alert('Please select a face first');
    return;
  }
  
  // Find the person
  const person = item.value.person.find(p => p.personID === personID);
  if (!person) {
    alert('Person not found');
    return;
  }
  
  // Check if this person already has a face assigned (prevent duplicates)
  if (person.faceTag && person.faceTag.region) {
    alert('This person already has a face assigned. Please unmatch the existing face first.');
    return;
  }
  
  const assignableFace = getAssignableFaceByIndex(faceIndex);
  if (!assignableFace) {
    alert('Face not found');
    return;
  }
  
  // Get the full face data (with descriptor) from the original detectedFaces
  const fullFace = detectedFaces.value[faceIndex];
  if (!fullFace) {
    alert('Face descriptor not found');
    return;
  }
  
  // Store face assignment in person.faceTag for pending save (UI only, not persisted yet)
  const model = fullFace.model || selectedModels.value[0] || 'ssd';
  
  // Create plain serializable objects
  const plainRegion = {
    x: fullFace.region.x,
    y: fullFace.region.y,
    w: fullFace.region.w,
    h: fullFace.region.h
  };
  const plainDescriptor = Array.from(fullFace.descriptor);
  
  // Store pending face assignment in UI state (will be saved to backend on Save button)
  person.faceTag = {
    region: plainRegion,
    descriptor: plainDescriptor,
    model: model,
    confidence: fullFace.confidence,
    candidateID: fullFace.candidateID || assignableFace.candidateID || candidateFaceIDsByIndex.value[faceIndex] || null,
    pending: true  // Mark as not yet saved to backend
  };
  
  
  // Move from unmatched to matched
  matchedFaces.value.push({
    faceIndex,
    personID: person.personID,
    confidence: assignableFace.confidence,
    region: assignableFace.region
  });
  
  // Remove from unmatched
  unmatchedFaces.value = unmatchedFaces.value.filter(f => f.faceIndex !== faceIndex);
  excludedFaceIndices.value.delete(faceIndex);
  excludedFaceIndices.value = new Set(excludedFaceIndices.value);

  const candidateID = person.faceTag.candidateID;
  if (candidateID && excludedCandidatesPendingByID.value[candidateID]) {
    const nextPending = { ...excludedCandidatesPendingByID.value };
    delete nextPending[candidateID];
    excludedCandidatesPendingByID.value = nextPending;
  }

  delete faceAssignments.value[personID];
  
  // Force reactivity update
  personListKey.value++;
  
  // Update status
  const unmatched = unmatchedFaces.value.length;
  if (unmatched > 0) {
    faceDetectionStatus.value = `${matchedFaces.value.length} matched, ${unmatched} need assignment`;
  } else {
    faceDetectionStatus.value = `All ${matchedFaces.value.length} faces assigned!`;
  }
  
  // Redraw overlays
  if (showFaceOverlays.value) {
    drawFaceOverlays();
  }
};

// Assign all currently selected faces (no modal)
const assignSelectedFaces = async () => {
  const personsToAssign = item.value.person.filter(p => {
    const hasSelected = faceAssignments.value[p.personID] !== undefined && faceAssignments.value[p.personID] !== null && faceAssignments.value[p.personID] !== '';
    const hasAssigned = p.faceTag && p.faceTag.region;
    return p.personID && hasSelected && !hasAssigned;
  });
  
  for (const person of personsToAssign) {
    const selectedFaceIndex = faceAssignments.value[person.personID];
    // Check if this face is still available (not already assigned to someone else in this loop)
    const isFaceStillAvailable = unmatchedFaces.value.some(f => f.faceIndex === selectedFaceIndex);
    if (isFaceStillAvailable) {
      await assignFaceToPersonByID(person.personID);
    }
  }
};

// Get list of faces that haven't been assigned yet
const getUnassignedFaces = () => {
  // Sort by face number (faceIndex) for dropdown
  return getAssignableFaces().sort((a, b) => {
    return a.faceIndex - b.faceIndex;
  });
};

const getAssignableFaces = () => {
  const pending = [...unmatchedFaces.value];

  for (const faceIndex of excludedFaceIndices.value.values()) {
    const numericFaceIndex = Number(faceIndex);
    if (Number.isNaN(numericFaceIndex)) {
      continue;
    }

    const alreadyPresent = pending.some(face => Number(face.faceIndex) === numericFaceIndex);
    const face = detectedFaces.value[numericFaceIndex];
    if (alreadyPresent || !face?.region) {
      continue;
    }

    pending.push({
      faceIndex: numericFaceIndex,
      region: face.region,
      confidence: typeof face.confidence === 'number' ? face.confidence : 0,
      candidateID: getCandidateIDForFaceIndex(numericFaceIndex),
      isExcluded: true
    });
  }

  return pending.map(face => ({
    ...face,
    isExcluded: excludedFaceIndices.value.has(Number(face.faceIndex))
  }));
};

const getAssignableFaceByIndex = (faceIndex) => {
  const numericFaceIndex = Number(faceIndex);
  if (Number.isNaN(numericFaceIndex)) {
    return null;
  }

  return getAssignableFaces().find(face => Number(face.faceIndex) === numericFaceIndex) || null;
};

const getFaceCandidatesLeftToRight = () => {
  // Sort left-to-right by region x-coordinate for badge display
  return getAssignableFaces().sort((a, b) => {
    const faceA = detectedFaces.value[a.faceIndex];
    const faceB = detectedFaces.value[b.faceIndex];
    if (!faceA || !faceB) return 0;
    return faceA.region.x - faceB.region.x;
  });
};

// Get the match info for a person (if they have a face assigned)
const getMatchForPerson = (personID) => {
  return matchedFaces.value.find(m => m.personID === personID);
};

const getPersonLabelForFaceIndex = (faceIndex) => {
  const match = matchedFaces.value.find(m => Number(m.faceIndex) === Number(faceIndex));
  if (!match || !match.personID) {
    return null;
  }

  const person = persons.value.find(p => p.personID === match.personID)
    || item.value.person.find(p => p.personID === match.personID);

  if (!person) {
    return null;
  }

  return getPersonDisplayName(person);
};


// Face Similarity Search Functions
const findSimilarFaces = async () => {
  if (unmatchedFaces.value.length === 0) {
    alert('No unmatched faces to search for');
    return;
  }
  
  // Show face selector dialog if multiple unmatched faces
  if (unmatchedFaces.value.length > 1) {
    selectedFaceForSearch.value = unmatchedFaces.value[0].faceIndex; // Default to first
    showFaceSelector.value = true;
  } else {
    // Only one face, search it directly
    await performFaceSimilaritySearch(unmatchedFaces.value[0].faceIndex);
  }
};

// Face badge/field interaction handlers
// Hover shows only the hovered face; leaving restores checkbox state after delay
const handleFaceBadgeHover = (faceIndex) => {
  if (faceIndex === null || faceIndex === undefined || faceIndex === '') {
    return;
  }
  hoveringFaceControl.value = true;
  if (hoverClearTimeout) {
    clearTimeout(hoverClearTimeout);
    hoverClearTimeout = null;
  }
  // Coerce to number to avoid string/number mismatches from v-model or event sources
  hoveredFaceIndex.value = Number(faceIndex);
  drawFaceOverlays();
};

const handleFaceBadgeLeave = () => {
  hoveringFaceControl.value = false;
  if (hoverClearTimeout) {
    clearTimeout(hoverClearTimeout);
  }
  hoverClearTimeout = setTimeout(() => {
    if (!hoveringFaceControl.value) {
      hoveredFaceIndex.value = null;
      drawFaceOverlays();
    }
  }, 1000);
};

const handleFaceFieldHover = (faceIndex) => {
  handleFaceBadgeHover(faceIndex);
};

const handleFaceFieldLeave = () => {
  handleFaceBadgeLeave();
};

const findHoveredFaceIndex = (event) => {
  const img = imageElement.value;
  if (!img || !event || !detectedFaces.value.length) {
    return null;
  }

  const rect = img.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return null;
  }

  const xNorm = (event.clientX - rect.left) / rect.width;
  const yNorm = (event.clientY - rect.top) / rect.height;

  if (xNorm < 0 || xNorm > 1 || yNorm < 0 || yNorm > 1) {
    return null;
  }

  for (let index = 0; index < detectedFaces.value.length; index += 1) {
    const face = detectedFaces.value[index];
    if (!face || !face.region) continue;

    const isMatched = matchedFaces.value.some(m => Number(m.faceIndex) === Number(index));
    const isUnmatched = unmatchedFaces.value.some(u => Number(u.faceIndex) === Number(index));
    if (!isMatched && !isUnmatched) continue;

    const xMin = Number(face.region.x) - (Number(face.region.w) / 2);
    const xMax = Number(face.region.x) + (Number(face.region.w) / 2);
    const yMin = Number(face.region.y) - (Number(face.region.h) / 2);
    const yMax = Number(face.region.y) + (Number(face.region.h) / 2);

    if (xNorm >= xMin && xNorm <= xMax && yNorm >= yMin && yNorm <= yMax) {
      return index;
    }
  }

  return null;
};

const handlePhotoPreviewMouseMove = (event) => {
  if (detectedFaces.value.length === 0) {
    return;
  }

  hoveringFaceControl.value = false;

  const hovered = findHoveredFaceIndex(event);
  if (hoveredFaceIndex.value === hovered) {
    return;
  }

  hoveredFaceIndex.value = hovered;
  drawFaceOverlays();
};

const handlePhotoPreviewMouseLeave = () => {
  if (hoveringFaceControl.value) {
    return;
  }

  if (hoveredFaceIndex.value === null) {
    return;
  }

  hoveredFaceIndex.value = null;
  drawFaceOverlays();
};

const handleFaceBadgeClick = async (faceIndex) => {
  if (faceProcessingControlsDisabled.value) {
    return;
  }

  // Check if there are any persons with face descriptors before attempting search
  const personsWithDescriptors = await window.electronAPI.getPersonsWithDescriptors();
  
  if (personsWithDescriptors.length === 0) {
    alert('No face matches found yet.\n\nTo assign this face:\n1. Click "+ Add Person" below\n2. Select the person from the dropdown\n3. Use the "Assign Face" dropdown next to their name\n\nAfter you\'ve tagged some faces, clicking these badges will search for similar faces in your library.');
    return;
  }
  
  // If we have face descriptors, perform similarity search (ensure numeric index)
  await performFaceSimilaritySearch(Number(faceIndex));
};

// Perform the actual similarity search for a specific face
const performFaceSimilaritySearch = async (faceIndex) => {
  // Ensure consistent numeric type for face indexes
  currentSearchFaceIndex.value = Number(faceIndex);
  searchingFaces.value = true;
  selectedMatches.value = new Set();
  showFaceSelector.value = false;
  
  try {
    // Get all persons with descriptors from the Person Library
    const personsWithDescriptors = await window.electronAPI.getPersonsWithDescriptors();
    
    if (personsWithDescriptors.length === 0) {
      alert('No persons with face descriptors found in the Person Library. Tag some faces first!');
      searchingFaces.value = false;
      return;
    }
    
    // Search for selected face (ensure numeric index)
    currentSearchFaceIndex.value = Number(faceIndex);
    const matches = await searchPersonLibrary(Number(faceIndex), personsWithDescriptors);
    
    similarityMatches.value = matches;
    showSimilaritySearch.value = true;
  } catch (error) {
    console.error('Error searching for similar faces:', error);
    alert('Error searching for similar faces: ' + error.message);
  } finally {
    searchingFaces.value = false;
  }
};

// Start search from face selector dialog
const searchSelectedFace = () => {
  if (selectedFaceForSearch.value !== null) {
    performFaceSimilaritySearch(selectedFaceForSearch.value);
  }
};

// Close face selector dialog
const closeFaceSelector = () => {
  showFaceSelector.value = false;
  selectedFaceForSearch.value = null;
};

// Search person library for matches to a specific face
const searchPersonLibrary = async (faceIndex, personsWithDescriptors, distanceThreshold = 0.6) => {
  const fi = Number(faceIndex);
  const face = detectedFaces.value[fi];
  if (!face || !face.descriptor) {
    return [];
  }
  
  const faceDescriptor = face.descriptor;
  const faceModel = face.model || 'ssd'; // Get the model used to detect this face
  const personBestMatches = {}; // Track best match per person
  const threshold = distanceThreshold; // Match threshold - lower is more similar
  
  // Compare against all persons with descriptors
  for (const person of personsWithDescriptors) {
    if (!person.descriptors || !Array.isArray(person.descriptors)) continue;
    
    // Get all descriptors for this person (from different photos)
    for (const descriptorEntry of person.descriptors) {
      const storedDescriptor = new Float32Array(descriptorEntry.descriptor);
      const distance = euclideanDistance(faceDescriptor, storedDescriptor);
      const modelMatches = descriptorEntry.model === faceModel;
      const effectiveDistance = modelMatches ? distance : distance + 0.01;

      if (effectiveDistance >= threshold) {
        continue;
      }

      // Keep only the best match for this person, using effective distance for comparison
      if (!personBestMatches[person.personID] || effectiveDistance < personBestMatches[person.personID].effectiveDistance) {
        const alreadyInPhoto = item.value.person.some(p => p.personID === person.personID);
        personBestMatches[person.personID] = {
          personID: person.personID,
          first: person.first,
          last: person.last,
          distance,
          effectiveDistance,
          confidence: Math.round((1 - distance) * 100), // Convert distance to confidence %
          referenceLink: descriptorEntry.link,
          referenceRegion: descriptorEntry.region || null,
          alreadyInPhoto: alreadyInPhoto
        };
      }
    }
  }
  
  // Convert to array and sort by effective distance (best matches first)
  const matches = Object.values(personBestMatches);
  matches.sort((a, b) => a.effectiveDistance - b.effectiveDistance);
  return matches.slice(0, 20);
};

// Calculate Euclidean distance between two face descriptors
const euclideanDistance = (descriptor1, descriptor2) => {
  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

// Toggle match selection (now single-select only)
const toggleMatchSelection = (personID) => {
  // Clear previous selection and select this one
  selectedMatches.value = new Set([personID]);
};

// Auto-select unmatched faces from person library (high confidence matches only)
const autoAssignUnmatchedFaces = async () => {
  // Convert percentage (0.60 = 60%) to distance threshold
  // Formula matches searchPersonLibrary: confidence = (1 - distance) * 100
  // Therefore: distance = 1 - (confidence / 100) = 1 - autoAssignThreshold
  // For 60% confidence: distance = 1 - 0.60 = 0.40
  const distanceThreshold = 1 - autoAssignThreshold.value;
  
  let selectedCount = 0;
  
  // Get persons with descriptors from library
  const personsWithDescriptors = await window.electronAPI.getPersonsWithDescriptors();
  if (personsWithDescriptors.length === 0) {
    return { assigned: 0 };
  }
  
  // Remember how many persons were in photo before Phase 2 matching
  const existingPersonCount = item.value.person.length;
  
  // Track Phase 2 assignments with match confidence for replacement logic
  // Map: personID → { faceIndex, confidence }
  const phase2Assignments = new Map();
  
  // Sort unmatched faces by detection confidence (highest first)
  // This prioritizes high-quality face descriptors for more reliable matching
  const sortedUnmatchedFaces = [...unmatchedFaces.value].sort((a, b) => {
    const faceA = detectedFaces.value[a.faceIndex];
    const faceB = detectedFaces.value[b.faceIndex];
    return faceB.confidence - faceA.confidence; // Descending: highest confidence first
  });
  
  // Process each unmatched face
  for (const unmatchedFace of sortedUnmatchedFaces) {
    const faceIndex = unmatchedFace.faceIndex;
    const face = detectedFaces.value[faceIndex];
    
    if (!face || !face.descriptor) continue;
    
    // Search for best match in person library (gets multiple matches, sorted by distance)
    // Use the user's autoAssignThreshold for filtering
    const matches = await searchPersonLibrary(Number(faceIndex), personsWithDescriptors, distanceThreshold);
    
    if (matches.length === 0) continue;
    
    // Try to find a match that doesn't already have a face assigned
    // Start with best match, fall back to next-best if needed
    let assignedThisFace = false;
    
    for (const match of matches) {
      // Only consider matches above threshold
      if (match.distance > distanceThreshold) {
        break; // Remaining matches are below threshold
      }
      
      // Skip if this face is already assigned to another person
      const faceAlreadySelected = Object.values(faceAssignments.value).includes(faceIndex);
      if (faceAlreadySelected) {
        continue;
      }
      
      // Check if person is already in photo
      const personInPhoto = item.value.person.find(p => p.personID === match.personID);
      
      if (personInPhoto) {
        // Person exists - check if they were matched in Phase 1 or Phase 2
        const existingPhase2Match = phase2Assignments.get(match.personID);
        
        if (!existingPhase2Match) {
          // Person was in photo before Phase 2 started (Phase 1 match) - never touch these
          continue;
        }
        
        // Person was matched in Phase 2 - compare match confidences
        if (match.confidence > existingPhase2Match.confidence) {
          // New match is better! Replace the old assignment
          const oldFaceIndex = existingPhase2Match.faceIndex;
          
          // Unassign old face (becomes available again)
          delete faceAssignments.value[match.personID];
          
          // Assign new face
          faceAssignments.value[match.personID] = faceIndex;
          
          // Update Phase 2 tracking
          phase2Assignments.set(match.personID, { faceIndex, confidence: match.confidence });
          
          selectedCount++; // Count as a selection (though it's a replacement)
          assignedThisFace = true;
          break;
        } else {
          // Existing match is better - skip
          continue;
        }
      }
      
      // Found a new match without conflicts - use it
      
      // Add person to photo (we already verified they're not in it)
      const newPerson = {
        personID: match.personID,
        position: ''
      };
      item.value.person.push(newPerson);
      personListKey.value++;
      
      // Set face selection
      faceAssignments.value[match.personID] = faceIndex;
      
      // Track this Phase 2 assignment for potential upgrades
      phase2Assignments.set(match.personID, { faceIndex, confidence: match.confidence });
      
      selectedCount++;
      assignedThisFace = true;
      break; // Successfully assigned this face, move to next face
    }
  }
  
  // Sort newly-added persons (Phase 2 matches) by left-to-right face position
  // This maintains existing person order while organizing new matches spatially
  if (item.value.person.length > existingPersonCount) {
    const existingPersons = item.value.person.slice(0, existingPersonCount);
    const newPersons = item.value.person.slice(existingPersonCount);
    
    // Sort new persons by their assigned face's X position
    newPersons.sort((a, b) => {
      const faceIndexA = faceAssignments.value[a.personID];
      const faceIndexB = faceAssignments.value[b.personID];
      
      if (faceIndexA === undefined || faceIndexB === undefined) return 0;
      
      const faceA = detectedFaces.value[faceIndexA];
      const faceB = detectedFaces.value[faceIndexB];
      
      if (!faceA || !faceB) return 0;
      
      return faceA.region.x - faceB.region.x; // Left to right
    });
    
    // Rebuild person list: existing persons first, then sorted new persons
    item.value.person = [...existingPersons, ...newPersons];
    personListKey.value++; // Trigger re-render
  }
  
  return { selected: selectedCount };
};

// Add selected match to photo and assign face
const addSelectedMatches = async () => {
  if (selectedMatches.value.size === 0) {
    alert('No person selected');
    return;
  }
  
  // Get the single selected person and current search face
  const personID = Array.from(selectedMatches.value)[0];
  const faceIndex = Number(currentSearchFaceIndex.value);
  
  if (faceIndex === null || faceIndex === undefined) {
    alert('No face index found');
    return;
  }
  
  // Check if person already exists in item.person
  const existingPersonIndex = item.value.person.findIndex(p => p.personID === personID);
  
  if (existingPersonIndex >= 0) {
    // Person exists - just set their face assignment
    faceAssignments.value[personID] = faceIndex;
  } else {
    // Person doesn't exist - add them and set face assignment
    const newPerson = {
      personID: personID,
      position: ''
    };
    item.value.person.push(newPerson);
    faceAssignments.value[personID] = faceIndex;
    personListKey.value++; // Force re-render
  }
  
  // Auto-press assign button
  await assignFaceToPersonByID(personID);
  
  // Clear selection and close modal
  selectedMatches.value = new Set();
  showSimilaritySearch.value = false;
};

// Close similarity search modal
const closeSimilaritySearch = () => {
  showSimilaritySearch.value = false;
  selectedMatches.value = new Set();
};

const loadImageForSnapshot = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode reference photo image'));
    img.src = src;
  });
};

const getCurrentPreviewLayoutSize = () => {
  const img = imageElement.value;
  if (!img) {
    return null;
  }

  const rect = img.getBoundingClientRect();
  const width = Number(rect?.width || 0);
  const height = Number(rect?.height || 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    width,
    height
  };
};

const isUserCanceledOpenError = (errorValue) => {
  const text = String(errorValue || '').toLowerCase();
  if (!text) {
    return false;
  }

  // Different desktop/opening stacks use different wording for user cancellation.
  return /cancel(?:led|ed)?|dismissed|aborted|portal.*cancel/.test(text);
};

const isReferencePhotoMissingOrDecodeError = (errorValue) => {
  const text = String(errorValue || '').toLowerCase();
  if (!text) {
    return false;
  }

  return /not found|no such file|enoent|failed to decode reference photo image|invalid snapshot image format|snapshot image is empty/.test(text);
};

const isTransientMediaOpenInvokeError = (errorValue) => {
  const text = String(errorValue || '').toLowerCase();
  if (!text) {
    return false;
  }

  // IPC lifecycle churn can reject invoke without indicating a media-path failure.
  return /reply\b.*never sent|object has been destroyed|render frame was disposed|channel closed|webcontents.*destroyed/.test(text);
};

// Open reference photo in snapshot view with optional region + label overlay.
const openReferencePhoto = async (match) => {
  const link = match?.referenceLink;
  if (!link) {
    return;
  }

  // Don't show messages if component has been unmounted
  if (!isMounted.value) {
    return;
  }
  
  try {
    const label = getPersonDisplayName({
      first: match?.first,
      last: match?.last
    });

    const region = match?.referenceRegion;
    const hasRegion = region
      && Number.isFinite(Number(region.x))
      && Number.isFinite(Number(region.y))
      && Number.isFinite(Number(region.w))
      && Number.isFinite(Number(region.h));

    if (!hasRegion) {
      const fallbackResult = await window.electronAPI.openMediaExternal('photo', link);
      if (!fallbackResult?.success && isMounted.value) {
        if (isUserCanceledOpenError(fallbackResult?.error)) {
          return;
        }
        // File was resolved, but external viewer launch can still fail (or be cancelled by user).
        // Keep this non-fatal to avoid false "not found" messages.
        console.warn('[REFERENCE PHOTO] External viewer open failed:', fallbackResult?.error);
      }
      return;
    }

    const mediaPath = await window.electronAPI.getMediaPath('photo', link);
    if (!mediaPath) {
      if (isMounted.value) {
        statusMessage.value = { type: 'error', text: 'Reference photo not found or could not be opened' };
        scheduleStatusMessageClear(3000);
      }
      return;
    }

    const referenceImage = await loadImageForSnapshot(mediaPath);
    const previewLayout = getCurrentPreviewLayoutSize();
    const snapshotResult = renderSnapshotDataUrlFromImageSource({
      imageSource: referenceImage,
      mode: FACE_OVERLAY_MODE.ALL,
      hoveredFaceIndex: null,
      layoutWidth: previewLayout?.width,
      layoutHeight: previewLayout?.height,
      faces: buildSingleSnapshotFace({
        label,
        region,
        faceIndex: 0,
        numberText: '1'
      })
    });

    if (!snapshotResult.success) {
      if (isMounted.value) {
        statusMessage.value = { type: 'error', text: `Reference snapshot failed: ${snapshotResult.error || 'unknown error'}` };
        scheduleStatusMessageClear(3000);
      }
      return;
    }

    const result = await window.electronAPI.openMediaSnapshotImageExternal({
      dataUrl: snapshotResult.dataUrl,
      link
    });
    
    if (!result.success && isMounted.value) {
      if (isUserCanceledOpenError(result?.error)) {
        return;
      }
      // Snapshot rendered successfully; launch failure is usually chooser/app-level and not
      // a missing reference photo. Log for debugging but do not show a false not-found error.
      console.warn('[REFERENCE PHOTO] Snapshot viewer open failed:', result.error);
    }
  } catch (error) {
    if (isUserCanceledOpenError(error?.message || error)) {
      return;
    }
    console.error('[REFERENCE PHOTO] Error opening reference photo:', error);
    if (isMounted.value && isReferencePhotoMissingOrDecodeError(error?.message || error)) {
      statusMessage.value = { type: 'error', text: 'Reference photo not found or could not be opened' };
      scheduleStatusMessageClear(3000);
    }
  }
};

// Search for next unmatched face
const searchNextFace = async () => {
  const currentIndex = unmatchedFaces.value.findIndex(f => f.faceIndex === currentSearchFaceIndex.value);
  if (currentIndex < unmatchedFaces.value.length - 1) {
    searchingFaces.value = true;
    try {
      const personsWithDescriptors = await window.electronAPI.getPersonsWithDescriptors();
      currentSearchFaceIndex.value = unmatchedFaces.value[currentIndex + 1].faceIndex;
      const matches = await searchPersonLibrary(currentSearchFaceIndex.value, personsWithDescriptors);
      similarityMatches.value = matches;
      selectedMatches.value = new Set();
    } catch (error) {
      console.error('Error searching next face:', error);
    } finally {
      searchingFaces.value = false;
    }
  } else {
    alert('No more unmatched faces');
    closeSimilaritySearch();
  }
};

const drawFaceOverlays = () => {
  try {
    if (!faceCanvas.value || !imageElement.value) {
      return;
    }
    
    const canvas = faceCanvas.value;
    const ctx = canvas.getContext('2d');
    const img = imageElement.value;
    
    if (!ctx || !img) {
      console.warn('drawFaceOverlays: Missing context or image element');
      return;
    }
    
    // Ensure canvas matches displayed image size
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    
    // Position canvas to overlay the centered image
    const containerRect = img.parentElement.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    canvas.style.left = (imgRect.left - containerRect.left) + 'px';
    canvas.style.top = (imgRect.top - containerRect.top) + 'px';
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = FACE_OVERLAY_STYLE.labelFont;
    
    const faces = detectedFaces.value
      .map((face, index) => {
        if (!face || !face.region) {
          return null;
        }

        const isMatched = matchedFaces.value.some(m => Number(m.faceIndex) === Number(index));
        const isUnmatched = unmatchedFaces.value.some(u => Number(u.faceIndex) === Number(index));
        const isExcluded = excludedFaceIndices.value.has(index);
        if (!isMatched && !isUnmatched && !isExcluded) {
          return null;
        }

        return {
          faceIndex: index,
          numberText: String(index + 1),
          label: isMatched ? getPersonLabelForFaceIndex(index) : (isExcluded ? 'Excluded' : null),
          state: isMatched ? 'matched' : (isExcluded ? 'excluded' : 'unmatched'),
          region: face.region
        };
      })
      .filter(Boolean);

    const hasHoverValue = hoveredFaceIndex.value !== null
      && hoveredFaceIndex.value !== undefined
      && hoveredFaceIndex.value !== '';
    const hoveredIndex = hasHoverValue ? Number(hoveredFaceIndex.value) : null;
    const hasValidHoveredFace = Number.isFinite(hoveredIndex)
      && faces.some(face => Number(face.faceIndex) === hoveredIndex);

    const layout = computeFaceOverlayLayout({
      faces,
      renderWidth: canvas.width,
      renderHeight: canvas.height,
      mode: faceTagsMode.value,
      hoveredFaceIndex: hasValidHoveredFace ? hoveredIndex : null,
      measureText: (text) => ctx.measureText(text).width
    });

    let entriesToDraw = layout;
    const shouldIsolateHoveredFace = hoveredFaceIndex.value !== null
      && (faceTagsMode.value === FACE_OVERLAY_MODE.REGIONS || faceTagsMode.value === FACE_OVERLAY_MODE.ALL);
    if (shouldIsolateHoveredFace || (hoveringFaceControl.value && hoveredFaceIndex.value !== null)) {
      const hoveredEntries = layout.filter(entry => Number(entry.faceIndex) === Number(hoveredFaceIndex.value));
      // If hover state points to a stale/non-renderable face, fall back to drawing all.
      entriesToDraw = hoveredEntries.length > 0 ? hoveredEntries : layout;
    }

    for (const entry of entriesToDraw) {
      const color = entry.state === 'matched'
        ? '#0080ff'
        : (entry.state === 'excluded' ? '#f59e0b' : '#00ff00');

      if (entry.regionVisible) {
        ctx.strokeStyle = color;
        ctx.lineWidth = FACE_OVERLAY_STYLE.borderWidth;
        ctx.strokeRect(entry.rect.x, entry.rect.y, entry.rect.w, entry.rect.h);

        ctx.font = FACE_OVERLAY_STYLE.numberFont;
        const faceNumMetrics = ctx.measureText(entry.numberText);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(entry.rect.x + 2, entry.rect.y + 2, faceNumMetrics.width + 8, FACE_OVERLAY_STYLE.numberBoxHeight);

        ctx.fillStyle = color;
        ctx.fillText(entry.numberText, entry.rect.x + 6, entry.rect.y + FACE_OVERLAY_STYLE.numberTextYOffset);
      }

      if (entry.labelVisible && entry.labelText && entry.labelRect) {
        ctx.font = FACE_OVERLAY_STYLE.labelFont;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.fillRect(entry.labelRect.x, entry.labelRect.y, entry.labelRect.w, entry.labelRect.h);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(entry.labelText, entry.labelRect.x + 5, entry.labelRect.y + FACE_OVERLAY_STYLE.labelTextYOffset);
      }
    }
  } catch (err) {
    console.error('Error drawing face overlays:', err);
  }
};

const buildUnresolvedCandidateFacesForSave = () => {
  if (item.value.type !== 'photo' || detectedFaces.value.length === 0) {
    return null;
  }

  const unresolved = [];
  for (const unmatchedFace of unmatchedFaces.value) {
    const faceIndex = Number(unmatchedFace.faceIndex);
    if (Number.isNaN(faceIndex)) continue;

    const fullFace = detectedFaces.value[faceIndex];
    if (!fullFace || !fullFace.region || !Array.isArray(fullFace.descriptor)) {
      continue;
    }

    unresolved.push({
      candidateID: unmatchedFace.candidateID || fullFace.candidateID || candidateFaceIDsByIndex.value[faceIndex] || null,
      link: item.value.link,
      accession: item.value.accession || null,
      type: 'photo',
      region: {
        x: fullFace.region.x,
        y: fullFace.region.y,
        w: fullFace.region.w,
        h: fullFace.region.h
      },
      descriptor: Array.from(fullFace.descriptor),
      model: fullFace.model || selectedModels.value[0] || 'ssd',
      confidence: typeof fullFace.confidence === 'number' ? fullFace.confidence : null,
      quality: null,
      detectedAt: new Date().toISOString()
    });
  }

  for (const candidate of Object.values(excludedCandidatesPendingByID.value)) {
    if (!candidate || !candidate.candidateID) {
      continue;
    }
    unresolved.push(candidate);
  }

  return unresolved;
};

const confirmPendingFaceSaveChanges = async () => {
  const unresolvedCount = unmatchedFaces.value.length;
  const excludedCount = Object.keys(excludedCandidatesPendingByID.value).length;

  if (unresolvedCount === 0 && excludedCount === 0) {
    return true;
  }

  if (excludedCount > 0 && unresolvedCount > 0) {
    return showConfirm(
      'Unassigned And Excluded Faces',
      `You have ${unresolvedCount} detected face(s) that are still unresolved and ${excludedCount} face(s) marked Exclude from Matching.\n\nSaving now will keep the unresolved faces as candidate faces and save the excluded face(s) so they are no longer used for descriptor matching.\n\nDo you want to save these face changes now?`,
      'Save Face Changes',
      'Go Back'
    );
  }

  if (excludedCount > 0) {
    return showConfirm(
      'Excluded Faces Pending Save',
      `You have ${excludedCount} face(s) marked Exclude from Matching.\n\nSaving now will persist that change so those face(s) remain visible but are no longer used for descriptor matching.\n\nDo you want to save this exclusion now?`,
      'Save Exclusion',
      'Go Back'
    );
  }

  return showConfirm(
    'Unassigned Faces',
    `Warning: You have ${unresolvedCount} detected face(s) that are not assigned to anyone.\n\nThis may mean you forgot to press the "Assign" button.\n\nDo you want to save anyway?`,
    'Save Anyway',
    'Go Back'
  );
};

const handleSave = async () => {
  if (saveCloseTimer) {
    clearTimeout(saveCloseTimer);
    saveCloseTimer = null;
  }

  if (faceProcessingControlsDisabled.value) {
    return;
  }

  // Confirm pending face state changes before save.
  if (item.value.type === 'photo') {
    const proceed = await confirmPendingFaceSaveChanges();
    if (!proceed) {
      return;
    }
  }
  
  saving.value = true;
  statusMessage.value = { type: 'info', text: 'Saving changes...' };

  try {
    // Defensive: Ensure item.value is a valid object
    if (!item.value || typeof item.value !== 'object') {
      statusMessage.value = { type: 'error', text: 'Error: Item data is invalid (null or not an object). Cannot save.' };
      saving.value = false;
      return;
    }

    // Validate no duplicate person assignments
    const personIDs = item.value.person
      .map(p => p.personID)
      .filter(id => id);
    const hasDuplicates = personIDs.length !== new Set(personIDs).size;

    if (hasDuplicates) {
      statusMessage.value = { type: 'error', text: 'Cannot save: same person appears multiple times' };
      saving.value = false;
      return;
    }
    
    // Validate playlist entries
    if (!validatePlaylist()) {
      statusMessage.value = { type: 'error', text: 'Cannot save: playlist entries have validation errors (see red highlights)' };
      saving.value = false;
      return;
    }

    // Clean up empty objects before saving
    const cleanedItem = {
      ...item.value,
      location: item.value.location.filter(loc => 
        loc.detail || loc.city || loc.state || (loc.latitude && loc.longitude)
      ),
      person: item.value.person.filter(p => p.personID).map(p => ({...p})), // Deep copy to avoid affecting UI
      source: item.value.source.filter(s => s.personID)
    };

    // Clean up playlist entries
    if (item.value.playlist && item.value.playlist.entry) {
      const filteredEntries = item.value.playlist.entry.filter(e => e.ref && e.starttime && e.duration);
      if (filteredEntries.length > 0) {
        cleanedItem.playlist = { entry: filteredEntries };
      } else {
        delete cleanedItem.playlist;
      }
    }

    // Remove empty date if no fields filled
    if (!cleanedItem.date.year && !cleanedItem.date.month && !cleanedItem.date.day) {
      delete cleanedItem.date;
    } else if (cleanedItem.date && !cleanedItem.date.time) {
      delete cleanedItem.date.time;
    }

    const unresolvedCandidates = buildUnresolvedCandidateFacesForSave();
    if (unresolvedCandidates) {
      cleanedItem.candidatefaces = unresolvedCandidates;
    }

    // Keep faceTags in person objects for backend to process
    // Backend will extract and save them to person library, then remove before persisting item
    
    // Convert to plain object to avoid IPC cloning issues
    const plainItem = JSON.parse(JSON.stringify(cleanedItem));

    const result = await window.electronAPI.saveItem(plainItem);

    if (result.success) {
      hasUnsavedChanges.value = false;
      clearStatusMessageClearTimer();
      statusMessage.value = { type: 'success', text: 'Changes saved successfully!' };
      
      // Only close window if not in queue mode
      if (!hasQueue.value) {
        scheduleSaveWindowCloseIfStillSuccessful();
      } else {
        scheduleStatusMessageClear(2000);
        saving.value = false;
      }
    } else {
      statusMessage.value = { type: 'error', text: 'Error: ' + result.error };
      saving.value = false;
    }
  } catch (err) {
    statusMessage.value = { type: 'error', text: 'Error saving: ' + err.message };
    saving.value = false;
  }
};

const handleDelete = async () => {
  if (faceProcessingControlsDisabled.value) {
    return;
  }

  if (!deleteInfo.value.canDelete) {
    return;
  }

  showDeleteModal.value = true;
};

const handleCancel = async () => {
  if (faceProcessingControlsDisabled.value) {
    return;
  }

  await window.electronAPI.saveWindowGeometry();
  window.close();
};

// Queue navigation functions
const hasQueue = computed(() => queueData.value && queueData.value.queue && queueData.value.queue.length > 0);
const hasPrevItem = computed(() => hasQueue.value && currentQueueIndex.value > 0);
const hasNextItem = computed(() => hasQueue.value && currentQueueIndex.value < queueData.value.queue.length - 1);
const queuePosition = computed(() => {
  if (!hasQueue.value || currentQueueIndex.value < 0) return '';
  return `${currentQueueIndex.value + 1} / ${queueData.value.queue.length}`;
});
const processingCollectionTitle = computed(() => {
  const raw = queueData.value?.collectionText;
  return raw && String(raw).trim() ? String(raw).trim() : 'Selected Collection';
});
const processingCollectionTitleShort = computed(() => {
  const title = processingCollectionTitle.value;
  return title.length > 44 ? `${title.slice(0, 41)}...` : title;
});
const faceProcessingControlsDisabled = computed(() => batchPhaseOneRunning.value || detectingFaces.value);
const showClearFaceData = computed(() => (
  item.value.type === 'photo'
  && (unmatchedFaces.value.length > 0 || excludedFaceIndices.value.size > 0)
));
const showClearUnassignedPersons = computed(() => (
  item.value.type === 'photo'
  && item.value.person.some(person => !getMatchForPerson(person.personID))
));

const faceAssignmentSummary = computed(() => {
  const total = detectedFaces.value.length;
  if (total === 0) {
    return 'No faces detected yet';
  }

  const assigned = matchedFaces.value.length;
  const unresolved = unmatchedFaces.value.length;
  return `${assigned} assigned, ${unresolved} unresolved, ${total} detected`;
});

const batchPhaseOneProgressText = computed(() => {
  if (batchPhaseOneSummary.value) {
    return batchPhaseOneSummary.value;
  }

  const progress = batchPhaseOneProgress.value;
  if (!progress) return '';

  const prefix = `Batch ${progress.processed}/${progress.total}`;
  const cancelSuffix = batchCancelRequested.value ? ' (cancel pending)' : '';
  if (progress.skipped) {
    return `${prefix}: skipped ${progress.link} (${progress.reason || 'ignored'})${cancelSuffix}`;
  }

  return `${prefix}: ${progress.link} -> ${progress.unresolvedCandidates || 0} unresolved candidate(s)${cancelSuffix}`;
});

const runBatchFacePhaseOne = async () => {
  if (!hasQueue.value || batchPhaseOneRunning.value) {
    return;
  }

  const queueLinks = Array.isArray(queueData.value?.queue)
    ? queueData.value.queue.map(link => String(link))
    : [];
  if (queueLinks.length === 0) {
    statusMessage.value = { type: 'info', text: 'No queue items available for batch processing.' };
    scheduleStatusMessageClear(3000);
    return;
  }

  const proceed = await showConfirm(
    'Run Batch Face Detection (Phase 1)',
    `Run phase 1 face detection for ${queueLinks.length} queue item(s)? This stores unmatched regions in candidatefaces and keeps existing person assignments untouched.`,
    'Run Batch',
    'Cancel'
  );

  if (!proceed) {
    return;
  }

  batchPhaseOneRunning.value = true;
  batchCancelRequested.value = false;
  batchPhaseOneSummary.value = '';
  batchPhaseOneProgress.value = { processed: 0, total: queueLinks.length, link: '' };

  // Flush UI so operator immediately sees the batch-running state.
  await nextTick();

  try {
    const result = await window.electronAPI.runBatchFacePhaseOne({
      links: [...queueLinks],
      models: [...selectedModels.value].map(model => String(model)),
      minConfidence: Number(confidenceThreshold.value)
    });

    if (!result.success) {
      statusMessage.value = { type: 'error', text: `Batch failed: ${result.error}` };
      return;
    }

    const skippedTotal = Number(result?.skipped?.total || 0);
    const skippedMissing = Number(result?.skipped?.missingFiles || 0);
    const skippedUnreadable = Number(result?.skipped?.unreadableFiles || 0);
    const skippedOther = Number(result?.skipped?.other || 0);
    const skipSummary = skippedTotal > 0
      ? ` Skipped ${skippedTotal} item(s) [missing: ${skippedMissing}, unreadable: ${skippedUnreadable}, other: ${skippedOther}].`
      : '';
    const logSummary = result?.log?.filename
      ? ` Report: ${result.log.filename}`
      : '';

    const runSummary = result.canceled
      ? `Batch canceled after ${result.processed}/${result.total} item(s). ${result.totalCandidatesAdded} unresolved candidate(s) saved.${skipSummary}${logSummary}`
      : `Batch complete: ${result.photosProcessed} photo(s), ${result.totalFacesDetected} face(s), ${result.totalCandidatesAdded} unresolved candidate(s) saved.${skipSummary}${logSummary}`;

    batchPhaseOneSummary.value = runSummary;
  } catch (err) {
    statusMessage.value = { type: 'error', text: `Batch failed: ${err.message}` };
  } finally {
    batchPhaseOneRunning.value = false;
    batchCancelRequested.value = false;
  }
};

const cancelBatchFacePhaseOne = async () => {
  try {
    batchCancelRequested.value = true;
    await window.electronAPI.cancelBatchFacePhaseOne();
  } catch (err) {
    batchCancelRequested.value = false;
    statusMessage.value = { type: 'error', text: `Failed to cancel batch: ${err.message}` };
  }
};

const navigateToQueueItem = (newIndex) => {
  if (!hasQueue.value || newIndex < 0 || newIndex >= queueData.value.queue.length) return;
  
  const newLink = queueData.value.queue[newIndex];
  const searchParams = `link=${encodeURIComponent(newLink)}&idx=${newIndex}&queue=${encodeURIComponent(JSON.stringify(queueData.value))}`;
  window.location.search = searchParams;
};

// Find next item of same type (or specifically next photo if current is photo)
const findNextItemOfSameType = async (startIndex, direction = 1) => {
  if (!hasQueue.value) return -1;
  
  // If current item is not a photo, navigate normally
  if (item.value.type !== 'photo') {
    const nextIndex = startIndex + direction;
    if (nextIndex >= 0 && nextIndex < queueData.value.queue.length) {
      return nextIndex;
    }
    return -1;
  }
  
  // Current item is a photo - find next photo
  let index = startIndex + direction;
  const maxAttempts = 20; // Prevent infinite loops
  let attempts = 0;
  
  while (index >= 0 && index < queueData.value.queue.length && attempts < maxAttempts) {
    attempts++;
    const link = queueData.value.queue[index];
    
    try {
      // Load just to check type
      const testItem = await window.electronAPI.loadItem(link);
      if (testItem && testItem.type === 'photo') {
        return index; // Found a photo
      }
    } catch (err) {
      console.error('Error checking item type:', err);
    }
    
    // Not a photo, try next
    index += direction;
  }
  
  return -1; // No photo found in this direction
};

const handlePrevItem = async () => {
  if (!hasPrevItem.value) return;
  
  if (hasUnsavedChanges.value) {
    const confirmNav = await showConfirm(
      'Unsaved Changes',
      'You have unsaved changes. Do you want to discard them and go to the previous item?',
      'Discard & Go',
      'Stay Here'
    );
    if (!confirmNav) return;
  }
  
  // Find previous item of same type (photo-only if current is photo)
  const prevIndex = await findNextItemOfSameType(currentQueueIndex.value, -1);
  
  if (prevIndex === -1) {
    if (item.value.type === 'photo') {
      statusMessage.value = { type: 'info', text: 'No more photos in this direction' };
      scheduleStatusMessageClear(2000);
    }
    return;
  }
  
  navigateToQueueItem(prevIndex);
};

const handleNextItem = async () => {
  if (!hasNextItem.value) return;
  
  if (hasUnsavedChanges.value) {
    const confirmNav = await showConfirm(
      'Unsaved Changes',
      'You have unsaved changes. Do you want to discard them and go to the next item?',
      'Discard & Go',
      'Stay Here'
    );
    if (!confirmNav) return;
  }
  
  // Find next item of same type (photo-only if current is photo)
  const nextIndex = await findNextItemOfSameType(currentQueueIndex.value, 1);
  
  if (nextIndex === -1) {
    if (item.value.type === 'photo') {
      statusMessage.value = { type: 'info', text: 'No more photos in queue' };
      scheduleStatusMessageClear(2000);
    }
    return;
  }
  
  navigateToQueueItem(nextIndex);
};

const handleSaveAndNavigate = async (direction = 1) => {
  if (item.value.type === 'photo') {
    const proceed = await confirmPendingFaceSaveChanges();
    if (!proceed) {
      return;
    }
  }
  
  saving.value = true;
  
  try {
    // Validate no duplicate person assignments
    const personIDs = item.value.person
      .map(p => p.personID)
      .filter(id => id);
    const hasDuplicates = personIDs.length !== new Set(personIDs).size;

    if (hasDuplicates) {
      statusMessage.value = { type: 'error', text: 'Cannot save: same person appears multiple times' };
      saving.value = false;
      return;
    }
    
    // Validate playlist entries
    if (!validatePlaylist()) {
      statusMessage.value = { type: 'error', text: 'Cannot save: playlist entries have validation errors' };
      saving.value = false;
      return;
    }

    // Clean up empty objects before saving (same logic as handleSave)
    const cleanedItem = {
      ...item.value,
      location: item.value.location.filter(loc => 
        loc.detail || loc.city || loc.state || (loc.latitude && loc.longitude)
      ),
      person: item.value.person.filter(p => p.personID).map(p => ({...p})),
      source: item.value.source.filter(s => s.personID)
    };

    // Clean up playlist entries
    if (item.value.playlist && item.value.playlist.entry) {
      const filteredEntries = item.value.playlist.entry.filter(e => e.ref && e.starttime && e.duration);
      if (filteredEntries.length > 0) {
        cleanedItem.playlist = { entry: filteredEntries };
      } else {
        delete cleanedItem.playlist;
      }
    }

    // Remove empty date if no fields filled
    if (!cleanedItem.date.year && !cleanedItem.date.month && !cleanedItem.date.day) {
      delete cleanedItem.date;
    } else if (cleanedItem.date && !cleanedItem.date.time) {
      delete cleanedItem.date.time;
    }

    const unresolvedCandidates = buildUnresolvedCandidateFacesForSave();
    if (unresolvedCandidates) {
      cleanedItem.candidatefaces = unresolvedCandidates;
    }
    
    // Convert to plain object to avoid IPC cloning issues
    const plainItem = JSON.parse(JSON.stringify(cleanedItem));

    // Save the item
    const result = await window.electronAPI.saveItem(plainItem);

    if (result.success) {
      hasUnsavedChanges.value = false;
      
      // Navigate within queue by direction (photo-only if current is photo)
      const hasDirectionTarget = direction > 0 ? hasNextItem.value : hasPrevItem.value;
      if (hasDirectionTarget) {
        const targetIndex = await findNextItemOfSameType(currentQueueIndex.value, direction);
        
        if (targetIndex === -1) {
          if (item.value.type === 'photo') {
            statusMessage.value = {
              type: 'success',
              text: direction > 0 ? 'Saved! No more photos ahead in queue.' : 'Saved! No more photos behind in queue.'
            };
          } else {
            statusMessage.value = {
              type: 'success',
              text: direction > 0 ? 'Saved! No more items ahead in queue.' : 'Saved! No more items behind in queue.'
            };
          }
          saving.value = false;
        } else {
          navigateToQueueItem(targetIndex);
        }
      } else {
        statusMessage.value = {
          type: 'success',
          text: direction > 0 ? 'Saved! End of queue.' : 'Saved! Start of queue.'
        };
        saving.value = false;
      }
    } else {
      statusMessage.value = { type: 'error', text: 'Error: ' + result.error };
      saving.value = false;
    }
  } catch (error) {
    console.error('Error saving item:', error);
    statusMessage.value = { type: 'error', text: 'Error saving: ' + error.message };
    saving.value = false;
  }
};

const handleSaveAndNext = async () => {
  await handleSaveAndNavigate(1);
};

const handleSaveAndPrev = async () => {
  await handleSaveAndNavigate(-1);
};

// Track changes to item data
watch(item, () => {
  if (!loading.value && !suppressUnsavedTracking.value) {
    hasUnsavedChanges.value = true;
  }
}, { deep: true });

onMounted(async () => {
  try {
    // Get item identifier and queue data from query string
    const urlParams = new URLSearchParams(window.location.search);
    const identifier = urlParams.get('link');
    const queueIndexParam = Number.parseInt(urlParams.get('idx'), 10);
    const queueParam = urlParams.get('queue');
    
    // Parse queue data if provided
    if (queueParam) {
      try {
        queueData.value = JSON.parse(decodeURIComponent(queueParam));
        // Find current item index in queue
        if (queueData.value && Array.isArray(queueData.value.queue)) {
          const isValidIndex = Number.isInteger(queueIndexParam)
            && queueIndexParam >= 0
            && queueIndexParam < queueData.value.queue.length
            && queueData.value.queue[queueIndexParam] === identifier;

          currentQueueIndex.value = isValidIndex
            ? queueIndexParam
            : queueData.value.queue.indexOf(identifier);
        }
      } catch (e) {
        console.error('Failed to parse queue data:', e);
      }
    }
    
    if (!identifier) {
      error.value = 'No item identifier provided';
      loading.value = false;
      return;
    }
    
    // Load persons and audio/video items in parallel
    const [
      loadedPersons,
      loadedAudioVideo,
      savedConfidenceThreshold,
      savedAutoAssignThreshold,
      savedPhaseOneMatchThreshold,
      savedPhaseOneRegionRestoreIoUThreshold,
      savedFaceDebugEnabled,
      savedFaceTagsMode,
      savedShowFaceTags
    ] = await Promise.all([
      window.electronAPI.getExistingPersons(),
      window.electronAPI.getAudioVideoItems(),
      window.electronAPI.getConfig('faceDetection:confidenceThreshold'),
      window.electronAPI.getConfig('faceDetection:autoAssignThreshold'),
      window.electronAPI.getConfig('faceDetection:phaseOneMatchThreshold'),
      window.electronAPI.getConfig('faceDetection:phaseOneRegionRestoreIoUThreshold'),
      window.electronAPI.getConfig('debug:faceMatching'),
      window.electronAPI.getConfig('mediaManager:faceTagsMode'),
      window.electronAPI.getConfig('mediaManager:showFaceTags')
    ]);
    
    // Set thresholds from config if available
    if (savedConfidenceThreshold !== undefined) {
      confidenceThreshold.value = savedConfidenceThreshold;
    }
    if (savedAutoAssignThreshold !== undefined) {
      autoAssignThreshold.value = savedAutoAssignThreshold;
    };
    if (Number.isFinite(Number(savedPhaseOneMatchThreshold))) {
      phaseOneMatchThreshold.value = Number(savedPhaseOneMatchThreshold);
    }
    if (Number.isFinite(Number(savedPhaseOneRegionRestoreIoUThreshold))) {
      phaseOneRegionRestoreIoUThreshold.value = Number(savedPhaseOneRegionRestoreIoUThreshold);
    }
    faceDebugEnabled.value = savedFaceDebugEnabled === true || savedFaceDebugEnabled === 'true';

    const normalizedMode = normalizeFaceOverlayMode(savedFaceTagsMode);
    if (isValidFaceOverlayMode(normalizedMode)) {
      faceTagsMode.value = normalizedMode;
    } else {
      faceTagsMode.value = savedShowFaceTags ? FACE_OVERLAY_MODE.REGIONS : FACE_OVERLAY_MODE.OFF;
    }

    isInitializingFaceTagsMode.value = false;
    isInitializingThresholds.value = false;
    isInitializingFaceDebugSetting.value = false;
    
    // Expand persons so each appears once per last name (matches nav column behavior)
    persons.value = expandPersonsByLastName(loadedPersons);
    
    // Store audio/video items for playlist dropdown
    audioVideoItems.value = loadedAudioVideo;
    
    // Listen for person saved events to refresh the persons list
    window.electronAPI.onPersonSaved(async () => {
      const refreshedPersons = await window.electronAPI.getExistingPersons();
      // Expand persons so each appears once per last name (matches nav column behavior)
      persons.value = expandPersonsByLastName(refreshedPersons);
      personListKey.value++; // Force re-render of dropdowns
    });
    
    // Listen for person selection from Person Manager
    window.electronAPI.onPersonSelected((personID) => {
      // Check if selecting for a source entry
      if (sourceSelectionIndex.value !== null && item.value.source[sourceSelectionIndex.value]) {
        item.value.source[sourceSelectionIndex.value].personID = personID;
        sourceSelectionIndex.value = null; // Clear selection index
      }
      // Otherwise check if selecting for a person entry
      else if (personSelectionIndex.value !== null && item.value.person[personSelectionIndex.value]) {
        // Set the selected person for the entry
        item.value.person[personSelectionIndex.value].personID = personID;
        personListKey.value++; // Force re-render
        personSelectionIndex.value = null; // Clear selection index
      }
    });

    window.electronAPI.onPersonSelectionCanceled(() => {
      sourceSelectionIndex.value = null;
      personSelectionIndex.value = null;
    });
    
    // Listen for item load events from other windows
    window.electronAPI.onItemLoad(async (identifier, queueDataParam) => {
      if (hasUnsavedChanges.value) {
        const confirmed = await showConfirm(
          'Unsaved Changes',
          'You have unsaved changes. Do you want to discard them and load the new item?',
          'Discard & Load',
          'Stay Here'
        );
        
        if (!confirmed) {
          return; // User chose to stay, don't load new item
        }
      }
      
      // Load the new item with queue data if provided
      let searchParams = `link=${encodeURIComponent(identifier)}`;
      if (queueDataParam) {
        const queueIndex = Array.isArray(queueDataParam.queue)
          ? queueDataParam.queue.indexOf(identifier)
          : -1;
        if (queueIndex >= 0) {
          searchParams += `&idx=${queueIndex}`;
        }
        searchParams += `&queue=${encodeURIComponent(JSON.stringify(queueDataParam))}`;
      }
      window.location.search = searchParams;
    });
    
    // Listen for collection updates and reload item if it's in that collection
    window.electronAPI.onCollectionItemsUpdated((data) => {
      // If the current item is in a collection that was just updated, reload it
      if (queueData.value && queueData.value.collectionKey === data.collectionKey && item.value && item.value.link) {
        if (hasUnsavedChanges.value) {
          statusMessage.value = {
            type: 'info',
            text: 'Collection updated elsewhere. Save or cancel current edits to refresh this item.'
          };
          scheduleStatusMessageClear(3500);
          return;
        }

        // Reload the item from disk to get the latest changes
        const reloadItem = async () => {
          try {
            const reloadedItem = await window.electronAPI.loadItem(item.value.link);
            if (reloadedItem) {
              hydrateItemFromLoadedItem(reloadedItem);
              hasUnsavedChanges.value = false;
            }
          } catch (error) {
            console.error('Error reloading item after collection update:', error);
          }
        };
        reloadItem();
      }
    });

    window.electronAPI.onBatchFaceProgress((progressData) => {
      batchPhaseOneProgress.value = progressData;
    });
    
    const loadedItem = await window.electronAPI.loadItem(identifier);
    
    if (!loadedItem) {
      error.value = 'Item not found';
      loading.value = false;
      return;
    }
    
    // Track file existence and delete status
    deleteInfo.value = loadedItem.deleteInfo || createEmptyDeleteInfo();
    fileExists.value = deleteInfo.value.fileExists ?? true;
    isReferencedInPlaylists.value = loadedItem.isReferencedInPlaylists ?? false;
    // Initialize item with defaults for missing arrays/objects.
    hydrateItemFromLoadedItem(loadedItem);
    
    // Get media preview path
    if (item.value.type && item.value.link) {
      mediaPreviewPath.value = await window.electronAPI.getMediaPath(item.value.type, item.value.link);
      videoError.value = false; // Reset error state for new media
    }
    
    // Load available face detection models and pre-select based on prior usage
    if (item.value.type === 'photo') {
      const modelsResult = await window.electronAPI.getFaceDetectionModels();
      
      if (modelsResult.success) {
        availableModels.value = modelsResult.models;
      }
      
      // Pre-select model based on prior descriptors for this link
      if (item.value.link) {
        try {
          const descriptors = await window.electronAPI.getDescriptorsForLink(item.value.link);
          if (descriptors && descriptors.length > 0) {
            // Count model usage for this link
            const modelCounts = {};
            descriptors.forEach(desc => {
              const model = desc.model || 'ssd';
              modelCounts[model] = (modelCounts[model] || 0) + 1;
            });
            
            // Find most common model
            let maxCount = 0;
            let mostCommonModel = null;
            Object.entries(modelCounts).forEach(([model, count]) => {
              if (count > maxCount) {
                maxCount = count;
                mostCommonModel = model;
              }
            });
            
            // Pre-select the most common model if it's available
            const modelAvailable = availableModels.value.find(m => m.key === mostCommonModel && m.available);
            if (modelAvailable) {
              selectedModels.value = [mostCommonModel];
            }
          }
        } catch (err) {
          console.error('Failed to load descriptors for model pre-selection:', err);
          // Continue without pre-selection
        }
      }
      
      // Load unresolved candidatefaces first (phase 2 queue), then fallback to faceBioData.
      // This will be called after image loads, so we wait for the image
      // The actual loading happens in onImageLoad or we can call it here if needed
      // For now, we'll call it after a short delay to ensure image is ready
      setTimeout(() => {
        loadExistingCandidateFaces().then((loadedCandidates) => {
          loadExistingFaceBioData({ merge: loadedCandidates });
        });
      }, 200);
    }
    
    loading.value = false;
    window.addEventListener('resize', handleWindowResize);
  } catch (err) {
    error.value = err.message;
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  isMounted.value = false;
  clearStatusMessageClearTimer();
  if (hoverClearTimeout) {
    clearTimeout(hoverClearTimeout);
    hoverClearTimeout = null;
  }
  if (saveCloseTimer) {
    clearTimeout(saveCloseTimer);
    saveCloseTimer = null;
  }
  window.removeEventListener('resize', handleWindowResize);
});
</script>

<style scoped>
.container {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem 2rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.subtitle {
  margin: 0.25rem 0 0 0;
  opacity: 0.9;
  font-size: 0.9rem;
}

.queue-navigation {
  background: #6c757d;
  color: white;
  padding: 0.75rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.queue-info {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.collection-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.queue-position {
  font-size: 0.9rem;
  opacity: 0.9;
}

.queue-controls {
  display: flex;
  gap: 0.5rem;
}

.queue-batch-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-batch {
  background: rgba(33, 136, 56, 0.5);
  border-color: rgba(210, 255, 219, 0.45);
}

.btn-batch-cancel {
  background: rgba(172, 35, 35, 0.55);
  border-color: rgba(255, 215, 215, 0.45);
}

.batch-progress-text {
  font-size: 0.82rem;
  opacity: 0.95;
  max-width: 460px;
}

.btn-nav {
  background: #eef2ff;
  color: #1f2937;
  border: 1px solid #c7d2fe;
  padding: 0.4rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-nav:hover:not(:disabled) {
  background: #e0e7ff;
  border-color: #a5b4fc;
}

.btn-nav:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.content {
  flex: 1;
  overflow: hidden;
  padding: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.loading,
.error-box {
  padding: 2rem;
  text-align: center;
  font-size: 1.1rem;
}

.error-box {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  border-radius: 6px;
  margin: 2rem;
}

.media-form {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  height: 100%;
}

.two-column-layout {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(400px, 0.75fr) minmax(400px, 1fr);
  grid-template-rows: 1fr;
  gap: 1.5rem;
  padding: 0;
  background: #f5f5f5;
  min-height: 0;
  height: 100%;
}

.left-column,
.right-column {
  position: relative;
  overflow: auto;
  min-height: 0;
  max-height: 100%;
}

.left-column {
  width: auto;
}

.right-column {
  background: #eeeeff;
}

.action-bar {
  background: white;
  border-top: 1px solid #dee2e6;
  padding: 1rem 2rem;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.05);
  position: sticky;
  bottom: 0;
  z-index: 2;
}

.action-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.queue-action-group {
  flex: 1 1 700px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  padding: 0.45rem 0.65rem;
  flex-wrap: nowrap;
  overflow-x: auto;
}

.save-action-group {
  flex: 0 1 auto;
  justify-content: flex-end;
  flex-wrap: nowrap;
}

.action-group-label {
  color: #4b5563;
  font-size: 0.9rem;
  font-weight: 600;
}

.action-bar .warning-message {
  color: #856404;
  background-color: #fff3cd;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 0.9rem;
}

.action-bar .status-message {
  margin: 0;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 0.9rem;
}

.preview-section {
  display: flex;
  flex-direction: column;
  height: 100%;
  margin-bottom: 0;
  text-align: center;
  background: white;
  overflow: hidden;
}

.preview-and-controls {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 0;
  align-items: stretch;
}

.preview-container {
  position: sticky;
  top: 0;
  flex-shrink: 0;
  width: 100%;
  height: 70%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  background: white;
}

.media-preview {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  border-radius: 4px;
  object-fit: contain;
}

/* Format error overlay */
.format-error-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.98);
  border: 3px solid #ff9800;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  max-width: 90%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 100;
}

.format-error-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.format-error-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.75rem;
}

.format-error-message {
  font-size: 0.9rem;
  color: #666;
  line-height: 1.5;
  margin-bottom: 1rem;
}

.btn-open-external {
  background: #ff9800;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-open-external:hover {
  background: #f57c00;
}

.format-error-hint {
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: #999;
  font-style: italic;
}

.form-section {
  margin-bottom: 0.5rem;
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.form-section label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: #333;
}

.inline-label {
  display: inline;
  margin-right: 0.5rem;
  font-weight: normal;
  font-size: 0.9rem;
}

.info-row {
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 6px;
}

.info-item {
  display: flex;
  gap: 0.5rem;
}

.info-item label {
  font-weight: 600;
  margin: 0;
}

.info-value {
  font-family: 'Courier New', monospace;
  color: #666;
}

.file-detail-list {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.file-detail-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.file-detail-row label {
  width: 96px;
  flex: 0 0 96px;
  margin: 0;
  font-weight: 600;
}

.path-value {
  word-break: break-all;
}

.file-status {
  font-weight: 600;
}

.file-status.present {
  color: #1f6f43;
}

.file-status.missing {
  color: #b42318;
}

.file-status.warning {
  color: #9a6700;
}

.form-section input,
.form-section textarea,
.form-section select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.95rem;
  font-family: inherit;
  box-sizing: border-box;
}

.form-section input:focus,
.form-section textarea:focus,
.form-section select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-section small {
  display: block;
  margin-top: 0.25rem;
  color: #666;
  font-size: 0.85rem;
}

.location-entry,
.person-entry,
.source-entry,
.playlist-entry {
  margin-bottom: 0.75rem;
}

.location-row {
  display: grid;
  grid-template-columns: 2fr 1fr 80px 40px;
  gap: 0.5rem;
  align-items: center;
}

.location-gps {
  grid-template-columns: 1fr 1fr auto 1fr;
  margin-top: 0.25rem;
  gap: 0.5rem;
}

.location-coordinate {
  font-family: monospace;
  font-size: 0.9rem;
}

.btn-lookup {
  padding: 0.375rem 0.75rem;
  background-color: #17a2b8;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  white-space: nowrap;
  transition: background-color 0.2s;
}

.btn-lookup:hover:not(:disabled) {
  background-color: #138496;
}

.btn-lookup:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
  opacity: 0.65;
}

.geocoding-attribution {
  font-size: 0.75rem;
  color: #666;
  font-style: italic;
  margin-top: 0.25rem;
  padding-left: 0.5rem;
}

.gps-hint {
  font-size: 0.85rem;
  color: #666;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  white-space: nowrap;
}

.gps-hint a {
  color: #007bff;
  text-decoration: none;
}

.gps-hint a:hover {
  text-decoration: underline;
}

.person-row {
  display: grid;
  grid-template-columns: 1fr 1.5fr 40px;
  gap: 0.5rem;
  align-items: center;
}

.source-row {
  display: grid;
  grid-template-columns: 1fr 2fr 40px;
  gap: 0.5rem;
  align-items: center;
}

.playlist-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 40px;
  gap: 0.5rem;
  align-items: center;
}

.time-input-group {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.btn-get-time {
  padding: 6px 12px;
  font-size: 14px;
  background: #4a5568;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
  height: auto;
}

.btn-get-time:hover {
  background: #2d3748;
}

.btn-get-time:active {
  background: #1a202c;
}

.playlist-row.validation-error input,
.playlist-row.validation-error select {
  border-color: #dc3545;
  background-color: #fff5f5;
}

/* Playlist dropdown option colors - matching main window */
.playlist-ref option.option-tape,
.playlist-ref option.option-audio {
  background-color: #f1e6c2;
}

.playlist-ref option.option-video {
  background-color: #fab2b8;
}

.validation-errors {
  margin-top: 0.25rem;
  margin-left: 0.5rem;
}

.error-text {
  display: block;
  color: #dc3545;
  font-size: 0.8rem;
  margin-top: 0.1rem;
}

.format-hint {
  display: block;
  margin-top: 0.5rem;
  color: #666;
  font-size: 0.85rem;
  font-style: italic;
}

.playlist-ref {
  flex: 1;
}

.playlist-time {
  width: 110px;
}

.source-date {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.btn-add {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-add:hover {
  background: #218838;
}

.btn-remove {
  padding: 0.5rem;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1.2rem;
  font-weight: bold;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s;
  width: 40px;
  height: 40px;
}

.btn-remove:hover {
  background: #c82333;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #dee2e6;
}

.btn-primary {
  padding: 0.875rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-danger {
  padding: 0.875rem 2rem;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 0.875rem 2rem;
  background: white;
  color: #6c757d;
  border: 1px solid #6c757d;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover:not(:disabled) {
  background: #6c757d;
  color: white;
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.faceTagsCycleBtn {
  padding: 0.625rem 1rem;
  border: 1px solid #9ca3af;
  border-radius: 6px;
  background: #f3f4f6;
  color: #1f2937;
  font-size: 0.85rem;
  cursor: pointer;
}

.faceTagsCycleBtn:hover:not(:disabled) {
  background: #e5e7eb;
}

.faceTagsCycleBtn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-bar .btn-primary,
.action-bar .btn-secondary,
.action-bar .btn-danger,
.action-bar .btn-nav {
  font-size: 0.92rem;
  padding: 0.62rem 1rem;
  min-height: 38px;
}

.status-message {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 6px;
  font-size: 0.95rem;
}

.status-message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.status-message.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

/* Face Detection Styles */
.preview-container {
  position: relative;
  display: inline-block;
}

.face-overlay-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.face-detection-controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: stretch;
  width: 100%;
  height: 30%;
  background: white;
  padding: 1rem;
  overflow-y: auto;
  border-top: 1px solid #dee2e6;
}

.face-controls-status-slot {
  min-height: 26px;
}

.status-message-inline {
  margin-top: 0;
  padding: 0.35rem 0.6rem;
  font-size: 0.82rem;
}

.face-detection-controls .btn-secondary {
  width: auto;
  padding: 0.58rem 0.95rem;
  font-size: 0.9rem;
}

.face-summary-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.6rem;
  flex-wrap: nowrap;
}

.face-summary-text {
  font-size: 0.88rem;
  color: #374151;
  font-weight: 500;
}

.face-summary-center {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
}

.detection-status-inline {
  font-size: 0.88rem;
  color: #4b5563;
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-icon {
  opacity: 0.65;
  margin-right: 4px;
}

.detect-actions-row {
  display: flex;
  gap: 0.55rem;
  flex-wrap: wrap;
  justify-content: flex-start;
}

.detect-action-btn {
  flex: 0 0 auto;
  min-width: 0;
  font-size: 0.92rem;
  padding: 0.62rem 1rem;
}

.btn-batch-related {
  background: #eef2ff;
  border-color: #c7d2fe;
  color: #1f2937;
}

.btn-batch-related:hover:not(:disabled) {
  background: #e0e7ff;
  border-color: #a5b4fc;
  color: #1f2937;
}

/* Advanced Settings */
.advanced-settings {
  width: 100%;
  margin-bottom: 0.5rem;
  text-align: center;
}

.btn-link {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.25rem 0;
  max-width: 100%;
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-link:hover {
  color: #764ba2;
  text-decoration: underline;
}

.settings-panel {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.setting-group {
  margin-bottom: 0.75rem;
}

.setting-group:last-child {
  margin-bottom: 0;
}

.setting-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 0.5rem;
}

.model-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.model-option {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-weight: normal;
  cursor: pointer;
}

.model-option input[type="checkbox"] {
  margin-top: 0.15rem;
  cursor: pointer;
}

.model-option input[type="checkbox"]:disabled {
  cursor: not-allowed;
}

.model-option span {
  flex: 1;
  font-size: 0.85rem;
  line-height: 1.4;
}

.model-option span.disabled {
  color: #adb5bd;
  cursor: not-allowed;
}

.model-desc {
  display: block;
  color: #6c757d;
  font-size: 0.75rem;
  margin-top: 0.15rem;
}

.hint-small {
  margin: 0.5rem 0 0 0;
  font-size: 0.75rem;
  color: #6c757d;
  font-style: italic;
}

.confidence-slider {
  width: 100%;
  margin: 0.5rem 0;
}

.toggle-overlay {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  cursor: pointer;
}

.toggle-overlay input[type="checkbox"] {
  width: auto;
  cursor: pointer;
}

.detection-status {
  font-size: 0.9rem;
  color: #666;
  font-style: italic;
}

/* Face Assignment Styles */
.face-people-section {
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 2px solid #dee2e6;
}

.face-people-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.face-people-header h3 {
  margin: 0;
  color: #495057;
  font-size: 1rem;
}

.people-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.btn-assign-selected {
  border: none;
  background: none;
  color: #0d6efd;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0;
}

.btn-assign-selected:hover {
  text-decoration: underline;
}

.btn-clear-compact {
  padding: 0.42rem 0.7rem;
  font-size: 0.82rem;
  border-radius: 4px;
}

.hint {
  margin: 0 0 0.75rem 0;
  color: #6c757d;
  font-size: 0.85rem;
}

/* Scrollable people list when more than 5 people */
.people-list-container.scrollable {
  max-height: 360px;
  overflow-y: auto;
  margin-bottom: 0.75rem;
  padding-right: 0.5rem;
}

.people-list-container.scrollable::-webkit-scrollbar {
  width: 8px;
}

.people-list-container.scrollable::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.people-list-container.scrollable::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.people-list-container.scrollable::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.person-face-row {
  display: grid;
  grid-template-columns: auto 1fr 200px 40px;
  gap: 0.5rem;
  align-items: center;
  padding: 0.6rem;
  background: white;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  border: 1px solid #dee2e6;
}

.person-reorder-controls {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 30px;
}

.btn-reorder {
  padding: 2px 6px;
  font-size: 10px;
  line-height: 1;
  background: #e9ecef;
  border: 1px solid #ced4da;
  border-radius: 3px;
  cursor: pointer;
  color: #495057;
  min-width: 24px;
}

.btn-reorder:hover:not(:disabled) {
  background: #dee2e6;
  border-color: #adb5bd;
}

.btn-reorder:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.person-info {
  display: grid;
  grid-template-columns: 2.5fr auto 1.25fr;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
  max-width: 100%;
}

.person-select {
  min-width: 0;
  max-width: 100%;
  padding: 0.375rem 0.5rem;
  font-size: 14px;
  border: 1px solid #ced4da;
  border-radius: 4px;
}



.btn-open-person {
  padding: 0.375rem 0.5rem;
  background: #e3f2fd;
  color: #1976d2;
  border: 1px solid #90caf9;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  width: 36px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-open-person:hover {
  background: #bbdefb;
  border-color: #64b5f6;
}

.btn-open-person:active {
  background: #90caf9;
  border-color: #42a5f5;
}

.person-context {
  min-width: 0;
  max-width: 100%;
  padding: 0.375rem 0.5rem;
  font-size: 14px;
  border: 1px solid #ced4da;
  border-radius: 4px;
}
.face-match-indicator {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.5rem;
}

.face-info-display {
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
}

.matched-indicator,
.unmatched-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  width: 100%;
}

.matched-indicator {
  color: #155724;
  font-weight: 500;
}

.no-person-indicator,
.no-faces-indicator {
  color: #6c757d;
  font-style: italic;
  font-size: 0.9rem;
}

.face-select-small {
  padding: 0.4rem;
  font-size: 0.85rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  flex: 1;
  max-width: 180px;
}

.face-select-small option {
  color: #6c757d; /* Gray color for detection confidence to distinguish from match confidence */
}

.face-select-small option:first-child {
  color: inherit; /* Keep "-- Assign Face --" option normal color */
}
.btn-unmatch-inline,
.btn-assign-inline {
  padding: 0.3rem 0.6rem;
  font-size: 0.85rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.btn-unmatch-inline {
  background: #ffc107;
  color: #000;
}

.btn-unmatch-inline:hover {
  background: #e0a800;
}

.btn-assign-inline {
  background: #28a745;
  color: white;
}

.btn-assign-inline:hover {
  background: #218838;
}

.btn-assign-inline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.unassigned-faces-summary {
  margin-top: 1rem;
  padding: 1rem;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
  color: #856404;
}

/* Unassigned faces section (below photo, above people list) */
.unassigned-faces-section {
  margin: 0.5rem 0 0.75rem 0;
  padding: 0.5rem 0.75rem;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
  color: #856404;
}

.unassigned-faces-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}

.unassigned-faces-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.unassigned-faces-section strong {
  margin: 0;
  font-size: 0.95rem;
}

.unassigned-faces-hint {
  font-size: 0.75rem;
  color: #856404;
  white-space: nowrap;
}

.unassigned-faces-section .face-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.face-badge-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.face-badge {
  display: inline-block;
  margin: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: #007bff;
  color: white;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
}

.face-badge-button {
  display: inline-block;
  margin: 0;
  padding: 0.35rem 0.6rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.face-badge-button:hover:not(:disabled) {
  background: #0056b3;
}

.face-badge-button:disabled {
  background: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.excluded-faces-section {
  border-color: #f4c676;
  background: #fff8eb;
}

.face-badge-button.excluded {
  background: #b7791f;
  cursor: pointer;
}

.face-badge-button.excluded:hover {
  background: #9c6517;
}

.face-badge-discard {
  padding: 0.35rem 0.55rem;
  border: 1px solid #d9534f;
  background: #fff;
  color: #b52a27;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.face-badge-discard:hover {
  background: #fcebea;
}

.face-assignment-section,
.face-matches-section {
  margin-top: 1.5rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 2px solid #dee2e6;
}

.face-assignment-section h3,
.face-matches-section h3 {
  margin: 0 0 0.5rem 0;
  color: #495057;
  font-size: 1.1rem;
}

.face-assignment-row {
  display: grid;
  grid-template-columns: 150px 1fr auto;
  gap: 1rem;
  align-items: center;
  padding: 0.75rem;
  background: white;
  border-radius: 6px;
  margin-bottom: 0.75rem;
  border: 1px solid #dee2e6;
}

.face-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.confidence-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: #28a745;
  color: white;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  width: fit-content;
}

.btn-small {
  padding: 0.5rem 1rem;
  font-size: 0.9rem;
}

.face-match-row {
  font-size: 0.85rem;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  align-items: center;
  padding: 0.75rem;
  background: #d4edda;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  border: 1px solid #c3e6cb;
  color: #155724;
}

.match-info {
  flex: 1;
}

.btn-unmatch {
  padding: 0.5rem 1rem;
  background: #ffc107;
  color: #000;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-unmatch:hover {
  background: #e0a800;
}

/* Find Similar Faces Button */
.btn-find-similar {
  margin-top: 1rem;
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
}

.btn-find-similar:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-find-similar:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Similarity Search Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-dialog {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.delete-modal {
  max-width: 640px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 700px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-small {
  max-width: 450px;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  color: #333;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #333;
}

.modal-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: #999;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
}

.modal-close:hover {
  color: #333;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.delete-modal-body {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.delete-modal-warning {
  margin: 0;
  color: #b42318;
  font-weight: 600;
}

.delete-modal-detail {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.delete-modal-path {
  font-family: 'Courier New', monospace;
  color: #444;
  word-break: break-all;
  background: #f8f9fa;
  border-radius: 6px;
  padding: 0.75rem;
}

.delete-modal-missing {
  margin: 0;
  color: #b42318;
}

.search-info {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #e7f3ff;
  border-radius: 6px;
  color: #004085;
}

.searching {
  text-align: center;
  padding: 2rem;
  color: #666;
  font-style: italic;
}

.no-matches {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.matches-header {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #dee2e6;
}

.matches-header strong {
  display: block;
  font-size: 1.1rem;
  margin-bottom: 0.25rem;
}

.matches-header small {
  color: #666;
}

.matches-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.match-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  align-items: center;
}

.match-item:hover {
  border-color: #667eea;
  background: #f8f9ff;
}

.match-item.match-selected {
  border-color: #667eea;
  background: #e7f3ff;
}

.match-item.match-in-photo {
  border-color: #ffc107;
  background: #fffbf0;
}

.match-radio input[type="radio"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.match-info {
  flex: 1;
}

.match-name {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: #333;
}

.badge-in-photo {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.25rem 0.5rem;
  background: #ffc107;
  color: #000;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.match-details {
  display: flex;
  gap: 1rem;
  font-size: 0.9rem;
  color: #666;
}

.match-confidence {
  font-weight: 500;
  color: #28a745;
}

.match-reference {
  font-style: italic;
}

.match-reference-link {
  color: #007bff;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
}

.match-reference-link:hover {
  text-decoration: underline;
  color: #0056b3;
}

/* Face Selector Dialog Styles */
.face-selector-info {
  margin-bottom: 1.5rem;
  color: #666;
  font-size: 0.95rem;
}

.face-selector-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.face-selector-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.face-selector-option:hover {
  border-color: #007bff;
  background: #f8f9fa;
}

.face-selector-option input[type="radio"] {
  cursor: pointer;
  width: 18px;
  height: 18px;
}

.face-option-label {
  font-size: 1rem;
  font-weight: 500;
  color: #333;
  user-select: none;
}

.face-confidence {
  color: #28a745;
  font-weight: 400;
  margin-left: 0.5rem;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #dee2e6;
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.modal-footer .btn-primary,
.modal-footer .btn-secondary {
  padding: 0.75rem 1.5rem;
}

.btn-modal-ok {
  padding: 0.75rem 1.5rem;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-modal-ok:hover {
  background: #c82333;
}

.btn-modal-alt-danger {
  padding: 0.75rem 1.5rem;
  background: white;
  color: #b42318;
  border: 1px solid #b42318;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-modal-alt-danger:hover {
  background: #fef3f2;
}

.btn-modal-cancel {
  padding: 0.75rem 1.5rem;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-modal-cancel:hover {
  background: #5a6268;
}
</style>
