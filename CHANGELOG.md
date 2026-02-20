# Changelog

All notable changes to Shoebox will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.6] - 2026-02-20

### Changed
- Updated electron from 40.4.1 to 40.6.0.
- Updated electron-updater from 6.7.3 to 6.8.3.
- Updated electron-builder from 26.7.0 to 26.8.1.
- Removed all dependency resolutions to allow natural dependency resolution after upstream package updates.
- Changed electron-builder and electron-updater to use semver ranges (^) for automatic patch and minor updates.

### Fixed
- Fixed media player timer leak causing premature playback stops when navigating through playlist items.
- Fixed main window mouseover race condition where quickly moving mouse over items in left column would miss or display wrong item details. Implemented debouncing with element position checking to ensure the correct item displays when mouse movement stops.
- Fixed reference photo error handling in Media Manager to use non-blocking status messages instead of alert popups, preventing errors after window closes.
- Fixed file opening to properly detect and report errors from shell.openPath().

### Removed
- Removed legacy unused code files (media.html, media.js, index.html, index.js, preload.js, mediaPreload.js).

## [3.0.5] - 2026-02-16

### Fixed
- Downgraded tar from 7.5.3 to 6.2.1 to fix build compatibility with @electron/rebuild (tar 7.x removed default export causing "does not provide an export named 'default'" error).
- Added resolutions to app/package.json to force security updates for transitive dependencies (node-fetch ^2.7.0, @isaacs/brace-expansion ^5.0.1) used by face-api.js.
- Added explicit permissions to GitHub Actions workflows to address code scanning alert.
- Updated documentation copyright year to 2026.

### Security Note
- tar 6.2.1 has known vulnerabilities (CVE-2024-28863, CVE-2024-45590, CVE-2024-45591) related to path traversal and symlink attacks during archive extraction. These vulnerabilities are not exploitable in Shoebox because:
  - tar is a build-time dependency used by @electron/rebuild and electron-builder
  - No user-provided tar archives are extracted at runtime
  - The application does not process or extract tar files
  - Upgrading to tar 7.x breaks compatibility with required build tools
  - Risk is limited to build environment compromise, which is protected by CI/CD controls

## [3.0.4] - 2026-02-16

### Documentation
- Changed references to version 3.0.0 to be generic.
- Alerted users that since we are not signing code they will see warnings on install.
- Highlighted Playlists and references as a key feature.

### Fixed
- Resolved security vulnerabilities by upgrading: tar (7.5.7), esbuild (0.25.12), @isaacs/brace-expansion (5.0.1), node-fetch (2.7.0).
- Person Manager people list now uses the same name formatting as the main navigation column.
- Person Manager refreshes item usage counts when items are updated, without reopening.
- Person Manager input fields no longer become locked after confirm dialogs - replaced native confirm() with custom Vue modal to avoid Electron focus bug.
- Media Manager now properly saves and restores window size and position when closed via Cancel/Save buttons.
- Face detection overlay canvas now properly aligns with dynamically-sized, centered images.
- Right column scrolling limited to viewport height, only scrolls when Advanced settings expanded.
- Eliminated double borders by removing outer padding from layout container.
- Both left and right columns now have consistent spacing and styling.
- Person Manager icon (👤) now properly selects the person when clicked, using event-based timing instead of setTimeout for improved reliability.
- Face assignment "Face Not Found" error resolved by adding safety check when multiple people could select the same face concurrently.
- Person Manager living checkbox and label now appear on the same line (flexbox layout).
- Person Manager TMGID field width limited to 150px to prevent excessive stretching.
- Media Manager modal dialog buttons (Unassign/Cancel) now visible with proper styling instead of appearing as white shadows.
- MainWindow keyboard navigation: down arrow on last item no longer causes scroll position jump and selection to move backward.
- Update Collection menu item now properly opens collection metadata editor instead of showing "not yet implemented" message.
- Update Collection dialog now correctly refreshes main window after saving collection metadata changes.
- Add Media Metadata dialog now properly saves source person and date received information to newly added items.
- Person name display standardized across all dialogs (Add Media Metadata, Media Manager, Update Collection) using shared `formatPersonName` helper function.


### Changed
- Person Manager now keeps person selected after save for continued editing (removed auto-clear timeout).
- Person Manager warns about unsaved changes when switching between persons, creating new person, or closing window, using custom modal dialogs instead of native browser confirms.
- Media Manager layout reorganized to two-column design: form fields on left, media preview and face detection controls on right.
- Column proportions optimized: left column (0.75fr) for efficient form input, right column (1fr) for maximized preview size.
- Media preview now uses variable sizing with dynamic height calculation to maximize available space.
- Reduced vertical padding and margins throughout to eliminate wasted space and improve information density.
- Person list layout optimized: narrower face assignment column (185px), wider name field (2.5fr), narrower position field (1.25fr).
- Assign/Unassign face buttons now occupy the same position to save space and prevent overlap.
- Media Manager people list scrolling threshold increased from 3 to 5 people before scrollbar appears.
- Edit Media behavior: now uses Limit checkbox to determine queue mode.
- Limit checkbox enabled: Opens Media Manager with queue navigation through selected collection (sorted by current sort order).
- Limit checkbox disabled: Opens Media Manager for single item only.
- Media Manager queue navigation now matches Main Window sort order (supports all 6 sort methods: Date, Person, Location, File, Source, Accession).
- Person Manager person selection timing improved: replaced setTimeout with 'did-finish-load' event for more reliable cross-window communication.
- Date input fields standardized across all dialogs using new shared `DateInput.vue` component.
- Removed approximately 150+ lines of duplicate date input code by consolidating into single reusable component.
- Add Media Metadata dialog now uses consistent person name formatting including maiden names in parentheses and multiple last names.


### Added
- Prevent display sleep/screen saver while slideshow is running.
- Media Manager queue navigation: when editing items from a collection, navigate through items sequentially with Previous/Next buttons. Items are sorted by date (newest first), and unsaved changes are protected with confirmation prompts.
- Media Manager documentation added to metadata.md describing the two-pane layout, workflow, and features.
- Media Manager preview now opens media in external window when clicked (consistent with main window behavior).
- Archive menu now includes "Edit Media" item with keyboard accelerator (Alt+R, E) for quick access to Media Manager.
- Menu-triggered Edit Media: Archive > Edit Media opens Media Manager for currently selected item, shows alert if no item is selected.
- Person Manager now includes "Living" checkbox to mark people who are still alive.
  - Living attribute is optional: only stored in JSON when true, removed when false to keep file size minimal.
  - Always displays in Person Manager UI, defaulting to unchecked (false) when not present.
- Maintenance Collections: New "Living People" collection automatically created via Collections > Create Maintenance Collections.
  - Contains all items with at least one person marked as living.
  - Named "_living" with text "Living People" to match existing maintenance collection patterns.
  - Useful for identifying items that may require privacy considerations or permission before sharing.
- New shared `DateInput.vue` component for consistent date entry across the application.
  - Supports normal and small sizes, optional hint text, and v-model binding for year/month/day.


## [3.0.3] - 2026-01-28

### Fixed
- CI build reliability: install native deps for canvas in release builds.
- Docs build reliability: disable install scripts to avoid native module builds.

## [3.0.2] - 2026-01-28

### Fixed
- Bundled `canvas` in the app package to prevent missing-module errors in Windows face detection.

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
