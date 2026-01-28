# Slideshow Mode

Turn Shoebox into a digital photo frame for displaying your family archive.

## Overview

Slideshow mode automatically cycles through photos in your archive, transforming your screen into a dynamic display of memories. Perfect for family gatherings, personal enjoyment, or leaving on display like a traditional photo frame.

## Getting Started

### Basic Usage

1. **Select Detail format** (optional): Double click in the Media Detail pane
2. **Start Slideshow**: Press **Space**
3. **Enjoy**: Photos will auto-advance every 5 seconds

The slideshow:
- Automatically enters **Photo Frame Mode** (hides UI for full-screen display)
- Shows only photos (skips videos and audio)
- Loops continuously through your collection
- Preserves your metadata display preference

### Stopping

- **Space**: Pause/Resume slideshow
- **Escape**: Exit photo frame mode completely
- **↑ Up / ↓ Down**: Stop and return to manual navigation

## Controls

### Speed Adjustment

Control how long each photo displays:

- **← Left**: Decrease speed (faster cycling)
- **→ Right**: Increase speed (slower cycling)
- Range: 1-30 seconds per photo
- Default: 5 seconds

::: tip Finding Your Speed
Start with the default 5 seconds. For quick browsing, try 2-3 seconds. For contemplative viewing or displays, use 10-15 seconds.
:::

### Direction

- **Backspace**: Reverse direction
  - **Forward** (→): Follows sort order top-to-bottom
  - **Backward** (←): Follows sort order bottom-to-top

### Playback Mode

- **Ctrl+Shift+R**: Toggle Random/Sequential
  - **Sequential**: Follows your current sort order (Date, Person, etc.)
  - **Random**: Picks photos randomly, avoiding recently shown items

::: info Random Mode
Random mode tracks visited photos to avoid repetition until all have been shown. Once the collection is exhausted, it resets and starts over with a fresh shuffle.
:::

## Photo Frame Mode

When you start a slideshow, Shoebox enters **Photo Frame Mode**:

- Navigation column hidden
- Header bar hidden
- Photo expands to full window
- Face tags automatically hidden
- Metadata display optional (your preference)

### Metadata Display

Before starting your slideshow, choose how much metadata to show:

- **Double click**: In the Media Detail pane to select
- **Collapsed**: Shows Description, people, location, date
- **Expanded**: Show link, collections, accession, Edit Media button etc

Your choice persists throughout the slideshow.

## Visual Indicators

A subtle overlay in the top-right shows slideshow status:

- **▶**: Playing forward
- **◀**: Playing backward
- **🔀**: Random mode enabled
- **⏸**: Paused (window lost focus)
- **5s**: Current speed

### Keyboard Shortcuts Tooltip

When you first enter photo frame mode, a tooltip displays available controls. It fades after a few seconds but can be recalled if needed.

## Auto-Pause

The slideshow intelligently pauses when:

- Window loses focus (you switch to another app)
- Computer goes to sleep

It automatically resumes when:

- Window regains focus
- Computer wakes up

::: tip Screen Saver
On some systems, slideshows may prevent screen savers from activating. If using as a photo frame overnight, check your power/display settings.
:::

## Use Cases

### Family Gatherings

1. Connect laptop to TV
2. Filter to recent events (use **Sort** control at bottom of window for Date)
3. Start slideshow (**Space**)
4. Set comfortable speed (8-10 seconds)
5. Enable random mode (**Ctrl+Shift+R**) for variety

### Daily Photo Frame

1. Create a collection of favorites (see [Collections](./collections.md))
2. Load the collection
3. Start slideshow
4. Set slow speed (15-20 seconds)
5. Use sequential mode for familiar rotation

### Quick Archive Review

1. Sort by new items (use **Sort** control at bottom of window for Date)
2. Start slideshow
3. Fast speed (2-3 seconds)
4. Sequential mode to catch every photo
5. Stop (↓) when you see something interesting

### Presentations

1. Create a collection for your presentation topic
2. Sort appropriately (use **Sort** control at bottom of window)
3. Start slideshow
4. Set presentation speed (6-8 seconds)
5. Use sequential for predictable flow

## Tips & Tricks

### Combining with Filters

Before starting a slideshow:

1. **Apply filters** to narrow selection
   - **Choose Collection**: To limit the show to only items in a collection
   - **Limit**: Select Limit to only show items in the selected collection
   
2. **Choose sort order**
   - Use the **Sort** dropdown at the bottom of the window for sequential mode

The slideshow respects these settings.

### Multi-Monitor Setup

Drag Shoebox to your secondary monitor before starting the slideshow for a dedicated display while you work on the primary screen.

### Creating Themed Slideshows

1. Create a **Collection** for your theme (birthdays, vacations, etc.)
2. Load that collection
3. Start slideshow

See [Collections](./collections.md) for how to create and manage them.

**Pro Tip**: Create multiple collections for different moods or occasions, then switch between them for instant themed slideshows. Great for holidays, birthdays, or specific family members!

## Troubleshooting

### Slideshow Won't Start

- **Check filters**: Press **Ctrl+Shift+P/A/V** or use the Photo/Audio/Video checkboxes to filter
- **Verify selection**: At least one photo must be in the current view
- **Window focus**: Click on the Shoebox window first

### Photos Not Advancing

- **Check speed**: Speed may be set very high (30s). Press **←** to decrease.
- **Random exhaustion**: If in random mode with small collection, might seem stuck. Press **Ctrl+Shift+R** to switch to sequential.
- **Window blur**: Check if window lost focus (indicator shows ⏸). Click window to resume.

### Slideshow Exits Unexpectedly

- Pressing **↑** or **↓** stops the slideshow and returns to manual navigation
- **Escape** exits photo frame mode
- Both are intentional behaviors for quick exit

Have ideas? [Open an issue](https://github.com/Marvbudd/shoebox/issues) on GitHub!

## Related Features

- [Keyboard Shortcuts](../guide/keyboard-shortcuts.md) - Complete shortcut reference
- [Collections](./collections.md) - Create themed photo sets
- [Metadata](./metadata.md) - Rich context for your photos
