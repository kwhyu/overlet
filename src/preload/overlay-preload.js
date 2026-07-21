'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  onInit: (cb) => ipcRenderer.on('overlay:init', (_e, data) => cb(data)),
  onUpdate: (cb) => ipcRenderer.on('overlay:update', (_e, data) => cb(data)),
  dragStart: () => ipcRenderer.send('overlay:dragStart'),
  dragEnd: () => ipcRenderer.send('overlay:dragEnd'),
  contextMenu: () => ipcRenderer.send('overlay:contextMenu'),
  wheel: (dir) => ipcRenderer.send('overlay:wheel', dir),
  reportAspect: (ratio) => ipcRenderer.send('overlay:aspect', ratio),
});
