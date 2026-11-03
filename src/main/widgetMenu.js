'use strict';

const { Menu } = require('electron');

const actions = require('./actions');
const config = require('./config');
const overlay = require('./overlayManager');
const { DOCK_OPTIONS } = require('./placement');
const settingsWindow = require('./settingsWindow');

const WIDTH_PRESETS = [
  { label: 'Small (160 px wide)', width: 160 },
  { label: 'Medium (320 px wide)', width: 320 },
  { label: 'Large (480 px wide)', width: 480 },
];
const OPACITY_PRESETS = [100, 90, 75, 50, 25];

function sizeSubmenu(win) {
  return [
    { label: 'Bigger  (scroll up)', click: () => overlay.resizeStep(win, 'up') },
    { label: 'Smaller  (scroll down)', click: () => overlay.resizeStep(win, 'down') },
    { type: 'separator' },
    ...WIDTH_PRESETS.map(({ label, width }) => ({
      label,
      click: () => overlay.setWidth(win, width),
    })),
  ];
}

function opacitySubmenu(item) {
  return OPACITY_PRESETS.map((percent) => ({
    label: `${percent}%`,
    type: 'radio',
    checked: Math.round(item.opacity * 100) === percent,
    click: () => actions.patchItem(item.id, { opacity: percent / 100 }),
  }));
}

function itemToggle(item, label, key) {
  return {
    label,
    type: 'checkbox',
    checked: item[key],
    click: () => actions.patchItem(item.id, { [key]: !item[key] }),
  };
}

function positionSubmenu(win, item) {
  return [
    ...DOCK_OPTIONS.map(({ id, label }) => ({
      label,
      type: 'radio',
      checked: item.dock === id,
      click: () => actions.setDock(item.id, id),
    })),
    { type: 'separator' },
    itemToggle(item, 'Cover the taskbar', 'coverTaskbar'),
    {
      label: 'Center on this monitor',
      click: () => overlay.centerOnCurrentDisplay(win),
    },
  ];
}

function snapToggle() {
  const { snapToEdges } = config.load().globals;
  return {
    label: 'Snap to edges',
    type: 'checkbox',
    checked: Boolean(snapToEdges),
    click: () => {
      config.setGlobals({ snapToEdges: !snapToEdges });
      actions.broadcastConfig();
    },
  };
}

function openItemSettings(id) {
  const win = settingsWindow.open();
  settingsWindow.broadcast('select:item', id);
  win.focus();
}

function buildTemplate(win, item) {
  return [
    { label: item.name, enabled: false },
    { type: 'separator' },
    { label: 'Size', submenu: sizeSubmenu(win) },
    { label: 'Opacity', submenu: opacitySubmenu(item) },
    { label: 'Position', submenu: positionSubmenu(win, item) },
    { type: 'separator' },
    itemToggle(item, 'Flip horizontally', 'flipX'),
    itemToggle(item, 'Lock position', 'locked'),
    itemToggle(item, 'Click-through', 'clickThrough'),
    snapToggle(),
    { type: 'separator' },
    { label: 'Widget settings…', click: () => openItemSettings(item.id) },
    {
      label: 'Hide this widget',
      click: () => actions.patchItem(item.id, { enabled: false }),
    },
    { type: 'separator' },
    { label: 'Add widget…', click: () => actions.addWidgetsFromDialog() },
    {
      label: 'Make all interactive',
      click: () => actions.setAllClickThrough(false),
    },
    { label: 'Open Manager', click: () => settingsWindow.open() },
    { label: 'Quit app', click: () => actions.quit() },
  ];
}

function show(win) {
  if (!win || win.isDestroyed()) return;
  const item = config.getItem(overlay.idForWin(win));
  if (!item) return;
  Menu.buildFromTemplate(buildTemplate(win, item)).popup({ window: win });
}

module.exports = { show };
