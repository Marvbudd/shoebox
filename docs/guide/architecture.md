---
audience: development
---

# Shoebox Architecture Guide

> Audience: Developers and advanced users

## Core Principles

### 1. Data Mutation Encapsulation

**Golden Rule: ALL mutations to `accessionJSON` MUST go through AccessionClass methods.**

See [app/main/utils/AccessionClass.js](../../app/main/utils/AccessionClass.js) header documentation for complete details.

#### Why This Matters

- **Data Security**: Single point of control prevents inconsistent state
- **Maintainability**: All mutation logic lives in one place  
- **Correctness**: Can't forget to set the `accessionsChanged` flag
- **Clarity**: Clear ownership - AccessionClass owns its data

#### Quick Reference

```javascript
// ❌ NEVER: Direct mutation from outside AccessionClass
accessionClass.accessionJSON.accessions.item.push(newItem);
accessionClass.accessionsChanged = true;

// ✅ ALWAYS: Use AccessionClass methods
accessionClass.saveItem(itemData);  // Method handles flag internally
```

### 2. Deferred-Save Pattern

Both AccessionClass and CollectionClass use deferred saves:

- Mutation methods set the `*Changed` flag
- **DO NOT call save methods from IPC handlers**
- Saves happen automatically on:
  - Window close
  - Archive switch
  - Collection deletion/archival

**Benefits:**
- Better performance (no disk write on every change)
- Transactional consistency (batched saves)
- Proper encapsulation (no external save control)

### 3. Service Classes Pattern

Service classes (PersonService, ArchiveImportService, ValidationService) are **implementation details** used internally by AccessionClass.

**Pattern:**
- AccessionClass instantiates services internally
- External code calls AccessionClass methods only
- AccessionClass manages all flags and persistence

**Exception:** ValidationService is read-only but still wrapped via `accessionClass.validateArchive()`.

### 4. Collections as Friends

CollectionsClass is owned and managed exclusively by AccessionClass:
- AccessionClass creates the CollectionsClass instance
- AccessionClass calls `readCollections()` on init
- AccessionClass calls `saveCollections()` from `saveAccessions()`
- External code never instantiates CollectionsClass directly

See [app/main/utils/CollectionsClass.js](../../app/main/utils/CollectionsClass.js) header for details.

---

## OS Interface / Electron IPC Patterns

### Critical Rule: One Implementation Per OS Operation

Any operation that interfaces with the OS (files, MIME types, external apps) **must have exactly one canonical implementation**. Duplication causes platform-specific bugs.

### Canonical Implementations Reference

| Operation | Method | Location | Usage |
|-----------|--------|----------|-------|
| Open file in system app | IPC: `media:openExternal` | `app/main/ipc/accessionsHandlers.js` | `window.electronAPI.openMediaExternal(type, link)` |
| Open arbitrary path | IPC: `file:open` | `app/main/ipc/accessionsHandlers.js` | For log files, exports, etc. |
| MIME type detection | Utility: `getMimeType()` | `app/main/utils/mimeTypes.js` | Import in main process code |
| Video codec detection | Utility: `hasUnsupportedCodec()` | `app/render/vue/shared/videoCodecDetection.js` | Import in Vue components |

### Why `<a target="_blank">` Fails for Local Files

Never use `<a target="_blank" href="filepath">` in Electron. This opens a blank BrowserWindow, not the system viewer.

```javascript
// ❌ WRONG: Opens blank Electron window
<a target="_blank" href="/path/to/file.jpg">Open</a>

// ✅ CORRECT: Opens in system default app
window.electronAPI.openMediaExternal('photo', 'file.jpg')
```

### Media URLs: Use `media://` Protocol

Electron's renderer sandbox **blocks raw file paths** as media `src` attributes. Always use `media://` protocol URLs.

```javascript
// ❌ WRONG: Blocked by sandbox, fails silently
<video><source src="/home/user/video/file.mov" /></video>

// ✅ CORRECT: Uses custom protocol handler
<video><source src="media://video/file.mov" /></video>

// In Vue: Get URL via IPC
const mediaPath = await window.electronAPI.getMediaPath(type, link);
// Returns: "media://video/file.mov"
```

**Vue Template Pattern:** Use `:src` binding, never `v-html` for media elements:

```vue
<!-- ✅ CORRECT: Template binding triggers media load, events fire -->
<video :src="mediaPreviewPath" controls @loadedmetadata="checkCodec"></video>

<!-- ❌ WRONG: v-html doesn't trigger load, events never fire -->
<div v-html="htmlWithVideoTag"></div>
```

### Shared Utilities Pattern

When multiple components need the same OS interface logic, create a shared utility in `app/render/vue/shared/`.

**Example:** Both Media Player and Media Manager use the same codec detection:
```javascript
import { hasUnsupportedCodec } from '../../shared/videoCodecDetection.js';
```

**Never duplicate inline** - causes divergent cross-platform behavior.

---

## Adding New Features

### When Adding Data Mutations

1. **Add method to AccessionClass** ([app/main/utils/AccessionClass.js](../../app/main/utils/AccessionClass.js))
2. **Update class header** to document in "Mutation Methods" list
3. **Set `this.accessionsChanged = true`** when data changes
4. **Test save/load cycle** to ensure persistence works
5. **Update [data-structure.md](data-structure.md)** if adding new fields/patterns

**Template:**
```javascript
/**
 * Brief description of what this mutation does
 * @param {Type} paramName - Parameter description  
 * @returns {Object} Result object
 */
myNewMutation(paramName) {
  // Validate input
  if (!isValid) return { success: false, error: 'reason' };
  
  // Mutate this.accessionJSON
  // ...
  
  // Set flag
  this.accessionsChanged = true;
  
  return { success: true, /* results */ };
}
```

### When Adding IPC Handlers

1. **Check if operation already exists** - avoid duplication
2. **Add to appropriate handler file** (e.g., `app/main/ipc/accessionsHandlers.js`)
3. **Use consistent naming**: `category:action` (e.g., `media:openExternal`)
4. **Document in this file** if it's a new OS interface pattern

### When Adding Shared Vue Components/Utilities

1. **Place in `app/render/vue/shared/`** for cross-window code
2. **Document in this file** under "Canonical Implementations"
3. **Import in components** rather than duplicating logic

---

## Decision Tree: Where Should Code Go?

```
Does it mutate accessionJSON?
├─ YES → Add method to AccessionClass
│        └─ Update class header documentation
└─ NO → Continue...

Does it interface with OS (files, apps, MIME types)?
├─ YES → Check if canonical implementation exists
│        ├─ EXISTS → Use it (don't duplicate!)
│        └─ NEW → Create one, document in this file
└─ NO → Continue...

Is it shared between multiple Vue components?
├─ YES → Create in app/render/vue/shared/
│        └─ Document in this file
└─ NO → Component-specific code is fine

Does it relate to data structure (JSON format)?
├─ YES → Document in docs/guide/data-structure.md
└─ NO → Component/module comments are sufficient
```

---

## Related Documentation

- **Data Structure**: [data-structure.md](data-structure.md) - Complete `accessions.json` format
- **Collections**: [collections.md](../features/collections.md) - Collection workflows and export
- **Implementation Details**:
  - [AccessionClass.js](../../app/main/utils/AccessionClass.js) - Data mutation patterns
  - [CollectionClass.js](../../app/main/utils/CollectionClass.js) - Collection management
  - [CollectionsClass.js](../../app/main/utils/CollectionsClass.js) - Friend relationship with AccessionClass
