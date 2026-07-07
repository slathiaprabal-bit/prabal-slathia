// Minimal, security-first bridge. The renderer is the untouched web app — it
// needs nothing from Node to function, so we expose only read-only app info
// and a native-notification passthrough for future features.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('volara', {
  /** { name, version, platform } — for About screens / diagnostics. */
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  /** Native OS notification (title, body). */
  notify: (title, body) => ipcRenderer.send('app:notify', { title: String(title), body: String(body) }),
  isDesktop: true,
});
