'use strict';

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONFIG_VERSION = 1;

function configPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function defaultGlobals() {
  return {
    startWithWindows: false,
    openSettingsOnLaunch: true,
    snapToEdges: true,
    snapThreshold: 16,
    hotkeys: {
      toggleClickThrough: 'CmdOrCtrl+Alt+L',
      toggleHidden: 'CmdOrCtrl+Alt+H',
      openSettings: 'CmdOrCtrl+Alt+S',
    },
  };
}

function defaultConfig() {
  return {
    version: CONFIG_VERSION,
    globals: defaultGlobals(),
    items: [],
  };
}

function normalizeItem(raw) {
  return {
    id: raw.id || crypto.randomUUID(),
    name: raw.name || 'Widget',
    enabled: raw.enabled !== false,
    type: raw.type || 'image',
    src: raw.src || '',
    x: Number.isFinite(raw.x) ? raw.x : 200,
    y: Number.isFinite(raw.y) ? raw.y : 200,
    width: Number.isFinite(raw.width) ? raw.width : 320,
    height: Number.isFinite(raw.height) ? raw.height : 320,
    opacity: Number.isFinite(raw.opacity) ? raw.opacity : 1,
    flipX: !!raw.flipX,
    rotation: Number.isFinite(raw.rotation) ? raw.rotation : 0,
    fit: raw.fit || 'contain',
    clickThrough: !!raw.clickThrough,
    locked: !!raw.locked,
    loop: raw.loop !== false,
    muted: raw.muted !== false,
    volume: Number.isFinite(raw.volume) ? raw.volume : 0.5,
  };
}

function normalizeConfig(raw) {
  const base = defaultConfig();
  if (!raw || typeof raw !== 'object') return base;
  const rawGlobals = raw.globals || {};
  const globals = Object.assign(defaultGlobals(), rawGlobals);
  globals.hotkeys = Object.assign(
    defaultGlobals().hotkeys,
    rawGlobals.hotkeys || {}
  );
  return {
    version: CONFIG_VERSION,
    globals,
    items: Array.isArray(raw.items) ? raw.items.map(normalizeItem) : [],
  };
}

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const txt = fs.readFileSync(configPath(), 'utf8');
    cache = normalizeConfig(JSON.parse(txt));
  } catch (err) {
    cache = defaultConfig();
  }
  return cache;
}

function save(cfg) {
  cache = normalizeConfig(cfg);
  try {
    fs.mkdirSync(path.dirname(configPath()), { recursive: true });
    fs.writeFileSync(configPath(), JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save config:', err);
  }
  return cache;
}

function getItem(id) {
  return load().items.find((it) => it.id === id) || null;
}

function upsertItem(patch) {
  const cfg = load();
  if (patch.id) {
    const idx = cfg.items.findIndex((it) => it.id === patch.id);
    if (idx !== -1) {
      cfg.items[idx] = normalizeItem(Object.assign({}, cfg.items[idx], patch));
      save(cfg);
      return cfg.items[idx];
    }
  }
  const item = normalizeItem(patch);
  cfg.items.push(item);
  save(cfg);
  return item;
}

function removeItem(id) {
  const cfg = load();
  cfg.items = cfg.items.filter((it) => it.id !== id);
  save(cfg);
}

function setGlobals(patch) {
  const cfg = load();
  const merged = Object.assign({}, cfg.globals, patch || {});
  if (patch && patch.hotkeys) {
    merged.hotkeys = Object.assign({}, cfg.globals.hotkeys, patch.hotkeys);
  }
  cfg.globals = merged;
  save(cfg);
  return cfg.globals;
}

module.exports = {
  CONFIG_VERSION,
  configPath,
  defaultConfig,
  normalizeItem,
  load,
  save,
  getItem,
  upsertItem,
  removeItem,
  setGlobals,
};
