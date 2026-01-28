<template>
  <div class="create-accessions">
    <header>
      <h1>Add Media Metadata</h1>
      <p class="subtitle">Create or update media metadata in accessions.json</p>
    </header>

    <div class="content">
      <div class="info-box">
        <p><strong>What this does:</strong> Creates a new accessions.json file in your selected directory and scans for media files (photos, videos, audio) to add to the database. If accessions.json already exists, the media directories will be scanned and any media files not already in the database will be added without modifying existing metadata. This allows you to nondestructively add new items.</p>
        <p><strong>Requirements:</strong> Your directory should contain subdirectories named <code>photo</code>, <code>video</code>, and/or <code>audio</code> with your media files.</p>
      </div>

      <form @submit.prevent="handleCreate" class="create-form">
        <div class="form-section">
          <label for="directory">Media Directory <span class="required">*</span></label>
          <div class="directory-input">
            <input 
              id="directory"
              v-model="formData.directory" 
              type="text"
              placeholder="/path/to/media/directory"
              required
              readonly
            />
            <button type="button" @click="selectDirectory" class="btn-browse">
              Browse...
            </button>
          </div>
          <small>Select the parent directory containing your media folders</small>
        </div>

        <div class="form-section">
          <label for="title">Database Title <span class="required">*</span></label>
          <input 
            id="title"
            v-model="formData.title" 
            type="text"
            placeholder="e.g., My Family Photos"
            required
          />
          <small>A descriptive name for this media collection</small>
        </div>

        <!-- Optional source and metadata -->
        <details class="optional-section">
          <summary>Optional: Source Information &amp; Default Metadata</summary>
          
          <div class="form-section">
            <label>Source Person Mode</label>
            <div class="radio-group">
              <label>
                <input type="radio" v-model="sourceMode" value="none" />
                No source person
              </label>
              <label v-if="existingPersons.length > 0">
                <input type="radio" v-model="sourceMode" value="existing" />
                Select existing person ({{ existingPersons.length }} available)
              </label>
              <label>
                <input type="radio" v-model="sourceMode" value="new" />
                Create new person
              </label>
            </div>
          </div>

          <!-- Select existing person -->
          <div v-if="sourceMode === 'existing'" class="form-section">
            <label for="sourcePerson">Select Person</label>
            <select 
              id="sourcePerson"
              v-model="formData.sourcePersonID"
            >
              <option value="">-- Select --</option>
              <option 
                v-for="person in existingPersons" 
                :key="person.personID" 
                :value="person.personID"
              >
                {{ getPersonDisplayName(person) }}
              </option>
            </select>
            <small>Person who provided this media</small>
          </div>

          <!-- Create new person -->
          <div v-if="sourceMode === 'new'" class="form-section">
            <label for="sourceFirstName">First Name</label>
            <input 
              id="sourceFirstName"
              v-model="formData.sourceFirstName" 
              type="text"
              placeholder="e.g., John"
            />
          </div>

          <div v-if="sourceMode === 'new'" class="form-section">
            <label for="sourceLastName">Last Name</label>
            <input 
              id="sourceLastName"
              v-model="formData.sourceLastName" 
              type="text"
              placeholder="e.g., Smith"
            />
          </div>

          <div v-if="sourceMode === 'new'" class="form-section">
            <label for="sourceTMGID">TMG ID (Optional)</label>
            <input 
              id="sourceTMGID"
              v-model="formData.sourceTMGID" 
              type="text"
              placeholder="e.g., 123"
            />
            <small>The Master Genealogist ID if available</small>
          </div>

          <!-- Date received (shown for both existing and new) -->
          <div v-if="sourceMode !== 'none'" class="form-section">
            <label for="dateReceived">Date Received</label>
            <input 
              id="dateReceived"
              v-model="formData.dateReceived" 
              type="date"
            />
            <small>When the media was received from the source person</small>
          </div>

          <div class="form-section">
            <label for="description">Default Description</label>
            <textarea 
              id="description"
              v-model="formData.description" 
              rows="2"
              placeholder="Applied to all new items unless already present"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-section">
              <label for="dateYear">Year</label>
              <input 
                id="dateYear"
                v-model="formData.dateYear" 
                type="text"
                placeholder="YYYY"
                pattern="\\d{4}"
              />
            </div>
            <div class="form-section">
              <label for="dateMonth">Month</label>
              <select 
                id="dateMonth"
                v-model="formData.dateMonth"
              >
                <option value="">Select month</option>
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
            </div>
            <div class="form-section">
              <label for="dateDay">Day</label>
              <input 
                id="dateDay"
                v-model="formData.dateDay" 
                type="text"
                placeholder="1-31"
                pattern="\\d{1,2}"
              />
            </div>
          </div>

          <div class="form-section">
            <label for="locationDetail">Location Detail</label>
            <input 
              id="locationDetail"
              v-model="formData.locationDetail" 
              type="text"
              placeholder="e.g., Living room, Park bench"
            />
          </div>

          <div class="form-row">
            <div class="form-section">
              <label for="locationCity">City</label>
              <input 
                id="locationCity"
                v-model="formData.locationCity" 
                type="text"
                placeholder="e.g., Indianapolis"
              />
            </div>
            <div class="form-section">
              <label for="locationState">State</label>
              <input 
                id="locationState"
                v-model="formData.locationState" 
                type="text"
                placeholder="e.g., IN, UK, NSW"
              />
            </div>
          </div>
        </details>

        <div class="form-actions">
          <button type="submit" :disabled="!isValid || isCreating" class="btn-primary">
            {{ isCreating ? 'Processing...' : 'Add Media Metadata' }}
          </button>
          <button type="button" @click="handleCancel" class="btn-secondary" :disabled="isCreating">
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
import { ref, computed, watch } from 'vue';

const formData = ref({
  directory: '',
  title: '',
  sourcePersonID: '',
  sourceFirstName: '',
  sourceLastName: '',
  sourceTMGID: '',
  dateReceived: '',
  description: '',
  dateYear: '',
  dateMonth: '',
  dateDay: '',
  locationDetail: '',
  locationCity: '',
  locationState: ''
});

const sourceMode = ref('none');
const existingPersons = ref([]);
const isCreating = ref(false);
const statusMessage = ref(null);

const isValid = computed(() => {
  return formData.value.directory && formData.value.title;
});

const getPersonDisplayName = (person) => {
  // Handle both old (givenName/surname) and new (first/last) formats
  const firstName = person.first || person.givenName || '';
  const lastName = Array.isArray(person.last) ? person.last[0]?.last : (person.last || person.surname || '');
  
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  } else if (firstName) {
    return firstName;
  } else if (lastName) {
    return lastName;
  } else if (person.TMGID || person.tmgID) {
    return `TMG ID: ${person.TMGID || person.tmgID}`;
  } else {
    return `Person ${person.personID.substring(0, 8)}`;
  }
};

// Watch directory changes to load existing persons
watch(() => formData.value.directory, async (newDir) => {
  if (newDir) {
    try {
      const persons = await window.electronAPI.getExistingPersons(newDir);
      existingPersons.value = persons || [];
      // Auto-select appropriate mode
      if (existingPersons.value.length > 0) {
        sourceMode.value = 'existing';
      }
    } catch (error) {
      console.error('Error loading existing persons:', error);
      existingPersons.value = [];
    }
  }
});

const selectDirectory = async () => {
  try {
    const result = await window.electronAPI.selectDirectory();
    if (result && !result.canceled) {
      formData.value.directory = result.filePath;
    }
  } catch (error) {
    statusMessage.value = { type: 'error', text: 'Error selecting directory: ' + error.message };
  }
};

const parseDateReceived = (dateString) => {
  if (!dateString) return null;
  
  // Parse YYYY-MM-DD format from HTML date input
  const parts = dateString.split('-');
  if (parts.length !== 3) return null;
  
  const [year, monthNum, day] = parts;
  
  // Convert month number to short month name
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[parseInt(monthNum) - 1];
  
  return {
    year: year,
    month: month,
    day: day
  };
};

const handleCreate = async () => {
  if (!isValid.value) return;
  
  isCreating.value = true;
  statusMessage.value = { type: 'info', text: 'Creating accessions and scanning media files...' };
  
  try {
    // Prepare form data with proper date format
    const submissionData = {
      ...formData.value,
      sourceMode: sourceMode.value,
      dateReceivedParsed: parseDateReceived(formData.value.dateReceived)
    };
    
    const result = await window.electronAPI.createAccessions(submissionData);
    
    if (result.success) {
      statusMessage.value = { 
        type: 'success', 
        text: `Success! Created accessions.json with ${result.itemsAdded || 0} items.` 
      };
      
      // Close window after short delay
      setTimeout(() => {
        window.close();
      }, 2000);
    } else {
      statusMessage.value = { type: 'error', text: 'Error: ' + result.error };
      isCreating.value = false;
    }
  } catch (error) {
    statusMessage.value = { type: 'error', text: 'Error creating accessions: ' + error.message };
    isCreating.value = false;
  }
};

const handleCancel = () => {
  window.close();
};
</script>

<style scoped>
.create-accessions {
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

.info-box {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 2rem;
}

.info-box p {
  margin: 0.5rem 0;
  font-size: 0.9rem;
}

.info-box code {
  background: rgba(0,0,0,0.1);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}

.create-form {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.radio-group label {
  display: flex;
  align-items: center;
  font-weight: normal;
  margin-bottom: 0;
  cursor: pointer;
}

.radio-group input[type="radio"] {
  width: auto;
  margin-right: 0.5rem;
  cursor: pointer;
}

.form-section select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.95rem;
  font-family: inherit;
  box-sizing: border-box;
  background: white;
  cursor: pointer;
}

.form-section select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.required {
  color: #dc3545;
}

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

.form-section input:focus,
.form-section textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-section input[readonly] {
  background: #f8f9fa;
  cursor: default;
}

.form-section small {
  display: block;
  margin-top: 0.25rem;
  color: #666;
  font-size: 0.85rem;
}

.directory-input {
  display: flex;
  gap: 0.5rem;
}

.directory-input input {
  flex: 1;
}

.btn-browse {
  padding: 0.75rem 1.5rem;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.95rem;
  white-space: nowrap;
}

.btn-browse:hover {
  background: #5a6268;
}

.form-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 1rem;
}

.optional-section {
  margin: 2rem 0;
  padding: 1rem;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  background: #f8f9fa;
}

.optional-section summary {
  cursor: pointer;
  font-weight: 500;
  color: #495057;
  user-select: none;
}

.optional-section summary:hover {
  color: #667eea;
}

.optional-section[open] {
  background: white;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e9ecef;
}

.btn-primary {
  flex: 1;
  padding: 0.875rem 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
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
