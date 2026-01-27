# Archives vs Collections

Understanding the difference between Archives and Collections is key to organizing your media effectively in Shoebox.

## Archive: Your Complete Library

An **archive** is your complete multimedia library—the master collection of all your family's photos, videos, and audio recordings along with their metadata.

### Characteristics

- **Single Source of Truth**: One master dataset containing everything
- **Comprehensive**: Includes all media files you want to preserve
- **Richly Documented**: Full metadata for people, dates, locations, sources
- **Long-Term**: Built and maintained over years or decades
- **Portable**: Entire directory can be moved, backed up, or shared

### Example

```
My Family Archive
├── 5,000 photos spanning 1920-2025
├── 200 videos from family events
├── 50 audio recordings of interviews
└── Complete metadata in accessions.json
```

### Use Cases

- **Preservation**: Safeguarding family memories for future generations
- **Research**: Genealogy and family history documentation
- **Completeness**: "Everything we have" in one place
- **Master Reference**: The canonical source for all media

## Collection: A Curated Subset

A **collection** is a subset of items from your archive, selected for a specific purpose.

### Characteristics

- **Subset**: Contains references to items, not duplicates
- **Purpose-Driven**: Created for specific themes, events, or people
- **Non-Destructive**: Doesn't modify the archive
- **Shareable**: Can be exported or shared independently
- **Multiple**: You can have many collections from one archive
- **Flexible**: Easy to create, modify, or delete

### Example

```
Collection: "Grandma's 90th Birthday"
├── 45 photos from party
├── 3 videos of speeches
└── 2 audio recordings of stories
(All items exist in main archive)
```

### Use Cases

- **Events**: Birthday parties, weddings, reunions
- **People**: "All photos of Grandpa," "Aunt Mary's life"
- **Time Periods**: "1950s photos," "Our Europe trip"
- **Presentations**: Selected highlights for slideshow
- **Sharing**: Subset for specific family members

## Key Differences

| Aspect | Archive | Collection |
|--------|---------|-----------|
| **Size** | Complete library | Subset of archive |
| **Purpose** | Preservation | Organization/Sharing |
| **Scope** | Everything | Specific theme |
| **Files** | Actual media files | References to items |
| **Quantity** | One per family/user | Many collections |
| **Permanence** | Long-term master | Temporary or themed |
| **Metadata** | Comprehensive | Inherits from archive |

## Working Together

Archives and Collections are complementary:

```
Archive (Master)
    ├── Collection: Family Reunions
    ├── Collection: Grandparents
    ├── Collection: 1980s Photos
    └── Collection: Vacation Memories
```

### Workflow

1. **Build Archive**: Import all media, add metadata
2. **Create Collections**: Group items by theme/purpose
3. **Use Collections**: Slideshows, sharing, presentations
4. **Maintain Archive**: Continue adding items over time
5. **Update Collections**: Add new items to relevant collections

## Creating Collections

### From Main Window

1. Select items you want to include
2. Go to **Collections > Create New Collection**
3. Name your collection
4. Save

See [Collections Feature Guide](../features/collections.md) for detailed instructions.

## When to Use What

### Use Archive When:

- Starting from scratch
- Importing new media
- Adding comprehensive metadata
- Backing up everything
- Long-term preservation

### Use Collections When:

- Preparing a slideshow for an event
- Sharing specific photos with family members
- Organizing themed photo sets
- Creating subsets for different purposes
- Presenting highlights

## Real-World Example

### Sarah's Archive

**Archive**: "Smith Family History"
- 10,000 photos (1900-2025)
- 500 videos
- 100 audio interviews
- Complete metadata for all items

**Collections Created**:
1. **"Great-Grandparents"**: 200 items featuring GG-Ma and GG-Pa
2. **"Family Reunion 2024"**: 150 items from recent reunion
3. **"Dad's Military Service"**: 75 items from Dad's time in service
4. **"Holiday Traditions"**: 300 items across all years showing holidays
5. **"Digital Photo Frame"**: 500 favorites for auto-cycling display

Sarah maintains **one archive** but creates **many collections** for different purposes.

## Technical Details

### Storage

- **Archive**: Files in `photo/`, `video/`, `audio/` directories + `accessions.json`
- **Collection**: JSON file listing item references (accession numbers)

### Portability

- **Archive**: Copy entire directory structure
- **Collection**: Export as standalone package with selected items

### Performance

- **Archive**: Can be very large (GBs or TBs)
- **Collection**: Lightweight (KBs), references only

## Best Practices

### Archive Management

- ✅ Back up regularly
- ✅ Add metadata as you import
- ✅ Use consistent file naming
- ✅ Document sources
- ✅ Organize chronologically first

### Collection Strategy

- ✅ Create for specific purposes
- ✅ Name descriptively
- ✅ Keep manageable size (50-500 items typically)
- ✅ Delete when no longer needed
- ✅ Use for sharing, not storage

## Common Confusion

::: warning Terminology
Some photo apps use "collection" to mean what we call an "archive." In Shoebox:
- **Archive** = Your complete library
- **Collection** = A themed subset

This documentation uses these terms consistently.
:::

## Next Steps

- [Create your archive](./creating-archive.md)
- [Learn about collections](../features/collections.md)
- [Understanding data structure](./data-structure.md)

---

Think of it this way: Your **archive** is your entire bookshelf, while **collections** are reading lists you create for different occasions.
