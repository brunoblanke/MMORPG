// editor/js/view/image-cache.js

import { IMG_BASE } from '../config.js';
import { loadImage as loadImageShared, getCachedImage } from '../../../shared/image-loader.js';

const brokenSet = new Set();
let onUpdate = () => {};

// ================================================================================================================================================================================================================================================
// setImageUpdateCallback

export function setImageUpdateCallback(cb) {
  onUpdate = cb;
}

// ================================================================================================================================================================================================================================================
// loadImage

export function loadImage(relPath) {
  const cached = getCachedImage(IMG_BASE + relPath);
  if (cached) return cached;

  const entry = loadImageShared(IMG_BASE + relPath);
  entry.promise
    .then(() => onUpdate())
    .catch(() => {
      brokenSet.add(relPath);
      renderBrokenList();
      onUpdate();
    });
  return entry;
}

// ================================================================================================================================================================================================================================================
// preloadAll

export function preloadAll(defsList) {
  defsList.forEach(defs => {
    Object.values(defs).forEach(entry => {
      const file = typeof entry === 'string' ? entry : entry.file;
      loadImage(file);
    });
  });
}

// ================================================================================================================================================================================================================================================
// renderBrokenList

export function renderBrokenList() {
  const el = document.getElementById('brokenList');
  if (!el) return;
  if (brokenSet.size === 0) { el.textContent = ''; return; }
  el.textContent = 'sprite não encontrado: ' + Array.from(brokenSet).join(', ');
}