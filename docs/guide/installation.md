# Installation

Download and install Shoebox for your operating system.

## System Requirements

- **macOS**: 10.13 (High Sierra) or later
- **Windows**: Windows 10 or later
- **Linux**: Modern distributions with AppImage support

## Download

Get the latest version from the [GitHub Releases](https://github.com/Marvbudd/shoebox/releases) page:

- **macOS**: `Shoebox-<version>.dmg`
- **Windows**: `Shoebox-<version>.exe`
- **Linux**: `Shoebox-<version>.AppImage`

## Installation Steps

### macOS

1. Download `Shoebox-<version>.dmg`
2. Open the DMG file
3. Drag Shoebox to your Applications folder
4. Launch Shoebox from Applications
5. If you see a security warning, right-click the app and select "Open"

### Windows

1. Download `Shoebox-<version>.exe`
2. Run the installer
3. Follow the installation wizard
4. Launch Shoebox from the Start menu or desktop shortcut

### Linux

1. Download `Shoebox-<version>.AppImage`
2. Make it executable:
   ```bash
   chmod +x Shoebox-<version>.AppImage
   ```
3. Run the AppImage:
   ```bash
   ./Shoebox-<version>.AppImage
   ```

## First Launch

When you first start Shoebox:

1. The app will open with a sample archive pre-loaded
2. Explore the interface and features using the sample data
3. When ready to create your own archive, see [Creating Your Archive](./creating-archive.md)

## Troubleshooting

### macOS: "App is damaged and can't be opened"

This is a Gatekeeper security warning. To fix:

1. Open Terminal
2. Run: `xattr -cr /Applications/Shoebox.app`
3. Try launching again

### Windows: SmartScreen Warning

1. Click "More info" in the warning dialog
2. Click "Run anyway"
3. This only appears on first launch

### Unsigned App Notice

Shoebox is currently distributed without a paid code‑signing certificate. This means:
- **Windows** may show a SmartScreen warning on first launch.
- **macOS** may show a Gatekeeper warning the first time the app is opened.

This is expected for unsigned apps. The only way to remove these warnings permanently is to sign and notarize the app. Let the maintainer know if you are interested in supporting this.

### Linux: AppImage Won't Run

Ensure you have FUSE installed:

```bash
# Ubuntu/Debian
sudo apt install fuse libfuse2

# Fedora
sudo dnf install fuse fuse-libs
```

## Updates

Shoebox includes automatic update checking. When a new version is available, you'll see a notification in the app.

## Uninstallation

### macOS
Drag Shoebox from Applications to Trash

### Windows
Use Add/Remove Programs in Settings

### Linux
Delete the AppImage file

Note: User data and archives are stored separately and won't be deleted. Archive location varies by platform:

- **macOS**: `~/Library/Application Support/shoebox/`
- **Windows**: `%APPDATA%/shoebox/`
- **Linux**: `~/.config/shoebox/`

## Next Steps

After installation, proceed to [Getting Started](./getting-started.md) to learn the basics.
