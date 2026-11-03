'use strict';

const path = require('path');
const { BrowserWindow, screen } = require('electron');

const config = require('./config');
const placement = require('./placement');
const settingsWindow = require('./settingsWindow');

const PRELOAD_PATH = path.join(__dirname, '..', 'preload', 'overlay-preload.js');
const HTML_PATH = path.join(__dirname, '..', 'renderer', 'overlay', 'overlay.html');

const ALWAYS_ON_TOP_LEVEL = 'screen-saver';
const SAVE_DELAY_MS = 250;
const DRAG_POLL_MS = 8;
const RESIZE_FACTOR = 1.06;
const ASPECT_TOLERANCE = 2;
const UNDOCKED_WIDTH = 320;

const { MIN_SIZE, clampSize } = placement;

const windows = new Map();
const pendingSaves = new Map();
const mediaRatios = new Map();
let hidden = false;
let dragTimer = null;
let dragOrigin = null;

const isAlive = (win) => Boolean(win) && !win.isDestroyed();
const isDev = process.argv.includes('--dev');

function boundsOf(item) {
  return {
    x: Math.round(item.x),
    y: Math.round(item.y),
    width: Math.round(item.width),
    height: Math.round(item.height),
  };
}

function sameBounds(a, b) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function centerPoint({ x, y, width, height }) {
  return { x: Math.round(x + width / 2), y: Math.round(y + height / 2) };
}

function centeredIn(area, width, height) {
  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
  };
}

function ratioOf(item) {
  return mediaRatios.get(item.id) || item.width / item.height;
}

function dockArea(item) {
  const display = screen.getDisplayNearestPoint(centerPoint(item));
  return item.coverTaskbar ? display.bounds : display.workArea;
}

function logOverlayActivity(webContents, name) {
  webContents.on('console-message', ({ message }) => {
    console.log(`[overlay:${name}] ${message}`);
  });
  webContents.on('render-process-gone', (_event, details) => {
    console.log(`[overlay:${name}] gone: ${details.reason}`);
  });
  console.log(`[main] overlay window created for "${name}"`);
}

function applyMouseMode(win, item) {
  if (win.isDestroyed()) return;
  win.setIgnoreMouseEvents(item.clickThrough, { forward: true });
  win.setSkipTaskbar(true);
  win.setAlwaysOnTop(true, ALWAYS_ON_TOP_LEVEL);
}

function createWindow(item) {
  const win = new BrowserWindow({
    ...boundsOf(item),
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    focusable: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: isDev,
    },
  });

  win.setAlwaysOnTop(true, ALWAYS_ON_TOP_LEVEL);
  win.loadFile(HTML_PATH);
  if (isDev) logOverlayActivity(win.webContents, item.name);

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('overlay:init', { item });
    applyMouseMode(win, item);
    if (!hidden) win.showInactive();
  });
  win.on('closed', () => {
    if (windows.get(item.id) === win) windows.delete(item.id);
  });

  windows.set(item.id, win);
}

function updateWindow(win, item) {
  const target = boundsOf(item);
  if (!sameBounds(win.getBounds(), target)) win.setBounds(target);
  win.webContents.send('overlay:update', { item });
  applyMouseMode(win, item);
}

function commitSave(id, fields) {
  const item = config.upsertItem({ id, ...fields });
  if (item) settingsWindow.broadcast('item:changed', item);
}

function scheduleSave(id, fields) {
  const pending = pendingSaves.get(id);
  if (pending) clearTimeout(pending.timer);
  const merged = { ...(pending && pending.fields), ...fields };
  const timer = setTimeout(() => {
    pendingSaves.delete(id);
    commitSave(id, merged);
  }, SAVE_DELAY_MS);
  pendingSaves.set(id, { timer, fields: merged });
}

function flushSaves() {
  for (const [id, { timer, fields }] of pendingSaves) {
    clearTimeout(timer);
    pendingSaves.delete(id);
    commitSave(id, fields);
  }
}

function applyDocks() {
  for (const item of config.load().items) {
    if (!item.dock) continue;
    const target = placement.dockBounds(item, dockArea(item), ratioOf(item));
    if (!sameBounds(boundsOf(item), target)) config.upsertItem({ id: item.id, ...target });
  }
}

function sync() {
  flushSaves();
  applyDocks();

  const enabledItems = new Map(
    config
      .load()
      .items.filter((item) => item.enabled && item.src)
      .map((item) => [item.id, item])
  );

  for (const [id, win] of windows) {
    if (enabledItems.has(id)) continue;
    if (!win.isDestroyed()) win.close();
    windows.delete(id);
    mediaRatios.delete(id);
  }

  for (const [id, item] of enabledItems) {
    const win = windows.get(id);
    if (isAlive(win)) {
      updateWindow(win, item);
    } else {
      createWindow(item);
    }
  }
}

function idForWin(win) {
  for (const [id, candidate] of windows) {
    if (candidate === win) return id;
  }
  return null;
}

function applyAndSave(win, id, bounds, extraFields) {
  win.setBounds(bounds);
  scheduleSave(id, { ...bounds, ...extraFields });
}

function resizedAround(current, width, height) {
  return {
    x: Math.round(current.x + (current.width - width) / 2),
    y: Math.round(current.y + (current.height - height) / 2),
    width,
    height,
  };
}

function setAllClickThrough(value) {
  config.patchAllItems({ clickThrough: Boolean(value) });
  sync();
}

function anyInteractive() {
  return config.load().items.some((item) => item.enabled && item.src && !item.clickThrough);
}

function setDock(id, dock) {
  flushSaves();
  const item = config.getItem(id);
  if (!item) return;

  const patch = { id, dock: dock || null, thickness: null };
  if (placement.isStretching(item.dock) && !placement.isStretching(dock)) {
    const width = UNDOCKED_WIDTH;
    const height = clampSize(width / ratioOf(item));
    const display = screen.getDisplayNearestPoint(centerPoint(item));
    Object.assign(patch, { width, height }, centeredIn(display.workArea, width, height));
  }
  config.upsertItem(patch);
  sync();
}

function overlapsDisplay(item, { bounds }) {
  const overlapX = Math.min(item.x + item.width, bounds.x + bounds.width) - Math.max(item.x, bounds.x);
  const overlapY = Math.min(item.y + item.height, bounds.y + bounds.height) - Math.max(item.y, bounds.y);
  return overlapX >= MIN_SIZE && overlapY >= MIN_SIZE;
}

function rescueOffscreen() {
  const displays = screen.getAllDisplays();
  const { workArea } = screen.getPrimaryDisplay();
  for (const item of config.load().items) {
    if (item.dock || displays.some((display) => overlapsDisplay(item, display))) continue;
    config.upsertItem({ id: item.id, ...centeredIn(workArea, item.width, item.height) });
  }
}

function snapAxis(position, size, areaStart, areaSize, threshold) {
  const areaEnd = areaStart + areaSize;
  if (Math.abs(position - areaStart) <= threshold) return areaStart;
  if (Math.abs(position + size - areaEnd) <= threshold) return areaEnd - size;
  return position;
}

function snapBounds(bounds, threshold) {
  const { workArea } = screen.getDisplayNearestPoint(centerPoint(bounds));
  return {
    ...bounds,
    x: snapAxis(bounds.x, bounds.width, workArea.x, workArea.width, threshold),
    y: snapAxis(bounds.y, bounds.height, workArea.y, workArea.height, threshold),
  };
}

function moveItemToDisplay(id, displayId) {
  flushSaves();
  const display = screen.getAllDisplays().find((candidate) => candidate.id === displayId);
  const item = config.getItem(id);
  if (!display || !item) return;

  const position = item.dock
    ? placement.dockBounds(
        item,
        item.coverTaskbar ? display.bounds : display.workArea,
        ratioOf(item)
      )
    : centeredIn(display.workArea, item.width, item.height);
  config.upsertItem({ id, ...position });
  sync();
}

function centerOnCurrentDisplay(win) {
  if (!isAlive(win)) return;
  const id = idForWin(win);
  if (!id) return;
  setDock(id, null);
  moveItemToDisplay(id, screen.getDisplayMatching(win.getBounds()).id);
}

function beginDrag(win) {
  if (!isAlive(win)) return;
  const item = config.getItem(idForWin(win));
  if (!item || item.locked || item.clickThrough) return;

  const cursor = screen.getCursorScreenPoint();
  const { x, y, width, height } = win.getBounds();
  const offsetX = cursor.x - x;
  const offsetY = cursor.y - y;
  dragOrigin = { x, y, width, height };

  clearInterval(dragTimer);
  dragTimer = setInterval(() => {
    if (win.isDestroyed()) {
      endDrag(win);
      return;
    }
    const point = screen.getCursorScreenPoint();
    win.setBounds({ x: point.x - offsetX, y: point.y - offsetY, width, height });
  }, DRAG_POLL_MS);
}

function endDrag(win) {
  clearInterval(dragTimer);
  dragTimer = null;
  const origin = dragOrigin;
  dragOrigin = null;
  if (!origin || !isAlive(win)) return;

  const moved = win.getBounds();
  if (sameBounds(moved, origin)) return;

  const { snapToEdges, snapThreshold } = config.load().globals;
  const bounds = snapToEdges ? snapBounds(moved, snapThreshold) : moved;
  applyAndSave(win, idForWin(win), bounds, { dock: null, thickness: null });
}

function resizeDocked(win, item, current, factor) {
  if (item.dock === 'fill') return;
  const resized = placement.isStrip(item.dock)
    ? { ...item, thickness: clampSize(placement.thicknessOf(item.dock, current) * factor) }
    : {
        ...item,
        width: clampSize(current.width * factor),
        height: clampSize(current.height * factor),
      };
  const bounds = placement.dockBounds(resized, dockArea(item), ratioOf(item));
  applyAndSave(win, item.id, bounds, { thickness: resized.thickness });
}

function resizeStep(win, direction) {
  if (!isAlive(win)) return;
  const id = idForWin(win);
  const item = config.getItem(id);
  if (!item || item.locked) return;

  const factor = direction === 'up' ? RESIZE_FACTOR : 1 / RESIZE_FACTOR;
  const current = win.getBounds();
  if (item.dock) {
    resizeDocked(win, item, current, factor);
    return;
  }
  const width = clampSize(current.width * factor);
  const height = clampSize(current.height * factor);
  applyAndSave(win, id, resizedAround(current, width, height));
}

function setWidth(win, targetWidth) {
  if (!isAlive(win)) return;
  const id = idForWin(win);
  if (!config.getItem(id)) return;

  const current = win.getBounds();
  const ratio = current.width / current.height || 1;
  const width = clampSize(targetWidth);
  const height = clampSize(width / ratio);
  applyAndSave(win, id, resizedAround(current, width, height), { dock: null, thickness: null });
}

function applyAspect(win, ratio) {
  if (!isAlive(win) || !Number.isFinite(ratio) || ratio <= 0) return;
  const id = idForWin(win);
  const item = config.getItem(id);
  if (!item) return;

  mediaRatios.set(id, ratio);
  if (item.dock) {
    sync();
    return;
  }

  const current = win.getBounds();
  const height = clampSize(current.width / ratio);
  if (Math.abs(height - current.height) <= ASPECT_TOLERANCE) return;
  applyAndSave(win, id, resizedAround(current, current.width, height));
}

function setHidden(value) {
  hidden = Boolean(value);
  for (const win of windows.values()) {
    if (win.isDestroyed()) continue;
    if (hidden) {
      win.hide();
    } else {
      win.showInactive();
    }
  }
}

function isHidden() {
  return hidden;
}

function closeAll() {
  flushSaves();
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.destroy();
  }
  windows.clear();
}

module.exports = {
  anyInteractive,
  applyAspect,
  beginDrag,
  centerOnCurrentDisplay,
  closeAll,
  endDrag,
  flushSaves,
  idForWin,
  isHidden,
  moveItemToDisplay,
  rescueOffscreen,
  resizeStep,
  setAllClickThrough,
  setDock,
  setHidden,
  setWidth,
  sync,
};
