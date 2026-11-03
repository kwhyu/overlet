'use strict';

const MIN_SIZE = 40;
const MAX_SIZE = 8000;

const DOCK_OPTIONS = [
  { id: null, label: 'Free position' },
  { id: 'bottom', label: 'Bottom, full width' },
  { id: 'top', label: 'Top, full width' },
  { id: 'left', label: 'Left, full height' },
  { id: 'right', label: 'Right, full height' },
  { id: 'fill', label: 'Fill the screen' },
  { id: 'top-left', label: 'Top-left corner' },
  { id: 'top-right', label: 'Top-right corner' },
  { id: 'bottom-left', label: 'Bottom-left corner' },
  { id: 'bottom-right', label: 'Bottom-right corner' },
];
const DOCK_IDS = DOCK_OPTIONS.map(({ id }) => id).filter(Boolean);
const HORIZONTAL_STRIPS = ['top', 'bottom'];
const VERTICAL_STRIPS = ['left', 'right'];

const DEFAULT_STRIP_SHARE = 0.5;

const clampSize = (value) => Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(value)));
const isStrip = (dock) => HORIZONTAL_STRIPS.includes(dock) || VERTICAL_STRIPS.includes(dock);
const isStretching = (dock) => dock === 'fill' || isStrip(dock);

function thicknessOf(dock, bounds) {
  return HORIZONTAL_STRIPS.includes(dock) ? bounds.height : bounds.width;
}

function horizontalStrip(item, area, ratio) {
  const fitted = Math.min(area.width / ratio, area.height * DEFAULT_STRIP_SHARE);
  const height = Math.min(area.height, clampSize(item.thickness || fitted));
  const y = item.dock === 'top' ? area.y : area.y + area.height - height;
  return { x: area.x, y, width: area.width, height };
}

function verticalStrip(item, area, ratio) {
  const fitted = Math.min(area.height * ratio, area.width * DEFAULT_STRIP_SHARE);
  const width = Math.min(area.width, clampSize(item.thickness || fitted));
  const x = item.dock === 'left' ? area.x : area.x + area.width - width;
  return { x, y: area.y, width, height: area.height };
}

function corner(item, area) {
  const width = Math.round(item.width);
  const height = Math.round(item.height);
  const x = item.dock.endsWith('left') ? area.x : area.x + area.width - width;
  const y = item.dock.startsWith('top') ? area.y : area.y + area.height - height;
  return { x, y, width, height };
}

function dockBounds(item, area, ratio) {
  if (item.dock === 'fill') {
    return { x: area.x, y: area.y, width: area.width, height: area.height };
  }
  if (HORIZONTAL_STRIPS.includes(item.dock)) return horizontalStrip(item, area, ratio);
  if (VERTICAL_STRIPS.includes(item.dock)) return verticalStrip(item, area, ratio);
  return corner(item, area);
}

module.exports = {
  DOCK_IDS,
  DOCK_OPTIONS,
  MAX_SIZE,
  MIN_SIZE,
  clampSize,
  dockBounds,
  isStretching,
  isStrip,
  thicknessOf,
};
