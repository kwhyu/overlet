'use strict';

function toFileUrl(filePath) {
  if (!filePath) return '';
  const normalized = filePath.replace(/\\/g, '/');
  const absolute = normalized.startsWith('/') ? normalized : `/${normalized}`;
  const encoded = absolute
    .split('/')
    .map(encodeURIComponent)
    .join('/')
    .replace(/^\/([a-z])%3A/i, '/$1:');
  return encoded.startsWith('//') ? `file:${encoded}` : `file://${encoded}`;
}
