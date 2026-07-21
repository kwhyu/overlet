'use strict';

const stage = document.getElementById('stage');
const label = document.getElementById('label');

let mediaEl = null;
let currentSrc = null;
let currentType = null;
let current = null;

function toFileUrl(p) {
  if (!p) return '';
  if (/^(https?:|file:|data:|blob:)/i.test(p)) return p;
  let u = p.replace(/\\/g, '/');
  if (!u.startsWith('/')) u = '/' + u;
  return 'file://' + encodeURI(u);
}

function buildMedia(item) {
  if (mediaEl && currentSrc === item.src && currentType === item.type) return;

  if (mediaEl) mediaEl.remove();
  currentSrc = item.src;
  currentType = item.type;

  const url = toFileUrl(item.src);
  if (item.type === 'video') {
    const v = document.createElement('video');
    v.src = url;
    v.autoplay = true;
    v.loop = item.loop !== false;
    v.muted = item.muted !== false;
    v.volume = typeof item.volume === 'number' ? item.volume : 0.5;
    v.playsInline = true;
    v.play().catch(() => {});
    v.addEventListener('loadedmetadata', () => {
      if (v.videoWidth && v.videoHeight) {
        window.overlayAPI.reportAspect(v.videoWidth / v.videoHeight);
      }
    });
    mediaEl = v;
  } else {
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.addEventListener('load', () => {
      if (img.naturalWidth && img.naturalHeight) {
        window.overlayAPI.reportAspect(img.naturalWidth / img.naturalHeight);
      }
    });
    mediaEl = img;
  }
  stage.appendChild(mediaEl);
}

function applyStyle(item) {
  if (!mediaEl) return;
  mediaEl.style.objectFit = item.fit || 'contain';
  const transforms = [];
  if (item.flipX) transforms.push('scaleX(-1)');
  if (item.rotation) transforms.push('rotate(' + item.rotation + 'deg)');
  mediaEl.style.transform = transforms.join(' ');
  stage.style.opacity = String(
    typeof item.opacity === 'number' ? item.opacity : 1
  );

  if (mediaEl.tagName === 'VIDEO') {
    mediaEl.loop = item.loop !== false;
    mediaEl.muted = item.muted !== false;
    mediaEl.volume = typeof item.volume === 'number' ? item.volume : 0.5;
  }

  label.textContent = item.name || 'Widget';
  document.body.classList.toggle('locked', !!item.locked);
}

function render(data) {
  if (!data || !data.item) return;
  current = data.item;
  buildMedia(data.item);
  applyStyle(data.item);
}

let dragging = false;

function draggable() {
  return current && !current.locked;
}

document.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || dragging || !draggable()) return;
  dragging = true;
  try {
    document.body.setPointerCapture(e.pointerId);
  } catch (_) {}
  window.overlayAPI.dragStart();
  e.preventDefault();
});

function stopDrag(e) {
  if (!dragging) return;
  dragging = false;
  try {
    document.body.releasePointerCapture(e.pointerId);
  } catch (_) {}
  window.overlayAPI.dragEnd();
}
document.addEventListener('pointerup', stopDrag);
document.addEventListener('pointercancel', stopDrag);

document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.overlayAPI.contextMenu();
});

document.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    window.overlayAPI.wheel(e.deltaY < 0 ? 'up' : 'down');
  },
  { passive: false }
);

document.addEventListener('pointerenter', () =>
  document.body.classList.add('hover')
);
document.addEventListener('pointerleave', () => {
  if (!dragging) document.body.classList.remove('hover');
});

window.overlayAPI.onInit(render);
window.overlayAPI.onUpdate(render);
