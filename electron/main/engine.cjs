// Market-engine supervisor.
//
// Owns the bundled Python backend (FastAPI/uvicorn on 127.0.0.1:8000):
//   pre-flight  →  spawn  →  health gate  →  supervise (restart w/ backoff)  →  tree-kill on quit
//
// Dev  (app not packaged): spawns `python -m uvicorn api.server:app` from the repo root.
// Prod (packaged):         spawns the PyInstaller-frozen engine from resources/engine/.
//
// The renderer never talks to this module — it keeps its own 4s WebSocket
// retry loop, so as long as the engine process is alive (or comes back),
// market data reconnects by itself.

const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = 8000;
const BASE = `http://${HOST}:${PORT}`;

const HEALTH_TIMEOUT_MS = 60_000;   // max wait for first /api/health
const HEALTH_POLL_MS = 400;
const MAX_RESTARTS = 5;             // supervised restarts before giving up

let child = null;
let stopping = false;
let external = false;               // an already-running engine we adopted (dev)
let restarts = 0;
let log = console;

function init(logger) {
  log = logger;
}

// ---------------------------------------------------------------- helpers --
function httpGetJson(pathname, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}${pathname}`, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function isHealthy() {
  try {
    const r = await httpGetJson('/api/health');
    return r.status === 200 && r.body.includes('true');
  } catch {
    return false;
  }
}

function isPortTaken() {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(800);
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('timeout', () => { sock.destroy(); resolve(false); });
    sock.once('error', () => resolve(false));
    sock.connect(PORT, HOST);
  });
}

// ------------------------------------------------------------ spawn logic --
function engineCommand({ isPackaged, resourcesPath, repoRoot }) {
  if (isPackaged) {
    // PyInstaller onedir output shipped in resources/engine (Phase C).
    const exe = process.platform === 'win32' ? 'volara-engine.exe' : 'volara-engine';
    const bin = path.join(resourcesPath, 'engine', exe);
    return { cmd: bin, args: [], cwd: path.dirname(bin) };
  }
  // Dev: run the backend from source with the local Python.
  const python = process.env.VOLARA_PYTHON ||
    (process.platform === 'win32' ? 'python' : 'python3');
  return {
    cmd: python,
    args: ['-m', 'uvicorn', 'api.server:app', '--host', HOST, '--port', String(PORT), '--log-level', 'warning'],
    cwd: repoRoot,
  };
}

function spawnEngine(opts, engineLogPath) {
  const { cmd, args, cwd } = engineCommand(opts);
  log.info(`[engine] spawning: ${cmd} ${args.join(' ')} (cwd=${cwd})`);

  const out = fs.createWriteStream(engineLogPath, { flags: 'a' });
  out.write(`\n===== engine start ${new Date().toISOString()} =====\n`);

  const proc = spawn(cmd, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    // Own process group on POSIX so we can kill the whole tree with -pid.
    detached: process.platform !== 'win32',
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });
  proc.stdout.pipe(out);
  proc.stderr.pipe(out);
  return proc;
}

function superviseExit(opts, engineLogPath, onUnexpectedExit) {
  if (!child) return;
  child.once('exit', (code, signal) => {
    const c = child;
    child = null;
    if (stopping) return;
    log.warn(`[engine] exited unexpectedly (code=${code} signal=${signal})`);
    if (restarts >= MAX_RESTARTS) {
      log.error('[engine] restart limit reached — giving up');
      onUnexpectedExit?.('gave-up');
      return;
    }
    restarts += 1;
    const delay = Math.min(30_000, 1000 * 2 ** restarts);
    log.info(`[engine] restart ${restarts}/${MAX_RESTARTS} in ${delay}ms`);
    setTimeout(() => {
      if (stopping) return;
      child = spawnEngine(opts, engineLogPath);
      superviseExit(opts, engineLogPath, onUnexpectedExit);
      onUnexpectedExit?.('restarted');
    }, delay);
    void c;
  });
}

// ------------------------------------------------------------- public API --
/**
 * Pre-flight + spawn + health gate.
 * Resolves { ok:true, external } once /api/health responds, or
 * { ok:false, reason: 'port-conflict' | 'spawn-failed' | 'health-timeout' }.
 */
async function start(opts, engineLogPath, onUnexpectedExit) {
  stopping = false;

  // Pre-flight: adopt a healthy engine that's already running (dev workflow);
  // refuse to fight a foreign process for the port.
  if (await isHealthy()) {
    log.info('[engine] adopting already-running engine on :8000');
    external = true;
    return { ok: true, external: true };
  }
  if (await isPortTaken()) {
    log.error('[engine] port 8000 is taken by a non-Volara process');
    return { ok: false, reason: 'port-conflict' };
  }

  try {
    child = spawnEngine(opts, engineLogPath);
  } catch (err) {
    log.error(`[engine] spawn failed: ${err}`);
    return { ok: false, reason: 'spawn-failed' };
  }

  // Fail fast if the process dies during boot (missing deps, bad exe…).
  let bootExited = false;
  child.once('exit', () => { bootExited = true; });
  child.once('error', (err) => { log.error(`[engine] process error: ${err}`); bootExited = true; });

  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (bootExited) return { ok: false, reason: 'spawn-failed' };
    if (await isHealthy()) {
      child.removeAllListeners('exit');
      superviseExit(opts, engineLogPath, onUnexpectedExit);
      log.info('[engine] healthy');
      return { ok: true, external: false };
    }
    await new Promise((r) => setTimeout(r, HEALTH_POLL_MS));
  }
  log.error('[engine] health check timed out');
  await stop(2000);
  return { ok: false, reason: 'health-timeout' };
}

/** Best-effort wait for the first full snapshot (splash stage 3). */
async function waitFirstSnapshot(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await httpGetJson('/api/snapshot', 8000);
      if (r.status === 200) return true;
    } catch { /* engine still warming up */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  return false; // renderer boots on demo data and upgrades when ready
}

/** Graceful tree-kill: TERM, then KILL after graceMs. Never kills adopted engines. */
function stop(graceMs = 3000) {
  stopping = true;
  if (!child || external) return Promise.resolve();
  const proc = child;
  child = null;

  return new Promise((resolve) => {
    const done = () => { clearTimeout(hardTimer); resolve(); };
    proc.once('exit', done);

    try {
      if (process.platform === 'win32') {
        // taskkill /T takes the whole tree down (uvicorn + any workers).
        spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true });
      } else {
        process.kill(-proc.pid, 'SIGTERM'); // negative pid = process group
      }
    } catch { resolve(); return; }

    const hardTimer = setTimeout(() => {
      try {
        if (process.platform !== 'win32') process.kill(-proc.pid, 'SIGKILL');
        else proc.kill('SIGKILL');
      } catch { /* already gone */ }
      resolve();
    }, graceMs);
  });
}

module.exports = { init, start, stop, waitFirstSnapshot, isHealthy, PORT, HOST, BASE };
