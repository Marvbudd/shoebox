# Changelog

All notable changes to Shoebox will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.1] - 2026-01-27

### Fixed
- Bundled `face-api.js` with the app package to prevent missing-module errors after auto-update on Windows.
- Made Vue build scripts compatible with macOS default shell tools.

### CI
- Improved release build workflow reliability for Yarn 4 and cross-platform builds.

## [3.0.0] - 2026-01-20

### Code refactoring
- Claude Sonnet 4.5 was used to refactor all code using GITHUB Copilot in VS Code.
- All UI now migrated to Vue.
- Refactored code from AccessionClass to AccessionSorter, and AccessionHTMLBuilder.
- Main.js reduced drastically by moving code to appropriate helper classes.
- Changed AccessionClass to migrate person data to a new array in accessions.json using PersonLibraryMigrator. 
- Person Manager allows editing data for a person. Person data keyed by PersonID.
- Added TMGID field for linking with Second Site/The Master Genealogist websites.
- faceBioData attribute of a person saves all photo descriptors of their faces.
- Central place for face matching.
- Items now link to person data using PersonID avoiding duplication.

### Added

#### Slideshow & Photo Frame Mode
- Auto-cycling slideshow that automatically advances through photos at configurable intervals (1-30 seconds)
- Photos-only filtering - intelligently displays only images, skipping videos and audio
- Photo frame display mode - full-window immersive view with hidden navigation and headers
- Continuous looping through entire collection
- Real-time speed control using Left/Right arrow keys
- Direction reversal with Backspace key
- Random mode toggle (Ctrl+Shift+R key) for non-sequential photo display
- Auto-pause when window loses focus, auto-resume on return
- Visual status overlay showing slideshow state and current settings
- Context-sensitive keyboard shortcuts tooltip
- **Keyboard Shortcuts:**
  - Space: Start/Stop slideshow
  - Left/Right: Decrease/Increase speed
  - Up/Down: Navigate manually and stop slideshow
  - Backspace: Reverse direction
  - Ctrl+Shift+R: Toggle random mode
  - Ctrl+Shift+P/A/V/F: Toggle Photo/Audio/Video filters and Face tags
  - Ctrl+Shift+L: Toggle Limit to Collection filter
  - Escape: Exit photo frame mode

#### Backup & Safety
- Archive > Backup Archive - Creates timestamped backup of accessions.json
- Collections > Backup All Collections - Creates timestamped backups of all collections
- Backup files use `.timestamp` extension (not `.json`) to prevent accidental ingestion
- All backups stored alongside original files for easy access

#### Collection Export
- Collections > Export Collection - Exports collection with complete person library
- **Cross-platform automatic media export** - works on Linux, macOS, and Windows
  - Automatically creates symlinks (fastest, saves disk space)
  - Falls back to hard links if symlinks not available
  - Falls back to file copies if hard links not supported
  - No manual command file execution required
- Exported accessions.json includes persons referenced by items in the collection
- Person faceBioData filtered to only include face descriptors for items within the collection
- Optional validation workflow before export to check for missing items
- Success/error dialogs with detailed feedback (item count, person count, method used)
- Comprehensive error handling with user-friendly error messages
- Gracefully handles missing items by skipping and reporting them

#### Validation
- Collections > Validate Collection - Validates currently selected collection
- Validation reports saved in collections directory with collection key prefix
- Improved workflow: select collection in UI, then validate (no additional prompts)

#### Menu Organization
- New dedicated "Collections" menu in menu bar
- Centralized all collection operations in one location
- Improved discoverability of collection features

#### Documentation
- F1 key opens documentation website from anywhere in the app
- Help menu integration with Documentation and Keyboard Shortcuts links
- Comprehensive keyboard shortcuts documentation for slideshow mode
- Custom About dialog showing version, copyright, license, and links

#### Face Detection
- Optimized model distribution - SSD MobileNet v1 included by default
- Optional MTCNN and TinyFace Detector available via download script
- Instructions for downloading additional face detection models
- Build size reduced by ~2 MB (optional models not bundled)

### Changed
- Reorganized Collections menu - moved operations from File/Database menus to dedicated Collections menu
- Improved face tag overlay rendering for photos with many detected faces
- Metadata display state now persists across photo changes in slideshow
- Updated terminology: "Database" → "Archive" throughout menus and dialogs
- Slideshow random mode changed from R key to Ctrl+Shift+R to avoid menu conflicts
- Validate Collection now uses currently selected collection (no prompt required)

### Removed
- Help > Info menu item (replaced with comprehensive online documentation)
- Bundled MTCNN and TinyFace Detector models (now optional downloads)
- Old static help.html file
- Keyboard shortcuts for sort selection (1-6 keys) - use Sort dropdown instead

### Documentation
- Created VitePress documentation site with comprehensive guides
- Migrated AccessionDataStructure.md to docs/guide/data-structure.md
- Migrated KeyboardShortcuts.md to docs/guide/keyboard-shortcuts.md
- Added face detection guide with model download instructions
- Created OFFLINE-DOCS.md with instructions for bundling docs with app
- Updated .gitignore to exclude optional face detection models

---

## [2.2.6] - 2025-12-31

Previous stable release. For detailed history before 3.0.0, see git commit history.

---

[3.0.0]: https://github.com/Marvbudd/shoebox/releases/tag/v3.0.0
[2.2.6]: https://github.com/Marvbudd/shoebox/releases/tag/v2.2.6
