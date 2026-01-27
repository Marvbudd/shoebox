<template>
  <div class="person-manager">
    <header>
      <h1>Person Management</h1>
      <div class="search-bar">
        <input 
          v-model="searchQuery" 
          type="text"
          placeholder="Search by name, TMGID..."
          class="search-input"
        />
      </div>
    </header>

    <div class="content">
      <!-- Person List -->
      <aside class="person-list">
        <div class="list-header">
          <div class="person-count">
            {{ filteredPersons.length }} person{{ filteredPersons.length !== 1 ? 's' : '' }}
          </div>
          <button @click="createNewPerson" class="btn-new-person">
            + New Person
          </button>
        </div>
        
        <div class="list-container">
          <div 
            v-for="person in filteredPersons" 
            :key="person.personID"
            @click="selectPerson(person)"
            :class="{ 
              'person-item': true, 
              'selected': selectedPerson?.personID === person.personID 
            }"
          >
            <div class="person-name">
              {{ formatPersonName(person) }}
            </div>
            <div class="person-meta">
              <span v-if="person.TMGID" class="tmgid">TMGID: {{ person.TMGID }}</span>
              <span v-else class="no-tmgid">No TMGID</span>
            </div>
          </div>
          
          <div v-if="filteredPersons.length === 0" class="no-results">
            No persons found
          </div>
        </div>
      </aside>

      <!-- Person Editor -->
      <main class="person-editor">
        <div v-if="!selectedPerson" class="no-selection">
          <p>Select a person to view details</p>
        </div>
        
        <div v-else class="editor-content">
          <h2>{{ formatPersonName(selectedPerson) }}</h2>
          
          <div class="form-section">
            <label>First Name</label>
            <input 
              v-model="selectedPerson.first" 
              type="text"
              placeholder="First name"
            />
          </div>

          <div class="form-section">
            <label>Last Names</label>
            <div 
              v-for="(lastName, index) in selectedPerson.last" 
              :key="index" 
              class="last-name-row"
            >
              <input 
                v-model="lastName.last" 
                type="text"
                placeholder="Last name"
                class="last-name-input"
              />
              <select v-model="lastName.type" class="name-type">
                <option value="">Birth/Maiden</option>
                <option value="married">Married</option>
              </select>
              <button 
                @click="removeLastName(index)" 
                type="button"
                class="btn-remove"
                :disabled="selectedPerson.last.length === 1"
              >
                ✕
              </button>
            </div>
            <button @click="addLastName" type="button" class="btn-add">
              + Add Last Name
            </button>
          </div>

          <div class="form-section">
            <label>TMGID</label>
            <input 
              v-model="selectedPerson.TMGID" 
              type="text"
              placeholder="The Master Genealogist ID"
            />
          </div>

          <div class="form-section">
            <label>Notes</label>
            <textarea 
              v-model="selectedPerson.notes" 
              rows="4"
              placeholder="Optional notes about this person"
              class="notes-input"
            ></textarea>
          </div>

          <div class="form-section">
            <label>Person ID</label>
            <input 
              :value="selectedPerson.personID" 
              type="text"
              readonly
              class="readonly"
              title="Stable unique identifier (cannot be changed)"
            />
          </div>

          <!-- Face descriptors info (if available) -->
          <div class="form-section" v-if="selectedPerson.faceBioData?.descriptors">
            <label>Face Descriptors</label>
            <input 
              :value="Object.keys(selectedPerson.faceBioData.descriptors).join(', ')" 
              type="text"
              readonly
              class="readonly"
              title="Accessions with face recognition data for this person"
            />
          </div>

          <div class="form-actions">
            <button @click="handleSave" :disabled="!isValid" class="btn-primary">
              Save Changes
            </button>
            <button 
              v-if="canDelete" 
              @click="handleDelete" 
              :disabled="deleting" 
              class="btn-danger"
              title="Delete person - no items reference this person"
            >
              {{ deleting ? 'Deleting...' : 'Delete Person' }}
            </button>
            <div v-if="!canDelete && !isNewPerson && selectedPerson" class="warning-message" style="color: #856404; background-color: #fff3cd; padding: 8px; border-radius: 4px; margin: 8px 0;">
              ⚠️ Cannot delete: {{ selectedPerson.itemCount }} item(s) reference this person
            </div>
            <button @click="handleCancel" class="btn-secondary">
              Cancel
            </button>
          </div>

          <div v-if="saveMessage" :class="'save-message ' + saveMessage.type">
            {{ saveMessage.text }}
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

// State
const persons = ref([]);
const selectedPerson = ref(null);
const originalPerson = ref(null);
const searchQuery = ref('');
const saveMessage = ref(null);
const isNewPerson = ref(false);
const deleting = ref(false);

const hasUnsavedChanges = () => {
  if (!selectedPerson.value || !originalPerson.value) return false;
  try {
    return JSON.stringify(selectedPerson.value) !== JSON.stringify(originalPerson.value);
  } catch (error) {
    return false;
  }
};

// Function to load all persons from backend
const loadPersons = async () => {
  try {
    const allPersons = await window.electronAPI.getAllPersons();
    persons.value = allPersons;
    
    // If a person is currently selected, refresh their data
    if (selectedPerson.value && !hasUnsavedChanges()) {
      const refreshedPerson = allPersons.find(p => p.personID === selectedPerson.value.personID);
      if (refreshedPerson) {
        selectedPerson.value = refreshedPerson;
        originalPerson.value = JSON.parse(JSON.stringify(refreshedPerson));
      }
    }
  } catch (error) {
    console.error('Error loading persons:', error);
    saveMessage.value = { type: 'error', text: 'Error loading persons' };
  }
};

// Computed
const filteredPersons = computed(() => {
  if (!searchQuery.value) return persons.value;
  
  const query = searchQuery.value.toLowerCase();
  return persons.value.filter(p => {
    const firstMatch = p.first?.toLowerCase().includes(query);
    const lastMatch = p.last?.some(ln => ln.last?.toLowerCase().includes(query));
    const tmgidMatch = p.TMGID?.toLowerCase().includes(query);
    return firstMatch || lastMatch || tmgidMatch;
  });
});

const isValid = computed(() => {
  if (!selectedPerson.value) return false;
  // Only require at least a first name OR at least one non-empty last name
  const hasFirst = selectedPerson.value.first && selectedPerson.value.first.trim();
  const hasLast = selectedPerson.value.last?.some(ln => ln.last && ln.last.trim());
  return hasFirst || hasLast;
});

const canDelete = computed(() => {
  if (!selectedPerson.value || isNewPerson.value) return false;
  // Person can be deleted if they have no item references
  return selectedPerson.value.itemCount === 0;
});

// Methods
const formatPersonName = (person) => {
  const first = person.first || '';
  const lastNames = person.last?.map(ln => ln.last).join(', ') || '';
  return `${first} ${lastNames}`.trim() || 'Unknown';
};

const selectPerson = (person) => {
  // Deep clone to avoid mutating original
  selectedPerson.value = JSON.parse(JSON.stringify(person));
  originalPerson.value = person;
  isNewPerson.value = false;
  saveMessage.value = null;
};

const createNewPerson = () => {
  // Generate new UUID for the person
  const personID = crypto.randomUUID();
  
  // Create blank person object
  const newPerson = {
    personID,
    first: '',
    last: [{ last: '', type: '' }],
    TMGID: '',
    notes: ''
  };
  
  // Set as selected and mark as new
  selectedPerson.value = newPerson;
  originalPerson.value = null;
  isNewPerson.value = true;
  saveMessage.value = null;
};

const addLastName = () => {
  if (!selectedPerson.value.last) {
    selectedPerson.value.last = [];
  }
  selectedPerson.value.last.push({ last: '', type: '' });
};

const removeLastName = (index) => {
  if (selectedPerson.value.last.length > 1) {
    selectedPerson.value.last.splice(index, 1);
  }
};

const handleSave = async () => {
  try {
    // Convert reactive object to plain object to avoid cloning issues
    const plainPerson = JSON.parse(JSON.stringify(selectedPerson.value));
    
    // Clean up empty last names before saving
    if (plainPerson.last) {
      plainPerson.last = plainPerson.last.filter(ln => ln.last && ln.last.trim());
    }
    
    // Ensure we have at least an empty array for last names
    if (!plainPerson.last || plainPerson.last.length === 0) {
      plainPerson.last = [];
    }
    
    // Call Electron IPC to save person
    const result = await window.electronAPI.savePerson(plainPerson);
    
    if (result.success) {
      saveMessage.value = { type: 'success', text: 'Person saved successfully!' };
      
      // Update local list with cleaned data
      const index = persons.value.findIndex(p => p.personID === selectedPerson.value.personID);
      if (index !== -1) {
        // Existing person - update it, preserve itemCount
        const itemCount = persons.value[index].itemCount;
        persons.value[index] = { ...plainPerson, itemCount };
      } else {
        // New person - add to list with itemCount = 0
        persons.value.push({ ...plainPerson, itemCount: 0 });
        // Sort by name for consistent display
        persons.value.sort((a, b) => {
          const nameA = formatPersonName(a).toLowerCase();
          const nameB = formatPersonName(b).toLowerCase();
          return nameA.localeCompare(nameB);
        });
      }
      
      // Update selected person with cleaned data including itemCount
      const wasNewPerson = isNewPerson.value;
      const personWithCount = wasNewPerson 
        ? { ...plainPerson, itemCount: 0 }
        : { ...plainPerson, itemCount: persons.value.find(p => p.personID === plainPerson.personID)?.itemCount || 0 };
      
      selectedPerson.value = JSON.parse(JSON.stringify(personWithCount));
      originalPerson.value = personWithCount;
      isNewPerson.value = false;
      
      // Clear message and reset form after 3 seconds
      setTimeout(() => {
        saveMessage.value = null;
        // Reset to "Add Person" state to prevent accidental re-editing
        selectedPerson.value = null;
        originalPerson.value = null;
      }, 3000);
    } else {
      saveMessage.value = { type: 'error', text: 'Error saving person: ' + result.error };
    }
  } catch (error) {
    saveMessage.value = { type: 'error', text: 'Error saving person: ' + error.message };
  }
};

const handleDelete = async () => {
  if (!selectedPerson.value || !selectedPerson.value.personID) return;
  
  const personName = formatPersonName(selectedPerson.value);
  if (!confirm(`Are you sure you want to delete "${personName}"? This cannot be undone.`)) {
    return;
  }
  
  deleting.value = true;
  saveMessage.value = { type: 'info', text: 'Deleting person...' };
  
  try {
    const result = await window.electronAPI.deletePerson(selectedPerson.value.personID);
    
    if (result.success) {
      saveMessage.value = { type: 'success', text: 'Person deleted successfully!' };
      
      // Remove from local list
      const index = persons.value.findIndex(p => p.personID === selectedPerson.value.personID);
      if (index !== -1) {
        persons.value.splice(index, 1);
      }
      
      // Clear selection
      setTimeout(() => {
        selectedPerson.value = null;
        originalPerson.value = null;
        saveMessage.value = null;
        deleting.value = false;
      }, 1500);
    } else {
      saveMessage.value = { type: 'error', text: 'Error: ' + result.error };
      deleting.value = false;
    }
  } catch (err) {
    saveMessage.value = { type: 'error', text: 'Error deleting: ' + err.message };
    deleting.value = false;
  }
};

const handleCancel = () => {
  if (isNewPerson.value) {
    // Discard new person and clear selection
    selectedPerson.value = null;
    originalPerson.value = null;
    isNewPerson.value = false;
    saveMessage.value = null;
  } else {
    // Close the window
    window.close();
  }
};

// Lifecycle
onMounted(async () => {
  // Load persons initially
  await loadPersons();
  
  // Listen for person selection events from other windows
  window.electronAPI.onPersonSelect((personID) => {
    if (personID) {
      // Find and select the person
      const person = persons.value.find(p => p.personID === personID);
      if (person) {
        selectPerson(person);
      }
    }
  });
  
  // No focus-based refresh; rely on IPC events for updates
});
</script>

<style scoped>
.person-manager {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
}

header {
  background-color: #fff;
  border-bottom: 1px solid #ddd;
  padding: 20px;
}

header h1 {
  margin: 0 0 15px 0;
  font-size: 24px;
  color: #333;
}

.search-bar {
  margin: 0;
}

.search-input {
  width: 100%;
  padding: 10px 15px;
  font-size: 14px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}

.content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Person List */
.person-list {
  width: 350px;
  background-color: #fff;
  border-right: 1px solid #ddd;
  display: flex;
  flex-direction: column;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 15px;
  border-bottom: 1px solid #eee;
  gap: 10px;
}

.person-count {
  font-size: 12px;
  color: #666;
  flex: 1;
}

.btn-new-person {
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  background-color: #2196F3;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
}

.btn-new-person:hover {
  background-color: #1976D2;
}

.btn-new-person:active {
  background-color: #0D47A1;
}

.list-container {
  flex: 1;
  overflow-y: auto;
}

.person-item {
  padding: 15px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.2s;
}

.person-item:hover {
  background-color: #f9f9f9;
}

.person-item.selected {
  background-color: #e3f2fd;
  border-left: 3px solid #2196F3;
}

.person-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 5px;
}

.person-meta {
  font-size: 12px;
  color: #666;
}

.tmgid {
  color: #4CAF50;
}

.no-tmgid {
  color: #999;
  font-style: italic;
}

.no-results {
  padding: 40px 20px;
  text-align: center;
  color: #999;
}

/* Person Editor */
.person-editor {
  flex: 1;
  overflow-y: auto;
  background-color: #fff;
}

.no-selection {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 16px;
}

.editor-content {
  padding: 30px;
  max-width: 600px;
}

.editor-content h2 {
  margin: 0 0 30px 0;
  color: #333;
}

.form-section {
  margin-bottom: 25px;
}

.form-section label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #555;
  font-size: 14px;
}

.form-section input,
.form-section select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-section input:focus,
.form-section select:focus {
  outline: none;
  border-color: #2196F3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

.form-section input.readonly {
  background-color: #f5f5f5;
  color: #666;
  cursor: not-allowed;
}

/* Last Name Rows */
.last-name-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  align-items: center;
}

.last-name-input {
  flex: 2;
}

.name-type {
  flex: 1;
}

.notes-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  min-height: 80px;
}

.notes-input:focus {
  outline: none;
  border-color: #2196F3;
}

.btn-remove {
  padding: 8px 12px;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-remove:hover:not(:disabled) {
  background-color: #d32f2f;
}

.btn-remove:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.btn-add {
  padding: 8px 16px;
  background-color: #fff;
  color: #2196F3;
  border: 1px solid #2196F3;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-add:hover {
  background-color: #e3f2fd;
}

/* Form Actions */
.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 30px;
}

.btn-primary,
.btn-secondary {
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background-color: #2196F3;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #1976D2;
}

.btn-primary:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #fff;
  color: #666;
  border: 1px solid #ddd;
}

.btn-secondary:hover {
  background-color: #f5f5f5;
}

/* Messages */
.save-message {
  margin-top: 15px;
  padding: 12px;
  border-radius: 4px;
  font-size: 14px;
}

.save-message.success {
  background-color: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #4caf50;
}

.save-message.error {
  background-color: #ffebee;
  color: #c62828;
  border: 1px solid #f44336;
}
</style>
