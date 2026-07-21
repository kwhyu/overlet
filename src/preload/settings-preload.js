'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setGlobals: (patch) => ipcRenderer.invoke('globals:set', patch),
  upsertItem: (patch) => ipcRenderer.invoke('item:upsert', patch),
  removeItem: (id) => ipcRenderer.invoke('item:remove', id),
  pickFile: () => ipcRenderer.invoke('item:pickFile'),
  pickFiles: () => ipcRenderer.invoke('item:pickFile', { multi: true }),
  getDisplays: () => ipcRenderer.invoke('displays:get'),
  moveToDisplay: (id, displayId) =>
    ipcRenderer.invoke('item:moveToDisplay', id, displayId),
  setHidden: (v) => ipcRenderer.invoke('overlay:setHidden', v),
  getHidden: () => ipcRenderer.invoke('overlay:getHidden'),
  setAllClickThrough: (v) => ipcRenderer.invoke('overlay:setAllClickThrough', v),
  onConfigChanged: (cb) => ipcRenderer.on('config:changed', (_e, cfg) => cb(cfg)),
  onHiddenChanged: (cb) => ipcRenderer.on('overlay:hidden', (_e, v) => cb(v)),
  onSelectItem: (cb) => ipcRenderer.on('select:item', (_e, id) => cb(id)),
});
