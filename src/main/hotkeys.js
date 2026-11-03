'use strict';

const { globalShortcut } = require('electron');

const actions = require('./actions');
const config = require('./config');
const settingsWindow = require('./settingsWindow');

let failures = [];

function bind(name, accelerator, handler) {
  if (!accelerator) return;
  try {
    if (globalShortcut.register(accelerator, handler)) return;
  } catch (error) {
    console.warn('Failed to register hotkey', accelerator, error.message);
  }
  failures.push({ name, accelerator });
}

function unregisterAll() {
  globalShortcut.unregisterAll();
}

function register() {
  unregisterAll();
  failures = [];
  const { hotkeys } = config.load().globals;
  bind('toggleClickThrough', hotkeys.toggleClickThrough, actions.toggleClickThroughAll);
  bind('toggleHidden', hotkeys.toggleHidden, actions.toggleHidden);
  bind('openSettings', hotkeys.openSettings, () => settingsWindow.open());
}

function getFailures() {
  return failures;
}

module.exports = { getFailures, register, unregisterAll };
