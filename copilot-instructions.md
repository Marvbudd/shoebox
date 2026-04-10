# Shoebox Development Guidelines

## Core Rules

1. **Follow existing patterns**: Extend the current ownership, save, IPC, and renderer patterns instead of inventing parallel ones.
2. **Keep mutations encapsulated**: Route data changes through the owning module or class, not through direct structure edits from callers.
3. **Keep persistence deferred**: Do not trigger immediate saves from UI or IPC entry points unless the existing pattern explicitly does so.
4. **Reuse canonical OS integrations**: File opening, media loading, MIME handling, and similar OS-facing behavior should have one shared implementation.
5. **Keep renderer media sandbox-safe**: Use approved media URL patterns in renderers, not raw filesystem paths.

## Key Documentation

| Topic | Location |
|-------|----------|
| **Architecture patterns** | [docs/guide/architecture.md](docs/guide/architecture.md) |
| **Data structure (`accessions.json`)** | [docs/guide/data-structure.md](docs/guide/data-structure.md) |
| **Collections** | [docs/features/collections.md](docs/features/collections.md) |
| **Archive mutation ownership** | [app/main/utils/AccessionClass.js](app/main/utils/AccessionClass.js) (class header) |
| **Single collection lifecycle** | [app/main/utils/CollectionClass.js](app/main/utils/CollectionClass.js) (class header) |
| **Collection set lifecycle** | [app/main/utils/CollectionsClass.js](app/main/utils/CollectionsClass.js) (class header) |

## Quick Reference

**Adding a data mutation?** → Find the owning module in [docs/guide/architecture.md](docs/guide/architecture.md), implement there, and update its header docs  
**Adding IPC or OS behavior?** → Check [docs/guide/architecture.md](docs/guide/architecture.md) for the canonical implementation first  
**Adding data fields or JSON structure?** → Update [docs/guide/data-structure.md](docs/guide/data-structure.md)  
**Adding shared Vue logic?** → Place it in `app/render/vue/shared/` if more than one component needs it


