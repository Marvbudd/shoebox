# Archive Data Structure

Complete technical reference for the `accessions.json` file format used by Shoebox.

**Date:** December 2025  
**Format Version:** Person Library (UUID-based)  
**Purpose:** Comprehensive specification for the archive data structure

## Overview

The `accessions.json` file is the core data file for the Shoebox application. It stores metadata for a multimedia genealogy archive including photos, videos, and audio recordings. The data structure uses a **Person Library pattern** where person biographical data is centralized and referenced by unique UUID identifiers.

## Top-Level Structure

```json
{
  "accessions": {
    "title": "Archive title",
    "item": [ /* array of media items */ ]
  },
  "persons": {
    "PersonID": { /* person biographical data */ }
  }
}
```

### Key Architectural Decisions

1. **Centralized Person Library** - Person biographical data stored once in `persons` object
2. **PersonID References** - Items reference persons via stable UUID-based keys
3. **Separation of Concerns** - Biographical data separate from item-specific context
4. **Nullable TMGID** - TMG Links (stable page references) can be added later

### Primary Keys and Identifiers

**Link as True Primary Key:**
- The combination of `type` + `link` is the true primary key for items
- Enforced by filesystem: each file has a unique name within its type subdirectory
- `type` determines subdirectory (photo/, video/, audio/)
- `link` is the filename within that subdirectory
- This composite key is guaranteed unique and stable

**Accession as Display Field:**
- `accession` is a user-editable display/grouping field, not a true primary key
- Originally hand-entered, no uniqueness enforcement in code
- User can change accession values (should trigger warnings)
- Primarily used for organization and human-readable references

**Reference Guidelines:**
- **Internal system references** (playlists, faceBioData): Use `type` + `link`
- **User-facing displays** (collections, UI lists): Use `accession`
- **Person references**: Use `personID` (UUID), never store names

**Portability:**
- All file paths are relative to `accessions.json` location
- Moving the entire directory structure preserves all references
- `link` values assume flat subdirectory structure (photo/, video/, audio/)

## Item Structure

Each item in the `accessions.item[]` array represents a single media file.

### Core Item Properties

```json
{
  "accession": "1000",
  "link": "BMGC001.jpg",
  "type": "photo",
  "description": "...",
  "date": { /* date object */ },
  "location": [ /* array */ ],
  "person": [ /* array */ ],
  "source": [ /* array */ ]
}
```

### Item Property Definitions

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `accession` | string | Yes | User-editable display field for organization |
| `link` | string | Yes | Filename (true primary key with `type`) |
| `type` | string | Yes | Media type: `"photo"`, `"video"`, or `"audio"` |
| `description` | string | No | Free-text description, context, transcription |
| `date` | object | No | When the media was created |
| `location` | array | No | Where the media was taken |
| `person` | array | No | People depicted/mentioned |
| `source` | array | No | How the item was acquired |
| `playlist` | object | No | References to other media files |

### Date Structure

Flexible date representation supporting partial dates:

```json
"date": {
  "year": "1980",      // String or number
  "month": "Sep",      // Optional: short or full month name
  "day": "14"          // Optional: string or number
}
```

**Examples:**
```json
// Full date
{"year": "1980", "month": "Sep", "day": "14"}

// Year only
{"year": "1915"}

// Year and month
{"year": "1990", "month": "Dec"}
```

### Location Structure

Array of location objects, ordered from most specific to least specific:

```json
"location": [
  {
    "detail": "farm",
    "city": "Borden",
    "state": "IN",
    "latitude": 38.456789,
    "longitude": -85.912345
  }
]
```

**GPS Coordinates:**
- `latitude` - Decimal degrees, positive for North, negative for South (range: -90 to 90)
- `longitude` - Decimal degrees, positive for East, negative for West (range: -180 to 180)
- Automatically extracted from EXIF/IPTC/XMP metadata during photo ingestion
- Stored with full precision, displayed to 6 decimal places (~0.1m accuracy)
- Clickable in Media Details to open Google Maps

**Metadata Extraction:**
Enhanced metadata extraction supports multiple standards:
- **EXIF** - Standard photo metadata (date, GPS, description)
- **IPTC** - Professional photography metadata (caption, location names)
- **XMP** - Adobe/Lightroom metadata (descriptions, location, dates)

**Reverse Geocoding:**
- User-initiated via "Look up location" button in MediaManager
- Uses free Nominatim API (OpenStreetMap)
- Converts GPS coordinates to city/state names
- Privacy-first: user explicitly triggers lookups

**Common Patterns:**
```json
// City and state only
[{"city": "New Albany", "state": "IN"}]

// With GPS coordinates
[{
  "city": "Portland",
  "state": "OR",
  "latitude": 45.523064,
  "longitude": -122.676483
}]

// With specific detail
[{
  "detail": "Lake Holiday",
  "city": "Crawfordsville",
  "state": "IN",
  "latitude": 40.041889,
  "longitude": -86.874417
}]
```

## Playlist Structure

Creates cross-references between media items. Most commonly used to link photos to audio/video recordings where the photo is discussed.

```json
"playlist": {
  "entry": [
    {
      "ref": "BUDC19951120a.mp3",
      "starttime": "00:00:00.0",
      "duration": "00:01:30.0"
    }
  ]
}
```

### Playlist Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `ref` | string | Yes | Filename of referenced media (without path) |
| `starttime` | string | Yes | Start time in format `HH:MM:SS.s` |
| `duration` | string | Yes | Duration in format `HH:MM:SS.s` |

**Bidirectional Navigation:**
- When viewing a photo with playlist entries, click a playlist entry to play the referenced segment
- When viewing audio/video, "References" section shows which photos are mentioned at what timestamps

**Example Workflow:**
1. User views photo `BMGC001.jpg`
2. Photo has playlist entry referencing `BUDC19951120a.mp3` at `00:03:45.0` for `00:01:30.0`
3. Click the playlist entry to play that 1.5-minute segment
4. Viewing `BUDC19951120a.mp3` shows `BMGC001.jpg` in the References section

## Person References

Items reference persons via stable UUID-based `personID` with optional item-specific context.

### Person Reference Structure

```json
"person": [
  {
    "personID": "550e8400-e29b-41d4-a716-446655440000",
    "position": "back row"
  }
]
```

### Person Reference Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `personID` | string | Yes | UUID reference to `persons` object |
| `position` | string | No | Item-specific position/context |

**Position Examples:**
- `"back row"`
- `"front left"`
- `"Third from left"`
- `"with Mexican hat"`
- `"in Ethel's arms"`

## Source Structure

Tracks how and when items were acquired:

```json
"source": [
  {
    "personID": "c8f5b3be-4feb-41d4-a716-446655440000",
    "received": {
      "year": "1999",
      "month": "Sep",
      "day": "14"
    }
  }
]
```

### Source Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `personID` | string | Yes | UUID reference to person who provided the item |
| `received` | object | No | When the item was received (same format as `date`) |

## Persons Object

Centralized person library storing biographical data once per unique individual.

### Persons Object Structure

```json
"persons": {
  "550e8400-e29b-41d4-a716-446655440000": {
    "personID": "550e8400-e29b-41d4-a716-446655440000",
    "TMGID": null,
    "first": "Edna Mae",
    "last": [
      {"last": "Smith"},
      {"type": "married", "last": "Jones"}
    ],
    "notes": "Optional biographical information",
    "living": true,
    "faceBioData": [ /* array */ ]
  }
}
```

### PersonID (UUID-based Identity)

PersonID is a stable UUID that uniquely identifies each person. It never changes and is used for all references.

**Benefits:**
- Stable identifiers that never change
- TMGID can be updated without breaking references
- "Unknown" persons can be split by assigning different UUIDs
- Clean separation: PersonID (identity), TMGID (external DB), name (display)

### TMGID (TMG Link) - Stable Page Reference

::: warning Important
TMGID is NOT an ID number - it is a **stable page reference** (filename) from Second Site genealogy website.
:::

**Correct Formats:** 
- `"123"` - Just the TMG ID number (`.htm` added automatically)
- `"123.htm"` - With `.htm` extension

**Incorrect Formats:**
- `"g0/p1.htm#i4"` - Indicates Person Page Groups enabled (wrong config!)

**Second Site Configuration for Stable TMGIDs:**
- Set **Person Page Sequence** to "By TMG ID"
- Enable **Static Page Assignments**
- Enable **One Person Script**
- **DISABLE Use Person Page Groups** (critical!)

**Example Values:**
```json
"TMGID": "123"          // Valid
"TMGID": "123.htm"      // Valid
"TMGID": null           // Valid - person not in website
```

### Person Object Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `personID` | string | Yes | UUID - stable unique identifier |
| `TMGID` | string/null | Yes | TMG Link - stable page reference or null |
| `first` | string/null | Yes | First/given name(s) |
| `last` | array | Yes | Array of last name objects |
| `notes` | string | No | Optional textual details about the person |
| `living` | boolean | No | Optional - true if person is still alive (omitted when false) |
| `faceBioData` | array | No | Face recognition data |

### Living Status (Privacy Management)

The optional `living` attribute helps identify items containing people who are still alive, for privacy and permission management.

**Storage Pattern:**
- **When true:** Attribute is explicitly stored: `"living": true`
- **When false:** Attribute is omitted from JSON (not stored)
- **In UI:** Checkbox always appears, defaults to unchecked when attribute is absent

**Purpose:**
- Privacy considerations before sharing archives publicly
- Legal compliance with privacy regulations
- Permission management for contemporary content
- Distinguishing historical from current content

**Example:**
```json
// Person who is living (attribute present)
{
  "personID": "550e8400-e29b-41d4-a716-446655440000",
  "TMGID": null,
  "first": "Jane",
  "last": [{"last": "Doe"}],
  "living": true
}

// Deceased person (attribute omitted)
{
  "personID": "c8f5b3be-4feb-41d4-a716-446655440000",
  "TMGID": "123",
  "first": "John",
  "last": [{"last": "Smith"}]
}
```

**Finding Items with Living People:**
- Use **Collections > Create Maintenance Collections** to generate the "Living People" collection
- Collection automatically identifies all items containing persons marked as living
- Useful for privacy reviews before sharing or publishing archives

### Face Biometric Data

::: tip Implementation Status
Face descriptors are now automatically migrated from `item.person[].faceTag.descriptor` to centralized person-based storage on save. The system tracks which detection model created each descriptor.
:::

Each person record stores face descriptors centrally:

```json
"faceBioData": [
  {
    "link": "BMGC001.jpg",
    "model": "ssd",
    "region": {"x": 0.5, "y": 0.3, "w": 0.15, "h": 0.2},
    "descriptor": [0.123, -0.456, 0.789, /* ...125 more floats */],
    "confidence": 0.95
  }
]
```

**Structure Properties:**

- `link` - Item filename (more stable than accession)
- `model` - Detection model: `"ssd"`, `"mtcnn"`, `"tinyFace"`, or `"manual"`
- `region` - Face region (x, y, w, h normalized 0-1)
- `descriptor` - 128-dimensional float array (face embedding)
- `confidence` - Detection confidence (0-1), 1.0 for manual regions

**Key Benefits:**

1. **Model Awareness** - Track which detection model works best for each person
2. **Smart Model Selection** - Auto-select most common model when opening photo
3. **Multi-Model Support** - Same person can have descriptors from different models
4. **Centralized Storage** - Eliminates duplication, one descriptor per photo appearance

### Last Name Structure

Last names are always arrays to support multiple surnames:

```json
"last": [
  {"last": "Budd"},
  {"type": "married", "last": "Campbell"},
  {"type": "married", "last": "Cowell"}
]
```

**Type Field:**
- Birth/Maiden names: `type` is omitted or set to empty string `""`
- Married names: `type: "married"`
- This allows backward compatibility with code expecting no type field

**Person Sort Behavior:**
When sorting by person, each individual appears under ALL their last names (maiden and married). This makes it easy to find people regardless of how they're known. For example, someone with maiden name "Smith" and married name "Jones" will appear in both the "S" and "J" sections.

**Single Last Name:**
```json
"last": [{"last": "Smith"}]
```

**Special Person Names:**
```json
// Unknown person with last name
{"first": "unknown", "last": [{"last": "Boyles"}]}

// Relationship only
{"first": "Mother", "last": [{"last": ""}]}
```

## Complete Examples

### Minimal Photo Item
```json
{
  "link": "BMGC001.jpg",
  "accession": "1000",
  "type": "photo",
  "description": "",
  "date": {"year": "1980"},
  "location": [{"city": "Linn", "state": "MO"}],
  "person": [
    {"personID": "550e8400-e29b-41d4-a716-446655440000"}
  ],
  "source": [
    {
      "personID": "c8f5b3be-4feb-41d4-a716-446655440000",
      "received": {"year": "1999", "month": "Sep", "day": "14"}
    }
  ]
}
```

### Complex Photo with Multiple People
```json
{
  "link": "HCKJ007.jpg",
  "accession": "1014",
  "type": "photo",
  "description": "On back in Joker's handwriting - \"Nance & Babe, Joker Hicks, Rod & Water\".",
  "date": {"year": "1911"},
  "location": [{"city": "New Albany", "state": "IN"}],
  "person": [
    {
      "personID": "ead6e56f-bd9e-441c-a37b-3a5e12345678",
      "position": "back row"
    },
    {"personID": "1a2cbdbd-3432-4d24-9c94-238ac0123456"},
    {
      "personID": "68ae1658-3175-41a6-919c-fa7401234567",
      "position": "front left"
    }
  ],
  "source": [
    {
      "personID": "0c077d04-b3d6-4e32-83e7-8b1dd0123456",
      "received": {"day": "20", "month": "Jun", "year": "2003"}
    }
  ]
}
```

### Person Entry Examples
```json
"persons": {
  // Simple person with single last name
  "09e88fac-4a11-4f52-b4da-c5260f95cce3": {
    "personID": "09e88fac-4a11-4f52-b4da-c5260f95cce3",
    "TMGID": null,
    "first": "Olin",
    "last": [{"last": "Bray"}]
  },
  
  // Person with multiple married names
  "45e385d2-4c85-4c9b-9805-f1375dca0083": {
    "personID": "45e385d2-4c85-4c9b-9805-f1375dca0083",
    "TMGID": null,
    "first": "Betty Colleen",
    "last": [
      {"last": "Brown"},
      {"type": "married", "last": "Budd"}
    ]
  }
}
```

## Archive Validation

A comprehensive validation tool is available via **Archive > Validate**. This generates a detailed report checking:

- **Person References**: All personID references exist in persons library
- **Media Files**: All item.link files exist in resource directories  
- **Playlist References**: All playlist.entry.ref files exist
- **Time Formats**: Playlist time values match `HH:MM:SS.s` pattern
- **Face Tags**: Face tag personIDs match item.person array
- **Accession Numbers**: No duplicate accession values

Validation generates a timestamped log file with detailed error reports.

## File Size and Performance

**Typical Statistics:**
- Total Lines: ~44,500
- Items: ~1,600+
- Persons: ~6,000+
- File Size: ~1.5 MB

**Performance Considerations:**
- Full file loaded into memory at application start
- PersonID lookups are O(1) hash operations
- Array operations (finding items) are O(n)

## Common Query Patterns

```javascript
// Find all photos from a specific year
items.filter(item => 
  item.type === "photo" && 
  item.date?.year === "1980"
)

// Find all items featuring a person
items.filter(item => 
  item.person?.some(p => p.personID === "550e8400-e29b-41d4-a716-446655440000")
)

// Get person full name
const person = persons[personID];
const firstName = person.first || '';
const lastName = person.last.map(ln => ln.last).join(' ');
const fullName = `${firstName} ${lastName}`.trim();
```

## Related Documentation

- [Metadata Extraction](../features/metadata.md) - How metadata is extracted from files
- [Face Detection](../features/face-detection.md) - Face recognition implementation
- [Collections](../features/collections.md) - Creating filtered subsets
