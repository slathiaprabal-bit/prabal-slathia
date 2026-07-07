// Production logging for startup + crash diagnostics.
// electron-log writes to  <userData>/logs/main.log  with rotation; if the
// dependency is ever missing we degrade to console so the app still boots.

let log;
try {
  log = require('electron-log/main');
  log.initialize();
  log.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB rotation
  log.transports.file.level = 'info';
  log.transports.console.level = process.env.NODE_ENV === 'production' ? false : 'info';
} catch {
  log = console;
  log.info = console.log;
  log.warn = console.warn;
  log.error = console.error;
}

/** Wire process-level crash diagnostics. Call once from main. */
function installCrashHandlers(app, dialog) {
  process.on('uncaughtException', (err) => {
    log.error('[crash] uncaughtException:', err?.stack || err);
    try {
      dialog.showErrorBox('PS Terminal — Unexpected Error',
        `An unexpected error occurred and was written to the log.\n\n${err?.message ?? err}`);
    } catch { /* dialog may be unavailable pre-ready */ }
  });
  process.on('unhandledRejection', (reason) => {
    log.error('[crash] unhandledRejection:', reason);
  });
  app.on('child-process-gone', (_e, details) => {
    log.error('[crash] child-process-gone:', JSON.stringify(details));
  });
  app.on('render-process-gone', (_e, _wc, details) => {
    log.error('[crash] render-process-gone:', JSON.stringify(details));
  });
}

module.exports = { log, installCrashHandlers };
