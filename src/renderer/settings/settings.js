'use strict';

const bridge = window.api;
const content = document.getElementById('content');
const widgetList = document.getElementById('widget-list');

const INPUT_DEBOUNCE_MS = 180;
const IMPORT_ORIGIN = { x: 260, y: 200 };
const IMPORT_OFFSET = 40;
const IMPORT_CASCADE_LENGTH = 8;
const IMPORT_SIZE = 320;
const MODIFIER_KEYS = ['Control', 'Alt', 'Shift', 'Meta'];
const SPECIAL_KEYS = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ' ': 'Space',
  Escape: 'Esc',
};
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const debounceTimers = new Map();

let cfg = { globals: {}, items: [] };
let displays = [];
let dockOptions = [];
let appVersion = '';
let hidden = false;
let selectedId = null;
let view = 'widgets';

const byId = (id) => document.getElementById(id);
const percent = (fraction) => `${Math.round(fraction * 100)}%`;
const checkedAttr = (on) => (on ? 'checked' : '');
const selectedAttr = (on) => (on ? 'selected' : '');

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

function mediaUrl(src) {
  return escapeHtml(toFileUrl(src));
}

function typeIcon(type) {
  if (type === 'video') return '🎬';
  return type === 'gif' ? '🎞️' : '🖼️';
}

function baseName(filePath) {
  const fileName = filePath.replace(/\\/g, '/').split('/').pop() || 'Widget';
  return fileName.replace(/\.[^.]+$/, '');
}

function debounce(key, callback) {
  clearTimeout(debounceTimers.get(key));
  debounceTimers.set(key, setTimeout(callback, INPUT_DEBOUNCE_MS));
}

function selectedItem() {
  return cfg.items.find((item) => item.id === selectedId);
}

function displayIdForItem(item) {
  const centerX = item.x + item.width / 2;
  const centerY = item.y + item.height / 2;
  const match = displays.find(
    ({ bounds }) =>
      centerX >= bounds.x &&
      centerX < bounds.x + bounds.width &&
      centerY >= bounds.y &&
      centerY < bounds.y + bounds.height
  );
  return match ? match.id : displays[0] && displays[0].id;
}

async function reload() {
  cfg = await bridge.getConfig();
  displays = await bridge.getDisplays();
  dockOptions = await bridge.getDockOptions();
  appVersion = await bridge.getVersion();
  hidden = await bridge.getHidden();
  if (!selectedItem()) {
    selectedId = cfg.items[0] ? cfg.items[0].id : null;
  }
  renderAll();
}

function storeItem(updated) {
  const index = cfg.items.findIndex((item) => item.id === updated.id);
  if (index !== -1) cfg.items[index] = updated;
}

async function patchItem(patch) {
  const updated = await bridge.upsertItem(patch);
  if (!updated) return;
  const previousDock = selectedItem() && selectedItem().dock;
  storeItem(updated);
  renderSidebar();
  if (updated.id === selectedId && updated.dock !== previousDock) renderWidgets();
}

function settingLabel(label, hint) {
  if (!hint) return `<label>${label}</label>`;
  return `<div><label>${label}</label><div class="hint">${hint}</div></div>`;
}

function switchRow(id, label, on, hint) {
  return `
    <div class="row">
      ${settingLabel(label, hint)}
      <label class="switch"><input type="checkbox" id="${id}" ${checkedAttr(on)} /><span class="slider"></span></label>
    </div>`;
}

function rangeRow(id, label, { min, max, step, value, text }) {
  return `
    <div class="row">
      <label>${label}</label>
      <div class="inline-controls">
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" />
        <span class="range-val" id="${id}-v">${text}</span>
      </div>
    </div>`;
}

function numberField(id, label, value, min) {
  const minAttr = min === undefined ? '' : `min="${min}"`;
  return `<label class="field"><span>${label}</span><input type="number" id="${id}" ${minAttr} value="${Math.round(value)}" /></label>`;
}

function hotkeyRow(id, label, value) {
  return `
    <div class="row">
      <label>${label}</label>
      <input type="text" class="hotkey" id="${id}" readonly value="${escapeHtml(value)}" placeholder="click &amp; press…" />
    </div>`;
}

function fitOption(value, label, current) {
  return `<option value="${value}" ${selectedAttr(current === value)}>${label}</option>`;
}

function thumbnailHtml(item) {
  const url = mediaUrl(item.src);
  if (item.type === 'video') {
    return `<video class="wl-media" src="${url}" muted preload="metadata"></video>`;
  }
  if (item.src) return `<img class="wl-media" src="${url}" alt="" />`;
  return `<span class="wl-ph">${typeIcon(item.type)}</span>`;
}

function createWidgetTile(item) {
  const tile = document.createElement('li');
  tile.className = `wl-tile${item.id === selectedId ? ' active' : ''}`;
  tile.innerHTML = `
    <div class="wl-thumb">
      ${thumbnailHtml(item)}
      <span class="wl-dot ${item.enabled ? '' : 'off'}" title="${item.enabled ? 'Enabled' : 'Disabled'}"></span>
      <span class="wl-badge">${typeIcon(item.type)}</span>
    </div>
    <div class="wl-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>`;
  tile.onclick = () => {
    selectedId = item.id;
    view = 'widgets';
    renderAll();
  };
  return tile;
}

function renderSidebar() {
  byId('widget-list-wrap').style.display = view === 'widgets' ? 'block' : 'none';
  widgetList.replaceChildren(...cfg.items.map(createWidgetTile));
}

function renderContent() {
  if (view === 'global') {
    renderGlobal();
  } else if (view === 'about') {
    renderAbout();
  } else {
    renderWidgets();
  }
}

function renderAll() {
  renderSidebar();
  renderContent();
}

function emptyStateHtml() {
  return `
    <div class="empty">
      <div class="big">◐</div>
      <div><strong>No widgets yet</strong><br/>Click “＋ Import Media” to add one or many images / GIFs / videos at once.</div>
    </div>`;
}

function previewHtml(item) {
  if (!item.src) return '<span class="no-media">No media</span>';
  const url = mediaUrl(item.src);
  return item.type === 'video'
    ? `<video src="${url}" autoplay loop muted></video>`
    : `<img src="${url}" alt="" />`;
}

function placementRowsHtml(item) {
  const options = dockOptions
    .map(
      ({ id, label }) =>
        `<option value="${id || ''}" ${selectedAttr(id === item.dock)}>${escapeHtml(label)}</option>`
    )
    .join('');
  return `
    <div class="row">
      ${settingLabel('Placement', 'Stretch across a screen edge, fill the screen, or stay in a corner. The widget stays there when the display changes.')}
      <select id="f-dock" class="select-md">${options}</select>
    </div>
    ${item.dock ? switchRow('f-cover-taskbar', 'Cover the taskbar', item.coverTaskbar, 'Use the whole screen, including the taskbar area.') : ''}`;
}

function monitorRowHtml(item) {
  if (displays.length <= 1) return '';
  const currentDisplayId = displayIdForItem(item);
  const options = displays
    .map(
      ({ id, label }) =>
        `<option value="${id}" ${selectedAttr(id === currentDisplayId)}>${escapeHtml(label)}</option>`
    )
    .join('');
  return `
    <div class="row">
      ${settingLabel('Monitor', 'Move the widget to the centre of the selected display.')}
      <select id="f-monitor" class="select-md">${options}</select>
    </div>`;
}

function videoRowsHtml(item) {
  if (item.type !== 'video') return '';
  return `
    ${switchRow('f-loop', 'Loop', item.loop)}
    ${switchRow('f-muted', 'Muted', item.muted)}
    ${rangeRow('f-vol', 'Volume', { min: 0, max: 1, step: 0.01, value: item.volume, text: percent(item.volume) })}`;
}

function widgetFormHtml(item) {
  return `
    <div class="detail-head">
      <input type="text" id="f-name" class="name-input" value="${escapeHtml(item.name)}" />
      <div class="inline-controls">
        <label class="switch" title="Enabled">
          <input type="checkbox" id="f-enabled" ${checkedAttr(item.enabled)} />
          <span class="slider"></span>
        </label>
        <button class="btn danger" id="f-delete">Delete</button>
      </div>
    </div>

    <div class="preview">${previewHtml(item)}</div>

    <div class="card">
      <h3>Source</h3>
      <div class="row">
        <div class="source-path">
          <div class="path">${escapeHtml(item.src || '(none)')}</div>
        </div>
        <button class="btn" id="f-change">Change file…</button>
      </div>
    </div>

    <div class="card">
      <h3>Position &amp; Size</h3>
      <div class="grid2">
        ${numberField('f-x', 'X (px)', item.x)}
        ${numberField('f-y', 'Y (px)', item.y)}
        ${numberField('f-w', 'Width (px)', item.width, 40)}
        ${numberField('f-h', 'Height (px)', item.height, 40)}
      </div>
      ${placementRowsHtml(item)}
      ${monitorRowHtml(item)}
      <div class="row tip-row">
        <span class="hint">Tip: just <strong>drag</strong> a widget on screen to move it, <strong>scroll</strong> to resize, <strong>right-click</strong> for options. It <em>snaps</em> to monitor edges.</span>
      </div>
    </div>

    <div class="card">
      <h3>Appearance</h3>
      ${rangeRow('f-opacity', 'Opacity', { min: 0, max: 1, step: 0.01, value: item.opacity, text: percent(item.opacity) })}
      ${rangeRow('f-rot', 'Rotation', { min: -180, max: 180, step: 1, value: item.rotation, text: `${item.rotation}°` })}
      <div class="row">
        <label>Fit</label>
        <select id="f-fit" class="select-sm">
          ${fitOption('contain', 'Contain', item.fit)}
          ${fitOption('cover', 'Cover', item.fit)}
          ${fitOption('fill', 'Fill', item.fit)}
        </select>
      </div>
      ${switchRow('f-flip', 'Flip horizontally', item.flipX)}
    </div>

    <div class="card">
      <h3>Behavior</h3>
      ${switchRow('f-locked', 'Lock position', item.locked, "Can't be dragged / scrolled (right-click still works).")}
      ${switchRow('f-click', 'Click-through', item.clickThrough, 'Mouse passes through this widget to the app behind it.')}
      ${videoRowsHtml(item)}
    </div>`;
}

function renderWidgets() {
  const item = selectedItem();
  if (!item) {
    content.innerHTML = emptyStateHtml();
    return;
  }
  content.innerHTML = widgetFormHtml(item);
  wireWidgetForm(item);
}

function wireRange(elementId, format, commit) {
  byId(elementId).oninput = (event) => {
    const value = Number(event.target.value);
    byId(`${elementId}-v`).textContent = format(value);
    debounce(elementId, () => commit(value));
  };
}

function wireWidgetForm(item) {
  const { id } = item;

  const wireToggle = (elementId, key) => {
    byId(elementId).onchange = (event) => patchItem({ id, [key]: event.target.checked });
  };
  const wireNumber = (elementId, key) => {
    byId(elementId).oninput = (event) => {
      debounce(key, () => patchItem({ id, [key]: Number(event.target.value) || 0 }));
    };
  };

  byId('f-name').oninput = (event) => {
    debounce('name', () => patchItem({ id, name: event.target.value }));
  };
  byId('f-delete').onclick = async () => {
    await bridge.removeItem(id);
    selectedId = null;
    reload();
  };
  byId('f-change').onclick = async () => {
    const picked = await bridge.pickFile();
    if (!picked) return;
    await patchItem({ id, src: picked.filePath, type: picked.type });
    reload();
  };

  wireToggle('f-enabled', 'enabled');
  wireToggle('f-flip', 'flipX');
  wireToggle('f-locked', 'locked');
  wireToggle('f-click', 'clickThrough');
  wireNumber('f-x', 'x');
  wireNumber('f-y', 'y');
  wireNumber('f-w', 'width');
  wireNumber('f-h', 'height');
  wireRange('f-opacity', percent, (opacity) => patchItem({ id, opacity }));
  wireRange('f-rot', (rotation) => `${rotation}°`, (rotation) => patchItem({ id, rotation }));
  byId('f-fit').onchange = (event) => patchItem({ id, fit: event.target.value });

  byId('f-dock').onchange = async (event) => {
    await bridge.setDock(id, event.target.value || null);
    await reload();
  };
  if (item.dock) wireToggle('f-cover-taskbar', 'coverTaskbar');

  const monitorSelect = byId('f-monitor');
  if (monitorSelect) {
    monitorSelect.onchange = async (event) => {
      await bridge.moveToDisplay(id, Number(event.target.value));
      await reload();
    };
  }

  if (item.type === 'video') {
    wireToggle('f-loop', 'loop');
    wireToggle('f-muted', 'muted');
    wireRange('f-vol', percent, (volume) => patchItem({ id, volume }));
  }
}

function globalFormHtml({ startWithWindows, openSettingsOnLaunch, snapToEdges, snapThreshold, hotkeys }) {
  return `
    <div class="card">
      <h3>Startup</h3>
      ${switchRow('g-startup', 'Start with Windows', startWithWindows, 'Launch automatically (minimized to tray) when you sign in.')}
      ${switchRow('g-opensettings', 'Open this window on launch', openSettingsOnLaunch, 'Otherwise it stays in the tray.')}
    </div>

    <div class="card">
      <h3>Widget</h3>
      <div class="row">
        ${settingLabel('All widgets', 'Make them all interactive, or all click-through (e.g. before gaming).')}
        <div class="button-group">
          <button class="btn" id="g-ct-off">Interactive</button>
          <button class="btn" id="g-ct-on">Click-through</button>
        </div>
      </div>
      <div class="row">
        ${settingLabel('Hide all widgets', 'Temporarily hide without disabling.')}
        <button class="btn ${hidden ? 'primary' : ''}" id="g-hide">${hidden ? '👁 Show all' : '🙈 Hide all'}</button>
      </div>
    </div>

    <div class="card">
      <h3>Snapping</h3>
      ${switchRow('g-snap', 'Snap to monitor edges', snapToEdges, 'While dragging a widget.')}
      ${rangeRow('g-snapt', 'Snap distance', { min: 0, max: 48, step: 1, value: snapThreshold, text: `${snapThreshold}px` })}
    </div>

    <div class="card">
      <h3>Global hotkeys</h3>
      <div class="hint hotkey-help">Click a field, then press a key combo with Ctrl, Alt or Win, or a function key. Works system-wide (even in games).</div>
      <div class="hotkey-status" id="hotkey-status"></div>
      ${hotkeyRow('hk-mode', 'Toggle click-through (all)', hotkeys.toggleClickThrough)}
      ${hotkeyRow('hk-hide', 'Show / hide all', hotkeys.toggleHidden)}
      ${hotkeyRow('hk-open', 'Open Settings', hotkeys.openSettings)}
    </div>`;
}

function renderGlobal() {
  content.innerHTML = globalFormHtml(cfg.globals);

  const wireGlobalToggle = (elementId, key) => {
    byId(elementId).onchange = (event) => bridge.setGlobals({ [key]: event.target.checked });
  };

  wireGlobalToggle('g-startup', 'startWithWindows');
  wireGlobalToggle('g-opensettings', 'openSettingsOnLaunch');
  wireGlobalToggle('g-snap', 'snapToEdges');
  byId('g-ct-off').onclick = () => bridge.setAllClickThrough(false);
  byId('g-ct-on').onclick = () => bridge.setAllClickThrough(true);
  byId('g-hide').onclick = async () => {
    hidden = await bridge.setHidden(!hidden);
    renderGlobal();
  };
  wireRange('g-snapt', (px) => `${px}px`, (snapThreshold) => bridge.setGlobals({ snapThreshold }));

  wireHotkey('hk-mode', 'toggleClickThrough');
  wireHotkey('hk-hide', 'toggleHidden');
  wireHotkey('hk-open', 'openSettings');
  showHotkeyFailures();
}

function acceleratorKey(key, code) {
  if (/^[a-z]$/i.test(key)) return key.toUpperCase();
  if (/^[0-9]$/.test(key)) return key;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (SPECIAL_KEYS[key]) return SPECIAL_KEYS[key];
  if (/^F\d{1,2}$/.test(key)) return key;
  return key.length === 1 ? key : '';
}

function acceleratorFromEvent(event) {
  const key = acceleratorKey(event.key, event.code);
  if (!key || MODIFIER_KEYS.includes(event.key)) return null;
  const parts = [];
  if (event.ctrlKey) parts.push('CmdOrCtrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Super');
  return [...parts, key].join('+');
}

function isSafeHotkeyEvent(event, accelerator) {
  const isFunctionKey = /^F\d{1,2}$/.test(accelerator.split('+').pop());
  return event.ctrlKey || event.altKey || event.metaKey || isFunctionKey;
}

function setHotkeyStatus(message) {
  const status = byId('hotkey-status');
  if (status) status.textContent = message;
}

async function showHotkeyFailures() {
  const failures = await bridge.getHotkeyFailures();
  const taken = failures.map(({ accelerator }) => accelerator).join(', ');
  setHotkeyStatus(taken ? `Not active, already in use: ${taken}` : '');
}

function wireHotkey(elementId, hotkeyName) {
  const input = byId(elementId);
  input.onkeydown = async (event) => {
    event.preventDefault();
    const accelerator = acceleratorFromEvent(event);
    if (!accelerator) return;
    if (!isSafeHotkeyEvent(event, accelerator)) {
      setHotkeyStatus(`${accelerator} would block typing. Add Ctrl, Alt or Win, or use a function key.`);
      return;
    }
    input.value = accelerator;
    cfg.globals = await bridge.setGlobals({ hotkeys: { [hotkeyName]: accelerator } });
    await showHotkeyFailures();
  };
}

function renderAbout() {
  content.innerHTML = `
    <div class="about">
      <h2>Overlet <span class="tag">v${escapeHtml(appVersion)}</span></h2>
      <p>An always-on-top desktop overlay for images, GIFs, and video — it floats above the
      taskbar and over borderless/windowed games.</p>
      <p><strong>How to use:</strong> <code>drag</code> a widget to move it,
      <code>scroll</code> to resize, <code>right-click</code> for options (lock position,
      click-through, size, etc.).</p>
      <p><span class="tag">PNG</span><span class="tag">JPG</span><span class="tag">GIF</span><span class="tag">WebP</span><span class="tag">AVIF</span><span class="tag">SVG</span><span class="tag">WebM</span></p>
      <p class="about-note">Note: true <em>exclusive</em>-fullscreen games can cover the overlay — set the
      game to <em>Borderless/Windowed</em> for it to show through.</p>
    </div>`;
}

function setActiveNav(activeView) {
  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === activeView);
  });
}

async function addFiles(files) {
  const existingCount = cfg.items.length;
  for (const [index, file] of files.entries()) {
    const step = (existingCount + index) % IMPORT_CASCADE_LENGTH;
    const item = await bridge.upsertItem({
      name: baseName(file.filePath),
      src: file.filePath,
      type: file.type,
      enabled: true,
      x: IMPORT_ORIGIN.x + step * IMPORT_OFFSET,
      y: IMPORT_ORIGIN.y + step * IMPORT_OFFSET,
      width: IMPORT_SIZE,
      height: IMPORT_SIZE,
    });
    selectedId = item.id;
  }
  view = 'widgets';
  setActiveNav(view);
  await reload();
}

async function importMedia() {
  const files = await bridge.pickFiles();
  if (files) await addFiles(files);
}

async function importDroppedFiles(event) {
  event.preventDefault();
  document.body.classList.remove('drop-target');
  const files = await bridge.describeDroppedFiles([...event.dataTransfer.files]);
  if (files.length > 0) await addFiles(files);
}

function syncField(elementId, value) {
  const field = byId(elementId);
  if (field && document.activeElement !== field) field.value = Math.round(value);
}

function applyItemChange(updated) {
  const previous = cfg.items.find((item) => item.id === updated.id);
  storeItem(updated);
  if (view !== 'widgets' || updated.id !== selectedId) return;
  if (previous && previous.dock !== updated.dock) {
    renderWidgets();
    return;
  }
  syncField('f-x', updated.x);
  syncField('f-y', updated.y);
  syncField('f-w', updated.width);
  syncField('f-h', updated.height);
}

function showPreviewError(event) {
  const media = event.target;
  const parent = media.parentElement;
  if (parent && parent.classList.contains('wl-thumb')) media.remove();
  if (!parent || !parent.classList.contains('preview')) return;
  const notice = document.createElement('span');
  notice.className = 'no-media';
  notice.textContent = "Can't show this file. It may have been moved, or its format is not supported.";
  media.replaceWith(notice);
}

document.querySelectorAll('.nav-btn').forEach((button) => {
  button.onclick = () => {
    view = button.dataset.view;
    setActiveNav(view);
    renderAll();
  };
});
byId('add-btn').onclick = importMedia;
document.addEventListener('error', showPreviewError, true);
document.addEventListener('dragover', (event) => {
  event.preventDefault();
  document.body.classList.add('drop-target');
});
document.addEventListener('dragleave', (event) => {
  if (!event.relatedTarget) document.body.classList.remove('drop-target');
});
document.addEventListener('drop', importDroppedFiles);

bridge.onConfigChanged((updatedConfig) => {
  cfg = updatedConfig;
  renderAll();
});
bridge.onItemChanged(applyItemChange);
bridge.onHiddenChanged((value) => {
  hidden = value;
  if (view === 'global') renderGlobal();
});
bridge.onSelectItem((id) => {
  selectedId = id;
  view = 'widgets';
  setActiveNav(view);
  renderAll();
});

reload();
