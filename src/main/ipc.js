'use strict';

const { BrowserWindow, app, ipcMain, screen } = require('electron');

const actions = require('./actions');
const config = require('./config');
const hotkeys = require('./hotkeys');
const media = require('./media');
const overlay = require('./overlayManager');
const { DOCK_OPTIONS } = require('./placement');
const settingsWindow = require('./settingsWindow');
const tray = require('./tray');
const widgetMenu = require('./widgetMenu');

const MANUAL_PLACEMENT_KEYS = ['x', 'y', 'width', 'height'];

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function describeDisplays() {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((display, index) => {
    const primary = display.id === primaryId;
    const { width, height } = display.size;
    return {
      id: display.id,
      primary,
      label: `Monitor ${index + 1}${primary ? ' (primary)' : ''} · ${width}×${height}`,
      bounds: display.bounds,
      workArea: display.workArea,
    };
  });
}

function setGlobals(patch = {}) {
  const globals = config.setGlobals(patch);
  if (hasOwn(patch, 'startWithWindows')) actions.applyStartup(globals.startWithWindows);
  if (hasOwn(patch, 'hotkeys')) hotkeys.register();
  tray.refresh();
  return globals;
}

async function pickFile({ multi = false } = {}) {
  const title = multi ? 'Import media files' : 'Choose an image, GIF, or video';
  const files = await media.pickFiles({ title, multi });
  if (!files) return null;
  return multi ? files : files[0];
}

function undockOnManualPlacement(patch) {
  const isManual = MANUAL_PLACEMENT_KEYS.some((key) => hasOwn(patch, key));
  if (!patch.id || !isManual || hasOwn(patch, 'dock')) return patch;
  return { ...patch, dock: null, thickness: null };
}

function handleFromSettings(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!settingsWindow.isSender(event.sender)) throw new Error(`Rejected ${channel}`);
    return handler(...args);
  });
}

function registerSettingsHandlers() {
  handleFromSettings('app:version', () => app.getVersion());
  handleFromSettings('config:get', () => config.load());
  handleFromSettings('globals:set', (patch) => setGlobals(patch));
  handleFromSettings('hotkeys:failures', () => hotkeys.getFailures());
  handleFromSettings('displays:get', () => describeDisplays());
  handleFromSettings('placement:options', () => DOCK_OPTIONS);
  handleFromSettings('files:describe', (filePaths = []) => media.describeFiles(filePaths));

  handleFromSettings('item:pickFile', (options) => pickFile(options));
  handleFromSettings('item:upsert', (patch = {}) => {
    const item = config.upsertItem(undockOnManualPlacement(patch));
    overlay.sync();
    return item;
  });
  handleFromSettings('item:remove', (id) => {
    config.removeItem(id);
    overlay.sync();
    return true;
  });
  handleFromSettings('item:setDock', (id, dock) => {
    overlay.setDock(id, dock);
    return config.getItem(id);
  });
  handleFromSettings('item:moveToDisplay', (id, displayId) => {
    overlay.moveItemToDisplay(id, displayId);
    return true;
  });

  handleFromSettings('overlay:getHidden', () => overlay.isHidden());
  handleFromSettings('overlay:setHidden', (value) => {
    actions.setHidden(value);
    return overlay.isHidden();
  });
  handleFromSettings('overlay:setAllClickThrough', (value) => {
    actions.setAllClickThrough(value);
    return true;
  });
}

function onOverlay(channel, handler) {
  ipcMain.on(channel, (event, ...args) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && overlay.idForWin(win)) handler(win, ...args);
  });
}

function registerOverlayHandlers() {
  onOverlay('overlay:dragStart', overlay.beginDrag);
  onOverlay('overlay:dragEnd', overlay.endDrag);
  onOverlay('overlay:wheel', overlay.resizeStep);
  onOverlay('overlay:aspect', overlay.applyAspect);
  onOverlay('overlay:contextMenu', widgetMenu.show);
}

function register() {
  registerSettingsHandlers();
  registerOverlayHandlers();
}

module.exports = { register };
