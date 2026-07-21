'use strict';

const path = require('path');
const { BrowserWindow } = require('electron');

const SETTINGS_PRELOAD = path.join(__dirname, '..', 'preload', 'settings-preload.js');
const SETTINGS_HTML = path.join(__dirname, '..', 'renderer', 'settings', 'settings.html');

let win = null;

function open() {
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    return win;
  }

  win = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 720,
    minHeight: 480,
    title: 'Desktop Mate Wannabe',
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    webPreferences: {
      preload: SETTINGS_PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(SETTINGS_HTML);
  if (process.argv.includes('--dev')) {
    win.webContents.on('console-message', (_e, level, msg, line, src) => {
      if (level >= 2) console.log(`[settings] ${msg} (${src}:${line})`);
    });
  }
  win.on('closed', () => {
    win = null;
  });
  return win;
}

function broadcast(channel, payload) {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

module.exports = { open, broadcast };
