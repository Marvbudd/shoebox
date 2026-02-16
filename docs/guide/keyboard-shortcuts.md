# Keyboard Shortcuts Reference

Comprehensive guide to all keyboard shortcuts available in Shoebox.

## Main Window Navigation

### Help & Documentation
- **F1**: Open documentation website

### Moving Through Your Archive
- **↓ Arrow Down**: Next item in navigation list (shows preview)
- **↑ Arrow Up**: Previous item in navigation list (shows preview)
- **Page Down**: Jump forward 15 items
- **Page Up**: Jump backward 15 items
- **Home**: Jump to first item
- **End**: Jump to last item

::: tip Mouse Navigation
Hover your mouse over any item in the navigation list (left side) to instantly preview it without changing selection. Click to select and view full details.
:::

::: tip
Use **Ctrl+Shift+P/A/V** keyboard shortcuts or the checkboxes at the top of the window to filter by media type. Use the Sort dropdown to change sort order.
:::

### Filter Toggles
- **Ctrl+Shift+P**: Toggle Photos filter
- **Ctrl+Shift+A**: Toggle Audio filter
- **Ctrl+Shift+V**: Toggle Video filter
- **Ctrl+Shift+L**: Toggle Limit to Collection filter
- **Ctrl+Shift+F**: Toggle Face Tags display

## Slideshow Mode (Photo Frame)

Transform Shoebox into a digital photo frame for displaying your archive.

### Starting & Stopping
- **Space**: Start/Stop slideshow
  - Automatically enters photo frame mode
  - Hides navigation column and header
  - Shows photos only (skips audio/video)
  - Default: 5 seconds per photo

### Speed Control
- **← Left Arrow**: Decrease slideshow speed by 1 second (slower = longer per photo, min: 1s, max: 30s)
- **→ Right Arrow**: Increase slideshow speed by 1 second (faster = shorter per photo, min: 1s, max: 30s)

### Navigation Mode
- **Backspace**: Reverse direction (forward ⇄ backward)
- **Ctrl+Shift+R**: Toggle Random/Sequential mode
  - Random: Randomly selects next photo (avoids repetition)
  - Sequential: Follows current sort order
  
### Exit
- **Escape**: Exit photo frame mode (stops slideshow)
- **↑ Up / ↓ Down**: Stop slideshow and resume manual navigation

### Visual Indicators
The slideshow shows an overlay with current status:
- **▶**: Playing forward
- **◀**: Playing backward  
- **🔀**: Random mode active
- **⏸**: Paused (window lost focus)
- **Speed**: Current interval (e.g., "5s")

::: info Auto-Pause
Slideshow automatically pauses when the window loses focus and resumes when you return.
:::

::: tip Metadata Display
Your metadata display mode (shortened/detailed) persists throughout the slideshow. Set it before starting for the best experience.
:::

## Menu Shortcuts

### File Menu
- **Cmd/Ctrl + Q**: Quit Shoebox

### View Menu
- **Cmd/Ctrl + R**: Reload window
- **Cmd/Ctrl + Shift + I**: Toggle Developer Tools
- **Cmd/Ctrl + 0**: Reset Zoom
- **Cmd/Ctrl + =**: Zoom In
- **Cmd/Ctrl + -**: Zoom Out
- **F11** (Win/Linux) or **Cmd + Ctrl + F** (Mac): Toggle Fullscreen

### Window Menu
- **Cmd/Ctrl + M**: Minimize window
- **Cmd/Ctrl + W**: Close window

### Help Menu
- **F1**: Open documentation website

::: tip
Press F1 anytime in the main window to quickly access this documentation online.
:::

::: warning Note About Shortcuts
Keyboard shortcuts only work when the main window is focused. They won't work when typing in input fields or dropdowns.
:::

## Menu Access Keys (Windows/Linux)

Use the **Alt** key + underlined letter to access menus:

- **Alt + F**: File menu
- **Alt + R**: Archive menu
- **Alt + C**: Collections menu
- **Alt + V**: View menu
- **Alt + W**: Window menu
- **Alt + H**: Help menu

Within menus, use the underlined letter to select items:

**File Menu:**
- **A**: Choose Accessions.json file

**Archive Menu:**
- **A**: Add Media Metadata
- **V**: Validate
- **B**: Backup Archive
- **P**: Person Manager
- **E**: Edit Media

**Collections Menu:**
- **C**: Create Collection
- **D**: Delete Collection
- **U**: Update Collection
- **A**: Validate Collection
- **B**: Backup All Collections
- **X**: Export Collection (only visible when collection is active)

**Window Menu:**
- **T**: Family Tree

## Platform Differences

### Cmd vs Ctrl
- **macOS**: Use **Command (⌘)** key
- **Windows/Linux**: Use **Ctrl** key

### Fullscreen Toggle
- **macOS**: **Cmd + Ctrl + F**
- **Windows/Linux**: **F11**

## Tips for Efficient Navigation

1. **Quick Filtering**: Press **Ctrl+Shift+P** (photos only) or use checkboxes, then **Space** to start slideshow
2. **Speed Browsing**: Use **Page Down/Up** to quickly scan through large archives
3. **Person Sort**: When sorting by person, people appear under all their last names (maiden and married) - perfect for finding anyone regardless of how they're known
4. **Targeted Search**: Use the sort dropdown to organize by person, date, location, etc.
5. **Random Discovery**: Start slideshow (**Space**), enable random mode (**Ctrl+Shift+R**), and explore your archive serendipitously

## Customization

Currently, keyboard shortcuts are not user-configurable. If you have suggestions for new shortcuts or remapping, please [open an issue](https://github.com/Marvbudd/shoebox/issues) on GitHub.
