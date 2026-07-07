# VOLARA Desktop (Electron)

The desktop shell packages the untouched web terminal + Python market engine
into a one-click application. All desktop concerns live in `electron/` — no
UI, engine, or API code is modified.

## Architecture

```
VOLARA (Electron main)
 ├─ splash window      electron/splash/       staged boot status
 ├─ market engine      spawned child process  FastAPI/uvicorn on 127.0.0.1:8000
 │    dev:  python3 -m uvicorn api.server:app
 │    prod: resources/engine/volara-engine(.exe)   (PyInstaller, Phase C)
 ├─ main window        loads the renderer over the privileged app:// scheme
 └─ preload            contextBridge: appInfo + native notifications only
```

- **Renderer build**: `npm run build:desktop` → `dist-desktop/` with relative
  asset paths and the engine URLs baked from `.env.desktop`
  (`http://127.0.0.1:8000`, `ws://127.0.0.1:8000/ws/stream`).
- **Engine supervisor** (`electron/main/engine.cjs`): pre-flight port check
  (adopts an already-running engine, refuses a foreign port squatter), health
  gate, restart with backoff on unexpected exit, graceful tree-kill on quit.
- **Window**: hidden title bar + native overlay controls, drag region injected
  via CSS from main, min 1600×900, default 1920×1080, size/position/maximized
  state remembered per display layout.
- **Security**: contextIsolation + sandbox on, nodeIntegration off, navigation
  locked to `app://`, external links open in the OS browser, permissions
  denied except notifications.
- **Logs**: `<userData>/logs/main.log` (shell) and `engine.log` (backend),
  5 MB rotation. Help → Open Logs Folder.

## Run (dev)

```
npm run desktop        # builds dist-desktop, then launches Electron
npm run desktop:dev    # launch without rebuilding the renderer
```

Requires local Python with `api/requirements.txt` +
`quant_engine/requirements.txt` installed (dev only — the packaged app ships
a frozen engine).

## Build the Windows app (Phase C)

Local (on Windows):

```
pip install -r desktop/engine-requirements.txt
npm run desktop:engine   # PyInstaller → dist/volara-engine/
npm run desktop:dist     # renderer + electron-builder → release/
```

Artifacts in `release/`: **VOLARA Setup <version>.exe** (NSIS wizard:
desktop + Start Menu shortcuts, uninstaller, per-user install) and
**VOLARA <version> Portable.exe**.

CI (`.github/workflows/desktop.yml`): runs the same pipeline on a Windows
runner — freeze engine, smoke-test it (`/api/health` + `/api/snapshot`),
build renderer, package both targets, upload artifacts. Trigger manually
(workflow_dispatch) or push a version tag (`v3.1.0` syncs the app version
automatically and attaches the artifacts to a draft GitHub Release).

Packaging layout: renderer + shell inside `app.asar`; the frozen engine at
`resources/engine/` (spawned with cwd = the per-user data dir so runtime
writes never touch the install dir). Version flows from one place —
`package.json` (or the git tag in CI) — into the installer, About dialog
and splash.
