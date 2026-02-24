# Installation

Download and install Shoebox for your operating system.

## System Requirements

- **macOS**: 10.13 (High Sierra) or later
- **Windows**: Windows 10 or later
- **Linux**: Modern distributions with AppImage support

## Important: Unsigned App Security Warnings

Shoebox is currently distributed **without a paid code-signing certificate**. This means your operating system will show security warnings during download or first launch. **This is expected and normal** for unsigned applications.

These warnings appear for **any application without a code-signing certificate**, regardless of safety. Code-signing certificates cost $300-500 annually. If you'd like to support signing/notarizing the app to remove these warnings permanently, let the maintainer know.

The instructions below include steps for handling these warnings on each platform.

---

## Download and Installation

Choose your operating system:

### macOS

**1. Download the latest release**

Get `Shoebox-<version>.dmg` from the [GitHub Releases](https://github.com/Marvbudd/shoebox/releases) page.

**2. Install Shoebox**

1. Open the downloaded DMG file
2. Drag Shoebox to your Applications folder
3. Close the DMG window

**3. Launch Shoebox (with security warning handling)**

When you first try to open Shoebox, macOS Gatekeeper will block it with a message like "Shoebox can't be opened because it is from an unidentified developer."

To proceed:

1. Try to open Shoebox normally from Applications (you'll see the warning)
2. Go to **System Settings** > **Privacy & Security**
3. Scroll down to the Security section
4. You'll see a message about Shoebox being blocked
5. Click **"Open Anyway"**
6. Authenticate with your password when prompted
7. Click **"Open"** in the confirmation dialog

**Alternative method:** Right-click (or Control-click) the Shoebox app and select **"Open"** from the menu, then click **"Open"** in the dialog.

**If you see "App is damaged and can't be opened":**
This is an extended attribute issue. Fix it by running this command in Terminal:
```bash
xattr -cr /Applications/Shoebox.app
```

---

### Windows

**1. Download the latest release**

Get `Shoebox-<version>.exe` from the [GitHub Releases](https://github.com/Marvbudd/shoebox/releases) page.

Your browser may warn "This file is not commonly downloaded." To proceed:

1. Click the **menu button (⋮)** on the warning
2. Select **"Keep"** or **"Keep anyway"**

**2. Install Shoebox (with security warning handling)**

1. Double-click the downloaded `Shoebox-<version>.exe` installer
2. Windows SmartScreen will show: "Windows protected your PC"
   - Click **"More info"**
   - Click **"Run anyway"**
3. If prompted by User Account Control, click **"Yes"**
4. Follow the installation wizard to complete installation

**If Windows Defender blocks the download:**

1. Open **Windows Security** > **Virus & threat protection**
2. Click **"Protection history"**
3. Find the Shoebox entry
4. Click **"Actions"** > **"Allow"**

**Note:** These warnings only appear on first download/install. Once installed, the app will launch normally.

**3. Launch Shoebox**

Launch Shoebox from the Start menu or desktop shortcut. No additional warnings - you're done!

---

### Linux

**1. Download the latest release**

Get `Shoebox-<version>.AppImage` from the [GitHub Releases](https://github.com/Marvbudd/shoebox/releases) page.

Linux doesn't show security warnings for AppImages.

**2. Make it executable**

```bash
chmod +x Shoebox-<version>.AppImage
```

**3. Run Shoebox**

```bash
./Shoebox-<version>.AppImage
```

You can also double-click the AppImage file from your file manager if it's set to allow executing files.

---

## First Launch

When you first start Shoebox:

1. The app will open with a sample archive pre-loaded
2. Explore the interface and features using the sample data
3. When ready to create your own archive, see [Creating Your Archive](./creating-archive.md)

---

## Troubleshooting

### Linux: AppImage Won't Run

Ensure you have FUSE installed:

```bash
# Ubuntu/Debian
sudo apt install fuse libfuse2

# Fedora
sudo dnf install fuse fuse-libs
```

If the AppImage still won't run, check that it's executable:
```bash
chmod +x Shoebox-<version>.AppImage
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
