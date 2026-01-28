<template>
  <div class="collection-set-operations">
    <header>
      <h1>{{ operationTitle }}</h1>
      <p class="subtitle">{{ operationSubtitle }}</p>
    </header>

    <div class="content">
      <div v-if="loading" class="loading">Loading collections...</div>
      
      <div v-else-if="error" class="error-box">
        <strong>Error:</strong> {{ error }}
      </div>

      <form v-else @submit.prevent="handleExecute" class="operation-form">
        <!-- Target Collection (read-only, pre-selected) -->
        <div class="form-section">
          <label>Target Collection</label>
          <div class="target-collection">
            <strong>{{ targetCollection?.text || targetCollectionKey }}</strong>
            <span class="item-count">({{ targetItemCount }} items)</span>
          </div>
        </div>

        <!-- Source Collection Selection (not shown for Add All) -->
        <div v-if="operation !== 'addAll'" class="form-section">
          <label for="sourceCollection">
            {{ operation === 'add' ? 'Add items from' : operation === 'remove' ? 'Remove items in' : 'Keep only items in' }}
            <span class="required">*</span>
          </label>
          <select 
            id="sourceCollection"
            v-model="selectedSourceCollection" 
            @change="onSourceCollectionChange"
            required
          >
            <option value="">-- Select a collection --</option>
            <option 
              v-for="collection in sourceCollections" 
              :key="collection.value" 
              :value="collection.value"
            >
              {{ collection.text }} ({{ collection.value }})
            </option>
          </select>
          <small v-if="sourceItemCount > 0">{{ sourceItemCount }} item(s) in this collection</small>
        </div>

        <!-- Preview -->
        <div v-if="showPreview" class="preview-section">
          <h3>Preview</h3>
          <div class="preview-details">
            <div class="preview-item">
              <span class="label">Target collection:</span>
              <span class="value">{{ targetItemCount }} items</span>
            </div>
            <div v-if="operation !== 'addAll'" class="preview-item">
              <span class="label">Source collection:</span>
              <span class="value">{{ sourceItemCount }} items</span>
            </div>
            <div v-if="operation === 'add'" class="preview-item highlight">
              <span class="label">New items (will be added):</span>
              <span class="value">{{ previewStats.toAdd }}</span>
            </div>
            <div v-if="operation === 'add'" class="preview-item muted">
              <span class="label">Duplicates (will be skipped):</span>
              <span class="value">{{ previewStats.alreadyPresent }}</span>
            </div>
            <div v-if="operation === 'remove'" class="preview-item highlight">
              <span class="label">Items to remove from target:</span>
              <span class="value">{{ previewStats.toRemove }}</span>
            </div>
            <div v-if="operation === 'remove'" class="preview-item muted">
              <span class="label">Source items not in target:</span>
              <span class="value">{{ previewStats.notPresent }}</span>
            </div>
            <div v-if="operation === 'intersect'" class="preview-item highlight">
              <span class="label">Items in both (will keep):</span>
              <span class="value">{{ previewStats.toKeep }}</span>
            </div>
            <div v-if="operation === 'intersect'" class="preview-item highlight">
              <span class="label">Items only in target (will remove):</span>
              <span class="value">{{ previewStats.toRemove }}</span>
            </div>
            <div v-if="operation === 'addAll'" class="preview-item highlight">
              <span class="label">Archive items to add:</span>
              <span class="value">{{ previewStats.toAdd }}</span>
            </div>
            <div class="preview-item result">
              <span class="label">Target size after operation:</span>
              <span class="value"><strong>{{ previewStats.finalCount }}</strong> items</span>
            </div>
          </div>
        </div>

        <!-- Backup Option -->
        <div class="form-section">
          <div class="info-box">
            <strong>Note:</strong> A timestamped backup of the target collection will be created automatically before making changes.
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="button-group">
          <button 
            type="submit" 
            class="btn-primary"
            :disabled="!canExecute || executing"
          >
            {{ executing ? 'Processing...' : executeButtonLabel }}
          </button>
          <button 
            type="button" 
            class="btn-secondary"
            @click="handleCancel"
            :disabled="executing"
          >
            Cancel
          </button>
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="success-box">
          {{ successMessage }}
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

// Props passed from main process
const urlParams = new URLSearchParams(window.location.search);
const operation = ref(urlParams.get('operation') || 'add'); // 'add', 'remove', 'intersect', 'addAll'
const targetCollectionKey = ref(urlParams.get('targetCollection') || '');

// State
const loading = ref(true);
const error = ref('');
const executing = ref(false);
const successMessage = ref('');

const collections = ref([]);
const targetCollection = ref(null);
const selectedSourceCollection = ref('');
const sourceCollection = ref(null);

const targetItemCount = ref(0);
const sourceItemCount = ref(0);
const targetItems = ref([]);
const sourceItems = ref([]);

// Computed
const operationTitle = computed(() => {
  switch (operation.value) {
    case 'add':
      return 'Add Items from Collection';
    case 'remove':
      return 'Remove Items (in Collection)';
    case 'intersect':
      return 'Intersect with Collection';
    case 'addAll':
      return 'Add All Archive Items';
    default:
      return 'Collection Operation';
  }
});

const operationSubtitle = computed(() => {
  switch (operation.value) {
    case 'add':
      return 'Add items from another collection to the target collection (union)';
    case 'remove':
      return 'Remove items that exist in another collection from the target (difference)';
    case 'intersect':
      return 'Keep only items that exist in both collections (intersection)';
    case 'addAll':
      return 'Add all items from the archive to the target collection';
    default:
      return '';
  }
});

const executeButtonLabel = computed(() => {
  switch (operation.value) {
    case 'add':
      return 'Add Items';
    case 'remove':
      return 'Remove Items';
    case 'intersect':
      return 'Apply Intersection';
    case 'addAll':
      return 'Add All Items';
    default:
      return 'Execute';
  }
});

const sourceCollections = computed(() => {
  return collections.value.filter(c => c.value !== targetCollectionKey.value);
});

const canExecute = computed(() => {
  if (operation.value === 'addAll') {
    return true;
  }
  return selectedSourceCollection.value !== '';
});

const showPreview = computed(() => {
  if (operation.value === 'addAll') {
    return targetItemCount.value >= 0;
  }
  return selectedSourceCollection.value !== '' && sourceItemCount.value >= 0;
});

const previewStats = computed(() => {
  const stats = {
    toAdd: 0,
    toRemove: 0,
    toKeep: 0,
    alreadyPresent: 0,
    notPresent: 0,
    finalCount: targetItemCount.value
  };

  if (operation.value === 'add') {
    // Calculate actual intersection between source and target
    // targetItems and sourceItems are arrays of link strings
    const targetLinks = new Set(targetItems.value);
    const sourceLinks = sourceItems.value;
    
    const newItems = sourceLinks.filter(link => !targetLinks.has(link));
    const duplicates = sourceLinks.filter(link => targetLinks.has(link));
    
    stats.toAdd = newItems.length;
    stats.alreadyPresent = duplicates.length;
    stats.finalCount = targetItemCount.value + stats.toAdd;
  } else if (operation.value === 'remove') {
    // Calculate how many items will actually be removed
    // targetItems and sourceItems are arrays of link strings
    const targetLinks = new Set(targetItems.value);
    const sourceLinks = sourceItems.value;
    
    const toRemove = sourceLinks.filter(link => targetLinks.has(link));
    const notInTarget = sourceLinks.filter(link => !targetLinks.has(link));
    
    stats.toRemove = toRemove.length;
    stats.notPresent = notInTarget.length;
    stats.finalCount = targetItemCount.value - stats.toRemove;
  } else if (operation.value === 'intersect') {
    // Calculate intersection
    // targetItems and sourceItems are arrays of link strings
    const targetLinks = new Set(targetItems.value);
    const sourceLinks = new Set(sourceItems.value);
    
    const intersection = targetItems.value.filter(link => sourceLinks.has(link));
    
    stats.toKeep = intersection.length;
    stats.toRemove = targetItemCount.value - stats.toKeep;
    stats.finalCount = stats.toKeep;
  } else if (operation.value === 'addAll') {
    // For addAll, we need the total archive count
    // This will be set when we load archive data
    stats.toAdd = 0;
    stats.finalCount = targetItemCount.value + stats.toAdd;
  }

  return stats;
});

// Methods
const loadData = async () => {
  try {
    loading.value = true;
    error.value = '';

    // Load all collections
    collections.value = await window.electronAPI.getCollections();

    // Find target collection
    targetCollection.value = collections.value.find(c => c.value === targetCollectionKey.value);
    
    if (!targetCollection.value) {
      error.value = `Target collection "${targetCollectionKey.value}" not found`;
      return;
    }

    // Get target collection item count
    const targetItemsData = await window.electronAPI.getCollectionItems(targetCollectionKey.value);
    targetItemCount.value = targetItemsData.length;
    targetItems.value = targetItemsData;

  } catch (err) {
    console.error('Error loading data:', err);
    error.value = err.message || 'Failed to load data';
  } finally {
    loading.value = false;
  }
};

const onSourceCollectionChange = async () => {
  if (!selectedSourceCollection.value) {
    sourceItemCount.value = 0;
    sourceCollection.value = null;
    sourceItems.value = [];
    return;
  }

  try {
    sourceCollection.value = collections.value.find(c => c.value === selectedSourceCollection.value);
    const sourceItemsData = await window.electronAPI.getCollectionItems(selectedSourceCollection.value);
    sourceItemCount.value = sourceItemsData.length;
    sourceItems.value = sourceItemsData;
  } catch (err) {
    console.error('Error loading source collection:', err);
    error.value = err.message || 'Failed to load source collection';
  }
};

const handleExecute = async () => {
  try {
    executing.value = true;
    error.value = '';
    successMessage.value = '';

    const operationData = {
      operation: operation.value,
      targetCollection: targetCollectionKey.value,
      sourceCollection: selectedSourceCollection.value
    };

    const result = await window.electronAPI.executeCollectionOperation(operationData);

    if (result.success) {
      successMessage.value = result.message + ' Window will close in 3 seconds...';
      
      // Keep button disabled and close window after showing success message
      setTimeout(() => {
        window.close();
      }, 3000);
    } else {
      error.value = result.error || 'Operation failed';
      executing.value = false;
    }

  } catch (err) {
    console.error('Error executing operation:', err);
    error.value = err.message || 'Failed to execute operation';
    executing.value = false;
  }
};

const handleCancel = () => {
  window.close();
};

// Lifecycle
onMounted(() => {
  loadData();
});
</script>

<style scoped>
.collection-set-operations {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

header {
  margin-bottom: 30px;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 15px;
}

h1 {
  margin: 0 0 10px 0;
  font-size: 24px;
  color: #333;
}

.subtitle {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.content {
  min-height: 200px;
}

.loading,
.error-box {
  padding: 20px;
  text-align: center;
  border-radius: 4px;
}

.loading {
  background: #f5f5f5;
  color: #666;
}

.error-box {
  background: #fee;
  color: #c33;
  border: 1px solid #fcc;
}

.info-box {
  background: #e7f3ff;
  color: #0066cc;
  border: 1px solid #b3d9ff;
  padding: 12px;
  border-radius: 4px;
  font-size: 13px;
}

.info-box strong {
  font-weight: 600;
}

.success-box {
  background: #efe;
  color: #3c3;
  border: 1px solid #cfc;
  padding: 15px;
  border-radius: 4px;
  margin-top: 20px;
}

.operation-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-section label {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.required {
  color: #c33;
}

.target-collection {
  padding: 12px;
  background: #f5f5f5;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-count {
  color: #666;
  font-size: 13px;
}

select {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
  background: white;
}

select:focus {
  outline: none;
  border-color: #4a90e2;
  box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
}

small {
  color: #666;
  font-size: 12px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: normal;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.preview-section {
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 15px;
}

.preview-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #333;
}

.preview-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 14px;
}

.preview-item.result {
  border-top: 2px solid #ddd;
  margin-top: 8px;
  padding-top: 12px;
  font-size: 15px;
}

.preview-item .label {
  color: #666;
}

.preview-item .value {
  color: #333;
  font-weight: 500;
}

.preview-item.highlight {
  background: #f0f8ff;
  padding: 8px 10px;
  margin: 0 -10px;
  border-radius: 4px;
}

.preview-item.highlight .label {
  color: #0066cc;
  font-weight: 600;
}

.preview-item.muted {
  opacity: 0.7;
}

.preview-item.muted .label {
  font-style: italic;
}

.button-group {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #4a90e2;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #357abd;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-secondary {
  background: #e0e0e0;
  color: #333;
}

.btn-secondary:hover:not(:disabled) {
  background: #d0d0d0;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
