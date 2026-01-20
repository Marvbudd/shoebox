<template>
  <div class="update-collection">
    <header>
      <h1>Update Collection</h1>
      <p class="subtitle">Bulk update metadata for all items in a collection</p>
    </header>

    <div class="content">
      <div v-if="loading" class="loading">Loading collections...</div>
      
      <div v-else-if="error" class="error-box">
        <strong>Error:</strong> {{ error }}
      </div>

      <form v-else @submit.prevent="handleUpdate" class="update-form">
        <!-- Collection Selection -->
        <div class="form-section">
          <label for="collection">Select Collection <span class="required">*</span></label>
          <select 
            id="collection"
            v-model="selectedCollection" 
            @change="onCollectionChange"
            required
          >
            <option value="">-- Select a collection --</option>
            <option 
              v-for="collection in collections" 
              :key="collection.value" 
              :value="collection.value"
            >
              {{ collection.text }} ({{ collection.value }})
            </option>
          </select>
          <small v-if="itemCount > 0">{{ itemCount }} item(s) in this collection</small>
        </div>

        <div v-if="selectedCollection" class="update-options">
          <p class="section-header">Select fields to update:</p>

          <!-- Description -->
          <div class="update-option">
            <label class="checkbox-label">
              <input type="checkbox" v-model="updateFields.description" />
              Update Description
            </label>
            <div v-if="updateFields.description" class="field-input">
              <textarea 
                v-model="fieldValues.description" 
                rows="3"
                placeholder="New description for all items in collection"
              ></textarea>
              <small>This will replace the description on all items</small>
            </div>
          </div>

          <!-- Date -->
          <div class="update-option">
            <label class="checkbox-label">
              <input type="checkbox" v-model="updateFields.date" />
              Update Date
            </label>
            <div v-if="updateFields.date" class="field-input">
              <div class="date-row">
                <input 
                  v-model="fieldValues.dateYear" 
                  type="text"
                  placeholder="YYYY"
                  class="date-year"
                />
                <select 
                  v-model="fieldValues.dateMonth" 
                  class="date-month"
                >
                  <option value="">Month</option>
                  <option v-for="month in validMonths" :key="month" :value="month">{{ month }}</option>
                </select>
                <input 
                  v-model="fieldValues.dateDay" 
                  type="text"
                  placeholder="Day"
                  class="date-day"
                />
              </div>
              <small>Partial dates allowed (e.g., year only)</small>
            </div>
          </div>

          <!-- Location -->
          <div class="update-option">
            <label class="checkbox-label">
              <input type="checkbox" v-model="updateFields.location" />
              Add Location
            </label>
            <div v-if="updateFields.location" class="field-input">
              <div class="location-row">
                <input 
                  v-model="fieldValues.locationDetail" 
                  type="text"
                  placeholder="Specific location (e.g., farm, living room)"
                  class="location-detail"
                />
                <input 
                  v-model="fieldValues.locationCity" 
                  type="text"
                  placeholder="City"
                  class="location-city"
                />
                <input 
                  v-model="fieldValues.locationState" 
                  type="text"
                  placeholder="State/Region"
                  class="location-state"
                />
              </div>
              <div class="location-row location-gps">
                <input 
                  v-model.number="fieldValues.locationLatitude" 
                  type="number"
                  step="any"
                  placeholder="Latitude (e.g., 45.523064)"
                  class="location-coordinate"
                />
                <input 
                  v-model.number="fieldValues.locationLongitude" 
                  type="number"
                  step="any"
                  placeholder="Longitude (e.g., -122.676483)"
                  class="location-coordinate"
                />
                <button 
                  v-if="fieldValues.locationLatitude && fieldValues.locationLongitude"
                  type="button" 
                  @click="lookupLocation" 
                  class="btn-lookup"
                  :disabled="isLookingUpLocation"
                  title="Look up city/state from GPS coordinates"
                >
                  {{ isLookingUpLocation ? 'Looking up...' : '🌐 Look up location' }}
                </button>
                <span class="gps-hint" v-if="fieldValues.locationLatitude && fieldValues.locationLongitude">
                  📍 <a :href="`https://maps.google.com?q=${fieldValues.locationLatitude},${fieldValues.locationLongitude}&t=k`" target="_blank">View on Map</a>
                </span>
              </div>
              <div v-if="geocodingAttribution" class="geocoding-attribution">
                Location data © OpenStreetMap contributors
              </div>
              <small>This will add a location to all items (won't replace existing)</small>
            </div>
          </div>

          <!-- Source Person -->
          <div class="update-option">
            <label class="checkbox-label">
              <input type="checkbox" v-model="updateFields.source" />
              Add Source Person & Received Date
            </label>
            <div v-if="updateFields.source" class="field-input">
              <label>Source Person</label>
              <select v-model="sourcePersonId">
                <option value="">-- Select a person --</option>
                <option 
                  v-for="person in persons" 
                  :key="person.personID" 
                  :value="person.personID"
                >
                  {{ getPersonDisplayName(person) }}
                </option>
              </select>
            </div>
            <div v-if="updateFields.source" class="field-input">
              <label>Date Received</label>
              <div class="date-row">
                <input 
                  v-model="fieldValues.sourceReceivedYear" 
                  type="text"
                  placeholder="YYYY"
                  class="date-year"
                />
                <select 
                  v-model="fieldValues.sourceReceivedMonth" 
                  class="date-month"
                >
                  <option value="">Month</option>
                  <option v-for="month in validMonths" :key="month" :value="month">{{ month }}</option>
                </select>
                <input 
                  v-model="fieldValues.sourceReceivedDay" 
                  type="text"
                  placeholder="Day"
                  class="date-day"
                />
              </div>
              <small>This will add a source to all items (won't replace existing sources)</small>
            </div>
          </div>

          <!-- Update Mode for Date/Description -->
          <div v-if="updateFields.date || updateFields.description" class="update-mode">
            <label class="checkbox-label">
              <input type="checkbox" v-model="onlyIfEmpty" />
              Only update if field is currently empty
            </label>
            <small>When checked, won't overwrite existing data</small>
          </div>
        </div>

        <!-- Action Buttons -->
        <div v-if="selectedCollection" class="form-actions">
          <button 
            type="submit" 
            :disabled="!hasUpdates || updating" 
            class="btn-primary"
          >
            {{ updating ? 'Updating...' : `Update ${itemCount} Item(s)` }}
          </button>
          <button 
            type="button" 
            @click="handleCancel" 
            :disabled="updating" 
            class="btn-secondary"
          >
            Cancel
          </button>
        </div>

        <div v-if="statusMessage" :class="'status-message ' + statusMessage.type">
          {{ statusMessage.text }}
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { expandPersonsByLastName, formatPersonName } from '../../../../shared/personHelpers.js';

const collections = ref([]);
const persons = ref([]);
const selectedCollection = ref('');
const itemCount = ref(0);
const loading = ref(true);
const updating = ref(false);
const error = ref(null);
const statusMessage = ref(null);

const updateFields = ref({
  description: false,
  date: false,
  location: false,
  source: false
});

const fieldValues = ref({
  description: '',
  dateYear: '',
  dateMonth: '',
  dateDay: '',
  locationDetail: '',
  locationCity: '',
  locationState: '',
  locationLatitude: null,
  locationLongitude: null,
  sourceReceivedYear: '',
  sourceReceivedMonth: '',
  sourceReceivedDay: ''
});

const sourcePersonId = ref('');

const onlyIfEmpty = ref(false);

// Reverse geocoding state
const isLookingUpLocation = ref(false);
const geocodingAttribution = ref(false);
const geocodingCache = new Map();
let lastGeocodingRequest = 0;

// US state abbreviations mapping
const stateAbbreviations = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH',
  'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC',
  'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA',
  'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN',
  'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
  'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
};

const getStateAbbreviation = (stateName) => {
  return stateAbbreviations[stateName] || null;
};

const lookupLocation = async () => {
  if (!fieldValues.value.locationLatitude || !fieldValues.value.locationLongitude) return;

  const cacheKey = `${fieldValues.value.locationLatitude},${fieldValues.value.locationLongitude}`;
  if (geocodingCache.has(cacheKey)) {
    const cached = geocodingCache.get(cacheKey);
    if (cached.city) fieldValues.value.locationCity = cached.city;
    if (cached.state) fieldValues.value.locationState = cached.state;
    geocodingAttribution.value = true;
    return;
  }

  const now = Date.now();
  const timeSinceLastRequest = now - lastGeocodingRequest;
  if (timeSinceLastRequest < 1000) {
    await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
  }

  isLookingUpLocation.value = true;
  
  try {
    const result = await window.electronAPI.reverseGeocode(
      fieldValues.value.locationLatitude, 
      fieldValues.value.locationLongitude
    );

    lastGeocodingRequest = Date.now();

    if (result.success) {
      if (result.city) fieldValues.value.locationCity = result.city;
      if (result.state) {
        const stateAbbrev = getStateAbbreviation(result.state);
        fieldValues.value.locationState = stateAbbrev || result.state;
      }
      
      geocodingCache.set(cacheKey, { 
        city: result.city, 
        state: fieldValues.value.locationState 
      });
      geocodingAttribution.value = true;
    } else {
      throw new Error(result.error || 'Geocoding failed');
    }
  } catch (err) {
    console.error('Reverse geocoding error:', err);
    alert(`Failed to look up location: ${err.message}`);
  } finally {
    isLookingUpLocation.value = false;
  }
};

const getPersonDisplayName = (person) => {
  return formatPersonName(person, false);
};

const hasUpdates = computed(() => {
  // Check if source is enabled but no person selected - this is invalid
  if (updateFields.value.source && !sourcePersonId.value) {
    return false;
  }
  
  return updateFields.value.description || 
         updateFields.value.date || 
         updateFields.value.location ||
         updateFields.value.source;
});

const validMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const onCollectionChange = async () => {
  if (!selectedCollection.value) {
    itemCount.value = 0;
    return;
  }
  
  try {
    const items = await window.electronAPI.getCollectionItems(selectedCollection.value);
    itemCount.value = items.length;
  } catch (err) {
    console.error('Error loading collection items:', err);
    itemCount.value = 0;
  }
};

const handleUpdate = async () => {
  if (!hasUpdates.value) return;
  
  updating.value = true;
  statusMessage.value = { type: 'info', text: `Updating ${itemCount.value} item(s)...` };
  
  try {
    const updateData = {
      collectionKey: selectedCollection.value,
      updates: {},
      onlyIfEmpty: onlyIfEmpty.value
    };
    
    if (updateFields.value.description) {
      updateData.updates.description = fieldValues.value.description;
    }
    
    if (updateFields.value.date) {
      updateData.updates.date = {
        year: fieldValues.value.dateYear || '',
        month: fieldValues.value.dateMonth || '',
        day: fieldValues.value.dateDay || ''
      };
    }
    
    if (updateFields.value.location) {
      updateData.updates.location = {
        detail: fieldValues.value.locationDetail || '',
        city: fieldValues.value.locationCity || '',
        state: fieldValues.value.locationState || '',
        latitude: fieldValues.value.locationLatitude || null,
        longitude: fieldValues.value.locationLongitude || null
      };
    }
    
    if (updateFields.value.source && sourcePersonId.value) {
      updateData.updates.source = {
        personID: sourcePersonId.value,
        receivedDate: {
          year: fieldValues.value.sourceReceivedYear || '',
          month: fieldValues.value.sourceReceivedMonth || '',
          day: fieldValues.value.sourceReceivedDay || ''
        }
      };
    }
    
    const result = await window.electronAPI.updateCollection(updateData);
    
    if (result.success) {
      statusMessage.value = { 
        type: 'success', 
        text: `Successfully updated ${result.itemsUpdated} item(s)! Window will close in 3 seconds...` 
      };
      setTimeout(() => {
        window.close();
      }, 3000);
    } else {
      statusMessage.value = { type: 'error', text: 'Error: ' + result.error };
      updating.value = false;
    }
  } catch (err) {
    statusMessage.value = { type: 'error', text: 'Error updating: ' + err.message };
    updating.value = false;
  }
};

const handleCancel = () => {
  window.close();
};

onMounted(async () => {
  try {
    const [collectionsData, personsData] = await Promise.all([
      window.electronAPI.getCollections(),
      window.electronAPI.getPersons()
    ]);
    collections.value = collectionsData;
    // Expand persons so each appears once per last name (matches nav column behavior)
    persons.value = expandPersonsByLastName(personsData);
    loading.value = false;
  } catch (err) {
    error.value = err.message;
    loading.value = false;
  }
});
</script>

<style scoped>
.update-collection {
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f5f5f5;
}

header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.5rem 2rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

header h1 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
}

.subtitle {
  margin: 0.5rem 0 0 0;
  opacity: 0.9;
  font-size: 0.95rem;
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

.update-form {
  max-width: 800px;
  margin: 0 auto;
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.form-section {
  margin-bottom: 1.5rem;
}

.form-section label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: #333;
}

.required {
  color: #dc3545;
}

.form-section select,
.form-section input,
.form-section textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.95rem;
  font-family: inherit;
  box-sizing: border-box;
}

.form-section select:focus,
.form-section input:focus,
.form-section textarea:focus {
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

.section-header {
  font-weight: 600;
  margin: 1.5rem 0 1rem 0;
  color: #333;
  font-size: 1.1rem;
}

.update-options {
  border-top: 2px solid #e9ecef;
  padding-top: 1rem;
}

.update-option {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 0;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin-right: 0.75rem;
  cursor: pointer;
}

.field-input {
  margin-top: 1rem;
  padding-left: 2rem;
}

.field-input input,
.field-input textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.95rem;
  font-family: inherit;
  box-sizing: border-box;
}

.field-input small {
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

.date-month {
  font-size: 0.95rem;
}

.location-row {
  display: grid;
  grid-template-columns: 2fr 1fr 80px;
  gap: 0.5rem;
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

.update-mode {
  margin-top: 1.5rem;
  padding: 1rem;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
}

.update-mode .checkbox-label {
  font-weight: 500;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 2rem;
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
</style>
