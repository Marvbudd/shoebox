# Collections

Collections allow you to create themed subsets of your archive for organizing, sharing, or presentations.

## Overview

A collection is a **reference** to items in your archive, not a duplicate. When you create a collection:

- Items stay in the main archive
- Collection contains only references (by accession number and file link)
- Deleting a collection doesn't delete the items
- One item can appear in multiple collections
- No limit to collection size

See [Archives vs Collections](../guide/archives-vs-collections.md) for conceptual explanation.

## Creating a Collection

### Using Collection Manager

1. Open **Collections > Create Collection**
2. Fill in the collection details:
   - **Key**: Short filename with no spaces (e.g., `vacation2024`)
   - **Text**: Display name for dropdowns (keep under 15 characters)
   - **Title**: Full descriptive title (used when exported)
3. Click **Create**

The collection is immediately created and ready to use. You can now add items to it.

## Adding Items to Collections

### Double-Click Method

1. Load a collection from the collection dropdown at the bottom of the main window
2. Browse your full archive (or limit to collection items only—see Loading Collections below)
3. **Double-click** items to toggle them in/out of the loaded collection
   - Items in the collection appear with **green background** in the navigation column
   - Items also show their collection membership in the metadata panel

### Manual Selection

When viewing items, you can see which collections they belong to in the item details panel.

## Managing Collections

### Viewing Collections

All collections are stored as JSON files in the `collections/` subdirectory next to your `accessions.json` file. Each collection has:
- **Key**: The filename (without `.json` extension)
- **Text**: Short display name
- **Title**: Full descriptive title
- **Items**: Array of accession numbers and file links

### Deleting Collections

1. Open **Collections > Delete Collection**
2. Select the collection to delete
3. Confirm deletion

::: info Archive, Not Delete
Deleting a collection doesn't actually delete the file—it renames it with a timestamp instead of the `.json` extension. This prevents it from being loaded but preserves it for recovery. You can manually restore it by renaming it back to `.json`.
:::

### Loading Collections

Use the collection dropdown at the **bottom of the main window** to:
- View all available collections
- Select a collection to work with
- Return to full archive view (select "All Items" or equivalent)

**Limit Checkbox:**
The **Limit to Collection** checkbox (Ctrl+Shift+L) controls what appears in the navigation list:
- **Checked**: Only items in the loaded collection appear in navigation (filtered view)
- **Unchecked**: All archive items appear, with collection items shown in green

This allows you to either focus on the collection or browse your full archive while adding items to the collection.

## Exporting Collections

The export feature creates a standalone directory that can be shared with others.

### How Export Works

1. Load the collection you want to export
2. Go to **Collections > Export Collection** (appears in menu when collection is active)
3. Shoebox creates a new directory in the **parent directory** of your `accessions.json` file

### What Gets Exported

The export directory is created automatically with all necessary files and media:

#### 1. `accessions.json`
A complete, standalone archive file containing:
- Only the items in the collection
- All metadata for those items
- Person library entries referenced by those items
- Proper structure for opening as a Shoebox archive

#### 2. Media Files (automatic)
Shoebox automatically creates the media file structure using the best method for your platform:

**Cross-Platform Export Strategy:**

1. **Symbolic Links** (default, best option)
   - Works on Linux and macOS automatically
   - Works on Windows 10+ with Developer Mode enabled
   - Saves disk space by referencing original files
   - Instant export, no file copying needed

2. **Hard Links** (automatic fallback)
   - Used if symbolic links aren't available
   - Works on all platforms when source and destination are on the same filesystem
   - Still saves disk space (same file, multiple directory entries)
   - No file duplication

3. **File Copies** (final fallback)
   - Used if links aren't supported or cross-filesystem export
   - Duplicates files but guaranteed to work everywhere
   - Slower for large collections but creates fully independent copy

Shoebox automatically tries each method in order and uses the first one that succeeds. The success dialog shows which method was used.

**Missing Items**: If any items in the collection are no longer in the archive, they are skipped and reported in the warnings section of the export dialog.

### Directory Structure

After export, you'll have a complete, ready-to-use collection:
```
/parent-directory/
  ├── your-archive/
  │   ├── accessions.json          (your main archive)
  │   ├── collections/
  │   ├── audio/
  │   ├── photo/
  │   └── video/
  └── collection-key/              (exported collection - ready to use)
      ├── accessions.json          (collection subset)
      ├── audio/                   (linked or copied media files)
      ├── photo/                   (linked or copied media files)
      └── video/                   (linked or copied media files)
```

The export is **immediately ready to use** - no additional steps required. Open the exported `accessions.json` in Shoebox to browse the collection.

### Sharing Collections

To share a collection with others:

**If exported with symlinks or hard links:**
1. Copy the exported directory to an external drive or network location
2. The links will be resolved during copy, creating actual file copies
3. Share the complete directory

**If exported with file copies:**
1. The export directory is already a complete, standalone copy
2. Simply share the entire directory as-is

**Alternative - Re-export for sharing:**
If you want to ensure the export uses file copies (not links):
- Move or copy your archive to a different drive
- Export the collection
- Shoebox will automatically use file copies (cross-filesystem limitation)
- This creates a guaranteed standalone copy

The recipient can:
1. Copy the directory to their system
2. Open the `accessions.json` file in Shoebox
3. Browse the collection as a standalone archive

This allows you to share themed subsets of your archive with only the relevant items, without duplicating your entire archive during the export process.

## Use Cases

### Event Collections

Create collections for specific events:
- "Family Reunion 2024"
- "Grandma's 90th Birthday"
- "Europe Vacation 2019"

### People Collections

Group all media featuring specific people:
- "All Photos of Grandpa"
- "Dad's Childhood"
- "The Smith Siblings"

Use the "Sort by Person" dropdown to find all items featuring someone, then add them to a collection.

### Theme Collections

Organize by theme or topic:
- "Holiday Celebrations"
- "Military Service"
- "School Photos"
- "Weddings"

### Presentation Collections

Curate highlights for slideshows or sharing:
- "Best of 2024"
- "Family History Highlights"
- "Favorites for Digital Frame"

Load the collection and press **Space** to start a slideshow with only those items.

## Maintenance Collections

Maintenance collections are automatically generated collections that help identify items needing data completion. These system-created collections use the `_` prefix to appear first in collection dropdowns.

### Creating Maintenance Collections

1. Go to **Collections > Create Maintenance Collections**
2. If existing maintenance collections exist, confirm replacement
3. View the summary showing how many items were found for each category

The system scans your entire archive and creates collections for items missing:
- **Location data** (`_no-location.json`) - Items with no location information
- **Person data** (`_no-persons.json`) - Items with no people identified
- **Source data** (`_no-source.json`) - Items with no source attribution
- **Description** (`_no-description.json`) - Items with no description text

### Using Maintenance Collections

**Workflow for Data Completion:**
1. Create maintenance collections to identify gaps
2. Load a maintenance collection (e.g., "Missing Loc") from the dropdown
3. Enable **Limit to Collection** to focus only on those items
4. Work through items adding missing data
5. Re-run **Create Maintenance Collections** to refresh and track progress

**Key Features:**
- Empty collections are not created (if all items have location data, `_no-location.json` won't exist)
- Collections are replaced each time you run the command (always current)
- Use collection checkboxes to see which items still need work
- Combine with sorting to prioritize (e.g., sort by date to fill in chronological order)

**Collection Properties:**
| Collection ID | Display Text | Description |
|--------------|--------------|-------------|
| `_nolocation` | Missing Loc | Items with empty or missing location array |
| `_nopersons` | Missing Person | Items with empty or missing person array |
| `_nosource` | Missing Source | Items with empty or missing source array |
| `_nodescription` | Missing Desc | Items with empty, missing, or whitespace-only description |

::: tip Use Case: Archive Quality Control
Before releasing of your family archive, run Create Maintenance Collections to find all items still needing metadata. Work through each collection systematically until all are empty, then you'll know your archive is complete.
:::

### Deleting Maintenance Collections

Maintenance collections are regular collections and can be deleted using **Collections > Delete Collection**. However, it's often easier to simply re-run **Create Maintenance Collections** to replace them with updated data.

## Validation

Validate collections to check for issues:

1. Go to **Collections > Validate Collection**
2. Select the collection to validate
3. Review the validation report

Checks include:
- All referenced items exist in the archive
- All referenced files exist on disk
- Accession numbers are valid
- Collection structure is correct

Results are saved to a timestamped log file in the archive directory.

## Backup

Backup all collections at once:

1. Go to **Collections > Backup All Collections**
2. Timestamped copies are created for each collection

Backup files have the same name as the collection with a timestamp appended (no `.json` extension to prevent them from being loaded as active collections).

## Collections Menu Reference

- **Create Collection**: Create a new collection
- **Delete Collection**: Archive a collection (rename with timestamp)
- **Update Collection**: Save changes to loaded collection
- **Validate Collection**: Check collection integrity
- **Backup All Collections**: Create timestamped backups
- **Create Maintenance Collections**: Generate collections for items with missing data
- **Export Collection**: Create shareable directory (only visible when collection loaded)

## Best Practices

### Naming

- **Key**: Short, no spaces, lowercase recommended (e.g., `vacation2024`, `wedding_photos`)
- **Text**: Brief but descriptive, under 15 characters (shows in dropdown)
- **Title**: Full descriptive title (shows when exported or in reports)

### Organization

- Create collections for specific purposes (events, people, themes)
- Use meaningful names that explain the collection's purpose

### Workflow

1. Create collection with descriptive key/text/title
2. Load the collection in main window
3. Browse archive and double-click items to add them
4. Validate collection to ensure all items exist
5. Export collection if sharing with others
6. Backup collections periodically

## Technical Details

- Collections stored in `collections/` subdirectory next to `accessions.json`
- Each collection is a separate JSON file: `<key>.json`
- Collections reference items by accession number and file link
- Export creates parent-level directory named after collection key
- Deleted collections renamed with timestamp (recoverable)
- No limit to number of items in a collection

## Related

- [Archives vs Collections](../guide/archives-vs-collections.md) - Conceptual differences
- [Creating Your Archive](../guide/creating-archive.md) - Building your archive
- [Slideshow Mode](./slideshow.md) - Present collections as slideshows
- [Keyboard Shortcuts](../guide/keyboard-shortcuts.md) - Navigation shortcuts
