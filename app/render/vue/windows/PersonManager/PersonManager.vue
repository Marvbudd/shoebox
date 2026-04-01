<template>
  <div class="person-manager">
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

    <header>
      <h1>Person Management</h1>
      <div class="search-bar">
        <input 
          ref="searchInput"
          v-model="searchQuery" 
          type="text"
          placeholder="Search by name, TMGID..."
          class="search-input"
        />
      </div>
    </header>

    <!-- Mode Banners -->
    <div v-if="mode === 'edit'" class="mode-banner edit-mode">
      🟡 EDITING: {{ formatPersonName(selectedPerson) }}
    </div>
    <div v-if="mode === 'new'" class="mode-banner new-mode">
      🟢 NEW PERSON
    </div>
    <div v-if="mode === 'select'" class="mode-banner select-mode">
      🔵 SELECT PERSON FOR MEDIA ITEM
    </div>

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
            @click="(mode !== 'edit' && mode !== 'new') ? selectPerson(person) : null"
            :class="{ 
              'person-item': true, 
              'selected': selectedPerson?.personID === person.personID,
              'disabled': mode === 'edit' || mode === 'new'
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
          <p v-if="mode === 'select'">👈 Click a person to select them</p>
          <p v-else>Select a person to view details</p>
        </div>
        
        <div v-else class="editor-content">
          <h2>{{ formatPersonName(selectedPerson) }}</h2>
          
          <div class="form-section">
            <label>First Name</label>
            <input 
              v-model="selectedPerson.first" 
              type="text"
              placeholder="First name"
              :disabled="mode === 'browse' || mode === 'select'"
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
                :disabled="mode === 'browse' || mode === 'select'"
              />
              <select v-model="lastName.type" class="name-type" :disabled="mode === 'browse' || mode === 'select'">
                <option value="">Birth/Maiden</option>
                <option value="married">Married</option>
              </select>
              <button 
                @click="removeLastName(index)" 
                type="button"
                class="btn-remove"
                :disabled="selectedPerson.last.length === 1 || mode === 'browse' || mode === 'select'"
              >
                ✕
              </button>
            </div>
            <button @click="addLastName" type="button" class="btn-add" :disabled="mode === 'browse' || mode === 'select'">
              + Add Last Name
            </button>
          </div>

          <div class="form-section">
            <label>TMGID</label>
            <input 
              v-model="selectedPerson.TMGID" 
              type="text"
              placeholder="The Master Genealogist ID"
              class="tmgid-input"
              :disabled="mode === 'browse' || mode === 'select'"
            />
          </div>

          <div class="form-section checkbox-field">
            <label>
              <input 
                v-model="selectedPerson.living" 
                type="checkbox"
                class="living-checkbox"
                :disabled="mode === 'browse' || mode === 'select'"
              />
              Living
            </label>
          </div>

          <div class="form-section">
            <label>Notes</label>
            <textarea 
              v-model="selectedPerson.notes" 
              rows="4"
              placeholder="Optional notes about this person"
              class="notes-input"
              :disabled="mode === 'browse' || mode === 'select'"
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
            <!-- Browse mode: Show Edit button -->
            <template v-if="mode === 'browse'">
              <button @click="enterEditMode" class="btn-primary">
                Edit This Person
              </button>
            </template>
            
            <!-- Edit/New mode: Show Save, Delete, and Cancel -->
            <template v-if="mode === 'edit' || mode === 'new'">
              <button @click="handleSave" :disabled="!isValid" class="btn-primary">
                {{ mode === 'new' ? 'Save New Person' : 'Save Changes' }}
              </button>
              <button 
                v-if="mode === 'edit' && canDelete" 
                @click="handleDelete" 
                :disabled="deleting" 
                class="btn-danger"
                title="Delete person - no items reference this person"
              >
                {{ deleting ? 'Deleting...' : 'Delete Person' }}
              </button>
              <div v-if="mode === 'edit' && !canDelete && !isNewPerson && selectedPerson" class="warning-message" style="color: #856404; background-color: #fff3cd; padding: 8px; border-radius: 4px; margin: 8px 0;">
                ⚠️ Cannot delete: {{ selectedPerson.itemCount }} item(s) reference this person
              </div>
              <button @click="handleCancel" class="btn-secondary">
                Cancel
              </button>
            </template>
            
            <!-- Select mode: Show Select button -->
            <template v-if="mode === 'select'">
              <button @click="handleSelectPerson" class="btn-primary btn-primary-large" :disabled="!selectedPerson.personID">
                ✓ Select This Person
              </button>
              <button @click="handleCancel" class="btn-secondary">
                Cancel
              </button>
            </template>
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
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { formatPersonName as formatPersonNameHelper } from '../../../../shared/personHelpers.js';

// State
const persons = ref([]);
const selectedPerson = ref(null);
const originalPerson = ref(null);
const searchQuery = ref('');
const saveMessage = ref(null);
const isNewPerson = ref(false);
const deleting = ref(false);
const searchInput = ref(null);
const mode = ref('browse'); // 'browse', 'edit', 'new', 'select'

const focusSearchInput = async () => {
  await nextTick();
  searchInput.value?.focus();
};
const previousMode = ref('browse'); // Track previous mode for returning after edit/new
const contextPersonIDs = ref([]); // Already-assigned personIDs for Select mode

// Modal state
const showConfirmModal = ref(false);
const confirmModalTitle = ref('');
const confirmModalMessage = ref('');
const confirmOkText = ref('OK');
const confirmCancelText = ref('Cancel');
let confirmResolve = null;

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
  const formatted = formatPersonNameHelper(person, false);
  return formatted || 'Unknown';
};

const selectPerson = async (person) => {
  // Check for unsaved changes before switching
  if (hasUnsavedChanges()) {
    const confirmed = await showConfirm(
      'Unsaved Changes',
      'You have unsaved changes. Switching to another person will discard them.',
      'Discard & Switch',
      'Stay Here'
    );
    
    if (!confirmed) {
      return; // User chose to stay, don't switch
    }
    // User chose OK, discard changes and continue with switch
  }
  
  // Clone to avoid mutating original, ensure living defaults to false if not present
  const personCopy = JSON.parse(JSON.stringify(person));
  if (personCopy.living === undefined) {
    personCopy.living = false;
  }
  
  selectedPerson.value = personCopy;
  originalPerson.value = JSON.parse(JSON.stringify(personCopy));
  isNewPerson.value = false;
  // Preserve select mode if active, otherwise return to browse
  if (mode.value !== 'select') {
    mode.value = 'browse';
  }
  saveMessage.value = null;
};

const enterEditMode = () => {
  if (!selectedPerson.value) return;
  previousMode.value = mode.value; // Remember where we came from
  mode.value = 'edit';
  saveMessage.value = null;
};

const handleSelectPerson = async () => {
  if (!selectedPerson.value || !selectedPerson.value.personID) return;
  
  // Check if person is already assigned (for validation)
  if (contextPersonIDs.value.includes(selectedPerson.value.personID)) {
    const confirmed = await showConfirm(
      'Person Already Assigned',
      `${formatPersonName(selectedPerson.value)} is already assigned to this media item. Select anyway?`,
      'Select Anyway',
      'Cancel'
    );
    if (!confirmed) {
      return;
    }
  }
  
  // Send selection back to Media Manager
  window.electronAPI.sendPersonSelection(selectedPerson.value.personID);
  
  // Close window
  window.close();
};

const createNewPerson = async () => {
  // Check for unsaved changes before creating new person
  if (hasUnsavedChanges()) {
    const confirmed = await showConfirm(
      'Unsaved Changes',
      'You have unsaved changes. Creating a new person will discard them.',
      'Discard & Create New',
      'Stay Here'
    );
    
    if (!confirmed) {
      return; // User chose to stay, don't create new
    }
    // User chose OK, discard changes and continue
  }
  
  // Generate new UUID for the person
  const personID = crypto.randomUUID();
  
  // Create blank person object
  const newPerson = {
    personID,
    first: '',
    last: [{ last: '', type: '' }],
    TMGID: '',
    living: false,
    notes: ''
  };
  
  // Set as selected and mark as new
  selectedPerson.value = newPerson;
  originalPerson.value = null;
  isNewPerson.value = true;
  // Remember the mode we came from before entering new mode
  previousMode.value = mode.value;
  mode.value = 'new';
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
    
    // Remove living attribute if false (optional, only present when true)
    if (!plainPerson.living) {
      delete plainPerson.living;
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
      
      // Update selected person and original person with cleaned data including itemCount
      const wasNewPerson = isNewPerson.value;
      const personWithCount = wasNewPerson 
        ? { ...plainPerson, itemCount: 0 }
        : { ...plainPerson, itemCount: persons.value.find(p => p.personID === plainPerson.personID)?.itemCount || 0 };
      
      selectedPerson.value = JSON.parse(JSON.stringify(personWithCount));
      originalPerson.value = JSON.parse(JSON.stringify(personWithCount));
      isNewPerson.value = false;
      // Return to the mode we were in before entering edit/new mode
      mode.value = previousMode.value;
      previousMode.value = 'browse'; // Reset for next time
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        if (saveMessage.value?.type === 'success') {
          saveMessage.value = null;
        }
      }, 3000);
    } else {
      saveMessage.value = { type: 'error', text: 'Error saving person: ' + result.error };
      throw new Error('Save failed: ' + result.error);
    }
  } catch (error) {
    saveMessage.value = { type: 'error', text: 'Error saving person: ' + error.message };
    throw error;
  }
};

const handleDelete = async () => {
  if (!selectedPerson.value || !selectedPerson.value.personID) return;
  
  const personName = formatPersonName(selectedPerson.value);
  const confirmed = await showConfirm(
    'Delete Person',
    `Are you sure you want to delete "${personName}"? This cannot be undone.`,
    'Delete',
    'Cancel'
  );
  
  if (!confirmed) {
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
      
      // Clear selection immediately
      selectedPerson.value = null;
      originalPerson.value = null;
      deleting.value = false;
      mode.value = 'browse'; // Return to browse mode
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        if (saveMessage.value?.type === 'success') {
          saveMessage.value = null;
        }
      }, 3000);
    } else {
      saveMessage.value = { type: 'error', text: 'Error: ' + result.error };
      deleting.value = false;
    }
  } catch (err) {
    saveMessage.value = { type: 'error', text: 'Error deleting: ' + err.message };
    deleting.value = false;
  }
};

const handleCancel = async () => {
  if (mode.value === 'select') {
    // In select mode, just close the window
    window.close();
    return;
  }
  
  if (mode.value === 'new') {
    // Cancel new person - return to previous mode
    selectedPerson.value = null;
    originalPerson.value = null;
    isNewPerson.value = false;
    mode.value = previousMode.value;
    previousMode.value = 'browse'; // Reset
    saveMessage.value = null;
    return;
  }
  
  if (mode.value === 'edit') {
    // Cancel edit - revert changes and return to previous mode
    if (hasUnsavedChanges()) {
      selectedPerson.value = JSON.parse(JSON.stringify(originalPerson.value));
    }
    mode.value = previousMode.value;
    previousMode.value = 'browse'; // Reset
    saveMessage.value = null;
    return;
  }
  
  // In browse mode with no selection or no changes
  if (isNewPerson.value) {
    // Discard new person and clear selection
    selectedPerson.value = null;
    originalPerson.value = null;
    isNewPerson.value = false;
    saveMessage.value = null;
  } else if (hasUnsavedChanges()) {
    const confirmed = await showConfirm(
      'Unsaved Changes',
      'You have unsaved changes. Discard changes and revert to original?',
      'Discard',
      'Keep Editing'
    );
    
    if (confirmed) {
      selectedPerson.value = JSON.parse(JSON.stringify(originalPerson.value));
      saveMessage.value = null;
    }
  } else {
    // No changes, just close the window
    window.close();
  }
};

// Lifecycle
onMounted(async () => {
  // Load persons initially
  await loadPersons();
  
  // Check if window was opened with mode and context parameters (initial load)
  if (window.personManagerInitData) {
    const { openMode, assignedPersonIDs } = window.personManagerInitData;
    if (openMode) {
      mode.value = openMode;
    }
    if (assignedPersonIDs) {
      contextPersonIDs.value = assignedPersonIDs;
    }
    if (openMode === 'select') {
      focusSearchInput();
    }
  }
  
  // Listen for mode change events (when window is already open)
  window.electronAPI.onModeChange((modeData) => {
    console.log('Mode change event received:', modeData);
    if (modeData.mode) {
      mode.value = modeData.mode;
      contextPersonIDs.value = modeData.assignedPersonIDs || [];
      // Clear selection when switching to select mode
      if (modeData.mode === 'select') {
        selectedPerson.value = null;
        originalPerson.value = null;
        isNewPerson.value = false;
        saveMessage.value = null;
        focusSearchInput();
      }
    }
  });
  
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

  // Refresh list when items change so itemCount stays current
  window.electronAPI.onPersonsRefresh(async () => {
    await loadPersons();
  });
  
  // Warn before closing window if there are unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges() && (mode.value === 'edit' || mode.value === 'new')) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
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

.form-section.checkbox-field label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0;
}

.form-section.checkbox-field input[type="checkbox"] {
  width: auto;
  padding: 0;
  margin: 0;
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

.form-section input.tmgid-input {
  max-width: 150px;
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

/* ModalStyles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  min-width: 400px;
  max-width: 500px;
  overflow: hidden;
}

.modal-header {
  padding: 20px;
  border-bottom: 1px solid #ddd;
  background-color: #f8f9fa;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.modal-body {
  padding: 20px;
  font-size: 14px;
  line-height: 1.6;
  color: #555;
}

.modal-footer {
  padding: 15px 20px;
  border-top: 1px solid #ddd;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  background-color: #f8f9fa;
}

.btn-modal-ok,
.btn-modal-cancel {
  padding: 8px 20px;
  font-size: 14px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-modal-ok {
  background-color: #007bff;
  color: white;
}

.btn-modal-ok:hover {
  background-color: #0056b3;
}

.btn-modal-cancel {
  background-color: #6c757d;
  color: white;
}

.btn-modal-cancel:hover {
  background-color: #545b62;
}

/* Mode Banners */
.mode-banner {
  padding: 12px 20px;
  font-weight: 600;
  font-size: 14px;
  text-align: center;
  border-bottom: 2px solid;
}

.mode-banner.edit-mode {
  background-color: #fff3cd;
  color: #856404;
  border-color: #ffc107;
}

.mode-banner.new-mode {
  background-color: #d4edda;
  color: #155724;
  border-color: #28a745;
}

.mode-banner.select-mode {
  background-color: #d1ecf1;
  color: #0c5460;
  border-color: #17a2b8;
}

/* Disabled person list items */
.person-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background-color: #f9f9f9;
}

.person-item.disabled:hover {
  background-color: #f9f9f9;
}

/* Large primary button for Select mode */
.btn-primary-large {
  font-size: 16px;
  padding: 14px 28px;
  font-weight: 600;
}

/* Select mode styling */
.select-mode + .content .person-item:not(.disabled) {
  cursor: pointer;
  transition: all 0.2s;
}

.select-mode + .content .person-item:not(.disabled):hover {
  background-color: #e3f2fd;
  border-left: 3px solid #90caf9;
}

.select-mode + .content .no-selection p {
  font-size: 18px;
  color: #0c5460;
}
</style>
