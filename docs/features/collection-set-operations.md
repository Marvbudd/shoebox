# Collection Set Operations - Vue Window Implementation

## Overview

Replaced dialog-based collection set operations with a proper Vue window interface. This provides better UX with:
- Visual collection selection
- Operation previews (item counts)
- Backup option
- Better error handling
- Modern, consistent UI

## Implementation

### New Files Created

1. **app/render/vue/windows/CollectionSetOperations/CollectionSetOperations.vue**
   - Main Vue component with reactive UI
   - Handles 4 operations: add, remove, intersect, addAll
   - Shows preview statistics before execution
   - Success/error feedback

2. **app/render/vue/windows/CollectionSetOperations/main.js**
   - Vue app initialization
   - Mounts component to DOM

3. **app/render/vue/windows/CollectionSetOperations/preload.js**
   - IPC bridge for secure renderer-main communication
   - Exposes: getCollections, getCollectionItems, executeCollectionOperation

4. **app/render/vue/windows/CollectionSetOperations/index.html**
   - Entry point for Vue window

### Modified Files

1. **app/main/ipc/collectionHandlers.js**
   - Added `collection:executeSetOperation` IPC handler
   - Validates input, executes operation, returns results
   - Supports optional user backup (in addition to automatic backup)

2. **app/main/windows/windowManager.js**
   - Added `createCollectionSetOperationsWindow()` function
   - Passes operation type and target collection via URL params
   - Manages window lifecycle

3. **app/main/main.js**
   - Added `collectionSetOperations` to windowRefs
   - Replaced 4 long dialog-based functions with simple window openers
   - Each function now just validates and opens the Vue window

4. **vite.config.js**
   - Added `collectionSetOperations` to window paths mapping

## Operations Supported

### 1. Add Items from Collection (Union)
- **Menu**: Collections > Add Items from Collection
- **Operation**: Adds all items from source collection to target
- **Duplicates**: Automatically skipped

### 2. Remove Items (in Collection) (Difference)
- **Menu**: Collections > Remove Items (in Collection)
- **Operation**: Removes items that exist in source from target
- **Non-existent**: Items in source but not in target are ignored

### 3. Intersect with Collection
- **Menu**: Collections > Intersect with Collection
- **Operation**: Keeps only items that exist in both collections
- **Result**: Target contains only common items

### 4. Add All Archive Items
- **Menu**: Collections > Add All Archive Items
- **Operation**: Adds every item from the archive to target
- **Duplicates**: Automatically skipped

## Technical Details

### URL Parameters
Window receives operation details via query params:
```
file:///.../collectionSetOperations/index.html?operation=add&targetCollection=favorites
```

### IPC Communication

**From Renderer:**
```javascript
window.electronAPI.executeCollectionOperation({
  operation: 'add',           // 'add', 'remove', 'intersect', 'addAll'
  targetCollection: 'key',
  sourceCollection: 'key',    // not needed for 'addAll'
  createBackup: true
})
```

**From Main:**
```javascript
{
  success: true,
  message: "Added 5 items...",
  addedCount: 5,
  skippedCount: 2,
  backupFile: "favorites_backup_20250101_120000.json"
}
```

### Backup Strategy

1. **Automatic Backup**: CollectionsClass methods create timestamped backups before modifications
2. **Optional User Backup**: Checkbox in UI creates additional backup collection
3. **Backup Location**: `collections/{collectionKey}_backup_{timestamp}.json`

## Testing

### Prerequisites
1. Have at least 2 collections created
2. Collections should have some overlapping and some unique items

### Test Cases

**Test 1: Add Items from Collection**
1. Select a target collection from dropdown
2. Menu: Collections > Add Items from Collection
3. Select source collection
4. Verify preview shows correct counts
5. Click "Add Items"
6. Verify success message and counts
7. Verify target collection updated in main window

**Test 2: Remove Items**
1. Create two collections with some common items
2. Select target from dropdown
3. Menu: Collections > Remove Items (in Collection)
4. Select source collection
5. Verify preview shows items to remove
6. Click "Remove Items"
7. Verify common items removed from target

**Test 3: Intersect**
1. Create collections with partial overlap
2. Select target collection
3. Menu: Collections > Intersect with Collection
4. Select source collection
5. Verify preview shows kept/removed counts
6. Click "Apply Intersection"
7. Verify only common items remain

**Test 4: Add All Archive Items**
1. Select a collection
2. Menu: Collections > Add All Archive Items
3. Verify preview shows items to add
4. Click "Add All Items"
5. Verify collection now contains all archive items

**Test 5: Error Handling**
1. Try operations with no collection selected
2. Verify friendly error dialog
3. Try operation with only one collection existing
4. Verify appropriate message

**Test 6: Backup Verification**
1. Enable "Create backup" checkbox
2. Execute any operation
3. Check collection dropdown for backup collection
4. Verify backup contains pre-operation state

## Benefits Over Old Implementation

### Before (Dialog-based)
- ❌ Multiple blocking dialogs
- ❌ No visual preview
- ❌ Poor UX for collection selection
- ❌ Limited error feedback
- ❌ Inconsistent with rest of app

### After (Vue Window)
- ✅ Single unified window
- ✅ Live preview of operation results
- ✅ Dropdown selection with item counts
- ✅ Clear success/error messages
- ✅ Matches PersonManager, MediaManager patterns
- ✅ Optional user backup in addition to automatic

## Future Enhancements

1. **Preview Details**: Show actual item lists before execution
2. **Undo Support**: Quick undo button to restore from backup
3. **Multiple Source Selection**: Add from multiple collections at once
4. **Operation History**: Track recent set operations
5. **Progress Bar**: For large collections
6. **Dry Run Mode**: Show what would happen without executing
