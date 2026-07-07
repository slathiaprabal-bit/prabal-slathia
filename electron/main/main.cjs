// VOLARA desktop shell — Electron main process.
//
// Boot sequence (each stage mirrored on the splash screen):
//   single-instance lock → splash → spawn market engine → health gate →
//   first snapshot → main window (splash closes when the dashboard paints).
//
// The renderer is the UNTOUCHED web build: all desktop concerns (engine
// lifecycle, window chrome, state memory, logging, crash handling) live here.

const { app, BrowserWindow, dialog, ipcMain, Notification, net, protocol, screen, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const { log, installCrashHandlers } = require('./logger.cjs');
const winState = require('./window-state.cjs');
const engine = require('./engine.cjs');
const { buildMenu } = require('./menu.cjs');

const isDev = !app.isPackaged;
const REPO_ROOT = path.join(__dirname, '..', '..');
const RENDERER_DIRS = [path.join(REPO_ROOT, 'dist-desktop'), path.join(REPO_ROOT, 'dist')];

let mainWin = null;
let splashWin = null;

// ------------------------------------------------------- app:// protocol
// The renderer is served over a privileged custom scheme instead of file://.
// A standard+secure scheme gives the SPA a real origin, so ES-module scripts,
// fetch/WebSocket to the local engine, and localStorage all behave exactly as
// they do in a browser. Must be registered before app.whenReady().
const APP_ORIGIN = 'app://volara';
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

function registerAppProtocol(rendererDir) {
  protocol.handle('app', (req) => {
    const url = new URL(req.url);
    let p = decodeURIComponent(url.pathname);
    if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(rendererDir, p));
    if (!file.startsWith(path.normalize(rendererDir))) {
      return new Response('forbidden', { status: 403 }); // path-traversal guard
    }
    return net.fetch(pathToFileURL(file).toString());
  });
}

// ---------------------------------------------------------- single instance
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.show();
      mainWin.focus();
    }
  });

  engine.init(log);
  installCrashHandlers(app, dialog);
  app.whenReady().then(boot).catch((err) => {
    log.error('[boot] fatal:', err);
    dialog.showErrorBox('VOLARA failed to start', String(err?.stack ?? err));
    app.exit(1);
  });
}

// ------------------------------------------------------------------- splash
function createSplash() {
  const win = new BrowserWindow({
    width: 460,
    height: 340,
    frame: false,
    resizable: false,
    maximizable: false,
    show: true,
    center: true,
    backgroundColor: '#0a0a0b',
    title: 'VOLARA',
    webPreferences: {
      preload: path.join(__dirname, '..', 'splash', 'splash-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'splash', 'splash.html'));
  return win;
}

function setStage(msg) {
  log.info(`[boot] ${msg}`);
  if (splashWin && !splashWin.isDestroyed()) {
    splashWin.webContents.send('boot:stage', msg);
  }
}

// -------------------------------------------------------------- main window
function rendererEntry() {
  if (process.env.VOLARA_DEV_URL) return { url: process.env.VOLARA_DEV_URL };
  for (const dir of RENDERER_DIRS) {
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      registerAppProtocol(dir);
      return { url: `${APP_ORIGIN}/index.html` };
    }
  }
  throw new Error('renderer build not found — run `npm run build:desktop` first');
}

// Desktop-only chrome CSS, injected from main so the web codebase stays
// untouched: the top rail becomes the drag region and reserves room on the
// right for the native window-control overlay.
const DESKTOP_CSS = `
  .rail-top { -webkit-app-region: drag; padding-right: 158px !important; }
  .rail-top button, .rail-top select, .rail-top input, .rail-top a { -webkit-app-region: no-drag; }
`;

function createMainWindow() {
  const state = winState.load(app.getPath('userData'), screen);

  mainWin = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: winState.MIN.width,
    minHeight: winState.MIN.height,
    show: false,                     // no white flash — show when ready
    backgroundColor: '#0a0a0b',
    title: 'VOLARA',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0b',
      symbolColor: '#9096a3',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: isDev,
    },
  });

  winState.track(mainWin, app.getPath('userData'));

  // ---- security hardening -------------------------------------------------
  const wc = mainWin.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    // External links go to the OS browser, never to a new Electron window.
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    // The SPA never navigates; block anything that tries to leave app://.
    const devUrl = process.env.VOLARA_DEV_URL;
    if (!url.startsWith(APP_ORIGIN) && !(devUrl && url.startsWith(devUrl))) {
      e.preventDefault();
      log.warn(`[security] blocked navigation to ${url}`);
    }
  });
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(permission === 'notifications');
  });

  wc.on('did-finish-load', () => { wc.insertCSS(DESKTOP_CSS); });

  mainWin.once('ready-to-show', () => {
    if (state.isMaximized) mainWin.maximize();
    mainWin.show();
    if (splashWin && !splashWin.isDestroyed()) splashWin.close();
    splashWin = null;
    if (isDev && process.env.VOLARA_DEVTOOLS === '1') wc.openDevTools({ mode: 'detach' });
  });

  mainWin.on('closed', () => { mainWin = null; });

  mainWin.loadURL(rendererEntry().url);
}

// --------------------------------------------------------------------- boot
async function boot() {
  log.info(`[boot] VOLARA ${app.getVersion()} starting (packaged=${app.isPackaged})`);
  buildMenu({ isDev, logsDir: path.join(app.getPath('userData'), 'logs') });

  splashWin = createSplash();
  setStage('Initializing Market Engine…');

  const engineLog = path.join(app.getPath('userData'), 'logs', 'engine.log');
  fs.mkdirSync(path.dirname(engineLog), { recursive: true });

  const opts = { isPackaged: app.isPackaged, resourcesPath: process.resourcesPath, repoRoot: REPO_ROOT };
  const result = await engine.start(opts, engineLog, (event) => {
    if (event === 'restarted') {
      log.warn('[engine] restarted after unexpected exit');
      new Notification({ title: 'VOLARA', body: 'Market engine restarted — reconnecting…' }).show();
    } else if (event === 'gave-up') {
      log.error('[engine] gave up restarting');
      new Notification({ title: 'VOLARA', body: 'Market engine stopped. Running on demo data.' }).show();
    }
  });

  if (!result.ok) {
    const detail = {
      'port-conflict': 'Port 8000 is in use by another application.\nClose it and relaunch VOLARA.',
      'spawn-failed': 'The market engine failed to launch.\nSee logs (Help → Open Logs Folder) for details.',
      'health-timeout': 'The market engine did not respond in time.\nSee logs for details.',
    }[result.reason] ?? 'Unknown engine error.';

    const choice = dialog.showMessageBoxSync({
      type: 'error',
      title: 'VOLARA — Market Engine',
      message: 'The market engine could not be started.',
      detail: `${detail}\n\nYou can continue in demo mode (no live market data) or quit.`,
      buttons: ['Continue in Demo Mode', 'Quit'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (choice === 1) { app.quit(); return; }
    log.warn('[boot] continuing in demo mode without engine');
  } else {
    setStage('Connecting Market Data…');
    await engine.waitFirstSnapshot(20_000);
  }

  setStage('Loading Volatility Models…');
  createMainWindow();
}

// ---------------------------------------------------------------- lifecycle
let shuttingDown = false;
app.on('before-quit', (e) => {
  if (shuttingDown) return;
  e.preventDefault();
  shuttingDown = true;
  log.info('[shutdown] stopping market engine…');
  engine.stop(3000).finally(() => {
    log.info('[shutdown] engine stopped — bye');
    app.quit();
  });
});

app.on('window-all-closed', () => {
  app.quit(); // desktop terminal semantics: closing the window exits the app
});

// ---------------------------------------------------------------------- IPC
ipcMain.handle('app:info', () => ({
  name: 'VOLARA',
  version: app.getVersion(),
  platform: process.platform,
}));
ipcMain.on('app:notify', (_e, { title, body }) => {
  new Notification({ title, body }).show();
});
