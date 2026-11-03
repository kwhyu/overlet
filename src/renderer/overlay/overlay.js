'use strict';

const stage = document.getElementById('stage');
const label = document.getElementById('label');
const overlayApi = window.overlayAPI;

let mediaElement = null;
let currentItem = null;
let dragging = false;

function reportAspect(width, height) {
  if (width && height) overlayApi.reportAspect(width / height);
}

function applyVideoOptions(video, item) {
  video.loop = item.loop;
  video.muted = item.muted;
  video.volume = item.volume;
}

function setMediaError(failed) {
  document.body.classList.toggle('media-failed', failed);
}

function createVideo(item) {
  const video = document.createElement('video');
  video.src = toFileUrl(item.src);
  video.autoplay = true;
  video.playsInline = true;
  applyVideoOptions(video, item);
  video.play().catch(() => {});
  video.addEventListener('error', () => setMediaError(true));
  video.addEventListener('loadedmetadata', () => {
    setMediaError(false);
    reportAspect(video.videoWidth, video.videoHeight);
  });
  return video;
}

function createImage(item) {
  const image = document.createElement('img');
  image.src = toFileUrl(item.src);
  image.alt = '';
  image.addEventListener('error', () => setMediaError(true));
  image.addEventListener('load', () => {
    setMediaError(false);
    reportAspect(image.naturalWidth, image.naturalHeight);
  });
  return image;
}

function isCurrentMedia(item) {
  return mediaElement && currentItem.src === item.src && currentItem.type === item.type;
}

function updateMedia(item) {
  if (isCurrentMedia(item)) return;
  if (mediaElement) mediaElement.remove();
  mediaElement = item.type === 'video' ? createVideo(item) : createImage(item);
  stage.appendChild(mediaElement);
}

function applyStyle(item) {
  const transforms = [];
  if (item.flipX) transforms.push('scaleX(-1)');
  if (item.rotation) transforms.push(`rotate(${item.rotation}deg)`);

  mediaElement.style.objectFit = item.fit;
  mediaElement.style.transform = transforms.join(' ');
  stage.style.opacity = String(item.opacity);
  if (item.type === 'video') applyVideoOptions(mediaElement, item);

  label.textContent = item.name;
  document.body.classList.toggle('locked', item.locked);
}

function render({ item }) {
  updateMedia(item);
  currentItem = item;
  applyStyle(item);
}

function startDrag(event) {
  const canDrag = currentItem && !currentItem.locked;
  if (event.button !== 0 || dragging || !canDrag) return;
  dragging = true;
  document.body.setPointerCapture(event.pointerId);
  overlayApi.dragStart();
  event.preventDefault();
}

function stopDrag(event) {
  if (!dragging) return;
  dragging = false;
  if (document.body.hasPointerCapture(event.pointerId)) {
    document.body.releasePointerCapture(event.pointerId);
  }
  overlayApi.dragEnd();
}

document.addEventListener('pointerdown', startDrag);
document.addEventListener('pointerup', stopDrag);
document.addEventListener('pointercancel', stopDrag);
document.addEventListener('pointerenter', () => document.body.classList.add('hover'));
document.addEventListener('pointerleave', () => {
  if (!dragging) document.body.classList.remove('hover');
});
document.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  overlayApi.contextMenu();
});
document.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    overlayApi.wheel(event.deltaY < 0 ? 'up' : 'down');
  },
  { passive: false }
);

overlayApi.onInit(render);
overlayApi.onUpdate(render);
