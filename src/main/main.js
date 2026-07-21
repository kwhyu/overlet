'use strict';

const path = require('path');
const {
  app,
  ipcMain,
  dialog,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  screen,
} = require('electron');

const config = require('./config');
const overlay = require('./overlayManager');
const settingsWindow = require('./settingsWindow');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let tray = null;
let isQuitting = false;

function applyStartup(enabled) {
  app.setLoginItemSettings({
    openAtLogin: !!enabled,
    args: ['--hidden'],
  });
}

function trayIcon() {
  const img = nativeImage.createFromDataURL(TRAY_ICON_DATAURL);
  return img.isEmpty() ? nativeImage.createEmpty() : img;
}

function buildTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('Desktop Mate Wannabe');
  refreshTrayMenu();
  tray.on('double-click', () => settingsWindow.open());
}

function refreshTrayMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: 'Open Settings', click: () => settingsWindow.open() },
    { type: 'separator' },
    {
      label: 'Make all widgets interactive',
      click: () => setAllClickThrough(false),
    },
    {
      label: 'Make all click-through',
      click: () => setAllClickThrough(true),
    },
    { type: 'separator' },
    {
      label: 'Hide all widgets',
      type: 'checkbox',
      checked: overlay.isHidden(),
      click: () => setHidden(!overlay.isHidden()),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => quit() },
  ]);
  tray.setContextMenu(menu);
}

function setAllClickThrough(v) {
  overlay.setAllClickThrough(v);
  settingsWindow.broadcast('config:changed', config.load());
}

function toggleClickThroughAll() {
  setAllClickThrough(overlay.anyInteractive());
}

function setHidden(v) {
  overlay.setHidden(v);
  refreshTrayMenu();
  settingsWindow.broadcast('overlay:hidden', overlay.isHidden());
}

function registerHotkeys() {
  globalShortcut.unregisterAll();
  const hk = config.load().globals.hotkeys || {};
  const bind = (accel, fn) => {
    if (!accel) return;
    try {
      globalShortcut.register(accel, fn);
    } catch (e) {
      console.warn('Failed to register hotkey', accel, e.message);
    }
  };
  bind(hk.toggleClickThrough, () => toggleClickThroughAll());
  bind(hk.toggleHidden, () => setHidden(!overlay.isHidden()));
  bind(hk.openSettings, () => settingsWindow.open());
}

function quit() {
  isQuitting = true;
  overlay.closeAll();
  app.quit();
}

function registerIpc() {
  ipcMain.handle('config:get', () => config.load());

  ipcMain.handle('globals:set', (_e, patch) => {
    const g = config.setGlobals(patch || {});
    if (Object.prototype.hasOwnProperty.call(patch || {}, 'startWithWindows')) {
      applyStartup(g.startWithWindows);
    }
    if (Object.prototype.hasOwnProperty.call(patch || {}, 'hotkeys')) {
      registerHotkeys();
    }
    refreshTrayMenu();
    return g;
  });

  ipcMain.handle('displays:get', () => {
    const primaryId = screen.getPrimaryDisplay().id;
    return screen.getAllDisplays().map((d, i) => ({
      id: d.id,
      primary: d.id === primaryId,
      label: `Monitor ${i + 1}${d.id === primaryId ? ' (primary)' : ''} · ${d.size.width}×${d.size.height}`,
      bounds: d.bounds,
      workArea: d.workArea,
    }));
  });

  ipcMain.handle('item:moveToDisplay', (_e, id, displayId) => {
    overlay.moveItemToDisplay(id, displayId);
    return true;
  });

  ipcMain.handle('overlay:setHidden', (_e, v) => {
    setHidden(v);
    return overlay.isHidden();
  });

  ipcMain.handle('overlay:getHidden', () => overlay.isHidden());

  ipcMain.handle('overlay:setAllClickThrough', (_e, v) => {
    setAllClickThrough(v);
    return true;
  });

  ipcMain.handle('item:upsert', (_e, patch) => {
    const item = config.upsertItem(patch || {});
    overlay.sync();
    return item;
  });

  ipcMain.handle('item:remove', (_e, id) => {
    config.removeItem(id);
    overlay.sync();
    return true;
  });

  ipcMain.handle('item:pickFile', async (_e, opts) => {
    const multi = opts && opts.multi;
    const res = await dialog.showOpenDialog({
      title: multi ? 'Import media files' : 'Choose an image, GIF, or video',
      properties: multi ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: [
        { name: 'Media', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'apng', 'mp4', 'webm', 'ogv'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'apng'] },
        { name: 'Video', extensions: ['mp4', 'webm', 'ogv'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (res.canceled || !res.filePaths.length) return null;
    const files = res.filePaths.map((filePath) => ({
      filePath,
      type: guessType(filePath),
    }));
    return multi ? files : files[0];
  });

  ipcMain.handle('app:openSettings', () => settingsWindow.open());

  const { BrowserWindow } = require('electron');
  ipcMain.on('overlay:dragStart', (e) =>
    overlay.beginDrag(BrowserWindow.fromWebContents(e.sender))
  );
  ipcMain.on('overlay:dragEnd', (e) =>
    overlay.endDrag(BrowserWindow.fromWebContents(e.sender))
  );
  ipcMain.on('overlay:wheel', (e, dir) =>
    overlay.resizeStep(BrowserWindow.fromWebContents(e.sender), dir)
  );
  ipcMain.on('overlay:contextMenu', (e) =>
    showWidgetMenu(BrowserWindow.fromWebContents(e.sender))
  );
  ipcMain.on('overlay:aspect', (e, ratio) =>
    overlay.applyAspect(BrowserWindow.fromWebContents(e.sender), ratio)
  );
}

function showWidgetMenu(win) {
  if (!win || win.isDestroyed()) return;
  const id = overlay.idForWin(win);
  const item = id ? config.getItem(id) : null;
  if (!item) return;

  const g = config.load().globals;

  const patch = (p) => {
    config.upsertItem(Object.assign({ id: item.id }, p));
    overlay.sync();
    settingsWindow.broadcast('config:changed', config.load());
  };

  const opacityItem = (label, value) => ({
    label,
    type: 'radio',
    checked: Math.round((item.opacity ?? 1) * 100) === value,
    click: () => patch({ opacity: value / 100 }),
  });

  const widthItem = (label, px) => ({
    label,
    click: () => overlay.setWidth(win, px),
  });

  const menu = Menu.buildFromTemplate([
    { label: item.name, enabled: false },
    { type: 'separator' },
    {
      label: 'Size',
      submenu: [
        { label: 'Bigger  (scroll up)', click: () => overlay.resizeStep(win, 'up') },
        { label: 'Smaller  (scroll down)', click: () => overlay.resizeStep(win, 'down') },
        { type: 'separator' },
        widthItem('Small (160 px wide)', 160),
        widthItem('Medium (320 px wide)', 320),
        widthItem('Large (480 px wide)', 480),
      ],
    },
    {
      label: 'Opacity',
      submenu: [
        opacityItem('100%', 100),
        opacityItem('90%', 90),
        opacityItem('75%', 75),
        opacityItem('50%', 50),
        opacityItem('25%', 25),
      ],
    },
    {
      label: 'Position',
      submenu: [
        {
          label: 'Center on this monitor',
          click: () => overlay.centerOnCurrentDisplay(win),
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Flip horizontally',
      type: 'checkbox',
      checked: !!item.flipX,
      click: () => patch({ flipX: !item.flipX }),
    },
    {
      label: 'Lock position',
      type: 'checkbox',
      checked: !!item.locked,
      click: () => patch({ locked: !item.locked }),
    },
    {
      label: 'Click-through',
      type: 'checkbox',
      checked: !!item.clickThrough,
      click: () => patch({ clickThrough: !item.clickThrough }),
    },
    {
      label: 'Snap to edges',
      type: 'checkbox',
      checked: !!g.snapToEdges,
      click: () => {
        config.setGlobals({ snapToEdges: !g.snapToEdges });
        settingsWindow.broadcast('config:changed', config.load());
      },
    },
    { type: 'separator' },
    {
      label: 'Widget settings…',
      click: () => {
        const w = settingsWindow.open();
        settingsWindow.broadcast('select:item', item.id);
        if (w) w.focus();
      },
    },
    {
      label: 'Hide this widget',
      click: () => patch({ enabled: false }),
    },
    { type: 'separator' },
    {
      label: 'Add widget…',
      click: async () => {
        const picked = await pickAndAdd();
        if (picked) settingsWindow.broadcast('config:changed', config.load());
      },
    },
    { label: 'Make all interactive', click: () => setAllClickThrough(false) },
    { label: 'Open Manager', click: () => settingsWindow.open() },
    { label: 'Quit app', click: () => quit() },
  ]);
  menu.popup({ window: win });
}

async function pickAndAdd() {
  const res = await dialog.showOpenDialog({
    title: 'Add widgets',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'apng', 'mp4', 'webm', 'ogv'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (res.canceled || !res.filePaths.length) return false;
  res.filePaths.forEach((filePath, i) => {
    const base = filePath.replace(/\\/g, '/').split('/').pop().replace(/\.[^.]+$/, '');
    config.upsertItem({
      name: base || 'Widget',
      src: filePath,
      type: guessType(filePath),
      enabled: true,
      x: 320 + i * 40,
      y: 240 + i * 40,
      width: 320,
      height: 320,
      clickThrough: false,
    });
  });
  overlay.sync();
  return true;
}

function guessType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.mp4', '.webm', '.ogv'].includes(ext)) return 'video';
  if (['.gif', '.apng'].includes(ext)) return 'gif';
  return 'image';
}

app.on('second-instance', () => settingsWindow.open());

app.whenReady().then(() => {
  const cfg = config.load();
  applyStartup(cfg.globals.startWithWindows);

  registerIpc();
  buildTray();
  registerHotkeys();
  overlay.sync();

  const launchedHidden = process.argv.includes('--hidden');
  if (cfg.globals.openSettingsOnLaunch && !launchedHidden) {
    settingsWindow.open();
  }
});

app.on('window-all-closed', (e) => {
  if (!isQuitting) e.preventDefault();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

const TRAY_ICON_DATAURL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAOZJREFUOE+lk7ENwjAQRZ+9AR2ZgIYRGIAJKGEBRoAJoGAERqBhAxpKJqBhAxoWQNZFOXKO4ziRIkX2+f/z2c6Zil0z0eF7oB1oB1oB9qBdqAdaAfagXagHWgH2oF2oB1oB9qBdqAdaAfagXagHWgH2oF2oB1oB9qBdqAdaAfagXagHWgH2oF2oB1oB9qBdqAdaAfagXagHWgH2oF2oB1oB9qBdqAdaAfagXagHWgH2oF2oB1oB9qBdqAdaAfagXagHWgH2oF2oB1oB9qBdqAdaAfagXagHWgH2oF2oB1oB9qBdqAd+ANQhQwR3W3aVwAAAABJRU5ErkJggg==';
