// Application menu + keyboard shortcuts. With the hidden title bar the menu is
// not drawn, but registering it keeps every accelerator (zoom, full screen,
// reload, DevTools-in-dev, quit) active — the professional-terminal defaults.

const { Menu, app, dialog, nativeImage, shell } = require('electron');

function showAbout(iconPng) {
  dialog.showMessageBox({
    type: 'none',
    icon: iconPng ? nativeImage.createFromPath(iconPng) : undefined,
    title: 'About PS Terminal',
    message: 'PS Terminal',
    detail: [
      'Quantitative Trading Systems',
      '',
      `Version ${app.getVersion()}`,
      '',
      'Developed by Prabal Slathia',
      '',
      'Powered by Electron · Python · FastAPI · React · Three.js',
      '',
      `© ${new Date().getFullYear()} Prabal Slathia. All rights reserved.`,
    ].join('\n'),
    buttons: ['OK'],
    noLink: true,
  });
}

function buildMenu({ isDev, logsDir, iconPng }) {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit', label: 'Quit PS Terminal' },
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
          label: 'About PS Terminal',
          click: () => showAbout(iconPng),
        },
        {
          label: 'Open Logs Folder',
          click: () => shell.openPath(logsDir),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu, showAbout };
