// Window-state memory: size, position and maximized flag survive restarts.
// Saved bounds are validated against the *current* display layout so a window
// last used on a detached monitor never opens off-screen.

const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = { width: 1920, height: 1080, isMaximized: false };
const MIN = { width: 1600, height: 900 };

function stateFile(userDataDir) {
  return path.join(userDataDir, 'window-state.json');
}

function load(userDataDir, screen) {
  let saved = null;
  try {
    saved = JSON.parse(fs.readFileSync(stateFile(userDataDir), 'utf8'));
  } catch { /* first run / corrupt file → defaults */ }

  const state = { ...DEFAULTS, ...(saved ?? {}) };
  state.width = Math.max(MIN.width, state.width | 0);
  state.height = Math.max(MIN.height, state.height | 0);

  // Multi-monitor sanity: keep the saved position only if it still lands on a
  // connected display (≥50% of the top strip visible so the title bar is grabbable).
  if (Number.isFinite(state.x) && Number.isFinite(state.y)) {
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      const overlapX = Math.min(state.x + state.width, a.x + a.width) - Math.max(state.x, a.x);
      const onTop = state.y >= a.y - 16 && state.y < a.y + a.height - 64;
      return overlapX > state.width * 0.5 && onTop;
    });
    if (!visible) { delete state.x; delete state.y; }
  } else {
    delete state.x; delete state.y;
  }

  // Shrink to fit the primary work area if the saved size no longer fits.
  const wa = screen.getPrimaryDisplay().workArea;
  if (state.width > wa.width) state.width = Math.max(MIN.width, wa.width);
  if (state.height > wa.height) state.height = Math.max(MIN.height, wa.height);

  return state;
}

/** Attach debounced persistence to a BrowserWindow. */
function track(win, userDataDir) {
  let timer = null;

  const snapshot = () => {
    const isMaximized = win.isMaximized();
    // Persist the *normal* bounds so un-maximizing restores the real size.
    const b = isMaximized ? win.getNormalBounds() : win.getBounds();
    return { x: b.x, y: b.y, width: b.width, height: b.height, isMaximized };
  };

  const save = () => {
    try {
      fs.writeFileSync(stateFile(userDataDir), JSON.stringify(snapshot()));
    } catch { /* non-fatal */ }
  };
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 400);
  };

  win.on('resize', debounced);
  win.on('move', debounced);
  win.on('maximize', debounced);
  win.on('unmaximize', debounced);
  win.once('close', save);
}

module.exports = { load, track, MIN, DEFAULTS };
