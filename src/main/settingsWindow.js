'use strict';

const path = require('path');
const { BrowserWindow } = require('electron');

const PRELOAD_PATH = path.join(__dirname, '..', 'preload', 'settings-preload.js');
const HTML_PATH = path.join(__dirname, '..', 'renderer', 'settings', 'settings.html');
const REPORTED_CONSOLE_LEVELS = ['warning', 'error'];

let win = null;

function logRendererProblems(webContents) {
  webContents.on('console-message', ({ level, message, lineNumber, sourceId }) => {
    if (REPORTED_CONSOLE_LEVELS.includes(level)) {
      console.log(`[settings] ${message} (${sourceId}:${lineNumber})`);
    }
  });
}

function focusExisting() {
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function open() {
  if (win && !win.isDestroyed()) {
    focusExisting();
    return win;
  }

  win = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 720,
    minHeight: 480,
    title: 'Overlet',
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: process.argv.includes('--dev'),
    },
  });

  win.loadFile(HTML_PATH);
  if (process.argv.includes('--dev')) logRendererProblems(win.webContents);
  win.on('closed', () => {
    win = null;
  });
  return win;
}

function isSender(webContents) {
  return Boolean(win) && !win.isDestroyed() && win.webContents === webContents;
}

function broadcast(channel, payload) {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

module.exports = { broadcast, isSender, open };
