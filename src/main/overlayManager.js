'use strict';

const path = require('path');
const { BrowserWindow, screen } = require('electron');
const config = require('./config');

const windows = new Map();
const saveTimers = new Map();
let hidden = false;
let dragging = false;
let dragTimer = null;

const OVERLAY_PRELOAD = path.join(__dirname, '..', 'preload', 'overlay-preload.js');
const OVERLAY_HTML = path.join(__dirname, '..', 'renderer', 'overlay', 'overlay.html');

function createWindow(item) {
  const win = new BrowserWindow({
    x: Math.round(item.x),
    y: Math.round(item.y),
    width: Math.round(item.width),
    height: Math.round(item.height),
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
      preload: OVERLAY_PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');

  win.loadFile(OVERLAY_HTML);

  if (process.argv.includes('--dev')) {
    win.webContents.on('console-message', (_e, level, msg) =>
      console.log(`[overlay:${item.name}] ${msg}`)
    );
    win.webContents.on('render-process-gone', (_e, d) =>
      console.log(`[overlay:${item.name}] gone: ${d.reason}`)
    );
    console.log(`[main] overlay window created for "${item.name}"`);
  }

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('overlay:init', { item });
    applyMouseMode(win, item);
    if (!hidden) win.showInactive();
  });

  win.on('closed', () => {
    windows.delete(item.id);
  });

  windows.set(item.id, win);
  return win;
}

function scheduleSave(id, patch) {
  clearTimeout(saveTimers.get(id));
  saveTimers.set(
    id,
    setTimeout(() => {
      config.upsertItem(Object.assign({ id }, patch));
      saveTimers.delete(id);
    }, 250)
  );
}

function applyMouseMode(win, item) {
  if (win.isDestroyed()) return;
  win.setIgnoreMouseEvents(!!item.clickThrough, { forward: true });
  win.setSkipTaskbar(true);
  win.setAlwaysOnTop(true, 'screen-saver');
}

function sync() {
  const cfg = config.load();
  const enabled = new Map(
    cfg.items.filter((it) => it.enabled && it.src).map((it) => [it.id, it])
  );

  for (const [id, win] of windows) {
    if (!enabled.has(id)) {
      if (!win.isDestroyed()) win.close();
      windows.delete(id);
    }
  }

  for (const [id, item] of enabled) {
    const win = windows.get(id);
    if (!win || win.isDestroyed()) {
      createWindow(item);
    } else {
      const b = win.getBounds();
      if (
        b.x !== Math.round(item.x) ||
        b.y !== Math.round(item.y) ||
        b.width !== Math.round(item.width) ||
        b.height !== Math.round(item.height)
      ) {
        win.setBounds({
          x: Math.round(item.x),
          y: Math.round(item.y),
          width: Math.round(item.width),
          height: Math.round(item.height),
        });
      }
      win.webContents.send('overlay:update', { item });
      applyMouseMode(win, item);
    }
  }
}

function setAllClickThrough(value) {
  const cfg = config.load();
  for (const it of cfg.items) {
    config.upsertItem({ id: it.id, clickThrough: !!value });
  }
  sync();
}

function anyInteractive() {
  return config
    .load()
    .items.some((it) => it.enabled && it.src && !it.clickThrough);
}

function snapBounds(b, threshold) {
  const disp = screen.getDisplayNearestPoint({
    x: b.x + Math.round(b.width / 2),
    y: b.y + Math.round(b.height / 2),
  });
  const wa = disp.workArea;
  let x = b.x;
  let y = b.y;

  if (Math.abs(x - wa.x) <= threshold) x = wa.x;
  else if (Math.abs(x + b.width - (wa.x + wa.width)) <= threshold)
    x = wa.x + wa.width - b.width;

  if (Math.abs(y - wa.y) <= threshold) y = wa.y;
  else if (Math.abs(y + b.height - (wa.y + wa.height)) <= threshold)
    y = wa.y + wa.height - b.height;

  return { x, y, width: b.width, height: b.height };
}

function moveItemToDisplay(id, displayId) {
  const disp = screen.getAllDisplays().find((d) => d.id === displayId);
  const item = config.getItem(id);
  if (!disp || !item) return;
  const wa = disp.workArea;
  const x = Math.round(wa.x + (wa.width - item.width) / 2);
  const y = Math.round(wa.y + (wa.height - item.height) / 2);
  config.upsertItem({ id, x, y });
  sync();
}

function idForWin(win) {
  for (const [id, w] of windows) if (w === win) return id;
  return null;
}

function beginDrag(win) {
  if (!win || win.isDestroyed()) return;
  const item = config.getItem(idForWin(win));
  if (!item || item.locked || item.clickThrough) return;
  const start = screen.getCursorScreenPoint();
  const b = win.getBounds();
  const offX = start.x - b.x;
  const offY = start.y - b.y;
  dragging = true;
  clearInterval(dragTimer);
  dragTimer = setInterval(() => {
    if (win.isDestroyed()) return endDrag(win);
    const p = screen.getCursorScreenPoint();
    win.setBounds({
      x: p.x - offX,
      y: p.y - offY,
      width: b.width,
      height: b.height,
    });
  }, 8);
}

function endDrag(win) {
  clearInterval(dragTimer);
  dragTimer = null;
  dragging = false;
  if (!win || win.isDestroyed()) return;
  let b = win.getBounds();
  const g = config.load().globals;
  if (g.snapToEdges) {
    const s = snapBounds(b, g.snapThreshold || 16);
    if (s.x !== b.x || s.y !== b.y) {
      win.setBounds({ x: s.x, y: s.y, width: b.width, height: b.height });
      b = win.getBounds();
    }
  }
  const id = idForWin(win);
  if (id) scheduleSave(id, { x: b.x, y: b.y, width: b.width, height: b.height });
}

function resizeStep(win, dir) {
  if (!win || win.isDestroyed()) return;
  const id = idForWin(win);
  const item = config.getItem(id);
  if (!item || item.locked) return;
  const factor = dir === 'up' ? 1.06 : 1 / 1.06;
  const b = win.getBounds();
  const nw = Math.max(40, Math.min(4000, Math.round(b.width * factor)));
  const nh = Math.max(40, Math.min(4000, Math.round(b.height * factor)));
  const nx = Math.round(b.x + (b.width - nw) / 2);
  const ny = Math.round(b.y + (b.height - nh) / 2);
  win.setBounds({ x: nx, y: ny, width: nw, height: nh });
  scheduleSave(id, { x: nx, y: ny, width: nw, height: nh });
}

function setWidth(win, width) {
  if (!win || win.isDestroyed()) return;
  const id = idForWin(win);
  const item = config.getItem(id);
  if (!item) return;
  const b = win.getBounds();
  const ratio = b.width / b.height || 1;
  const nw = Math.max(40, Math.min(4000, Math.round(width)));
  const nh = Math.max(40, Math.round(nw / ratio));
  const nx = Math.round(b.x + (b.width - nw) / 2);
  const ny = Math.round(b.y + (b.height - nh) / 2);
  win.setBounds({ x: nx, y: ny, width: nw, height: nh });
  scheduleSave(id, { x: nx, y: ny, width: nw, height: nh });
}

function applyAspect(win, ratio) {
  if (!win || win.isDestroyed() || !ratio || !isFinite(ratio) || ratio <= 0) {
    return;
  }
  const id = idForWin(win);
  if (!id) return;
  const b = win.getBounds();
  const targetH = Math.max(24, Math.round(b.width / ratio));
  if (Math.abs(targetH - b.height) <= 2) return;
  const ny = Math.round(b.y + (b.height - targetH) / 2);
  win.setBounds({ x: b.x, y: ny, width: b.width, height: targetH });
  scheduleSave(id, { x: b.x, y: ny, width: b.width, height: targetH });
}

function centerOnCurrentDisplay(win) {
  if (!win || win.isDestroyed()) return;
  const id = idForWin(win);
  if (!id) return;
  const disp = screen.getDisplayMatching(win.getBounds());
  moveItemToDisplay(id, disp.id);
}

function setHidden(v) {
  hidden = !!v;
  for (const [, win] of windows) {
    if (win.isDestroyed()) continue;
    if (hidden) win.hide();
    else win.showInactive();
  }
  return hidden;
}

function toggleHidden() {
  return setHidden(!hidden);
}

function isHidden() {
  return hidden;
}

function closeAll() {
  for (const [, win] of windows) {
    if (!win.isDestroyed()) win.destroy();
  }
  windows.clear();
}

module.exports = {
  sync,
  closeAll,
  idForWin,
  moveItemToDisplay,
  setAllClickThrough,
  anyInteractive,
  resizeStep,
  setWidth,
  applyAspect,
  centerOnCurrentDisplay,
  setHidden,
  toggleHidden,
  isHidden,
  beginDrag,
  endDrag,
};
