#!/bin/bash
# Build script for Vue windows in Electron app
# Usage: ./scripts/build-vue.sh [window-name]
# Example: ./scripts/build-vue.sh mainWindow

set -e  # Exit on error

# Get window name from argument or environment variable
WINDOW="${1:-${VUE_WINDOW:-mainWindow}}"

echo "Building Vue window: $WINDOW"

# Run Vite build
VUE_WINDOW="$WINDOW" yarn vite build

# Define paths
BUILD_DIR="app/render/vue-dist/$WINDOW"
NESTED_HTML_PATTERNS=(
  "$BUILD_DIR/app/render/vue/windows/$WINDOW/index.html"
  "$BUILD_DIR/app/render/vue/windows/${WINDOW^}/index.html"  # Capitalized
)
TARGET_HTML="$BUILD_DIR/index.html"

# Check if nested structure exists (try different case variations)
NESTED_HTML=""
for pattern in "${NESTED_HTML_PATTERNS[@]}"; do
  if [ -f "$pattern" ]; then
    NESTED_HTML="$pattern"
    break
  fi
done

if [ -n "$NESTED_HTML" ]; then
  echo "Moving index.html from nested directory..."
  mv "$NESTED_HTML" "$TARGET_HTML"
  
  echo "Cleaning up nested directories..."
  rm -rf "$BUILD_DIR/app"
else
  echo "Warning: No nested HTML found, checking if already in correct location..."
  if [ ! -f "$TARGET_HTML" ]; then
    echo "Error: index.html not found anywhere!"
    exit 1
  fi
fi

# Fix asset paths in HTML
if [ -f "$TARGET_HTML" ]; then
  echo "Fixing asset paths..."
  sed -i 's|\.\./\.\./\.\./\.\./\.\./assets/|assets/|g' "$TARGET_HTML"
  sed -i 's|/assets/|assets/|g' "$TARGET_HTML"
  echo "Build complete for $WINDOW"
else
  echo "Error: index.html not found at $TARGET_HTML"
  exit 1
fi
