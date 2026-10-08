// editor/js/view/zoom.js

import { canvas, canvasWrap } from './canvas-renderer.js';

const KEY = 'editor-zoom';
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const STEP = 1.1;
let zoom = 1;

// ================================================================================================================================================================================================================================================
// applyZoom
// Muda o tamanho do mapa na tela (a HUD não muda) mantendo sob (clientX, clientY) o mesmo ponto do mapa.

function applyZoom(next, clientX, clientY) {
  const value = Math.min(Math.max(next, MIN_ZOOM), MAX_ZOOM);
  if (value === zoom) return;
  const before = canvas.getBoundingClientRect();
  const mapX = (clientX - before.left) / zoom;
  const mapY = (clientY - before.top) / zoom;
  zoom = value;
  canvas.style.width = `${canvas.width * zoom}px`;
  canvas.style.height = `${canvas.height * zoom}px`;
  const after = canvas.getBoundingClientRect();
  canvasWrap.scrollLeft += after.left + mapX * zoom - clientX;
  canvasWrap.scrollTop += after.top + mapY * zoom - clientY;
  try {
    localStorage.setItem(KEY, String(zoom));
  } catch (error) {
    return;
  }
}

// ================================================================================================================================================================================================================================================
// initZoom
// A roda do mouse dá zoom no mapa (no ponto do cursor); segurar Espaço vira mão (grab) e arrastar move o mapa; o zoom fica guardado no navegador.

export function initZoom() {
  let saved = 1;
  try {
    saved = Number(localStorage.getItem(KEY)) || 1;
  } catch (error) {
    saved = 1;
  }
  const rect = canvasWrap.getBoundingClientRect();
  applyZoom(saved, rect.left + rect.width / 2, rect.top + rect.height / 2);
  canvasWrap.addEventListener('wheel', (event) => {
    event.preventDefault();
    applyZoom(zoom * (event.deltaY < 0 ? STEP : 1 / STEP), event.clientX, event.clientY);
  }, { passive: false });
  let spaceHeld = false;
  let drag = null;
  const typing = (event) => /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || typing(event)) return;
    event.preventDefault();
    spaceHeld = true;
    canvasWrap.classList.add('pan');
  });
  window.addEventListener('keyup', (event) => {
    if (event.code !== 'Space') return;
    spaceHeld = false;
    canvasWrap.classList.remove('pan');
  });
  canvasWrap.addEventListener('mousedown', (event) => {
    if (!spaceHeld || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    drag = { x: event.clientX, y: event.clientY, left: canvasWrap.scrollLeft, top: canvasWrap.scrollTop };
    canvasWrap.classList.add('dragging');
  }, true);
  window.addEventListener('mousemove', (event) => {
    if (!drag) return;
    canvasWrap.scrollLeft = drag.left - (event.clientX - drag.x);
    canvasWrap.scrollTop = drag.top - (event.clientY - drag.y);
  });
  window.addEventListener('mouseup', () => {
    drag = null;
    canvasWrap.classList.remove('dragging');
  });
}
