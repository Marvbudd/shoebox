# Dependency Maintenance Notes

Verified 2026-10-14 with Yarn 4.17.1 and Electron 44.7.2 on Ubuntu (Linux x64). Re-verify anything that looks stale before relying on it.

## Layout

- Two workspaces, each with its own manifest and lockfile:
  - Root (`package.json`, `yarn.lock`): build tooling, Vite/Vue, VitePress, electron-builder.
  - `app/` (`app/package.json`, `app/yarn.lock`): runtime dependencies that ship in the packaged app.
- Update both. `resolutions` apply per manifest, so add one in whichever workspace needs it.
- Yarn is pinned by `.yarnrc.yml` (`yarnPath: .yarn/releases/yarn-4.17.1.cjs`) with `nodeLinker: node-modules`. The download cache is `~/.yarn/berry/cache`.

## Do not let install scripts run on this machine

Any `yarn install` or `yarn up` that changes the dependency tree triggers the root `postinstall` (`electron-builder install-app-deps`). Here it fails and **deletes `app/node_modules/canvas/build/Release/canvas.node`**, which breaks face detection on the next launch.

- electron-builder rebuilds `canvas` with `runtime=napi target=<electron version>`. No prebuilt binary exists for that target, so it falls back to compiling from source.
- Compiling needs the pixman, Cairo, Pango and librsvg development packages, which are not installed here. CI installs them in `releaseBuild.yml`, so CI is unaffected.

Safe workflow:

1. Edit versions in the manifest(s) by hand. `yarn up` also runs the scripts, and it rewrote `"electron": "^41.10.3"` to `"^41"`.
2. Run `yarn install --mode=skip-build` in `app/`, then in the root.
3. Confirm `canvas` still loads (see below).

If the binary is missing, restore it from the prebuilt N-API package (no system libraries needed):

```bash
cd app && yarn rebuild canvas
```

## Verification snippets

Run from `app/`. Canvas under Electron's runtime:

```bash
ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron -e "const c=require('canvas');const v=c.createCanvas(10,10);console.log('canvas OK',v.toBuffer('image/png').length)"
```

Face-detection stack (loads the models and runs detection; save as `.facecheck.cjs` in `app/`, run with `ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron ./.facecheck.cjs`, then delete it):

```js
const path = require('path');
const canvas = require('canvas');
const faceapi = require('face-api.js');
faceapi.env.monkeyPatch({ Canvas: canvas.Canvas, Image: canvas.Image, ImageData: canvas.ImageData });
(async () => {
  const dir = path.resolve('models');
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(dir);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(dir);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(dir);
  const cv = canvas.createCanvas(64, 64);
  cv.getContext('2d').fillRect(0, 0, 64, 64);
  console.log('face-api OK, detections:', (await faceapi.detectAllFaces(cv)).length);
})().catch(e => { console.log('FAIL:', e.message); process.exit(1); });
```

Packaging without publishing or rebuilding native modules (output goes to `/tmp`, delete it afterwards). Check that `app.asar.unpacked/node_modules/canvas/build/Release/canvas.node` exists in the output.

```bash
yarn build:vue
npx electron-builder --dir --publish never -c.npmRebuild=false -c.directories.output=/tmp/pkg-test
```

Never run `yarn dist`, `yarn dist:dir` or `yarn deploy` locally for testing: all three pass `--publish always`.

## Finding and checking updates

| Task | Command |
|------|---------|
| Outdated direct deps | `npm outdated --json` in the root and in `app/` (`yarn outdated` does not exist in Yarn 4) |
| Security advisories | `yarn npm audit --all --recursive` in the root and in `app/`; entries marked `(deprecation)` are notices, not CVEs |
| Why is it installed | `yarn why <package>` |
| Pull Dependabot merges | `git stash push -m "<what>" && git pull --ff-only origin main && git stash pop` |

Dependabot PRs only touch manifests and lockfiles. Past stash-pop conflicts were limited to version lines in `package.json`: keep the newer version, then re-run the install.

## Resolutions

| Workspace | Resolution | Why it exists |
|-----------|-----------|---------------|
| root | `node-fetch ^2.7.0` | `@tensorflow/tfjs-core@1.7.0` (via `face-api.js`) pins `~2.1.2`, which has a high-severity advisory. 2.7.0 passes the face-api smoke test above. |
| root | `undici 7.30.0` | `node-gyp@12.4.0` asks for `^6.25.0`; `@electron/get` asks for `^7.24.4`. |
| root | `minimatch ^10.2.5` | `@electron/asar`, `@electron/universal`, `dir-compare`, `filelist` and `glob@7` ask for `^3` through `^9`. |
| root | `node-abi 4.35.0` | `prebuild-install@7.1.3` asks for `^3.3.0`. 4.35.0 knows the ABIs for Electron 41 to 44 (added in 4.0.2 for Electron 41). |
| `app/` | `node-fetch ^2.7.0` | Same `tfjs-core` pin as above. |

Tested by removal: dropping root `undici` and `minimatch` kept the audit clean but split the tree (undici 6.29.0 beside 7.30.0; minimatch 3.1.5, 5.1.9, 9.0.9 and 10.x). They are kept to hold a single version, and can be removed if that does not matter.

Removed as redundant on 2026-10-14, because every dependent's range already accepts the patched version: `http-cache-semantics` and `source-map-js` (root); `http-cache-semantics`, `undici` and `minimatch` (`app/`).

To check whether a resolution is still needed:

1. Read each dependent's declared range for the package from `node_modules/**/package.json`.
2. If all ranges accept the patched version, the resolution is redundant.
3. Confirm by removing it, running `yarn install --mode=skip-build`, then checking `yarn why <package>` and the audit. Restore from git if the tree changes.

## Known open items

- **`sprintf-js` 1.1.3** (moderate, denial of service): 1.1.3 is the latest published release and is itself in the vulnerable range, so there is nothing to upgrade to. It appears in the root lockfile only, via `@electron/get` → `global-agent` → `roarr`. Re-check when `roarr` or `global-agent` publish an update.
- **Electron 44** (upgraded from 41 on 2026-10-14; Electron supports only the latest three majors, <https://www.electronjs.org/docs/latest/tutorial/electron-timelines>, so plan the next bump when 45 ships). Verified locally on Linux: `canvas` and the face smoke test pass, the Vue build passes, and an unpacked package builds. Not yet verified: the full running app, and the Windows and macOS CI builds. Things that changed on the way from 41:
  - Electron 42+ no longer downloads its binary on install. It downloads on first run of `./node_modules/.bin/electron`, so the first `yarn start` or smoke test is slow and needs network.
  - Electron 43+ opens `dialog.showOpenDialog` in Downloads when no `defaultPath` is given, and the OS no longer remembers the last folder. Three dialogs still pass none: the directory picker in `accessionsHandlers.js` and the two "Select Source Archive" pickers in `main.js`.
  - Electron 44 requires macOS 13 or later and publishes 64-bit builds only.
  - `.github/dependabot.yml` still ignores Electron major bumps, with a comment saying 41+ is incompatible with `node-abi` in CI. Revisit once the CI builds on 44 pass.
- **Squirrel was removed.** The Windows target is `nsis`, and `electron-builder-squirrel-windows` is only loaded for a Squirrel target. `app-builder-lib` lists it as a peer dependency, so Yarn shows one extra peer warning, and `yarn.lock` still contains that peer record. Linux packaging was verified without it; the Windows and macOS CI builds have not yet run without it.
