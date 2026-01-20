# Optional: Bundle Documentation for Offline Use

By default, the Help menu opens online documentation at `https://marvbudd.github.io/shoebox/`.

If you want to bundle the documentation with the application for offline use, follow these steps:

## Step 1: Build the Documentation

```bash
yarn docs:build
```

This generates static HTML in `docs/.vitepress/dist/`

## Step 2: Update package.json

Add a `files` property to the `build` section:

```json
"build": {
  "appId": "com.gmail.marvbudd.shoebox",
  "files": [
    "app/**/*",
    "docs/.vitepress/dist/**/*"
  ],
  "dmg": {
    // ... rest of config
```

## Step 3: Update menuTemplates.js

Replace the `shell.openExternal()` calls with local file paths:

```javascript
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In Help menu:
{
  label: '&Documentation',
  click: () => {
    import('electron').then(({ shell }) => {
      // Open local docs instead of online URL
      const docsPath = path.join(__dirname, '../../docs/.vitepress/dist/index.html');
      shell.openPath(docsPath);
    });
  }
},
{
  label: '&Keyboard Shortcuts',
  click: () => {
    import('electron').then(({ shell }) => {
      const shortcutsPath = path.join(__dirname, '../../docs/.vitepress/dist/guide/keyboard-shortcuts.html');
      shell.openPath(shortcutsPath);
    });
  }
}
```

## Tradeoffs

**Online Documentation (Current):**
- ✅ Smaller build size
- ✅ Always up-to-date
- ✅ No rebuild needed for doc updates
- ❌ Requires internet connection

**Offline Documentation:**
- ✅ Works without internet
- ✅ Bundled with application
- ❌ Larger build size (~5-10 MB additional)
- ❌ Requires app rebuild to update docs

## Recommendation

Keep the current online approach unless you need offline functionality. The online docs update automatically via GitHub Pages without requiring app rebuilds.
