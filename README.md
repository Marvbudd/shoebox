# Shoebox

> Personal Family History Archive Manager

Organize, preserve, and share your family's multimedia memories with a powerful desktop application that keeps your data private and under your control.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-latest-blue.svg)](https://github.com/Marvbudd/shoebox/releases)

## 🎯 What is Shoebox?

Shoebox is a cross-platform desktop application for managing your family archive—photos, videos, and audio recordings with rich metadata. Unlike cloud-based services, Shoebox keeps everything local, giving you complete control and privacy.

### Features

- 📸 **Multimedia Archive**: Organize photos, videos, and audio in one place
- 🎞️ **Slideshow Mode**: Auto-cycling photo frame with speed control, random mode, and direction reversal
- 👤 **Face Detection**: AI-powered face recognition and tagging under user control
- 🗂️ **Collections**: Create themed subsets for sharing or presentations with set operations support
- � **Multiple Archives**: Organize across multiple archives with person identity consistency and intelligent conflict detection
- �📝 **Rich Metadata**: Document people, places, dates, and stories
- 🎵 **Playlists & Inverse Playlists**: Attach time-based playlists to items and automatically see reverse references on related media
- 📇 **Person Manager**: Centralized biographical data for consistent maintenance across archive
- 🔗 **TMG Integration**: Links to The Master Genealogist data in Second Site websites via TMG ID
- 🎛️ **Management Screens**: Dedicated Media and Person Manager windows with detailed help
- ⌨️ **Keyboard Shortcuts**: Efficient navigation without the mouse
- 🔒 **Privacy-Focused**: No cloud uploads, your data stays yours
- 🌐 **Cross-Platform**: macOS, Windows, and Linux

## 🚀 Quick Start

Download from [GitHub Releases](https://github.com/Marvbudd/shoebox/releases) and follow the [Installation Guide](https://marvbudd.github.io/shoebox/guide/installation) for your platform. Then see [First Launch](https://marvbudd.github.io/shoebox/guide/first-launch) to get started with the sample archive.

## 📚 Documentation

Comprehensive documentation is available at our [documentation site](https://marvbudd.github.io/shoebox/):

### Getting Started
- [Introduction](https://marvbudd.github.io/shoebox/guide/getting-started)
- [Installation](https://marvbudd.github.io/shoebox/guide/installation)
- [First Launch](https://marvbudd.github.io/shoebox/guide/first-launch)
- [Creating Your Archive](https://marvbudd.github.io/shoebox/guide/creating-archive)

### Core Concepts
- [Archives vs Collections](https://marvbudd.github.io/shoebox/guide/archives-vs-collections)
- [Data Structure](https://marvbudd.github.io/shoebox/guide/data-structure)
- [Managing Multiple Archives](https://marvbudd.github.io/shoebox/guide/managing-multiple-archives)
- [Keyboard Shortcuts](https://marvbudd.github.io/shoebox/guide/keyboard-shortcuts)

### Features
- [Overview](https://marvbudd.github.io/shoebox/features/overview)
- [Slideshow Mode](https://marvbudd.github.io/shoebox/features/slideshow)
- [Face Detection](https://marvbudd.github.io/shoebox/features/face-detection)
- [Collections](https://marvbudd.github.io/shoebox/features/collections)
- [Metadata](https://marvbudd.github.io/shoebox/features/metadata)

### Video Tutorials

Watch the [YouTube playlist](https://www.youtube.com/playlist?list=PL8z7p1h74xBqbjDLCWjncm9EF5RL7oTDP) for video tutorials covering installation and basic usage.

## 🆕 Recent Updates

Latest improvements include an auto-cycling slideshow mode, reorganized menu structure (Collections and Archive menus), improved UI polish, and a comprehensive VitePress documentation site. See the [Release Notes](CHANGELOG.md) for complete details.

## 💡 Use Cases

### Digital Photo Frame
Set up a continuous slideshow of family photos for display at home or events.

### Family History Research
Document people, dates, locations, and sources for genealogy work.

### Event Sharing
Create collections of specific events to share with family members.

### Memory Preservation
Organize and preserve multimedia memories for future generations.

## 🏗️ Architecture

Built with modern web technologies:

- **Electron**: Cross-platform desktop framework
- **Vue 3**: Reactive user interface
- **face-api.js**: AI-powered face detection
- **Vite**: Fast build tooling

Data stored in:
- **JSON format**: Human-readable accessions.json file
- **Local files**: Photos, videos, audio in organized directories
- **Portable**: Entire archive can be moved or backed up as a unit

## 📂 Archive Structure

Your Shoebox archive consists of:

```
my-archive/
├── accessions.json      # Metadata for all items
├── photo/              # All photos (.jpg, .png, .gif)
├── video/              # All videos (.mp4, .mov)
└── audio/              # All audio (.mp3, .wav)
```

See the [Data Structure Guide](https://marvbudd.github.io/shoebox/guide/data-structure) for complete details.

## 🔐 Privacy & Data Ownership

- **No Cloud Required**: Everything stored locally on your computer
- **No Accounts**: No sign-up, no login, no tracking
- **No Uploads**: Files never leave your device
- **Open Format**: JSON-based data you can access directly
- **Complete Control**: Your data, your rules

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

For major changes, please open an issue first to discuss.

## 🛠️ Development

### Prerequisites

- Node.js 18+ (with npm/yarn)
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/Marvbudd/shoebox.git
cd shoebox

# Install dependencies
yarn install

# Run development server
yarn start
```

### Building

```bash
# Build Vue components
yarn build:vue

# Package for distribution
yarn build
```

### Documentation

```bash
# Run documentation site locally
yarn docs:dev

# Build documentation
yarn docs:build
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Documentation**: [https://marvbudd.github.io/shoebox/](https://marvbudd.github.io/shoebox/)
- **Issues**: [GitHub Issues](https://github.com/Marvbudd/shoebox/issues)
- **Email**: marvbudd@gmail.com
- **Videos**: [YouTube Playlist](https://www.youtube.com/playlist?list=PL8z7p1h74xBqbjDLCWjncm9EF5RL7oTDP)

## 👨‍💻 Author

**Marvin E Budd**
- Email: marvbudd@gmail.com
- GitHub: [@Marvbudd](https://github.com/Marvbudd)

## 🙏 Acknowledgments

Thank you to all users who have provided feedback and feature requests over the years. Shoebox has evolved from a Windows 98/Internet Explorer application during the 9/11 era into a modern cross-platform tool thanks to your input.

---

**Happy Archiving!** 📸

For questions about accessing the author's family archive, please email with information about how you're related.

