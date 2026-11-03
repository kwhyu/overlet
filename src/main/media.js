'use strict';

const path = require('path');
const { dialog } = require('electron');

const ANIMATED_IMAGE_EXTENSIONS = ['gif', 'apng'];
const IMAGE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'webp',
  'avif',
  'svg',
  'bmp',
  'ico',
  ...ANIMATED_IMAGE_EXTENSIONS,
];
const VIDEO_EXTENSIONS = ['webm'];
const SUPPORTED_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

const FILE_FILTERS = [
  { name: 'Media', extensions: SUPPORTED_EXTENSIONS },
  { name: 'Images', extensions: IMAGE_EXTENSIONS },
  { name: 'Video', extensions: VIDEO_EXTENSIONS },
  { name: 'All Files', extensions: ['*'] },
];

const extensionOf = (filePath) => path.extname(filePath).slice(1).toLowerCase();

function guessType(filePath) {
  const extension = extensionOf(filePath);
  if (VIDEO_EXTENSIONS.includes(extension)) return 'video';
  if (ANIMATED_IMAGE_EXTENSIONS.includes(extension)) return 'gif';
  return 'image';
}

function baseName(filePath) {
  return path.parse(filePath).name;
}

async function pickFiles({ title, multi }) {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title,
    properties: multi ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: FILE_FILTERS,
  });
  if (canceled || filePaths.length === 0) return null;
  return filePaths.map((filePath) => ({ filePath, type: guessType(filePath) }));
}

function describeFiles(filePaths) {
  return filePaths
    .filter((filePath) => typeof filePath === 'string')
    .filter((filePath) => SUPPORTED_EXTENSIONS.includes(extensionOf(filePath)))
    .map((filePath) => ({ filePath, type: guessType(filePath) }));
}

module.exports = { baseName, describeFiles, pickFiles };
