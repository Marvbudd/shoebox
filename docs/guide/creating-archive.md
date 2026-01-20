# Creating Your Archive

Ready to start organizing your family's multimedia memories? This guide walks you through creating your own archive.

## Overview

Creating a Shoebox archive involves:

1. **Organizing files** into the proper directory structure
2. **Creating the accessions.json** metadata file
3. **Adding metadata** for people, dates, locations, etc.
4. **Pointing Shoebox** to your archive location

## File Organization

### Directory Structure

Shoebox expects files organized into type-specific subdirectories:

```
my-family-archive/
├── accessions.json       # Metadata file
├── photo/               # All photos go here
│   ├── family-reunion-2020.jpg
│   ├── grandma-birthday.png
│   └── ...
├── video/               # All videos go here
│   ├── wedding-ceremony.mp4
│   ├── baby-first-steps.mov
│   └── ...
└── audio/               # All audio files go here
    ├── grandpa-interview.mp3
    ├── family-stories.wav
    └── ...
```

### Organizing Your Files

You have two main options for organizing files into the required structure:

**Option 1: Copy Files**
- Copy your media files into the appropriate subdirectories
- Safe and straightforward, but requires disk space for duplicates
- Good if you want a standalone archive

**Option 2: Use Symbolic Links**
- Create symbolic links (symlinks) or hard links pointing to your original files
- No disk space duplication—files stay in their current location
- Files appear in multiple locations but only exist once
- Requires understanding of your operating system's linking features

**Symbolic Links Resources:**
- Learn more: [Wikipedia: Symbolic Link](https://en.wikipedia.org/wiki/Symbolic_link)
- **Linux/macOS**: `ln -s /path/to/original /path/to/link`
- **Windows**: `mklink /D link-path target-path` (requires admin privileges)
- Can be automated with shell scripts for bulk operations

::: tip Automation
If you have hundreds or thousands of files, consider writing a script to automate the linking process. This is especially useful if your existing file organization differs significantly from Shoebox's structure.
:::

### File Naming

- Use descriptive names: `family-reunion-2020.jpg` not `IMG_1234.jpg`
- Avoid special characters: stick to letters, numbers, hyphens, underscores
- Be consistent: develop a naming convention and stick to it

### Supported Formats

**Photos:**
- JPEG (.jpg, .jpeg, .JPG, .JPEG)

**Videos:**
- MP4 (.mp4, .MP4)
- MOV (.mov, .MOV)

**Audio:**
- MP3 (.mp3, .MP3)

::: info Other Formats
Other common formats (PNG, GIF, WAV, etc.) may work but have not been extensively tested. The formats listed above are verified and recommended.
:::

## Creating accessions.json

The `accessions.json` file is the heart of your archive. It stores all metadata for your items.

**Shoebox creates this file automatically** when you use the Add Media Metadata feature for the first time. You don't need to create it manually.

### Initial Setup

1. **Organize your media files** into the directory structure (see above)
2. **Open Shoebox**
3. **Go to **Archive > Add Media Metadata**
4. **Select your media directory**
5. **Fill in metadata** as prompted when it applies to all new items
6. **Click Save**

Shoebox will:
- Create the `accessions.json` file in your archive directory
- Scan for media files in the photo/, video/, and audio/ subdirectories
- Add items with the metadata you provided, and retrieved from the files
- Initialize the persons library

::: tip
Start small! Add 10-20 items first to get comfortable with the workflow.
:::

## Adding Items

::: warning Initial Setup
When starting a new archive, the **only way to add items** is through the **File > Add Media Metadata** menu (or **Media > Add Media Metadata**).

Once you have an `accessions.json` file with items:
- **Adding more media**: Simply run Add Media Metadata again with the same directory or accessions.json - it will add any new items found
- **Re-scanning**: Running the same import multiple times is safe - existing items won't be duplicated
- **Incremental growth**: Your archive grows as you add new media files to the photo/video/audio directories
:::

### Using Add Media Metadata

The Add Media Metadata window is a powerful tool for scanning directories and automatically adding media files to your archive.

**How It Works:**

1. Open **Archive > Add Media Metadata**
2. Select **Update Type**: "Directory" (most common for initial setup)
3. Click **Select** button next to "Directory or Collection" field
4. Choose the directory containing your media files (the one with photo/, video/, audio/ subdirectories)
5. Enter optional metadata that applies to ALL items being imported:
   - **Person**: First/Last name (creates person references for all items)
   - **Description**: Text that applies to all items
   - **Date**: Year/Month/Day (if all items share the same date)
   - **Location**: Detail/City/State (if all items from same location)
   - **Source**: Who provided these items (First/Last, Date received)
6. Click **Save**

**What Happens:**

- Shoebox scans the photo/, video/, and audio/ subdirectories
- For each file not already in the archive:
  - Auto-generates accession number (sequential)
  - Extracts metadata from EXIF/IPTC/XMP (for photos)
  - Applies your form metadata to the item
  - Adds item to accessions.json
- Existing items are NOT duplicated (safe to re-run)

**Metadata Extraction (Photos Only):**

Shoebox automatically extracts:
- **Date**: From EXIF DateTimeOriginal, CreateDate, ModifyDate, etc.
- **GPS**: Latitude/longitude coordinates (plus city/state if present in metadata)
- **Description**: From EXIF/IPTC/XMP description, caption, or title fields

**Re-running Add Media Metadata:**

You can safely run this multiple times:
- Add new files to photo/, video/, or audio/ directories
- Run Add Media Metadata on the same directory
- Only new files are added (existing files skipped by link name)

::: tip Individual Item Editing
After import, use **Media Manager** (select item and click **Edit Media** button in the Media Details pane) to customize individual items with specific metadata, add multiple people, assign faces, etc.
:::

### After Initial Import

Once items are in your archive, you have better tools for detailed metadata:

**For Individual Items:**
1. Select item in main window
2. Click **Edit Media** button in the details pane
3. Media Manager opens with full metadata editing:
   - Add/remove multiple people with context (e.g., "holding baby")
   - Add/remove multiple locations
   - Edit description, dates, sources
   - Assign face tags (if faces detected)
   - Add playlist entries

**For Batch Updates:**
- Use **Collection > Update Collection** update all items in a collection

**Best Practice:**
1. **Initial import**: Use Add Media Metadata to get files into the archive quickly
2. **Detailed work**: Use Media Manager for individual item metadata, person tagging, face detection
3. **Organization**: Create collections, sort by person/location, use slideshow mode

## Managing People

### Person Manager

The Person Manager (**Archive > Person Manager**) is your central hub for managing people in your archive.

**How to Access:**
- **Main menu**: Archive > Person Manager
- **From Media Manager**: Click the 👤 button next to any person dropdown
- **During face detection**: Click the 👤 button next to person names in the face tagging interface

**Creating a New Person:**
1. Open Person Manager (Archive > Person Manager or click 👤 button)
2. Click **+ New Person** button
3. Enter person information:
   - **First Name**: Given name
   - **Last Names**: Add one or more (click "+ Add Last Name" for married names, etc.)
   - **TMGID**: The Master Genealogist ID (optional, for genealogy integration)
4. Click **Save Changes**

**Editing Existing Person:**
1. Open Person Manager
2. Click person in the list
3. Modify fields as needed
4. Click **Save Changes**

### Person Entries

People are stored in the `persons` section of accessions.json and referenced by a unique Person ID (UUID).

**Person Data Includes:**
- Full name (first and multiple last names)
- TMGID for genealogy software integration  
- Face biometric data (when faces are tagged)
- Stable UUID identifier (never changes)

::: tip Genealogy Integration
If you use The Master Genealogist or generate websites with Second Site, add TMGID values to your persons. This enables clickable links from Shoebox to your family tree website.
:::

### Linking People to Items

**During Initial Import (Add Media Metadata):**
- Add person information in the form fields
- This creates basic person references

**For Detailed Person Management:**
1. Open **Archive > Person Manager**
2. Click **+ New Person**
3. Fill in complete biographical data
4. Save

**To Link People After Import:**
1. Select item in main window
2. Click **Edit Media** button
3. In Media Manager, click **+ Add Person**
4. Select from dropdown or click 👤 to create new person
5. Optionally add context (e.g., "holding baby", "in background")
6. Save changes

::: tip Face Detection
Once people are created in Person Manager, you can use face detection to tag them in photos. See the complete [Face Detection Workflow](../features/face-detection.md#face-detection-workflow).
:::

## Metadata Best Practices

### Dates

- **Exact dates**: Use year, month, and day fields when you know the precise date
- **Partial dates**: Fill in only what you know (year only, year and month, etc.)
- **Consistency**: Pick a format and stick to it

### Locations

Use hierarchical structure:
- City, State, Country
- Be specific: "Portland, Oregon, USA" not just "Portland"
- Consistent spelling: don't mix "NY" and "New York"

### Descriptions

- **Context**: What's happening in the media?
- **Stories**: Who, what, when, where, why?
- **Transcriptions**: For audio, transcribe what's said
- **Details**: Small details become precious over time

### Sources

Track how items entered your archive:
- "Scanned from Mom's photo album, 2023"
- "Digital photo taken by John, 2020"
- "Copied from Uncle Bob's VHS tape, 2019"

This provenance is valuable for genealogy research.

## Data Structure Reference

For complete details on the accessions.json format, see:
- [Data Structure Guide](./data-structure.md)

## Pointing Shoebox to Your Archive

Once you've created your archive:

1. Open Shoebox
2. Go to **File > Open Accessions.json** (or similar menu)
3. Navigate to your `accessions.json` file
4. Select and open

Shoebox will load your archive and you can start browsing!

## Backing Up Your Archive

Your archive is precious. Protect it:

### Built-in Backup

Shoebox includes a backup feature to create timestamped copies:

**Archive > Backup Archive**:
- Creates timestamped copy of accessions.json in the same directory
- Format: `accessions.YYYY-MM-DD-HHMMSS` (no .json extension)
- Saves any pending changes before creating backup
- Preserves complete metadata state at backup time

**When to Use:**
- Before major editing sessions
- Before experimenting with new features
- Before batch updates or deletions
- Periodically as part of your workflow

### Regular Backups

- **Copy entire archive directory** to external drive
- **Cloud backup**: OneDrive, Dropbox, Google Drive
- **Version control**: Git for tech-savvy users (accessions.json only)

### 3-2-1 Rule

- **3** copies of your data
- **2** different media types (e.g., local drive + external drive)
- **1** off-site backup (cloud or physical location)

::: warning
Losing your accessions.json file means losing all your metadata work. Back up regularly!
:::

## Maintaining Your Archive

### Removing Unwanted Media

Sometimes you'll want to remove duplicate or poor quality media:

**Safe Deletion Workflow:**

1. **Create a backup first**: Archive > Backup Archive
2. **Identify files to remove**: Review your media in the filesystem
3. **Delete from filesystem**: Remove unwanted files from photo/, video/, or audio/ directories
4. **Clean up metadata**: Use Archive > Edit Media to delete orphaned metadata entries
   - Delete button appears only when physical file is missing
   - Prevents deletion if item is referenced in playlists

See [Metadata Cleanup](../features/metadata.md#metadata-cleanup) for complete details.

### Person Library Maintenance

Keep your Person Library organized:

- **Remove unused persons**: Archive > Person Manager shows delete button when person has no item references
- **Consolidate duplicates**: Merge duplicate person records, then delete the unused one
- **Regular reviews**: Periodically check for test persons or entries added by mistake

See [Deleting Unused Person Records](../features/metadata.md#deleting-unused-person-records) for details.

## Migrating from Other Systems

### From File System

If your photos are currently just in folders:

1. **Organize** into photo/video/audio directories (consider using a script)
2. **Use Add Media Metadata** to add new or additional items
3. **Export media and Metadata from other systems if possible**

## Getting Help

Creating your first archive can feel overwhelming. Resources:

- [Data Structure](./data-structure.md) - Complete accessions.json format
- [GitHub Issues](https://github.com/Marvbudd/shoebox/issues) - Ask questions
- Email: marvbudd@gmail.com - Direct support

## Next Steps

Once your archive is created:

- [Try slideshow mode](../features/slideshow.md)
- [Create collections](../features/collections.md)
- [Set up face detection](../features/face-detection.md)
- [Learn keyboard shortcuts](./keyboard-shortcuts.md)

Happy archiving! 📸
