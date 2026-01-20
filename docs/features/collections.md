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

The export directory contains two files:

#### 1. `accessions.json`
A complete, standalone archive file containing:
- Only the items in the collection
- All metadata for those items
- Person library entries referenced by those items
- Proper structure for opening as a Shoebox archive

#### 2. `commands` (bash script)
A Linux shell script that creates the media file structure:
- Creates `audio/`, `photo/`, and `video/` subdirectories
- Uses symbolic links (`ln`) to link media files from your archive
- Can be edited for other platforms (Windows: `mklink`, macOS: `ln`)

**Note**: The script uses symbolic links to avoid duplicating large media files. Run the script in the export directory to complete the collection structure.

### Directory Structure

After export, you'll have:
```
/parent-directory/
  ├── your-archive/
  │   ├── accessions.json          (your main archive)
  │   ├── collections/
  │   ├── audio/
  │   ├── photo/
  │   └── video/
  └── collection-key/              (exported collection)
      ├── accessions.json          (collection subset)
      └── commands                 (bash script)
```

After running the `commands` script:
```
/parent-directory/
  └── collection-key/
      ├── accessions.json
      ├── commands
      ├── audio/                   (symlinks to source files)
      ├── photo/                   (symlinks to source files)
      └── video/                   (symlinks to source files)
```

### Sharing Collections

To share a collection with others:

1. **Run the `commands` script** on your system to create the directory structure with linked files
2. **Copy the actual media files** (not symbolic links) to prepare for sharing:
   - Replace symbolic links with actual file copies, or
   - Use a sync tool to copy the linked files
3. **Share the complete directory** containing:
   - `accessions.json` (the collection subset)
   - `audio/`, `photo/`, `video/` directories with actual media files

The recipient can then:
1. Open the `accessions.json` file in Shoebox
2. Browse the collection as a standalone archive

This allows you to share themed subsets of your archive with only the relevant items, without duplicating your entire archive.

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
