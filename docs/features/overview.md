---
audience: general
---

# Features Overview

> Audience: General users

Shoebox provides powerful tools for organizing and enjoying your family archive.

## Core Features

### 📸 Multimedia Archive Management

Organize photos, videos, and audio recordings in a unified archive.

- **Supported Formats**: JPEG, MP4, MP3, and more
- **Local Storage**: All files stay on your computer
- **Centralized Metadata**: Rich contextual information for each item
- **Fast Search**: Quickly find items by person, date, location, or source
- **Smart Person Sort**: People appear under all their last names (maiden and married), so they're easy to find regardless of how they're known

[Learn more about Archives vs Collections](../guide/archives-vs-collections.md)

### 🎞️ Slideshow & Photo Frame Mode

Display your memories dynamically with auto-cycling slideshows.

- **Auto-Advance**: Configurable 1-30 second intervals
- **Photo Frame Mode**: Full-screen display hiding all UI
- **Speed Control**: Adjust with left/right arrow keys during slideshow
- **Direction & Random**: Forward, backward, or shuffle playback
- **Smart Pause**: Auto-pause when window loses focus

[Slideshow Mode Guide](./slideshow.md)

### 👤 Face Detection

AI-powered face recognition to identify people in your photos.

- **Automatic Detection**: Scan photos for faces
- **Manual Tagging**: Associate faces with people in your archive
- **Visual Overlays**: See tagged faces directly on photos
- **Multiple Models**: Choose from SSD, MTCNN, or TinyFace detectors

[Face Detection Guide](./face-detection.md) | [Advanced Technical Details](./face-detection-advanced.md)

### 🗂️ Collections

Create subsets of your archive for sharing or thematic grouping.

- **Flexible Selection**: Choose any combination of items
- **Non-Destructive**: Collections reference original files
- **Export Ready**: Share collections with family members
- **Multiple Collections**: Create unlimited themed sets

[Collections Guide](./collections.md)

### � Multiple Archive Management

Organize your collection across multiple archives while maintaining person identity consistency.

- **Person Import**: Transfer person records between archives preserving identifiers
- **Archive Import**: Merge archives with intelligent conflict detection
- **Collaborative Workflows**: Share subsets, receive edits back, integrate changes
- **Flexible Organization**: Thematic archives, time periods, or project-based splits
- **Conflict Detection**: Never overwrites data - flags differences for manual resolution

[Managing Multiple Archives Guide](../guide/managing-multiple-archives.md)

### �📝 Rich Metadata

Document the context and stories behind each item.

- **People**: Link items to biographical data
- **Dates**: Precise or partial (year, month, day)
- **Locations**: Multi-level hierarchy (city, state, country)
- **Descriptions**: Free-text narratives and transcriptions
- **Sources**: Track who provided items (person with date received)
- **Safe Cleanup**: Review file status in Media Manager and safely remove metadata, archive files, symlinks, or unused person records

[Metadata Guide](./metadata.md)

### 🎵 Playlists & Inverse Playlists

Attach time-based playlists to items and move between related media in both directions.

- **Attached to Items**: Add playlist entries to photos or documents that jump to specific audio/video moments
- **Automatic Inverse Playlists**: Referenced audio/video automatically lists the items that point to it under “References”
- **Bidirectional Navigation**: Click either side to jump between related media

### ⌨️ Keyboard Shortcuts

Navigate efficiently without touching the mouse.

- **Up/Down Arrow Keys**: Navigate archive chronologically
- **Mouse Hover**: Preview items by hovering in navigation list
- **Sort Control**: Use the dropdown at the bottom of the window to change sort order
- **Letter Keys**: Toggle filters and displays
- **Spacebar**: Enter/exit slideshow mode
- **Custom Shortcuts**: Menu access keys and more

[Complete Keyboard Reference](../guide/keyboard-shortcuts.md)

## Platform Support

Shoebox runs on all major desktop platforms:

- **macOS**: 10.13 (High Sierra) or later
- **Windows**: Windows 10 or later
- **Linux**: Modern distributions with AppImage support

Built with Electron for consistent experience across platforms.

## Privacy & Ownership

### Your Data, Your Control

- **No Cloud Required**: Everything stored locally
- **No Accounts**: No sign-up, no login, no tracking
- **No Uploads**: Files never leave your computer
- **Open Format**: JSON-based data structure you can access directly

### Offline-First

- **Works Anywhere**: No internet connection needed
- **Fast Performance**: Local processing, no network delays
- **Always Available**: Access your archive anytime
- **Complete Control**: Own your files and metadata

## Technology

Shoebox is built with modern web technologies:

- **Electron**: Cross-platform desktop framework
- **Vue 3**: Reactive user interface
- **face-api.js**: AI-powered face detection
- **Vite**: Fast build tooling

Open source under the MIT license.

## Getting Started

Ready to organize your family archive?

1. [Install Shoebox](../guide/installation.md)
2. [Explore the sample archive](../guide/getting-started.md)
3. [Create your own archive](../guide/creating-archive.md)
4. [Try slideshow mode](./slideshow.md)

## What's New in 3.0.0

Latest release highlights:

- ✨ Complete slideshow system with photo frame mode
- 🎯 Speed control, random mode, and direction reversal
- 📋 Reorganized Collections menu for better discoverability
- 🐛 Fixed metadata display persistence and UI bugs
- 📚 Improved documentation and keyboard shortcuts

[Release Notes](https://github.com/Marvbudd/shoebox/blob/main/CHANGELOG.md)

## Getting Help

- [Getting Started Guide](../guide/getting-started.md)
- [Keyboard Shortcuts](../guide/keyboard-shortcuts.md)
- [GitHub Issues](https://github.com/Marvbudd/shoebox/issues)
- Email: marvbudd@gmail.com

---

Explore the sidebar to dive deeper into specific features!
