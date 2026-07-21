'use strict';

const dmapi = window.api;
const content = document.getElementById('content');
const widgetList = document.getElementById('widget-list');

let cfg = { globals: {}, items: [] };
let displays = [];
let hidden = false;
let selectedId = null;
let view = 'widgets';

function toFileUrl(p) {
  if (!p) return '';
  if (/^(https?:|file:|data:|blob:)/i.test(p)) return p;
  let u = p.replace(/\\/g, '/');
  if (!u.startsWith('/')) u = '/' + u;
  return 'file://' + encodeURI(u);
}

function typeIcon(type) {
  return type === 'video' ? '🎬' : type === 'gif' ? '🎞️' : '🖼️';
}

const debouncers = new Map();
function debounce(key, fn, ms = 180) {
  clearTimeout(debouncers.get(key));
  debouncers.set(key, setTimeout(fn, ms));
}

async function reload() {
  cfg = await dmapi.getConfig();
  displays = await dmapi.getDisplays();
  hidden = await dmapi.getHidden();
  if (!cfg.items.find((it) => it.id === selectedId)) {
    selectedId = cfg.items[0] ? cfg.items[0].id : null;
  }
  renderAll();
}

function displayIdForItem(it) {
  const cx = it.x + it.width / 2;
  const cy = it.y + it.height / 2;
  const d = displays.find(
    (d) =>
      cx >= d.bounds.x &&
      cx < d.bounds.x + d.bounds.width &&
      cy >= d.bounds.y &&
      cy < d.bounds.y + d.bounds.height
  );
  return d ? d.id : displays[0] && displays[0].id;
}

async function patchItem(patch) {
  await dmapi.upsertItem(patch);
  const idx = cfg.items.findIndex((it) => it.id === patch.id);
  if (idx !== -1) cfg.items[idx] = Object.assign({}, cfg.items[idx], patch);
  renderSidebar();
}

function renderAll() {
  renderSidebar();
  renderContent();
}

function renderSidebar() {
  document
    .getElementById('widget-list-wrap')
    .style.setProperty('display', view === 'widgets' ? 'block' : 'none');

  widgetList.innerHTML = '';
  cfg.items.forEach((it) => {
    const li = document.createElement('li');
    li.className = 'wl-tile' + (it.id === selectedId ? ' active' : '');
    const preview =
      it.type === 'video'
        ? `<video class="wl-media" src="${toFileUrl(it.src)}" muted preload="metadata"></video>`
        : it.src
          ? `<img class="wl-media" src="${toFileUrl(it.src)}" alt="" />`
          : `<span class="wl-ph">${typeIcon(it.type)}</span>`;
    li.innerHTML = `
      <div class="wl-thumb">
        ${preview}
        <span class="wl-dot ${it.enabled ? '' : 'off'}" title="${it.enabled ? 'Enabled' : 'Disabled'}"></span>
        <span class="wl-badge">${typeIcon(it.type)}</span>
      </div>
      <div class="wl-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</div>`;
    li.onclick = () => {
      selectedId = it.id;
      view = 'widgets';
      renderAll();
    };
    widgetList.appendChild(li);
  });
}

function renderContent() {
  if (view === 'global') return renderGlobal();
  if (view === 'about') return renderAbout();
  return renderWidgets();
}

function renderWidgets() {
  const item = cfg.items.find((it) => it.id === selectedId);
  if (!item) {
    content.innerHTML = `
      <div class="empty">
        <div class="big">◐</div>
        <div><strong>No widgets yet</strong><br/>Click “＋ Import Media” to add one or many images / GIFs / videos at once.</div>
      </div>`;
    return;
  }

  const isVideo = item.type === 'video';
  const preview = isVideo
    ? `<video src="${toFileUrl(item.src)}" autoplay loop muted></video>`
    : `<img src="${toFileUrl(item.src)}" alt="" />`;

  content.innerHTML = `
    <div class="detail-head">
      <input type="text" id="f-name" value="${escapeHtml(item.name)}" style="max-width:280px;font-weight:600" />
      <div style="display:flex;gap:10px;align-items:center">
        <label class="switch" title="Enabled">
          <input type="checkbox" id="f-enabled" ${item.enabled ? 'checked' : ''} />
          <span class="slider"></span>
        </label>
        <button class="btn danger" id="f-delete">Delete</button>
      </div>
    </div>

    <div class="preview">${item.src ? preview : '<span style="color:var(--muted)">No media</span>'}</div>

    <div class="card">
      <h3>Source</h3>
      <div class="row">
        <div style="min-width:0">
          <div class="path">${escapeHtml(item.src || '(none)')}</div>
        </div>
        <button class="btn" id="f-change">Change file…</button>
      </div>
    </div>

    <div class="card">
      <h3>Position & Size</h3>
      <div class="grid2">
        <label class="field"><span>X (px)</span><input type="number" id="f-x" value="${Math.round(item.x)}" /></label>
        <label class="field"><span>Y (px)</span><input type="number" id="f-y" value="${Math.round(item.y)}" /></label>
        <label class="field"><span>Width (px)</span><input type="number" id="f-w" min="20" value="${Math.round(item.width)}" /></label>
        <label class="field"><span>Height (px)</span><input type="number" id="f-h" min="20" value="${Math.round(item.height)}" /></label>
      </div>
      ${
        displays.length > 1
          ? `<div class="row">
        <div><label>Monitor</label><div class="hint">Move the widget to the centre of the selected display.</div></div>
        <select id="f-monitor" style="max-width:220px">
          ${displays
            .map(
              (d) =>
                `<option value="${d.id}" ${d.id === displayIdForItem(item) ? 'selected' : ''}>${escapeHtml(d.label)}</option>`
            )
            .join('')}
        </select>
      </div>`
          : ''
      }
      <div class="row" style="margin-top:6px">
        <span class="hint">Tip: just <strong>drag</strong> a widget on screen to move it, <strong>scroll</strong> to resize, <strong>right-click</strong> for options. It <em>snaps</em> to monitor edges/centre.</span>
      </div>
    </div>

    <div class="card">
      <h3>Appearance</h3>
      <div class="row">
        <label>Opacity</label>
        <div style="display:flex;align-items:center;gap:10px">
          <input type="range" id="f-opacity" min="0" max="1" step="0.01" value="${item.opacity}" />
          <span class="range-val" id="f-opacity-v">${Math.round(item.opacity * 100)}%</span>
        </div>
      </div>
      <div class="row">
        <label>Rotation</label>
        <div style="display:flex;align-items:center;gap:10px">
          <input type="range" id="f-rot" min="-180" max="180" step="1" value="${item.rotation}" />
          <span class="range-val" id="f-rot-v">${item.rotation}°</span>
        </div>
      </div>
      <div class="row">
        <label>Fit</label>
        <select id="f-fit" style="max-width:160px">
          <option value="contain" ${item.fit === 'contain' ? 'selected' : ''}>Contain</option>
          <option value="cover" ${item.fit === 'cover' ? 'selected' : ''}>Cover</option>
          <option value="fill" ${item.fit === 'fill' ? 'selected' : ''}>Fill</option>
        </select>
      </div>
      <div class="row">
        <label>Flip horizontally</label>
        <label class="switch"><input type="checkbox" id="f-flip" ${item.flipX ? 'checked' : ''} /><span class="slider"></span></label>
      </div>
    </div>

    <div class="card">
      <h3>Behavior</h3>
      <div class="row">
        <div><label>Lock position</label><div class="hint">Can't be dragged / scrolled (right-click still works).</div></div>
        <label class="switch"><input type="checkbox" id="f-locked" ${item.locked ? 'checked' : ''} /><span class="slider"></span></label>
      </div>
      <div class="row">
        <div><label>Click-through</label><div class="hint">Mouse passes through this widget to the app behind it.</div></div>
        <label class="switch"><input type="checkbox" id="f-click" ${item.clickThrough ? 'checked' : ''} /><span class="slider"></span></label>
      </div>
      ${
        isVideo
          ? `
      <div class="row">
        <label>Loop</label>
        <label class="switch"><input type="checkbox" id="f-loop" ${item.loop ? 'checked' : ''} /><span class="slider"></span></label>
      </div>
      <div class="row">
        <label>Muted</label>
        <label class="switch"><input type="checkbox" id="f-muted" ${item.muted ? 'checked' : ''} /><span class="slider"></span></label>
      </div>
      <div class="row">
        <label>Volume</label>
        <div style="display:flex;align-items:center;gap:10px">
          <input type="range" id="f-vol" min="0" max="1" step="0.01" value="${item.volume}" />
          <span class="range-val" id="f-vol-v">${Math.round(item.volume * 100)}%</span>
        </div>
      </div>`
          : ''
      }
    </div>`;

  wireWidgetForm(item);
}

function wireWidgetForm(item) {
  const id = item.id;
  const $ = (sel) => document.getElementById(sel);

  $('f-name').oninput = (e) =>
    debounce('name', () => patchItem({ id, name: e.target.value }));
  $('f-enabled').onchange = (e) => patchItem({ id, enabled: e.target.checked });
  $('f-delete').onclick = async () => {
    await dmapi.removeItem(id);
    selectedId = null;
    reload();
  };
  $('f-change').onclick = async () => {
    const picked = await dmapi.pickFile();
    if (picked) patchItem({ id, src: picked.filePath, type: picked.type }).then(reload);
  };

  const num = (elId, key) =>
    ($(elId).oninput = (e) =>
      debounce(key, () => patchItem({ id, [key]: Number(e.target.value) || 0 })));
  num('f-x', 'x');
  num('f-y', 'y');
  num('f-w', 'width');
  num('f-h', 'height');

  if ($('f-monitor')) {
    $('f-monitor').onchange = async (e) => {
      await dmapi.moveToDisplay(id, Number(e.target.value));
      await reload();
    };
  }

  $('f-opacity').oninput = (e) => {
    $('f-opacity-v').textContent = Math.round(e.target.value * 100) + '%';
    debounce('op', () => patchItem({ id, opacity: Number(e.target.value) }));
  };
  $('f-rot').oninput = (e) => {
    $('f-rot-v').textContent = e.target.value + '°';
    debounce('rot', () => patchItem({ id, rotation: Number(e.target.value) }));
  };
  $('f-fit').onchange = (e) => patchItem({ id, fit: e.target.value });
  $('f-flip').onchange = (e) => patchItem({ id, flipX: e.target.checked });
  $('f-locked').onchange = (e) => patchItem({ id, locked: e.target.checked });
  $('f-click').onchange = (e) => patchItem({ id, clickThrough: e.target.checked });

  if (item.type === 'video') {
    $('f-loop').onchange = (e) => patchItem({ id, loop: e.target.checked });
    $('f-muted').onchange = (e) => patchItem({ id, muted: e.target.checked });
    $('f-vol').oninput = (e) => {
      $('f-vol-v').textContent = Math.round(e.target.value * 100) + '%';
      debounce('vol', () => patchItem({ id, volume: Number(e.target.value) }));
    };
  }
}

function renderGlobal() {
  const g = cfg.globals;
  content.innerHTML = `
    <div class="card">
      <h3>Startup</h3>
      <div class="row">
        <div><label>Start with Windows</label><div class="hint">Launch automatically (minimized to tray) when you sign in.</div></div>
        <label class="switch"><input type="checkbox" id="g-startup" ${g.startWithWindows ? 'checked' : ''} /><span class="slider"></span></label>
      </div>
      <div class="row">
        <div><label>Open this window on launch</label><div class="hint">Otherwise it stays in the tray.</div></div>
        <label class="switch"><input type="checkbox" id="g-opensettings" ${g.openSettingsOnLaunch ? 'checked' : ''} /><span class="slider"></span></label>
      </div>
    </div>

    <div class="card">
      <h3>Widget</h3>
      <div class="row">
        <div><label>All widgets</label><div class="hint">Make them all interactive, or all click-through (e.g. before gaming).</div></div>
        <div style="display:flex;gap:8px">
          <button class="btn" id="g-ct-off">Interactive</button>
          <button class="btn" id="g-ct-on">Click-through</button>
        </div>
      </div>
      <div class="row">
        <div><label>Hide all widgets</label><div class="hint">Temporarily hide without disabling.</div></div>
        <button class="btn ${hidden ? 'primary' : ''}" id="g-hide">${hidden ? '👁 Show all' : '🙈 Hide all'}</button>
      </div>
    </div>

    <div class="card">
      <h3>Snapping</h3>
      <div class="row">
        <div><label>Snap to monitor edges & centre</label><div class="hint">While dragging a widget.</div></div>
        <label class="switch"><input type="checkbox" id="g-snap" ${g.snapToEdges ? 'checked' : ''} /><span class="slider"></span></label>
      </div>
      <div class="row">
        <label>Snap distance</label>
        <div style="display:flex;align-items:center;gap:10px">
          <input type="range" id="g-snapt" min="0" max="48" step="1" value="${g.snapThreshold}" />
          <span class="range-val" id="g-snapt-v">${g.snapThreshold}px</span>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Global hotkeys</h3>
      <div class="hint" style="margin-bottom:8px">Click a field, then press a key combo. Works system-wide (even in games).</div>
      <div class="row">
        <label>Toggle click-through (all)</label>
        <input type="text" class="hotkey" id="hk-mode" readonly value="${escapeHtml(g.hotkeys.toggleClickThrough)}" placeholder="click & press…" />
      </div>
      <div class="row">
        <label>Show / hide all</label>
        <input type="text" class="hotkey" id="hk-hide" readonly value="${escapeHtml(g.hotkeys.toggleHidden)}" placeholder="click & press…" />
      </div>
      <div class="row">
        <label>Open Settings</label>
        <input type="text" class="hotkey" id="hk-open" readonly value="${escapeHtml(g.hotkeys.openSettings)}" placeholder="click & press…" />
      </div>
    </div>`;

  document.getElementById('g-startup').onchange = (e) =>
    dmapi.setGlobals({ startWithWindows: e.target.checked });
  document.getElementById('g-opensettings').onchange = (e) =>
    dmapi.setGlobals({ openSettingsOnLaunch: e.target.checked });
  document.getElementById('g-ct-off').onclick = () =>
    dmapi.setAllClickThrough(false);
  document.getElementById('g-ct-on').onclick = () =>
    dmapi.setAllClickThrough(true);

  document.getElementById('g-hide').onclick = async () => {
    hidden = await dmapi.setHidden(!hidden);
    renderGlobal();
  };
  document.getElementById('g-snap').onchange = (e) =>
    dmapi.setGlobals({ snapToEdges: e.target.checked });
  document.getElementById('g-snapt').oninput = (e) => {
    document.getElementById('g-snapt-v').textContent = e.target.value + 'px';
    debounce('snapt', () =>
      dmapi.setGlobals({ snapThreshold: Number(e.target.value) })
    );
  };

  wireHotkey('hk-mode', 'toggleClickThrough');
  wireHotkey('hk-hide', 'toggleHidden');
  wireHotkey('hk-open', 'openSettings');
}

function wireHotkey(elId, key) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.onkeydown = (e) => {
    e.preventDefault();
    const parts = [];
    if (e.ctrlKey) parts.push('CmdOrCtrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Super');
    const k = normalizeKey(e.key, e.code);
    if (k && !['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      parts.push(k);
      const accel = parts.join('+');
      el.value = accel;
      cfg.globals.hotkeys[key] = accel;
      dmapi.setGlobals({ hotkeys: { [key]: accel } });
    }
  };
}

function normalizeKey(key, code) {
  if (/^[a-z]$/i.test(key)) return key.toUpperCase();
  if (/^[0-9]$/.test(key)) return key;
  if (code && code.startsWith('Key')) return code.slice(3);
  if (code && code.startsWith('Digit')) return code.slice(5);
  const map = {
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ' ': 'Space',
    Escape: 'Esc',
  };
  if (map[key]) return map[key];
  if (/^F\d{1,2}$/.test(key)) return key;
  return key.length === 1 ? key : '';
}

function renderAbout() {
  content.innerHTML = `
    <div class="about">
      <h2 style="margin-top:0">Desktop Mate Wannabe <span class="tag">v0.1</span></h2>
      <p>An always-on-top desktop overlay for images, GIFs, and video — it floats above the
      taskbar and over borderless/windowed games.</p>
      <p><strong>How to use (Rainmeter-style):</strong> <code>drag</code> a widget to move it,
      <code>scroll</code> to resize, <code>right-click</code> for options (lock position,
      click-through, size, etc.).</p>
      <p><span class="tag">PNG</span><span class="tag">JPG</span><span class="tag">GIF</span><span class="tag">WebP</span><span class="tag">MP4</span><span class="tag">WebM</span></p>
      <p style="font-size:11px">Note: true <em>exclusive</em>-fullscreen games can cover the overlay — set the
      game to <em>Borderless/Windowed</em> for it to show through.</p>
    </div>`;
}

document.querySelectorAll('.nav-btn').forEach((b) => {
  b.onclick = () => {
    view = b.dataset.view;
    document
      .querySelectorAll('.nav-btn')
      .forEach((n) => n.classList.toggle('active', n === b));
    renderSidebar();
    renderContent();
  };
});

document.getElementById('add-btn').onclick = async () => {
  const picked = await dmapi.pickFiles();
  if (!picked) return;
  const files = Array.isArray(picked) ? picked : [picked];
  const startCount = cfg.items.length;
  let lastId = selectedId;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const step = (startCount + i) % 8;
    const item = await dmapi.upsertItem({
      name: baseName(f.filePath),
      src: f.filePath,
      type: f.type,
      enabled: true,
      x: 260 + step * 40,
      y: 200 + step * 40,
      width: 320,
      height: 320,
    });
    lastId = item.id;
  }
  selectedId = lastId;
  view = 'widgets';
  await reload();
};

function baseName(p) {
  const b = p.replace(/\\/g, '/').split('/').pop() || 'Widget';
  return b.replace(/\.[^.]+$/, '');
}

function escapeHtml(s) {
  return String(s || '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

dmapi.onConfigChanged((c) => {
  cfg = c;
  renderAll();
});

dmapi.onHiddenChanged((v) => {
  hidden = v;
  if (view === 'global') renderGlobal();
});

dmapi.onSelectItem((id) => {
  selectedId = id;
  view = 'widgets';
  document
    .querySelectorAll('.nav-btn')
    .forEach((n) => n.classList.toggle('active', n.dataset.view === 'widgets'));
  renderAll();
});

reload();
