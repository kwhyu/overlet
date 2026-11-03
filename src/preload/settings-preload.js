'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getVersion: () => ipcRenderer.invoke('app:version'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setGlobals: (patch) => ipcRenderer.invoke('globals:set', patch),
  getHotkeyFailures: () => ipcRenderer.invoke('hotkeys:failures'),
  upsertItem: (patch) => ipcRenderer.invoke('item:upsert', patch),
  removeItem: (id) => ipcRenderer.invoke('item:remove', id),
  pickFile: () => ipcRenderer.invoke('item:pickFile'),
  pickFiles: () => ipcRenderer.invoke('item:pickFile', { multi: true }),
  describeDroppedFiles: (files) =>
    ipcRenderer.invoke('files:describe', files.map((file) => webUtils.getPathForFile(file))),
  getDisplays: () => ipcRenderer.invoke('displays:get'),
  getDockOptions: () => ipcRenderer.invoke('placement:options'),
  setDock: (id, dock) => ipcRenderer.invoke('item:setDock', id, dock),
  moveToDisplay: (id, displayId) =>
    ipcRenderer.invoke('item:moveToDisplay', id, displayId),
  setHidden: (v) => ipcRenderer.invoke('overlay:setHidden', v),
  getHidden: () => ipcRenderer.invoke('overlay:getHidden'),
  setAllClickThrough: (v) => ipcRenderer.invoke('overlay:setAllClickThrough', v),
  onConfigChanged: (cb) => ipcRenderer.on('config:changed', (_e, cfg) => cb(cfg)),
  onItemChanged: (cb) => ipcRenderer.on('item:changed', (_e, item) => cb(item)),
  onHiddenChanged: (cb) => ipcRenderer.on('overlay:hidden', (_e, v) => cb(v)),
  onSelectItem: (cb) => ipcRenderer.on('select:item', (_e, id) => cb(id)),
});
