# Metadata

## Overview

Metadata is the contextual information that makes your media meaningful. In Shoebox, you can add rich metadata to every item in your archive.

## Types of Metadata

### People

Link items to biographical person records:

- **Person Manager**: Centralized biographical database
- **Person Links**: Items are related to people, and Sources are people
- **Position**: Add descriptive info for position in photo (e.g., "holding baby")
- **Face Detection**: AI-powered face tagging - tagging optional
- **Audio/Video Descriptions**: Photo can be related to media by a playlist

See [Person Manager](#person-manager) below.

### Dates

Document when media was created:

- **Full dates**: Year, month, and day
- **Partial dates**: Year only, or year and month
- **Flexible entry**: Supports partial date formats (year, month, day)

### Locations

Multi-level hierarchy for places:

- **City**: Portland
- **State/Province**: Oregon
- **GPS Coordinates**: Click coordinates in Media Details to open location in Google Maps
- **Reverse Geocoding**: Use "Look up location" button in Media Manager to convert GPS to city/state names

### Descriptions

Free-text narratives:

- What's happening in the photo/video
- Who's present and what they're doing
- Stories and memories associated
- Transcriptions for audio recordings

### Sources

Document provenance:

- What person provided this item
- Date it was obtained - possible reference to email or source records
- List other people who provided this item, multiple sources accepted

### Playlists

Link related media together:

- Audio narration for a photo
- Scanned Photo related to people in a poor quality video with interesting story
- Audio/video items list related photos

**How to Use Playlists:**
- When viewing a photo with playlist entries, click a playlist entry to jump to that specific segment of the referenced audio/video
- When viewing audio/video, the "References" section shows which photos are mentioned at specific timestamps
- Example: A photo might have a playlist entry linking to a 90-second segment of an oral history where the photo is discussed

## Person Manager

### Centralized Person Database

The Person Manager maintains biographical data:

**Access**: **Archive > Person Manager**

**Features**:
- Add new people with names and biographical data
- Edit existing person information
- Link to genealogy software via TMGID
- Accessed from main menu or Media Manager (👤 button)

For complete details on using Person Manager, see [Creating Your Archive - Managing People](../guide/creating-archive.md#managing-people).

## Data Storage

All metadata is stored in the `accessions.json` file:

- **Person Library Pattern**: Person biographical data stored once, referenced by UUID
- **Item Metadata**: Each photo/video/audio item stores dates, locations, descriptions, playlists
- **Relationships**: Items reference people via PersonID, not by storing names directly
- **Portability**: All paths relative to accessions.json location

For complete technical reference, see [Data Structure Guide](../guide/data-structure.md).

## Best Practices

### Be Consistent

- Use standard date formats
- Spell names consistently - they sort better
- Use same location hierarchy
- Develop naming conventions - sorts help locate related items

### Be Thorough

- Document what you know now (memory fades)
- Add sources (provenance is valuable)
- Include context (why this photo matters)
- Tag people systematically - start with recent clear photos - others identify properly

### Be Realistic

- Don't let perfect be the enemy of good
- Add basic metadata first (date, people)
- Enhance with details over time
- Batch similar items for efficiency

## Editing Metadata

### Adding New Items

**Archive > Add Media Metadata**:

1. Select directory containing media files
2. Fill in metadata that applies to all items - batchs can have same metadata
3. Save - Shoebox scans and adds new items

See [Creating Your Archive - Adding Items](../guide/creating-archive.md#adding-items) for details.

### Editing Existing Items

**Collections** (Put items needing common updates in a collection):

1. Update Collection allows adding common metadata fields in a batch

## Metadata Display

### In Main Window

- **Preview Pane**: Shows photo/video/audio preview
- **Detail Pane**: Displays complete metadata for selected item
- **Person Links**: Click person names with TMGID to open genealogy website
- **GPS Coordinates**: Click location coordinates to open in Google Maps
- **Playlists**: Click playlist entries to jump to referenced audio/video segments

## Metadata Cleanup

### Deleting Items with Missing Media Files

When you've removed poor quality or duplicate media files from the filesystem, Shoebox provides safe metadata cleanup:

**Using Media Manager** (Archive > Edit Media):

1. Load an item whose media file has been deleted from the filesystem
2. A **Delete Item** button appears (only when file is missing)
3. Click to remove the metadata entry

**Safety Features:**
- Delete button only appears when the physical media file is missing
- Button is hidden (with warning) if the item is referenced in any playlists
- Warning: "Cannot delete: Item is referenced in playlist(s)"
- Prevents accidental deletion of referenced items
- Requires confirmation before deleting

**Recommended Workflow:**
1. Review your media files and identify duplicates or poor quality items
2. Delete unwanted media files from the photo/, video/, or audio/ directories
3. Open items in Media Manager to clean up orphaned metadata entries
4. The missing file indicator helps you identify items that need cleanup

### Deleting Unused Person Records

Keep your Person Library clean by removing person records that are no longer referenced:

**Using Person Manager** (Archive > Person Manager):

1. Select a person from the list
2. A **Delete Person** button appears (only when no items reference this person)
3. Click to remove the person record

**Safety Features:**
- Delete button only appears when itemCount is 0 (no references)
- Shows warning when person cannot be deleted: "Cannot delete: X item(s) reference this person"
- Item count displayed for each person in the library
- Prevents deletion of persons linked to your media
- Requires confirmation before deleting

**When to Delete Persons:**
- Test persons created during face detection experiments
- Duplicate person records that were consolidated
- Persons added by mistake
- After removing all items that referenced a specific person

::: tip Cleanup Strategy
For large cleanup operations:
1. Create backups first (Archive > Backup Archive)
2. Delete poor quality media files in batches
3. Use Media Manager to review and clean metadata
4. Run Person Manager periodically to remove unused persons
5. Verify your archive integrity after major cleanups
:::

## Related

- [Data Structure](./data-structure.md)
- [Creating Your Archive](../guide/creating-archive.md)
- [Face Detection](./face-detection.md)
