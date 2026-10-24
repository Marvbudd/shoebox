#!/bin/bash
# Safe dependency setup: installs without running install scripts, then verifies canvas.
# Usage: yarn setup
# Why: a plain `yarn install` runs electron-builder's postinstall, which rebuilds canvas
# from source and can delete app/node_modules/canvas/build/Release/canvas.node.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CANVAS_NODE="$ROOT/app/node_modules/canvas/build/Release/canvas.node"

check_canvas() {
  (cd "$ROOT/app" && ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron -e \
    "const c=require('canvas');const v=c.createCanvas(10,10);if(!v.toBuffer('image/png').length)process.exit(1)") >/dev/null 2>&1
}

echo "==> Node $(node -v), Yarn $(yarn -v)"

echo "==> Installing app/ dependencies (install scripts skipped)"
(cd "$ROOT/app" && yarn install --mode=skip-build)

echo "==> Installing root dependencies (install scripts skipped)"
(cd "$ROOT" && yarn install --mode=skip-build)

echo "==> Verifying canvas under Electron"
if ! check_canvas; then
  echo "canvas failed to load (binary present: $([ -f "$CANVAS_NODE" ] && echo yes || echo no)); running 'yarn rebuild canvas'"
  (cd "$ROOT/app" && yarn rebuild canvas)
  if ! check_canvas; then
    echo "ERROR: canvas still does not load. Install libcairo2-dev libpango1.0-dev librsvg2-dev libpixman-1-dev and retry." >&2
    exit 1
  fi
fi

echo "==> Setup OK. Run 'yarn build:vue' if window code changed, then 'yarn start'."
