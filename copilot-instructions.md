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
