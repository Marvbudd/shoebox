<template>
  <div class="collection-manager">
    <header>
      <h1>{{ isDeleteMode ? 'Delete Collection' : 'Create Collection' }}</h1>
      <p class="subtitle">{{ isDeleteMode ? 'Remove a collection from the system' : 'Add a new collection to organize items' }}</p>
    </header>

    <div class="content">
      <div v-if="loading" class="loading">Loading...</div>
      
      <div v-else-if="error" class="error-box">
        <strong>Error:</strong> {{ error }}
      </div>

      <!-- Create Collection Form -->
      <form v-else-if="!isDeleteMode" @submit.prevent="handleCreate" class="collection-form">
        <div class="form-section">
          <label for="key">Key <span class="required">*</span></label>
          <input 
            type="text" 
            id="key" 
            v-model="formData.key" 
            required
            placeholder="e.g., vacation2024"
          />
          <small>Filename in the collections folder (short, no spaces)</small>
        </div>

        <div class="form-section">
          <label for="text">Text <span class="required">*</span></label>
          <input 
            type="text" 
            id="text" 
            v-model="formData.text" 
            required
            maxlength="15"
            placeholder="e.g., Vacation 2024"
          />
          <small>Display name when selecting (max 15 characters)</small>
        </div>

        <div class="form-section">
          <label for="title">Title <span class="required">*</span></label>
          <input 
            type="text" 
            id="title" 
            v-model="formData.title" 
            required
            placeholder="e.g., Summer Vacation Photos 2024"
          />
          <small>Full title shown at top of exported page (can be longer)</small>
        </div>

        <div class="form-actions">
          <button type="submit" :disabled="saving" class="btn-primary">
            {{ saving ? 'Creating...' : 'Create Collection' }}
          </button>
          <button type="button" @click="handleCancel" :disabled="saving" class="btn-secondary">
            Cancel
          </button>
        </div>

        <div v-if="statusMessage" :class="'status-message ' + statusMessage.type">
          {{ statusMessage.text }}
        </div>
      </form>

      <!-- Delete Collection Form -->
      <form v-else @submit.prevent="handleDelete" class="collection-form">
        <div class="form-section">
          <label for="collection">Select Collection <span class="required">*</span></label>
          <select id="collection" v-model="selectedCollection" required>
            <option value="">-- Select a collection to delete --</option>
            <option 
              v-for="collection in collections" 
              :key="collection.value" 
              :value="collection.value"
            >
              {{ collection.text }} ({{ collection.value }})
            </option>
          </select>
        </div>

        <div class="warning-box">
          <strong>⚠ Note:</strong> Deleting a collection renames it in the collections folder so it becomes inactive. 
          The .json extension is replaced with a timestamp (yearDayOfYearHourMinute). 
          You can manually restore it later by renaming the file back to .json.
        </div>

        <div class="form-actions">
          <button 
            type="submit" 
            :disabled="!selectedCollection || saving" 
            class="btn-danger"
          >
            {{ saving ? 'Deleting...' : 'Delete Collection' }}
          </button>
          <button type="button" @click="handleCancel" :disabled="saving" class="btn-secondary">
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
import { ref, onMounted } from 'vue';

const mode = ref('');
const collections = ref([]);
const loading = ref(true);
const saving = ref(false);
const error = ref(null);
const statusMessage = ref(null);

const formData = ref({
  key: '',
  text: '',
  title: ''
});

const selectedCollection = ref('');

const isDeleteMode = ref(false);

const handleCreate = async () => {
  if (!formData.value.key || !formData.value.text || !formData.value.title) {
    return;
  }
  
  saving.value = true;
  statusMessage.value = { type: 'info', text: 'Creating collection...' };
  
  try {
    // Convert reactive object to plain object for IPC
    const plainData = {
      key: formData.value.key,
      text: formData.value.text,
      title: formData.value.title
    };
    const result = await window.electronAPI.createCollection(plainData);
    
    if (result.success) {
      statusMessage.value = { 
        type: 'success', 
        text: 'Collection created successfully!' 
      };
      setTimeout(() => {
        window.close();
      }, 1500);
    } else {
      statusMessage.value = { type: 'error', text: 'Error: ' + result.error };
      saving.value = false;
    }
  } catch (err) {
    statusMessage.value = { type: 'error', text: 'Error creating collection: ' + err.message };
    saving.value = false;
  }
};

const handleDelete = async () => {
  if (!selectedCollection.value) {
    return;
  }
  
  saving.value = true;
  statusMessage.value = { type: 'info', text: 'Deleting collection...' };
  
  try {
    const result = await window.electronAPI.deleteCollection(selectedCollection.value);
    
    if (result.success) {
      statusMessage.value = { 
        type: 'success', 
        text: 'Collection deleted successfully!' 
      };
      setTimeout(() => {
        window.close();
      }, 1500);
    } else {
      statusMessage.value = { type: 'error', text: 'Error: ' + result.error };
      saving.value = false;
    }
  } catch (err) {
    statusMessage.value = { type: 'error', text: 'Error deleting collection: ' + err.message };
    saving.value = false;
  }
};

const handleCancel = () => {
  window.close();
};

onMounted(async () => {
  try {
    mode.value = await window.electronAPI.getMode();
    isDeleteMode.value = mode.value === 'delete';
    
    if (isDeleteMode.value) {
      collections.value = await window.electronAPI.getCollections();
    }
    
    loading.value = false;
  } catch (err) {
    error.value = err.message;
    loading.value = false;
  }
});
</script>

<style scoped>
.collection-manager {
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

.collection-form {
  max-width: 600px;
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

.form-section input,
.form-section select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
}

.form-section input:focus,
.form-section select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-section small {
  display: block;
  margin-top: 0.25rem;
  color: #666;
  font-size: 0.875rem;
}

.warning-box {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  color: #856404;
}

.warning-box strong {
  display: block;
  margin-bottom: 0.5rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.form-actions button {
  flex: 1;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-message {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 4px;
  text-align: center;
}

.status-message.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
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
</style>
