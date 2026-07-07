// Splash bridge: receive boot-stage updates from main.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('splash', {
  onStage: (cb) => ipcRenderer.on('boot:stage', (_e, msg) => cb(String(msg))),
});
