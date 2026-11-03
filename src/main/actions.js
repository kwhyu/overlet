'use strict';

const path = require('path');
const { app, dialog } = require('electron');

const config = require('./config');
const media = require('./media');
const overlay = require('./overlayManager');
const settingsWindow = require('./settingsWindow');
const tray = require('./tray');

const NEW_WIDGET_ORIGIN = { x: 320, y: 240 };
const NEW_WIDGET_OFFSET = 40;
const NEW_WIDGET_SIZE = 320;

function applyStartup(enabled) {
  const launchArgs = app.isPackaged ? ['--hidden'] : [app.getAppPath(), '--hidden'];
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    path: process.execPath,
    args: launchArgs,
  });
}

function broadcastConfig() {
  settingsWindow.broadcast('config:changed', config.load());
}

function setAllClickThrough(value) {
  overlay.setAllClickThrough(value);
  broadcastConfig();
}

function toggleClickThroughAll() {
  setAllClickThrough(overlay.anyInteractive());
}

function setHidden(value) {
  overlay.setHidden(value);
  tray.refresh();
  settingsWindow.broadcast('overlay:hidden', overlay.isHidden());
}

function toggleHidden() {
  setHidden(!overlay.isHidden());
}

function patchItem(id, patch) {
  config.upsertItem({ id, ...patch });
  overlay.sync();
  broadcastConfig();
}

function setDock(id, dock) {
  overlay.setDock(id, dock);
  broadcastConfig();
}

function handleDisplayChange() {
  overlay.rescueOffscreen();
  overlay.sync();
  broadcastConfig();
}

function reportDamagedConfig() {
  const backupPath = config.takeDamagedBackupPath();
  if (!backupPath) return;
  dialog.showMessageBox({
    type: 'warning',
    title: 'Overlet',
    message: 'Your settings file could not be read.',
    detail: `Overlet started with default settings. The old file was kept as ${path.basename(backupPath)} in ${path.dirname(backupPath)}.`,
  });
}

async function addWidgetsFromDialog() {
  const files = await media.pickFiles({ title: 'Add widgets', multi: true });
  if (!files) return;

  files.forEach(({ filePath, type }, index) => {
    config.upsertItem({
      name: media.baseName(filePath) || 'Widget',
      src: filePath,
      type,
      enabled: true,
      x: NEW_WIDGET_ORIGIN.x + index * NEW_WIDGET_OFFSET,
      y: NEW_WIDGET_ORIGIN.y + index * NEW_WIDGET_OFFSET,
      width: NEW_WIDGET_SIZE,
      height: NEW_WIDGET_SIZE,
      clickThrough: false,
    });
  });
  overlay.sync();
  broadcastConfig();
}

function quit() {
  overlay.closeAll();
  app.quit();
}

module.exports = {
  addWidgetsFromDialog,
  applyStartup,
  broadcastConfig,
  handleDisplayChange,
  patchItem,
  quit,
  reportDamagedConfig,
  setAllClickThrough,
  setDock,
  setHidden,
  toggleClickThroughAll,
  toggleHidden,
};
