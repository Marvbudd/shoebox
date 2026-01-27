<template>
  <div class="media-manager">
    <header>
      <h1>Media Manager</h1>
      <p class="subtitle">Edit media item metadata</p>
    </header>

    <div class="content">
      <div v-if="loading" class="loading">Loading item...</div>
      
      <div v-else-if="error" class="error-box">
        <strong>Error:</strong> {{ error }}
      </div>

      <form v-else @submit.prevent="handleSave" class="media-form">
        <!-- Media Preview -->
        <div v-if="mediaPreviewPath || item.type === 'photo'" class="preview-section">
          <div class="preview-and-controls">
            <div class="preview-container" :style="{ position: 'relative', display: 'inline-block' }">
              <img 
                v-if="item.type === 'photo'" 
                ref="imageElement"
                :src="mediaPreviewPath" 
                alt="Preview" 
                class="media-preview"
                @load="onImageLoad"
              />
              <video v-else-if="item.type === 'video'" :src="mediaPreviewPath" controls class="media-preview"></video>
              <audio v-else-if="item.type === 'audio'" :src="mediaPreviewPath" controls class="media-preview"></audio>
              
              <!-- Face overlay canvas (only for photos) -->
              <canvas 
                v-if="item.type === 'photo' && detectedFaces.length > 0"
                ref="faceCanvas"
                class="face-overlay-canvas"
                :style="{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }"
              ></canvas>
            </div>
            
            <!-- Face Detection Controls (only for photos) - beside preview -->
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
                </div>
              </div>
              
              <button 
                type="button" 
                @click="handleDetectFaces" 
                :disabled="detectingFaces || selectedModels.length === 0"
                class="btn-secondary"
              >
                {{ detectingFaces ? 'Detecting...' : 'Detect Faces' }}
              </button>
              
              <label v-if="detectedFaces.length > 0" class="toggle-overlay">
                <input type="checkbox" v-model="showFaceOverlays" @change="drawFaceOverlays" />
                Show Overlays<br>
                <small>({{ detectedFaces.length }} {{ detectedFaces.length === 1 ? 'face' : 'faces' }})</small>
              </label>
              
              <span v-if="faceDetectionStatus" class="detection-status">
                <span v-if="facesLoadedFromBioData" title="Loaded from previous detection" style="opacity: 0.6; margin-right: 4px;">📂</span>
                <span v-else-if="detectedFaces.length > 0" title="Newly detected" style="opacity: 0.6; margin-right: 4px;">🔍</span>
                {{ faceDetectionStatus }}
              </span>
            </div>
          </div>
          
          <!-- Unassigned faces section (below photo, above people list) -->
          <div v-if="item.type === 'photo' && getUnassignedFacesLeftToRight().length > 0" class="unassigned-faces-section">
            <div class="unassigned-faces-header">
              <strong>⚠️ {{ getUnassignedFacesLeftToRight().length }} face(s) not yet assigned</strong>
              <span class="unassigned-faces-hint">L→R order • Hover to preview • Click to search</span>
            </div>
            <div class="face-badges">
              <button 
                v-for="face in getUnassignedFacesLeftToRight()" 
                :key="face.faceIndex" 
                @click="handleFaceBadgeClick(face.faceIndex)"
                @mouseenter="handleFaceBadgeHover(face.faceIndex)"
                @mouseleave="handleFaceBadgeLeave()"
                class="face-badge-button"
                type="button"
              >
                Face #{{ face.faceIndex + 1 }}
              </button>
            </div>
          </div>
          
          <!-- People List (visible for all media types) -->
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
              </div>
            </div>
            <p v-if="item.type === 'photo'" class="hint">Click "+ Add Person" below, select who they are, then use the "Assign Face" dropdown to match detected faces. {{ detectedFaces.length > 0 ? 'Match confidence shown in %.': 'Press "Detect Faces" above to enable face matching.' }}</p>
            <p v-else class="hint">Click "+ Add Person" below to add people appearing or speaking in this {{ item.type }}. Use the position field to note their role or appearance.</p>
            
            <!-- Scrollable people list -->
            <div class="people-list-container" :class="{ 'scrollable': item.person.length > 3 }">
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
                <select 
                  v-model="person.personID" 
                  @change="personListKey++" 
                  class="person-select"
                  :disabled="getMatchForPerson(person.personID) !== undefined"
                  :title="getMatchForPerson(person.personID) ? 'Unassign face before changing person' : ''"
                >
                  <option value="">-- Select Person --</option>
                  <option v-for="p in getAvailablePersons(index)" :key="p.personID" :value="p.personID">
                    {{ getPersonDisplayName(p) }}
                  </option>
                </select>
                <button 
                  type="button"
                  @click="openPersonManager(person.personID)"
                  class="btn-open-person"
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
                <span 
                  v-if="getMatchForPerson(person.personID)" 
                  class="matched-indicator"
                  @mouseenter="handleFaceFieldHover(getMatchForPerson(person.personID).faceIndex)"
                  @mouseleave="handleFaceFieldLeave()"
                >
                  Face #{{ getMatchForPerson(person.personID).faceIndex + 1 }} ({{ Math.round((getMatchForPerson(person.personID).confidence || 0) * 100) }}%)
                  <button 
                    type="button"
                    @click="unmatchPersonFace(person.personID)"
                    class="btn-unmatch-inline"
                    title="Unassign this face"
                  >
                    Unassign
                  </button>
                </span>
                <span v-else-if="person.personID && detectedFaces.length > 0" class="unmatched-indicator">
                  <select 
                    v-model.number="faceAssignments[person.personID]" 
                    class="face-select-small"
                    @mouseenter="handleFaceFieldHover(faceAssignments[person.personID])"
                    @mouseleave="handleFaceFieldLeave()"
                  >
                    <option value="">-- Assign Face --</option>
                    <option v-for="face in getUnassignedFaces()" :key="face.faceIndex" :value="face.faceIndex">
                      Face #{{ face.faceIndex + 1 }} ({{ Math.round(face.confidence * 100) }}%)
                    </option>
                  </select>
                  <button 
                    type="button"
                    @click="console.log('Assign button clicked for', person.personID); assignFaceToPersonByID(person.personID)"
                    :disabled="!faceAssignments[person.personID] && faceAssignments[person.personID] !== 0"
                    class="btn-assign-inline"
                  >
                    Assign
                  </button>
                </span>
                <span v-else-if="detectedFaces.length === 0" class="no-faces-indicator">
                  No faces detected
                </span>
                <span v-else-if="!person.personID" class="no-person-indicator">
                  Select a person first
                </span>
              </div>
              
              <button type="button" @click="removePerson(index)" class="btn-remove" title="Remove person">×</button>
            </div>
            </div>
            
            <button type="button" @click="addPerson" class="btn-add">+ Add Person</button>
            <small>Tip: Use Person Manager to add new people to the database</small>
          </div>
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
          <div class="date-row">
            <input 
              v-model="item.date.year" 
              type="text"
              placeholder="YYYY"
              class="date-year"
            />
            <select 
              v-model="item.date.month" 
              class="date-month"
            >
              <option value="">Month</option>
              <option value="Jan">Jan</option>
              <option value="Feb">Feb</option>
              <option value="Mar">Mar</option>
              <option value="Apr">Apr</option>
              <option value="May">May</option>
              <option value="Jun">Jun</option>
              <option value="Jul">Jul</option>
              <option value="Aug">Aug</option>
              <option value="Sep">Sep</option>
              <option value="Oct">Oct</option>
              <option value="Nov">Nov</option>
              <option value="Dec">Dec</option>
            </select>
            <input 
              v-model="item.date.day" 
              type="text"
              placeholder="Day"
              class="date-day"
            />
          </div>
          <small>Partial dates allowed (e.g., year only)</small>
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
              <select v-model="source.personID" class="source-select">
                <option value="">-- Select Person --</option>
                <option v-for="p in persons" :key="p.personID" :value="p.personID">
                  {{ getPersonDisplayName(p) }}
                </option>
              </select>
              <div class="source-date">
                <label class="inline-label">Received:</label>
                <input 
                  v-model="source.received.year" 
                  type="text"
                  placeholder="YYYY"
                  class="date-year-small"
                />
                <select 
                  v-model="source.received.month" 
                  class="date-month-small"
                >
                  <option value="">Month</option>
                  <option value="Jan">Jan</option>
                  <option value="Feb">Feb</option>
                  <option value="Mar">Mar</option>
                  <option value="Apr">Apr</option>
                  <option value="May">May</option>
                  <option value="Jun">Jun</option>
                  <option value="Jul">Jul</option>
                  <option value="Aug">Aug</option>
                  <option value="Sep">Sep</option>
                  <option value="Oct">Oct</option>
                  <option value="Nov">Nov</option>
                  <option value="Dec">Dec</option>
                </select>
                <input 
                  v-model="source.received.day" 
                  type="text"
                  placeholder="Day"
                  class="date-day-small"
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

        <!-- Action Buttons -->
        <div class="form-actions">
          <button type="submit" :disabled="saving" class="btn-primary">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
          <button v-if="!fileExists && !isReferencedInPlaylists" type="button" @click="handleDelete" :disabled="saving || deleting" class="btn-danger" title="Delete item - media file not found in filesystem">
            {{ deleting ? 'Deleting...' : 'Delete Item (File Missing)' }}
          </button>
          <div v-if="!fileExists && isReferencedInPlaylists" class="warning-message" style="color: #856404; background-color: #fff3cd; padding: 8px; border-radius: 4px; margin: 8px 0;">
            ⚠️ Cannot delete: Item is referenced in playlist(s)
          </div>
          <button type="button" @click="handleCancel" :disabled="saving || deleting" class="btn-secondary">
            Cancel
          </button>
        </div>

        <div v-if="statusMessage" :class="'status-message ' + statusMessage.type">
          {{ statusMessage.text }}
        </div>
      </form>
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
                    @click.prevent.stop="openReferencePhoto(match.referenceLink)"
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
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { formatPersonName, expandPersonsByLastName } from '../../../../shared/personHelpers.js';

const item = ref({
  accession: '',
  link: '',
  type: '',
  description: '',
  date: { year: '', month: '', day: '' },
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
const mediaPreviewPath = ref(null);

// Face detection state
const imageElement = ref(null);
const faceCanvas = ref(null);
const detectedFaces = ref([]);
const detectingFaces = ref(false);
const showFaceOverlays = ref(false);
const faceDetectionStatus = ref('');
const imageDimensions = ref({ width: 0, height: 0 });

// Face detection advanced settings
const showAdvancedSettings = ref(false);
const availableModels = ref([]);
const selectedModels = ref(['ssd']); // Default to SSD
const confidenceThreshold = ref(0.20); // Will be loaded from nconf
const autoAssignThreshold = ref(0.60); // Will be loaded from nconf
const lastUsedModel = ref('ssd');
const hoveredFaceIndex = ref(null); // Track which face is being hovered over
let hoverClearTimeout = null;
const facesLoadedFromBioData = ref(false); // Track if faces were loaded vs detected

// Watch thresholds and save to nconf when changed
watch(confidenceThreshold, async (newValue) => {
  await window.electronAPI.setConfig('faceDetection:confidenceThreshold', newValue);
});

watch(autoAssignThreshold, async (newValue) => {
  await window.electronAPI.setConfig('faceDetection:autoAssignThreshold', newValue);
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

// Playlist validation state
const playlistValidationErrors = ref([]);

// Audio/video items for playlist dropdown
const audioVideoItems = ref([]);

// Reverse geocoding state
const isLookingUpLocation = ref(false);
const geocodingAttribution = ref(false);
const geocodingCache = new Map(); // Cache results to avoid duplicate requests
let lastGeocodingRequest = 0; // Timestamp of last request for rate limiting

// Format person display name for dropdowns/lists
const getPersonDisplayName = (person) => {
  if (!person) return 'Unknown';
  
  // Use shared formatting helper
  const baseName = formatPersonName(person, false);
  
  // Add face number if this person has a matched face
  const match = matchedFaces.value.find(m => m.personID === person.personID);
  if (match) {
    return `${match.faceIndex + 1} - ${baseName}`;
  }
  
  // Fallback for missing data
  if (!baseName) {
    if (person.TMGID || person.tmgID) {
      return `TMG ID: ${person.TMGID || person.tmgID}`;
    } else {
      return `Person ${person.personID?.substring(0, 8) || 'Unknown'}`;
    }
  }
  
  return baseName;
};

// Get available persons for a specific person entry (excludes already-assigned persons)
// Get available persons for a specific dropdown (excluding already assigned persons)
const getAvailablePersons = (currentIndex) => {
  // Force dependency on personListKey to trigger reactivity
  personListKey.value; // eslint-disable-line no-unused-expressions
  
  // Get all personIDs already assigned in this item (except the current entry being edited)
  const assignedPersonIDs = item.value.person
    .map((p, idx) => idx !== currentIndex ? p.personID : null)
    .filter(id => id); // Remove nulls and empty strings
  
  // Filter out persons who are already assigned
  return persons.value.filter(p => !assignedPersonIDs.includes(p.personID));
};

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
      setTimeout(() => statusMessage.value = null, 3000);
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

const addPerson = () => {
  try {
    item.value.person.push({ personID: '', position: '' });
  } catch (err) {
    console.error('Error adding person:', err);
  }
};

const removePerson = async (index) => {
  try {
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

const addSource = () => {
  item.value.source.push({ 
    personID: '', 
    received: { year: '', month: '', day: '' } 
  });
};

const removeSource = (index) => {
  item.value.source.splice(index, 1);
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
      }
    }
  } catch (err) {
    console.error('Error in onImageLoad:', err);
  }
};

// Load existing faceBioData from persons on mount
const loadExistingFaceBioData = async () => {
  if (!item.value.link || item.value.type !== 'photo') return;
  
  try {
    console.log('[FACE LOAD] Loading existing faceBioData for link:', item.value.link);
    
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
      console.log('[FACE LOAD] No existing faceBioData found');
      return;
    }
    
    console.log('[FACE LOAD] Found faceBioData for', facesData.length, 'person(s)');
    
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
    
    console.log('[FACE LOAD] Using model:', selectedModel, 'Model counts:', modelCounts);
    
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
      detectedFaces.value = loadedDetectedFaces;
      matchedFaces.value = loadedMatchedFaces;
      unmatchedFaces.value = [];
      showFaceOverlays.value = true;
      facesLoadedFromBioData.value = true;
      lastUsedModel.value = selectedModel;
      
      const modelName = availableModels.value.find(m => m.key === selectedModel)?.name || selectedModel;
      faceDetectionStatus.value = `Loaded ${loadedDetectedFaces.length} ${loadedDetectedFaces.length === 1 ? 'face' : 'faces'} (${modelName})`;
      
      console.log('[FACE LOAD] Successfully loaded', loadedDetectedFaces.length, 'face(s)');
      
      // Draw overlays after a short delay to ensure image is rendered
      setTimeout(() => {
        drawFaceOverlays();
      }, 100);
    }
  } catch (err) {
    console.error('[FACE LOAD] Error loading faceBioData:', err);
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
  if (!item.value.accession) {
    faceDetectionStatus.value = 'Error: No accession number';
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
  hoveredFaceIndex.value = null; // Clear hover state
  facesLoadedFromBioData.value = false; // Mark as newly detected, not loaded
  
  // Clear all existing face assignments from people since regions will be regenerated
  item.value.person.forEach(person => {
    if (person.faceTag) {
      delete person.faceTag;
    }
  });
  
  try {
    // Step 1: Detect faces with selected models
    const result = await window.electronAPI.detectFaces(item.value.accession, {
      models: [...selectedModels.value], // Create plain array copy
      minConfidence: confidenceThreshold.value
    });
    
    if (result.success) {
      detectedFaces.value = result.faces || [];
      lastUsedModel.value = modelNames; // Store for display
      
      if (detectedFaces.value.length === 0) {
        faceDetectionStatus.value = `No faces detected (${modelNames})`;
        showFaceOverlays.value = false;
      } else {
        // Step 2: Try to match faces to existing persons in the item
        faceDetectionStatus.value = 'Matching faces to people...';
        
        // Send only necessary data for matching, ensuring it's JSON-serializable
        const facesForMatching = detectedFaces.value.map((face, index) => ({
          faceIndex: index,
          descriptor: [...face.descriptor], // Ensure it's a plain array
          region: { ...face.region }, // Clone object
          confidence: face.confidence
        }));
        
        const matchResult = await window.electronAPI.matchFaces(
          item.value.accession,
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
        
        showFaceOverlays.value = true;
        
        // Wait for next tick to ensure canvas is rendered
        setTimeout(() => {
          drawFaceOverlays();
        }, 50);
      }
    } else {
      faceDetectionStatus.value = `Error: ${result.error}`;
      detectedFaces.value = [];
      showFaceOverlays.value = false;
    }
  } catch (err) {
    faceDetectionStatus.value = `Error: ${err.message}`;
    detectedFaces.value = [];
    showFaceOverlays.value = false;
  } finally {
    detectingFaces.value = false;
  }
};

const assignFaceToPerson = async (faceIndex) => {
  const personID = faceAssignments.value[faceIndex];
  if (!personID) {
    alert('Please select a person first');
    return;
  }
  
  // Get the person from the local item data by personID
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
  
  const unmatchedFace = unmatchedFaces.value.find(f => f.faceIndex === faceIndex);
  if (!unmatchedFace) {
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
    pending: true  // Mark as not yet saved to backend
  }
  
  
  // Move from unmatched to matched
  matchedFaces.value.push({
    faceIndex,
    personID: person.personID,
    confidence: unmatchedFace.confidence,
    region: unmatchedFace.region
  });
  
  // Remove from unmatched
  unmatchedFaces.value = unmatchedFaces.value.filter(f => f.faceIndex !== faceIndex);
  delete faceAssignments.value[faceIndex];
  
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

const handleFaceAssignment = (faceIndex) => {
  // Optional: Could trigger auto-save or preview here
};

const unmatchFace = async (match) => {
  if (!confirm(`Are you sure you want to unassign Face #${match.faceIndex + 1} from this person? You can reassign it after.`)) {
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
  
  // Remove the hasFace marker and any legacy faceTag
  
  delete person.faceTag;
  
  // Move from matched to unmatched
  matchedFaces.value = matchedFaces.value.filter(m => m.faceIndex !== match.faceIndex);
  
  // Add to unmatched faces
  const face = detectedFaces.value[match.faceIndex];
  if (face) {
    unmatchedFaces.value.push({
      faceIndex: match.faceIndex,
      region: match.region,
      confidence: face.confidence
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

// Assign face to person by personID (for inline assign)
const assignFaceToPersonByID = async (personID) => {
  console.log('assignFaceToPersonByID called with personID:', personID);
  console.log('faceAssignments:', faceAssignments.value);
  
  const faceIndex = faceAssignments.value[personID];
  console.log('faceIndex for this person:', faceIndex);
  
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
  
  const unmatchedFace = unmatchedFaces.value.find(f => f.faceIndex === faceIndex);
  if (!unmatchedFace) {
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
    pending: true  // Mark as not yet saved to backend
  };
  
  
  // Move from unmatched to matched
  matchedFaces.value.push({
    faceIndex,
    personID: person.personID,
    confidence: unmatchedFace.confidence,
    region: unmatchedFace.region
  });
  
  // Remove from unmatched
  unmatchedFaces.value = unmatchedFaces.value.filter(f => f.faceIndex !== faceIndex);
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
    await assignFaceToPersonByID(person.personID);
  }
};

// Get list of faces that haven't been assigned yet
const getUnassignedFaces = () => {
  // Sort by face number (faceIndex) for dropdown
  return [...unmatchedFaces.value].sort((a, b) => {
    return a.faceIndex - b.faceIndex;
  });
};

const getUnassignedFacesLeftToRight = () => {
  // Sort left-to-right by region x-coordinate for badge display
  return [...unmatchedFaces.value].sort((a, b) => {
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
  if (hoverClearTimeout) {
    clearTimeout(hoverClearTimeout);
    hoverClearTimeout = null;
  }
  hoveredFaceIndex.value = faceIndex;
  drawFaceOverlays();
};

const handleFaceBadgeLeave = () => {
  if (hoverClearTimeout) {
    clearTimeout(hoverClearTimeout);
  }
  hoverClearTimeout = setTimeout(() => {
    hoveredFaceIndex.value = null;
    drawFaceOverlays();
  }, 1000);
};

const handleFaceFieldHover = (faceIndex) => {
  handleFaceBadgeHover(faceIndex);
};

const handleFaceFieldLeave = () => {
  handleFaceBadgeLeave();
};

const handleFaceBadgeClick = async (faceIndex) => {
  // Check if there are any persons with face descriptors before attempting search
  const personsWithDescriptors = await window.electronAPI.getPersonsWithDescriptors();
  
  if (personsWithDescriptors.length === 0) {
    alert('No face matches found yet.\n\nTo assign this face:\n1. Click "+ Add Person" below\n2. Select the person from the dropdown\n3. Use the "Assign Face" dropdown next to their name\n\nAfter you\'ve tagged some faces, clicking these badges will search for similar faces in your library.');
    return;
  }
  
  // If we have face descriptors, perform similarity search
  await performFaceSimilaritySearch(faceIndex);
};

// Perform the actual similarity search for a specific face
const performFaceSimilaritySearch = async (faceIndex) => {
  currentSearchFaceIndex.value = faceIndex;
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
    
    // Search for selected face
    currentSearchFaceIndex.value = faceIndex;
    const matches = await searchPersonLibrary(faceIndex, personsWithDescriptors);
    
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
const searchPersonLibrary = async (faceIndex, personsWithDescriptors) => {
  const face = detectedFaces.value[faceIndex];
  if (!face || !face.descriptor) {
    return [];
  }
  
  const faceDescriptor = face.descriptor;
  const faceModel = face.model || 'ssd'; // Get the model used to detect this face
  const personBestMatches = {}; // Track best match per person
  const threshold = 0.6; // Match threshold - lower is more similar
  
  console.log(`[SIMILARITY SEARCH] Searching for face detected with model: ${faceModel}`);
  
  // Compare against all persons with descriptors
  for (const person of personsWithDescriptors) {
    if (!person.descriptors || !Array.isArray(person.descriptors)) continue;
    
    // Get all descriptors for this person (from different photos)
    for (const descriptorEntry of person.descriptors) {
      // Only compare descriptors from the same model
      if (descriptorEntry.model !== faceModel) {
        continue; // Skip descriptors from different models
      }
      
      const storedDescriptor = new Float32Array(descriptorEntry.descriptor);
      const distance = euclideanDistance(faceDescriptor, storedDescriptor);
      
      if (distance < threshold) {
        // Keep only the best match for this person
        if (!personBestMatches[person.personID] || distance < personBestMatches[person.personID].distance) {
          // Check if person already in item.person list
          const alreadyInPhoto = item.value.person.some(p => p.personID === person.personID);
          
          personBestMatches[person.personID] = {
            personID: person.personID,
            first: person.first,
            last: person.last,
            distance: distance,
            confidence: Math.round((1 - distance) * 100), // Convert distance to confidence %
            referenceLink: descriptorEntry.link,
            alreadyInPhoto: alreadyInPhoto
          };
        }
      }
    }
  }
  
  // Convert to array and sort by distance (best matches first)
  const matches = Object.values(personBestMatches);
  matches.sort((a, b) => a.distance - b.distance);
  return matches.slice(0, 10);
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
  
  // Sort unmatched faces left-to-right by region.x
  const sortedUnmatchedFaces = [...unmatchedFaces.value].sort((a, b) => {
    const faceA = detectedFaces.value[a.faceIndex];
    const faceB = detectedFaces.value[b.faceIndex];
    return faceA.region.x - faceB.region.x;
  });
  
  // Process each unmatched face
  for (const unmatchedFace of sortedUnmatchedFaces) {
    const faceIndex = unmatchedFace.faceIndex;
    const face = detectedFaces.value[faceIndex];
    
    if (!face || !face.descriptor) continue;
    
    // Search for best match in person library (gets multiple matches, sorted by distance)
    const matches = await searchPersonLibrary(faceIndex, personsWithDescriptors);
    
    if (matches.length === 0) continue;
    
    // Try to find a match that doesn't already have a face assigned
    // Start with best match, fall back to next-best if needed
    let assignedThisFace = false;
    
    for (const match of matches) {
      // Only consider matches above threshold
      if (match.distance > distanceThreshold) {
        break; // Remaining matches are below threshold
      }
      
      // Check if this person already has a face assigned (single source of truth)
      const personInPhoto = item.value.person.find(p => p.personID === match.personID);
      const hasFaceAssigned = personInPhoto && personInPhoto.faceTag && personInPhoto.faceTag.region;
      const hasFaceSelected = faceAssignments.value[match.personID] !== undefined && faceAssignments.value[match.personID] !== null && faceAssignments.value[match.personID] !== '';
      const faceAlreadySelected = Object.values(faceAssignments.value).includes(faceIndex);
      
      if (hasFaceAssigned || hasFaceSelected || faceAlreadySelected) {
        // This person already has a face - try next best match
        console.log(`[AUTO-ASSIGN] Face #${faceIndex + 1}: Skipping ${match.first} ${match.last} (${match.confidence}%) - already has face`);
        continue;
      }
      
      // Found a match without a face assigned - use it
      console.log(`[AUTO-SELECT] Face #${faceIndex + 1}: ${match.first} ${match.last} (${match.confidence}%)`);
      
      // Add person to photo if not already in it
      if (!match.alreadyInPhoto) {
        const newPerson = {
          personID: match.personID,
          position: ''
        };
        item.value.person.push(newPerson);
        personListKey.value++;
      }
      
      // Set face selection only (no auto-assign)
      faceAssignments.value[match.personID] = faceIndex;
      
      selectedCount++;
      assignedThisFace = true;
      break; // Successfully assigned this face, move to next face
    }
    
    if (!assignedThisFace && matches.length > 0 && matches[0].distance <= distanceThreshold) {
      // Had good matches but all already have faces assigned
      console.log(`[AUTO-SELECT] Face #${faceIndex + 1}: All matches already have faces assigned/selected`);
    }
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
  const faceIndex = currentSearchFaceIndex.value;
  
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

// Open reference photo in system default viewer
const openReferencePhoto = async (link) => {
  console.log('[REFERENCE PHOTO] Opening reference photo for link:', link);
  try {
    // Get the full file path for the photo
    const filePath = await window.electronAPI.getMediaPath('photo', link);
    console.log('[REFERENCE PHOTO] File path:', filePath);
    
    // Open in system default viewer
    await window.electronAPI.openFile(filePath);
    console.log('[REFERENCE PHOTO] File opened successfully');
  } catch (error) {
    console.error('[REFERENCE PHOTO] Error opening reference photo:', error);
    alert('Could not open reference photo');
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
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw rectangles for each detected face
    detectedFaces.value.forEach((face, index) => {
      if (!face || !face.region) {
        console.warn(`drawFaceOverlays: Invalid face data at index ${index}`);
        return;
      }
      
      const hasHover = hoveredFaceIndex.value !== null && hoveredFaceIndex.value !== undefined;
      // If hovering a face, show ONLY that face
      if (hasHover && hoveredFaceIndex.value !== index) {
        return; // Skip this face
      }
      // If not hovering, show faces only when checkbox is enabled
      if (!hasHover && !showFaceOverlays.value) {
        return; // Skip this face
      }
      
      // Check if this face is matched or unmatched
      const isMatched = matchedFaces.value.some(m => m.faceIndex === index);
      const isUnmatched = unmatchedFaces.value.some(u => u.faceIndex === index);
      
      // MWG Regions format: x, y are center coordinates (normalized 0-1)
      // w, h are width and height (normalized 0-1)
      const region = face.region;
      
      // Convert normalized coordinates to pixel coordinates
      const centerX = region.x * canvas.width;
      const centerY = region.y * canvas.height;
      const width = region.w * canvas.width;
      const height = region.h * canvas.height;
      
      // Calculate top-left corner
      const x = centerX - (width / 2);
      const y = centerY - (height / 2);
      
      // Draw rectangle - different color for matched vs unmatched
      if (isMatched) {
        ctx.strokeStyle = '#0080ff'; // Blue for matched faces
      } else {
        ctx.strokeStyle = '#00ff00'; // Green for unmatched faces
      }
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
      
      // Draw face number with background for better visibility
      ctx.font = 'bold 16px sans-serif';
      const faceNumText = `${index + 1}`;
      const faceNumMetrics = ctx.measureText(faceNumText);
      
      // Background for face number
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(x + 2, y + 2, faceNumMetrics.width + 8, 22);
      
      // Face number text - match color to border
      ctx.fillStyle = isMatched ? '#0080ff' : '#00ff00';
      ctx.fillText(faceNumText, x + 6, y + 18);
    });
  } catch (err) {
    console.error('Error drawing face overlays:', err);
  }
};

const handleSave = async () => {
  // Check for unassigned faces (using unmatchedFaces which is already maintained)
  if (unmatchedFaces.value.length > 0) {
    const proceed = confirm(
      'Warning: You have ' + unmatchedFaces.value.length + ' detected face(s) that are not assigned to anyone.\n\n' +
      'This may mean you forgot to press the "Assign" button.\n\n' +
      'Do you want to save anyway?'
    );
    if (!proceed) {
      return; // User canceled save to fix assignments
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
    }

    // Keep faceTags in person objects for backend to process
    // Backend will extract and save them to person library, then remove before persisting item
    
    // Convert to plain object to avoid IPC cloning issues
    const plainItem = JSON.parse(JSON.stringify(cleanedItem));

    const result = await window.electronAPI.saveItem(plainItem);

    if (result.success) {
      statusMessage.value = { type: 'success', text: 'Changes saved successfully!' };
      setTimeout(() => {
        window.close();
      }, 1500);
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
  if (!confirm(`Are you sure you want to delete item "${item.value.link}"? This cannot be undone.`)) {
    return;
  }
  
  deleting.value = true;
  statusMessage.value = { type: 'info', text: 'Deleting item...' };
  
  try {
    const result = await window.electronAPI.deleteItem(item.value.link);
    
    if (result.success) {
      statusMessage.value = { type: 'success', text: 'Item deleted successfully!' };
      setTimeout(() => {
        window.close();
      }, 1500);
    } else {
      statusMessage.value = { type: 'error', text: 'Error: ' + result.error };
      deleting.value = false;
    }
  } catch (err) {
    statusMessage.value = { type: 'error', text: 'Error deleting: ' + err.message };
    deleting.value = false;
  }
};

const handleCancel = () => {
  window.close();
};

onMounted(async () => {
  const mountStart = performance.now();
  console.log('[TIMING] MediaManager onMounted started');
  
  try {
    // Get item identifier from query string or window property
    const urlParams = new URLSearchParams(window.location.search);
    const identifier = urlParams.get('link');
    
    if (!identifier) {
      error.value = 'No item identifier provided';
      loading.value = false;
      return;
    }
    
    // Load persons and audio/video items in parallel
    console.log('[TIMING] Starting persons and audio/video load');
    const personsLoadStart = performance.now();
    const [loadedPersons, loadedAudioVideo, savedConfidenceThreshold, savedAutoAssignThreshold] = await Promise.all([
      window.electronAPI.getExistingPersons(),
      window.electronAPI.getAudioVideoItems(),
      window.electronAPI.getConfig('faceDetection:confidenceThreshold'),
      window.electronAPI.getConfig('faceDetection:autoAssignThreshold')
    ]);
    
    // Set thresholds from config if available
    if (savedConfidenceThreshold !== undefined) {
      confidenceThreshold.value = savedConfidenceThreshold;
    }
    if (savedAutoAssignThreshold !== undefined) {
      autoAssignThreshold.value = savedAutoAssignThreshold;
    };
    console.log('[TIMING] Persons and audio/video loaded in:', (performance.now() - personsLoadStart).toFixed(2), 'ms');
    
    // Expand persons so each appears once per last name (matches nav column behavior)
    persons.value = expandPersonsByLastName(loadedPersons);
    
    // Store audio/video items for playlist dropdown
    audioVideoItems.value = loadedAudioVideo;
    
    // Listen for person saved events to refresh the persons list
    window.electronAPI.onPersonSaved(async () => {
      console.log('Person saved event received, refreshing persons list');
      const refreshedPersons = await window.electronAPI.getExistingPersons();
      // Expand persons so each appears once per last name (matches nav column behavior)
      persons.value = expandPersonsByLastName(refreshedPersons);
      personListKey.value++; // Force re-render of dropdowns
    });
    
    console.log('[TIMING] Starting item load for:', identifier);
    const itemLoadStart = performance.now();
    
    // Load the item
    const loadedItem = await window.electronAPI.loadItem(identifier);
    console.log('[TIMING] Item loaded in:', (performance.now() - itemLoadStart).toFixed(2), 'ms');
    
    if (!loadedItem) {
      error.value = 'Item not found';
      loading.value = false;
      return;
    }
    
    // Track file existence status
    fileExists.value = loadedItem.fileExists ?? true;
      isReferencedInPlaylists.value = loadedItem.isReferencedInPlaylists ?? false;
    // Initialize item with defaults for missing arrays/objects
    item.value = {
      accession: loadedItem.accession || '',
      link: loadedItem.link || '',
      type: loadedItem.type || '',
      description: loadedItem.description || '',
      date: loadedItem.date || { year: '', month: '', day: '' },
      location: loadedItem.location || [],
      person: (loadedItem.person || []).map(p => ({
        ...p,  // Preserve all original properties from backend
        position: p.position || p.context || ''  // Use 'position' as standard field name
      })),
      source: loadedItem.source || [],
      playlist: loadedItem.playlist || { entry: [] }
    };
    
    // Get media preview path
    if (item.value.type && item.value.link) {
      console.log('[TIMING] Starting media path load');
      const mediaStart = performance.now();
      mediaPreviewPath.value = await window.electronAPI.getMediaPath(item.value.type, item.value.link);
      console.log('[TIMING] Media path loaded in:', (performance.now() - mediaStart).toFixed(2), 'ms');
    }
    
    // Load available face detection models and pre-select based on prior usage
    if (item.value.type === 'photo') {
      console.log('[TIMING] Starting models load');
      const modelsStart = performance.now();
      const modelsResult = await window.electronAPI.getFaceDetectionModels();
      console.log('[TIMING] Models loaded in:', (performance.now() - modelsStart).toFixed(2), 'ms');
      
      if (modelsResult.success) {
        availableModels.value = modelsResult.models;
      }
      
      // Pre-select model based on prior descriptors for this link
      if (item.value.link) {
        try {
          console.log('[TIMING] Starting descriptors load for link:', item.value.link);
          const descriptorsStart = performance.now();
          const descriptors = await window.electronAPI.getDescriptorsForLink(item.value.link);
          console.log('[TIMING] Descriptors loaded in:', (performance.now() - descriptorsStart).toFixed(2), 'ms', 'Found:', descriptors?.length || 0);
          if (descriptors && descriptors.length > 0) {
            // Count model usage for this link
            const modelCounts = {};
            descriptors.forEach(desc => {
              const model = desc.model || 'ssd';
              modelCounts[model] = (modelCounts[model] || 0) + 1;
            });
            
            console.log('[MODEL PRE-SELECT] Model counts for this link:', modelCounts);
            
            // Find most common model
            let maxCount = 0;
            let mostCommonModel = null;
            Object.entries(modelCounts).forEach(([model, count]) => {
              if (count > maxCount) {
                maxCount = count;
                mostCommonModel = model;
              }
            });
            
            console.log('[MODEL PRE-SELECT] Most common model:', mostCommonModel, 'with', maxCount, 'descriptors');
            console.log('[MODEL PRE-SELECT] Available models:', availableModels.value);
            
            // Pre-select the most common model if it's available
            const modelAvailable = availableModels.value.find(m => m.key === mostCommonModel && m.available);
            if (modelAvailable) {
              selectedModels.value = [mostCommonModel];
              console.log(`[MODEL PRE-SELECT] Pre-selected model ${mostCommonModel} based on ${maxCount} prior descriptor(s) for this photo`);
            } else {
              console.log('[MODEL PRE-SELECT] Could not pre-select model - model not available or not loaded');
            }
          }
        } catch (err) {
          console.error('Failed to load descriptors for model pre-selection:', err);
          // Continue without pre-selection
        }
      }
      
      // Load existing faceBioData if available (after model pre-selection)
      // This will be called after image loads, so we wait for the image
      // The actual loading happens in onImageLoad or we can call it here if needed
      // For now, we'll call it after a short delay to ensure image is ready
      setTimeout(() => {
        loadExistingFaceBioData();
      }, 200);
    }
    
    console.log('[TIMING] MediaManager total onMounted time:', (performance.now() - mountStart).toFixed(2), 'ms');
    loading.value = false;
  } catch (err) {
    console.log('[TIMING] MediaManager onMounted error after:', (performance.now() - mountStart).toFixed(2), 'ms');
    error.value = err.message;
    loading.value = false;
  }
});
</script>

<style scoped>
.media-manager {
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f5f5f5;
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

.content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
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
}

.media-form {
  max-width: 900px;
  margin: 0 auto;
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.preview-section {
  margin-bottom: 1rem;
  text-align: center;
}

.preview-and-controls {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
  justify-content: center;
  flex-wrap: wrap;
}

.preview-container {
  flex-shrink: 0;
}

.media-preview {
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.form-section {
  margin-bottom: 1rem;
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

.date-row {
  display: grid;
  grid-template-columns: 120px 120px 80px;
  gap: 0.5rem;
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

.date-year-small,
.date-month-small,
.date-day-small {
  width: auto !important;
}

.date-year-small {
  width: 80px !important;
}

.date-month-small {
  width: 70px !important;
}

.date-day-small {
  width: 50px !important;
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
  align-items: flex-start;
  min-width: 220px;
  flex: 1 1 220px;
}

.face-detection-controls .btn-secondary {
  width: 100%;
  padding: 0.6rem 1rem;
  font-size: 0.9rem;
}

/* Advanced Settings */
.advanced-settings {
  width: 100%;
  margin-bottom: 0.5rem;
}

.btn-link {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.25rem 0;
  text-align: left;
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
  margin-top: 1rem;
  padding: 1rem;
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

.hint {
  margin: 0 0 0.75rem 0;
  color: #6c757d;
  font-size: 0.85rem;
}

/* Scrollable people list when more than 3 people */
.people-list-container.scrollable {
  max-height: 280px;
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
  grid-template-columns: auto 1fr 300px 40px;
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
  grid-template-columns: 2fr auto 2fr;
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
  width: 300px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.matched-indicator,
.unmatched-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
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
  display: grid;
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
</style>
