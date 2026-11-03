'use strict';

const path = require('path');
const { Menu, Tray, nativeImage } = require('electron');

const overlay = require('./overlayManager');
const settingsWindow = require('./settingsWindow');

const ICON_PATH = path.join(__dirname, '..', 'assets', 'icon.png');
const ICON_SIZE = 16;

let tray = null;
let actions = null;

function createIcon() {
  return nativeImage
    .createFromPath(ICON_PATH)
    .resize({ width: ICON_SIZE, height: ICON_SIZE });
}

function refresh() {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Add widget…', click: () => actions.addWidgetsFromDialog() },
      { label: 'Open Settings', click: () => settingsWindow.open() },
      { type: 'separator' },
      {
        label: 'Make all widgets interactive',
        click: () => actions.setAllClickThrough(false),
      },
      {
        label: 'Make all click-through',
        click: () => actions.setAllClickThrough(true),
      },
      { type: 'separator' },
      {
        label: 'Hide all widgets',
        type: 'checkbox',
        checked: overlay.isHidden(),
        click: () => actions.toggleHidden(),
      },
      { type: 'separator' },
      { label: 'Quit', click: () => actions.quit() },
    ])
  );
}

function create(appActions) {
  actions = appActions;
  tray = new Tray(createIcon());
  tray.setToolTip('Overlet');
  tray.on('double-click', () => settingsWindow.open());
  refresh();
}

module.exports = { create, refresh };
