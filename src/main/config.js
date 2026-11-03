'use strict';

const { app } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { DOCK_IDS, MAX_SIZE, MIN_SIZE } = require('./placement');

const CONFIG_VERSION = 1;
const LEGACY_DIR_NAMES = ['desktop-mate-wannabe', 'Desktop Mate Wannabe'];
const ITEM_TYPES = ['image', 'gif', 'video'];
const FIT_MODES = ['contain', 'cover', 'fill'];
const HOTKEY_MODIFIERS = ['CmdOrCtrl', 'Control', 'Ctrl', 'Alt', 'AltGr', 'Super', 'Meta'];
const FUNCTION_KEY = /^F([1-9]|1\d|2[0-4])$/;

const MAX_SNAP_THRESHOLD = 48;
const MAX_ROTATION = 180;

let cache = null;
let damagedBackupPath = null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finiteOr = (value, fallback) => (Number.isFinite(value) ? value : fallback);
const numberIn = (value, fallback, min, max) => clamp(finiteOr(value, fallback), min, max);
const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const textOr = (value, fallback) => (typeof value === 'string' && value ? value : fallback);
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

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
  return { version: CONFIG_VERSION, globals: defaultGlobals(), items: [] };
}

function isSafeHotkey(accelerator) {
  if (accelerator === '') return true;
  if (typeof accelerator !== 'string') return false;
  const parts = accelerator.split('+');
  const modifiers = parts.slice(0, -1);
  return (
    FUNCTION_KEY.test(parts[parts.length - 1]) ||
    modifiers.some((modifier) => HOTKEY_MODIFIERS.includes(modifier))
  );
}

function normalizeHotkeys(raw, fallback) {
  const hotkeys = {};
  for (const name of Object.keys(fallback)) {
    const requested = isRecord(raw) ? raw[name] : undefined;
    hotkeys[name] = isSafeHotkey(requested) ? requested : fallback[name];
  }
  return hotkeys;
}

function normalizeGlobals(raw) {
  const defaults = defaultGlobals();
  const source = isRecord(raw) ? raw : {};
  return {
    startWithWindows: source.startWithWindows === true,
    openSettingsOnLaunch: source.openSettingsOnLaunch !== false,
    snapToEdges: source.snapToEdges !== false,
    snapThreshold: numberIn(source.snapThreshold, defaults.snapThreshold, 0, MAX_SNAP_THRESHOLD),
    hotkeys: normalizeHotkeys(source.hotkeys, defaults.hotkeys),
  };
}

function normalizeItem(raw) {
  return {
    id: textOr(raw.id, crypto.randomUUID()),
    name: textOr(raw.name, 'Widget'),
    enabled: raw.enabled !== false,
    type: oneOf(raw.type, ITEM_TYPES, 'image'),
    src: textOr(raw.src, ''),
    x: finiteOr(raw.x, 200),
    y: finiteOr(raw.y, 200),
    width: numberIn(raw.width, 320, MIN_SIZE, MAX_SIZE),
    height: numberIn(raw.height, 320, MIN_SIZE, MAX_SIZE),
    dock: oneOf(raw.dock, DOCK_IDS, null),
    thickness: raw.thickness > 0 ? numberIn(raw.thickness, MIN_SIZE, MIN_SIZE, MAX_SIZE) : null,
    coverTaskbar: Boolean(raw.coverTaskbar),
    opacity: numberIn(raw.opacity, 1, 0, 1),
    flipX: Boolean(raw.flipX),
    rotation: numberIn(raw.rotation, 0, -MAX_ROTATION, MAX_ROTATION),
    fit: oneOf(raw.fit, FIT_MODES, 'contain'),
    clickThrough: Boolean(raw.clickThrough),
    locked: Boolean(raw.locked),
    loop: raw.loop !== false,
    muted: raw.muted !== false,
    volume: numberIn(raw.volume, 0.5, 0, 1),
  };
}

function normalizeConfig(raw) {
  return {
    version: CONFIG_VERSION,
    globals: normalizeGlobals(raw.globals),
    items: Array.isArray(raw.items) ? raw.items.filter(isRecord).map(normalizeItem) : [],
  };
}

function copyLegacyConfig() {
  const userData = app.getPath('userData');
  const appData = app.getPath('appData');
  if (path.dirname(userData) !== appData || fs.existsSync(configPath())) return;

  for (const name of LEGACY_DIR_NAMES) {
    const legacyPath = path.join(appData, name, 'config.json');
    if (!fs.existsSync(legacyPath)) continue;
    fs.mkdirSync(userData, { recursive: true });
    fs.copyFileSync(legacyPath, configPath());
    return;
  }
}

function keepDamagedFile() {
  const backupPath = path.join(app.getPath('userData'), `config.damaged-${Date.now()}.json`);
  try {
    fs.renameSync(configPath(), backupPath);
    return backupPath;
  } catch (error) {
    console.error('Failed to keep damaged config:', error);
    return configPath();
  }
}

function readConfigFile() {
  const raw = JSON.parse(fs.readFileSync(configPath(), 'utf8').replace(/^﻿/, ''));
  if (!isRecord(raw)) throw new SyntaxError('The settings file is not an object');
  return raw;
}

function load() {
  if (cache) return cache;
  try {
    copyLegacyConfig();
    cache = normalizeConfig(readConfigFile());
  } catch (error) {
    if (error.code !== 'ENOENT') damagedBackupPath = keepDamagedFile();
    cache = defaultConfig();
  }
  return cache;
}

function save(cfg) {
  cache = normalizeConfig(cfg);
  const target = configPath();
  const temporary = `${target}.tmp`;
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(temporary, JSON.stringify(cache, null, 2), 'utf8');
    fs.renameSync(temporary, target);
  } catch (error) {
    console.error('Failed to save config:', error);
  }
}

function takeDamagedBackupPath() {
  const backupPath = damagedBackupPath;
  damagedBackupPath = null;
  return backupPath;
}

function getItem(id) {
  return load().items.find((item) => item.id === id) || null;
}

function upsertItem(patch) {
  const cfg = load();
  if (!patch.id) {
    const created = normalizeItem(patch);
    cfg.items.push(created);
    save(cfg);
    return created;
  }

  const index = cfg.items.findIndex((item) => item.id === patch.id);
  if (index === -1) return null;
  const updated = normalizeItem({ ...cfg.items[index], ...patch });
  cfg.items[index] = updated;
  save(cfg);
  return updated;
}

function patchAllItems(patch) {
  const cfg = load();
  cfg.items = cfg.items.map((item) => ({ ...item, ...patch }));
  save(cfg);
}

function removeItem(id) {
  const cfg = load();
  cfg.items = cfg.items.filter((item) => item.id !== id);
  save(cfg);
}

function setGlobals(patch = {}) {
  const cfg = load();
  const hotkeys = normalizeHotkeys(patch.hotkeys, cfg.globals.hotkeys);
  cfg.globals = { ...cfg.globals, ...patch, hotkeys };
  save(cfg);
  return cache.globals;
}

module.exports = {
  getItem,
  load,
  patchAllItems,
  removeItem,
  setGlobals,
  takeDamagedBackupPath,
  upsertItem,
};
