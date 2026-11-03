'use strict';

const { Menu, app, screen } = require('electron');

const actions = require('./actions');
const config = require('./config');
const hotkeys = require('./hotkeys');
const ipc = require('./ipc');
const overlay = require('./overlayManager');
const security = require('./security');
const settingsWindow = require('./settingsWindow');
const tray = require('./tray');

function keepRunningInTray() {}

function watchDisplays() {
  screen.on('display-removed', actions.handleDisplayChange);
  screen.on('display-metrics-changed', actions.handleDisplayChange);
}

function onReady() {
  security.denyPermissions();
  Menu.setApplicationMenu(null);

  const { globals } = config.load();
  actions.applyStartup(globals.startWithWindows);

  ipc.register();
  tray.create(actions);
  hotkeys.register();
  overlay.rescueOffscreen();
  overlay.sync();
  watchDisplays();

  const launchedHidden = process.argv.includes('--hidden');
  if (globals.openSettingsOnLaunch && !launchedHidden) {
    settingsWindow.open();
  }
  actions.reportDamagedConfig();
}

function start() {
  security.lockDownWebContents();
  app.on('second-instance', () => settingsWindow.open());
  app.on('window-all-closed', keepRunningInTray);
  app.on('before-quit', () => overlay.flushSaves());
  app.on('will-quit', () => hotkeys.unregisterAll());
  app.whenReady().then(onReady);
}

if (app.requestSingleInstanceLock()) {
  start();
} else {
  app.quit();
}
