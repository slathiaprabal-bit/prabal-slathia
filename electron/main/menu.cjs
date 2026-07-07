// Application menu + keyboard shortcuts. With the hidden title bar the menu is
// not drawn, but registering it keeps every accelerator (zoom, full screen,
// reload, DevTools-in-dev, quit) active — the professional-terminal defaults.

const { Menu, app, dialog, shell } = require('electron');
const path = require('node:path');

function buildMenu({ isDev, logsDir }) {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit', label: 'Quit VOLARA' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev ? [{ role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About VOLARA',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About VOLARA',
              message: 'VOLARA Quant Terminal',
              detail: `Version ${app.getVersion()}\nInstitutional volatility & risk terminal.`,
              buttons: ['OK'],
            });
          },
        },
        {
          label: 'Open Logs Folder',
          click: () => shell.openPath(logsDir),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  void path;
}

module.exports = { buildMenu };
