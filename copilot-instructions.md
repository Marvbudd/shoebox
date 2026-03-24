# Shoebox Architecture Guidelines

## Data Mutation and Encapsulation Pattern

### Critical Rule: AccessionClass Encapsulation

**ALL mutations to `accessionJSON` MUST go through AccessionClass methods.**

#### ❌ NEVER DO THIS:
```javascript
// DON'T: Direct mutation from outside AccessionClass
accessionClass.accessionJSON.accessions.item.push(newItem);
accessionClass.accessionsChanged = true;  // Caller shouldn't touch this flag

// DON'T: Service classes modifying data with caller managing the flag
const personService = new PersonService(accessionClass.accessionJSON);
const result = personService.importPersons(sourcePersons, targetPersons, options);
if (result.imported.length > 0) {
  accessionClass.accessionsChanged = true;  // This is AccessionClass's responsibility
}
```

#### ✅ ALWAYS DO THIS:
```javascript
// DO: Use AccessionClass mutation methods
const result = accessionClass.importPersonsFromArchive(sourcePersons, options);
// The method handles setting accessionsChanged internally

// DO: Create new AccessionClass methods for complex operations
// Add to AccessionClass:
myMutationMethod(data) {
  // ... perform mutations on this.accessionJSON ...
  this.accessionsChanged = true;  // AccessionClass manages its own flag
  return result;
}
```

### Why This Pattern Matters

1. **Data Security**: Single point of control prevents inconsistent state
2. **Maintainability**: All mutation logic lives in one place
3. **Correctness**: Can't forget to set the `accessionsChanged` flag
4. **Clarity**: Clear ownership - AccessionClass owns its data

### Service Classes (PersonService, ArchiveImportService, ValidationService, etc.)

Service classes are **implementation details** used by AccessionClass methods:

```javascript
// In AccessionClass
importPersonsFromArchive(sourcePersons, options) {
  // Service is internal - AccessionClass owns the mutation
  const personService = new PersonService(this.accessionJSON);
  const result = personService.importPersons(
    sourcePersons,
    this.accessionJSON.persons,
    options
  );
  
  // AccessionClass manages the flag
  if (result.imported.length > 0) {
    this.accessionsChanged = true;
  }
  
  return result;
}
```

**External code should never directly instantiate service classes for mutations** - they should call AccessionClass methods instead.

**ValidationService** is read-only but still an implementation detail:
- AccessionClass has `validateArchive()` method
- CollectionsClass has `validateCollection()` method  
- External code should use these methods, not instantiate ValidationService directly
- This maintains encapsulation even for read operations

### Adding New Mutation Operations

When implementing a new feature that modifies `accessionJSON`:

1. **Add a method to AccessionClass** (in `app/main/utils/AccessionClass.js`)
2. **Document it in the class header** (add to "Mutation Methods" list)
3. **Set `this.accessionsChanged = true`** when modifications occur
4. **Use service classes internally** if needed for complex logic
5. **Return meaningful results** to the caller

Example template:
```javascript
/**
 * Brief description of what this mutation does
 * @param {Type} paramName - Parameter description
 * @returns {Object} Result description
 */
myNewMutation(paramName) {
  // Perform validation
  if (!isValid) {
    return { success: false, error: 'reason' };
  }
  
  // Perform mutation on this.accessionJSON
  // ... modify data ...
  
  // Set flag when data changes
  this.accessionsChanged = true;
  
  return { success: true, /* other results */ };
}
```

### Deferred-Save Pattern

AccessionClass uses a **deferred-save pattern**:

- Methods set `accessionsChanged = true` 
- **DO NOT call `saveAccessions()` from IPC handlers or menu functions**
- Save happens automatically when:
  - Main window closes
  - Switching archives
  - Creating new archive

This ensures:
- Better performance (no disk write on every change)
- Transactional consistency (batched saves)
- Proper encapsulation

### Read-Only Access

For read-only operations, direct access to `accessionJSON` is acceptable:
```javascript
// OK for reading
const items = accessionClass.accessionJSON.accessions.item;
const person = accessionClass.accessionJSON.persons[personID];
```

But prefer using getter methods when available:
```javascript
// Better
const itemView = accessionClass.getItemView(accession, link);
const items = accessionClass.getItemsForPerson(personID);
```

## Summary

**Golden Rule**: If it changes `accessionJSON`, it must be an AccessionClass method.

When in doubt:
1. Is this modifying data? → Add to AccessionClass
2. Is this just reading? → Direct access OK, but prefer getters
3. Is this complex logic? → Create a service, wrap in AccessionClass method
4. Am I setting `accessionsChanged`? → Should be in AccessionClass, not caller

---

## OS Interface / Electron IPC Pattern

### Rule: One Implementation Per OS-Level Operation

Any operation that interfaces with the OS (opening files, launching external apps, MIME type detection, etc.) **must have exactly one implementation**. Duplicated OS interface code leads to bugs that appear on only one platform.

#### ❌ NEVER DO THIS:
```javascript
// DON'T: Different code paths for the same OS operation
// Main window uses <a target="_blank" href="filepath"> → blank window on Windows
// Media Manager uses shell.openPath via IPC → works correctly
// MIME type logic duplicated in main.js AND ItemViewClass.js → gets out of sync
```

#### ✅ ALWAYS DO THIS:
```javascript
// DO: Single IPC handler for opening files in the system default app
// Defined in: app/main/ipc/accessionsHandlers.js → 'media:openExternal'
// All windows must call: window.electronAPI.openMediaExternal(type, link)

// DO: Shared utility for MIME types
// Defined in: app/main/utils/mimeTypes.js → getMimeType(type, link)
// Used by: main.js (media:// protocol handler) AND ItemViewClass.js
```

#### Canonical OS Interface Implementations

| Operation | IPC Channel | Handler Location | Notes |
|-----------|-------------|------------------|-------|
| Open file in system default app | `media:openExternal` | `accessionsHandlers.js` | Pass (type, link); resolves full path internally |
| Open arbitrary file path | `file:open` | `accessionsHandlers.js` | Pass full path; used for log files etc. |
| MIME type detection | (utility) | `utils/mimeTypes.js` → `getMimeType(type, link)` | Import directly in main process code |

#### Why `<a target="_blank">` Fails in Electron

Never use `<a target="_blank" href="filepath">` to open local files. In Electron's sandboxed renderer, clicking such a link opens a new blank Electron BrowserWindow attempting to navigate to the file path — it does **not** open the system viewer. Always use `shell.openPath()` via IPC instead.

#### Why Raw File Paths Fail as `<video src>` / `<audio src>` in Electron

The Electron renderer sandbox **blocks raw file system paths** as media `src` attributes (e.g., `src="/home/user/video/file.mov"`). The media element will exist in the DOM but fail silently — no video loads, no events fire, codec detection never runs.

**Always use `media://type/link` URLs** for audio/video `src` attributes in any renderer window. The `media://` custom protocol handler (registered in `main.js`) serves the file securely with correct MIME types.

```javascript
// ❌ WRONG - raw path is blocked by renderer sandbox
`<video><source src="${filePath}" /></video>`

// ✅ CORRECT - use media:// protocol
`<video><source src="media://${type}/${link}" /></video>`
```

**In Vue components**: Never use `v-html` to inject `<video>` or `<audio>` elements. Use Vue template binding (`:src`) which handles media loading correctly:

```vue
<!-- ✅ CORRECT: Template binding loads media automatically -->
<video :src="mediaPreviewPath" controls @loadedmetadata="checkCodec"></video>

<!-- ❌ WRONG: v-html doesn't trigger media load -->
<div v-html="htmlWithVideoTag"></div>  <!-- video never loads, events never fire -->
```

To get `mediaPreviewPath`: Call `window.electronAPI.getMediaPath(type, link)` in the component, which returns `media://type/link` URLs.

#### Shared Renderer Utilities

| Utility | File Path | Purpose | Usage |
|---------|-----------|---------|-------|
| Video codec detection | `app/render/vue/shared/videoCodecDetection.js` | Detect HEVC/unsupported codecs | Import `hasUnsupportedCodec(videoElement)` in any Vue component |

**Pattern**: Both Media Player and Media Manager must use the same codec detection logic via the shared utility. Never duplicate codec checks inline.

```javascript
// DO: Use shared utility in all Vue components
import { hasUnsupportedCodec } from '../../shared/videoCodecDetection.js';

const checkVideoCodec = (event) => {
  if (hasUnsupportedCodec(event.target)) {
    videoError.value = true;  // Show "Format Not Supported" overlay
  }
};
```

---

## Vue.js Patterns

