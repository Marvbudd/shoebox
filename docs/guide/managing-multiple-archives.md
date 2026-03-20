# Managing Multiple Archives

**Advanced Topic** - This guide covers strategies for working with multiple related archives while maintaining data consistency.

## Overview

As your collection grows, you may want to organize items into separate archives for different purposes:
- Thematic groupings (e.g., family events, vacations, historical periods)
- Collaborative projects (sharing subsets with others)
- Performance optimization (smaller archives load faster)
- Archival preservation (separating master copies from working copies)

The challenge is maintaining **person identity consistency** across archives. When the same people appear in multiple archives, you want their person records to use the same identifiers (personIDs) so that:
- Archives can be merged later without creating duplicate person records
- Collaborative workflows preserve relationships
- Cross-archive queries can identify the same individuals

## Key Concepts

### Person Identity and personID

Every person in Shoebox has a unique identifier called a `personID` (a UUID). This identifier:
- Is generated once when a person is created
- Remains stable across imports, exports, and merges
- Links person biographical data to items that feature them
- Enables person consistency across multiple archives

**Why personID matters for multiple archives:**
- If two archives have the same person with the **same personID**, they're recognized as the same individual
- If two archives have different personIDs, Shoebox treats them as different people (even if names match)
- Importing persons before adding items ensures personID consistency from the start

For technical details on person data structure, see [Data Structure Guide - Person Library](data-structure.md#person-library).

### Design Philosophy

Our multi-archive approach follows these principles:

1. **Never Overwrite on Conflict** - If metadata differs, preserve the target archive and log the conflict for manual resolution. This protects existing data and relationships.

2. **Staged Import Process** - Import persons first (without face detection data), then items (with face descriptors attached). This prevents broken references.

3. **File Verification** - Before importing items, verify files are truly identical (size + hash). Same filename doesn't mean same file.

4. **Explicit Conflict Reporting** - Don't silently merge or guess. Show all conflicts in a collection and log file for deliberate resolution.

5. **Preserve Face Descriptors** - Never replace face detection data in target items. Face assignments are valuable manual work.

These principles emerged from real-world needs: collaborative genealogy work, thematic archive organization, and data consolidation projects.

## Common Workflows

### Workflow 1: Starting a New Related Archive

**Scenario:** You're creating a new archive for vacation photos. Many people in these photos already exist in your main family archive.

**Steps:**
1. Create the new archive - see [Creating Your Archive](creating-archive.md) for directory setup
2. **Before adding photos**, import persons from your main archive:
   - Archive > Import Persons from Archive...
   - Select your main archive's accessions.json
   - Choose "Import (Strip Face Descriptors)" - clean person library without item references
   - Review import results
3. Add vacation photos (Archive > Add Media Metadata)
4. Assign people to photos using the imported persons
5. Result: Vacation photos reference the same person records as your main archive

**Why this works:** Importing persons first establishes personID consistency. Later, you can merge these archives or import items between them without conflicts.

### Workflow 2: Collaborative Editing

**Scenario:** You export a collection to a colleague, they add metadata and face assignments, then you import their updates back.

**Steps:**
1. Export collection from your archive (Collections > Export Collection)
   - This creates a standalone archive with only selected items
   - Persons referenced by these items are included
2. Share the exported archive with collaborator
3. Collaborator adds descriptions, dates, face assignments, etc.
4. Collaborator returns the modified archive
5. Import the archive back (Archive > Import Archive...)
   - **Run Dry Run first** to preview conflicts
   - Review conflict log to see what changed
   - Do full import - conflicts preserved in _ImportConflicts collection
6. Manually resolve conflicts by comparing target items with conflict collection

**Considerations:**
- If you modified the same items while collaborator worked on them, conflicts will occur
- The conflict collection shows which items differ
- Face descriptors in target are always preserved (never overwritten)

### Workflow 3: Thematic Archive Consolidation

**Scenario:** You've created separate archives for different decades. Now you want to consolidate into one master archive.

**Steps:**
1. Choose which archive will be the target (master)
2. For each source archive:
   - Archive > Import Archive...
   - Run Dry Run first to see conflicts
   - Review log file for person and item conflicts
   - Run full import
   - Resolve any conflicts in _ImportConflicts collection
3. After all imports, run Archive > Validate to check for:
   - TMGID conflicts (different personIDs with same genealogy ID)
   - Unreferenced persons (can be cleaned up if not needed)
   - Orphaned face descriptors (can be cleaned up)

**Considerations:**
- Person conflicts usually indicate data quality issues (same person entered multiple times)
- Item conflicts mean the same file appears with different metadata in multiple archives
- TMGID conflicts should be resolved - they may indicate duplicate person entries

## Import Features

### Import Persons Only

**Menu:** Archive > Import Persons from Archive...

Import person library from another archive while maintaining personID consistency.

**When to use:**
- Starting a new archive - import persons before adding items
- Synchronizing person data across archives
- Preparing for future archive merge

**How it works:**
1. Select source accessions.json file
2. Preview: Shows source archive title and person count
3. Choose options:
   - **Import (Strip Face Descriptors)** - Recommended. Clean person library without item references
   - **Import (Include Face Descriptors)** - Keeps face detection data (will be orphaned until items imported)
   - **Create backup** - Enabled by default (checkbox)
4. Review results:
   - Imported persons (new to target archive)
   - Skipped persons (same personID already exists with identical data)
   - personID collisions (rare - same personID but different biographical data)
   - TMGID conflicts (different personIDs with same genealogy ID)

**Person Matching Logic:**
- **personID match with same data**: Person skipped (already exists)
- **personID collision** (same personID, different data): Alert shown - manual resolution required (very rare)
- **TMGID conflict** (different personID, same TMGID): Import proceeds, validation will flag for review
- **New person** (personID doesn't exist in target): Person imported

**Face Descriptor Handling:**

Face descriptors (`faceBioData`) contain references to specific items by their `link` field. When importing persons only:

- **Strip Face Descriptors (recommended)**: Clean person library without item references
- **Include Face Descriptors**: Keeps face detection data, but descriptors will be orphaned until items imported
  - Orphaned descriptors can be cleaned up later: Archive > Validate > Cleanup Orphaned Descriptors

**After Import:**
- Newly imported persons won't be assigned to any items initially (by design)
- Assign them through Add Media Metadata or Edit Media windows
- **Unreferenced persons** can be cleaned up: Archive > Validate > Cleanup Unreferenced Persons
- **TMGID conflicts** should be reviewed: Archive > Validate

::: tip Best Practice
Always import persons before adding items to new archives. This establishes personID consistency from the start and prevents duplicate person records when merging archives later.
:::

### Import Full Archive

**Menu:** Archive > Import Archive...

Import both persons and items from another archive with comprehensive conflict detection.

**When to use:**
- Merging thematic archives into a master archive
- Importing collaborative edits back into main archive
- Consolidating split archives

**How it works:**

1. Select source accessions.json file
2. Preview: Shows source archive title, person count, item count
3. Warning if _ImportConflicts collection already exists (option to cancel)
4. Choose mode:
   - **Cancel** - Abort operation
   - **Import (Full)** - Perform actual import with mandatory backup
   - **Dry Run (Preview Only)** - Analyze conflicts without making changes (no backup needed)
5. If full import: **Mandatory backup** created automatically
6. Import executes in two stages:
   - Stage 1: Import persons (without face descriptors)
   - Stage 2: Import items (with face descriptors for successfully imported items)
7. File verification for matching links:
   - Compare file size (fast check)
   - Compare file hash (SHA-256 - always performed)
   - Different files with same link → Conflict logged, item not imported
8. Review results:
   - Import statistics
   - Conflicts detected (persons and items)
   - Log file created with timestamp
   - _ImportConflicts collection created (if conflicts exist)

**Conflict Handling:**

**Person Conflicts:**
- Same as "Import Persons Only" feature
- personID collisions and TMGID conflicts flagged
- All persons imported unless collision detected

**Item Conflicts:**
- **File Mismatch**: Same link but different files (size or hash differs) → Not imported, logged
- **Metadata Mismatch**: Same file but different metadata → Not imported, target preserved, added to _ImportConflicts collection
- **All fields compared**: date, description, type, link, city, state, gps, person[], source[], playlist, faceTag
- **Any difference = conflict**

**Conflict Collection:**
- Created only if item metadata conflicts detected
- Key: `_ImportConflicts` (sorts to top with underscore)
- Title: `Import Conflicts from: [source filename]`
- Text: "Import Conflicts"
- **Contains target archive items** that couldn't be replaced (not source items)
- Review collection to see which items differ
- Compare with source archive to decide resolution

**Log File:**
- Saved to archive directory: `import-log-[timestamp].txt`
- Contains:
  - Import summary statistics
  - Person conflicts with details
  - Item conflicts with field differences
  - File verification results
  - Symlink detection warnings (if found)

**Face Descriptor Handling (Two-Stage Process):**
- **Stage 1**: Persons imported without face descriptors
- **Stage 2**: Items imported with face descriptors only for successfully imported items
- **Rationale**: Prevents orphaned face descriptors - only import face data for items that exist in target
- **Target preservation**: If target item has face descriptors and conflicts exist, target face data completely preserved
- **New items**: Face descriptors from source transferred when item import succeeds

**Symlink Detection:**
- Resource directories (`photo/`, `audio/`, `video/`) may contain symlinks or actual files
- Import treats all references uniformly as links (doesn't distinguish)
- File verification compares actual file content/size regardless of symlink status
- Log file notes if symlinks detected (informational only)

::: tip Using Dry Run
Always run a Dry Run first to preview conflicts before committing to a full import. This lets you review the conflict log and _ImportConflicts collection (preview only) to understand what will happen.
:::

::: warning Important
Full archive import **never overwrites** target items with conflicts. When metadata differs, the target is preserved and the conflict is logged. This protects your existing data and face assignments. You must manually resolve conflicts by reviewing the _ImportConflicts collection and log file.
:::

## Conflict Resolution

### Understanding Conflicts

**Person Conflicts:**
- **personID Collision** (very rare): Same personID but different biographical data
  - Indicates: Data corruption or manual personID manipulation
  - Resolution: One person must have their personID changed - see [Manual personID Reassignment](#manual-personid-reassignment) below
  - Check both archives to confirm which data is correct

- **TMGID Conflict**: Different personIDs with same genealogy ID (TMGID)
  - Indicates: Same person was entered multiple times with different names/data
  - Resolution: Decide which person record is correct, delete duplicate, reassign items - see [Manual personID Reassignment](#manual-personid-reassignment) below
  - Use Archive > Validate to detect these

**Item Conflicts:**
- **File Mismatch**: Same filename (link) but different files
  - Indicates: Files were replaced without changing filename
  - Resolution: Rename one file to differentiate, or determine which is correct

- **Metadata Mismatch**: Same file but different metadata
  - Indicates: Archives independently edited the same items
  - Resolution: Compare metadata field by field, manually update target to merge information

### Resolving Item Metadata Conflicts

1. Open _ImportConflicts collection (shows all conflicting target items)
2. Compare each item with source archive:
   - Open both archives side-by-side
   - Compare metadata field by field using Edit Media window
3. Decide resolution:
   - Keep target (no action needed)
   - Use source metadata (manually copy into target)
   - Merge both (combine information from both)
4. After resolution, delete _ImportConflicts collection or Clear its items

### Manual personID Reassignment

While a dedicated personID reassignment tool doesn't yet exist, you can manually handle personID conflicts in two scenarios:

**Scenario 1: Separating - One personID Used for Multiple People**

If the same personID was mistakenly used for different people (collision), you need to create a new person and reassign some references:

1. Open Person Manager and note the personID and all details of the conflicting person
2. Create a new person for the second individual:
   - Open Add Media Metadata or Edit Media windows
   - Enter person details (creates new personID automatically)
   - Note the new personID from Person Manager
3. Manually visit each item that references the old personID:
   - Open Edit Media window for each item
   - In the People section, evaluate whether this item shows the first or second person
   - If second person: Remove old person reference, add new person reference
   - If first person: Leave unchanged
4. After reassigning all appropriate items:
   - Check Source fields (who provided items) and update if needed
   - Run Archive > Validate to check for unreferenced persons
   - If old person now unreferenced and no longer needed, can be cleaned up

**Scenario 2: Joining - Combining Two personIDs into One**

If the same person was entered twice with different personIDs (TMGID conflict or name variations):

1. Decide which person record to keep as the primary (better data, more complete)
2. Note both personIDs from Person Manager
3. Manually visit each item that references the personID to be removed:
   - Open Edit Media window for each item
   - Remove the old person reference
   - Add the primary person reference
4. Update Source fields if needed (items provided by the merged person)
5. After reassigning all references:
   - The old person will be unreferenced
   - Run Archive > Validate > Cleanup Unreferenced Persons to remove it
   - Update biographical data in primary person if needed (merge notes, names, etc.)

**Finding All References:**
- Use Collection Manager to create temporary collections
- Filter items by person to see all items featuring that individual
- Export collection to see item list
- Work through systematically to ensure no references missed

::: warning Time Intensive
Manual personID reassignment is tedious for persons referenced in many items. Consider carefully whether reassignment is necessary, or if the situation can be resolved by editing person biographical data instead.
:::

### Cleaning Up After Import

After importing, run **Archive > Validate** to check for:

**Unreferenced Persons:**
- Persons not linked to any items
- May occur after importing extra persons "just in case"
- Click "Cleanup Unreferenced Persons" to remove

**Orphaned Face Descriptors:**
- Face detection data that doesn't match any items
- May occur if face descriptors included but items not imported
- Click "Cleanup Orphaned Descriptors" to remove

**TMGID Conflicts:**
- Different persons with same genealogy ID
- May indicate duplicate person entries across archives
- Review and resolve manually

## Best Practices

### Before Starting Multi-Archive Workflows

1. **Understand personID**: Each person has a unique identifier. Same personID = same person across archives.
2. **Establish a main archive**: Designate one archive as your "master" with authoritative person data.
3. **Import persons first**: When creating related archives, import persons from main before adding items.
4. **Use collections for collaboration**: Export collections (Archive > Export Collection) rather than full archives when sharing with others.

### During Import Operations

1. **Always run Dry Run first**: Preview conflicts before committing changes.
2. **Read the log file**: Understand what conflicts exist and why.
3. **Review _ImportConflicts collection**: See exactly which items differ.
4. **One archive at a time**: Don't import from multiple sources simultaneously - resolve conflicts between each import.

### After Import Operations

1. **Run Archive > Validate**: Check for data quality issues.
2. **Resolve conflicts promptly**: Don't let _ImportConflicts collection accumulate.
3. **Clean up unreferenced data**: Remove orphaned descriptors and unreferenced persons you don't need.
4. **Document your process**: Note which archives have been merged and when.

## Technical Considerations

### Why personID Instead of Names?

Names are unreliable identifiers:
- Same person may have different names (maiden vs. married, nicknames, spelling variations)
- Different people may have the same name
- Names change over time but identity doesn't

Using personID (UUID):
- Guarantees uniqueness
- Remains stable across all operations
- Enables reliable matching across archives
- Supports complex relationships (multiple last names, name changes)

### Why Two-Stage Import?

Importing persons and items separately:
- **Prevents orphaned references**: Face descriptors only transferred for items that successfully import
- **Preserves data integrity**: Persons established before items reference them
- **Enables cleanup**: Can import persons "just in case" and remove unreferenced ones later
- **Reduces complexity**: Simpler than all-at-once import with complex dependency tracking

### Why Never Overwrite on Conflict?

Automatic merging is dangerous:
- Loss of manually-entered data
- Overwrites face assignments (valuable manual work)
- Hides disagreements that need human judgment
- No undo mechanism

Explicit conflict reporting:
- Protects existing data
- Makes user aware of discrepancies
- Allows informed decision-making
- Provides audit trail (log files)

## Advanced Scenarios

### Splitting One Archive into Multiple

1. Create new archive - see [Creating Your Archive](creating-archive.md) for directory setup
2. Import persons from original (Archive > Import Persons from Archive...)
3. In original archive, create collection with items to split off
4. Export collection (Collections > Export Collection)
5. Import exported items into new archive (Archive > Import Archive...)
6. Remove exported items from original (delete individually or use Item Manager)
7. Clean up unreferenced persons in both archives (Archive > Validate)

### Synchronizing Person Data Across Archives

If you update person biographical data in one archive and want to sync to others:

1. Export person library only (currently no direct feature - use Import Persons to transfer)
2. In target archive: Archive > Import Persons from Archive...
3. personID matches with different data will be flagged as collisions
4. Currently requires manual synchronization (person-by-person comparison)
5. Future enhancement: Person sync feature with selective field updates

### Handling Face Descriptors Across Archives  

Face descriptors reference items by `link`. When importing across archives:

- **Same items in both archives**: Face descriptors transfer correctly
- **Different items**: Face descriptors become orphaned (reference non-existent items)
- **Best practice**: Strip face descriptors on initial person import, re-run face detection in target archive
- **Alternative**: Include face descriptors if items will also be imported

## Limitations and Future Enhancements

### Current Limitations

- No batch person synchronization (update person data across multiple archives)
- personID collisions require manual personID reassignment (tool not yet implemented)
- No collection import from source archives (collections ignored)
- No merge preview UI (must use dry-run + log file)

## Related Documentation

- [Data Structure - Person Library](data-structure.md#person-library) - Technical details on person data structure
- [Archives vs Collections](archives-vs-collections.md) - Understanding the difference
- [Creating Your Archive](creating-archive.md) - Basic archive setup
- [Metadata Features](../features/metadata.md) - Person Manager usage

---

::: tip Need Help?
Multi-archive management is an advanced workflow. Start with simple scenarios (import persons to new archive) before attempting complex merges. Always backup before importing. Use dry-run mode liberally.
:::
