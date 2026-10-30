// js/controller/canvas-input.js

import { canvas, cellFromEvent, scheduleRender, scheduleOverlay } from '../view/canvas-renderer.js';
import { state } from '../model/state.js';
import { updateStats } from '../view/tools-panel.js';
import { openEnemyForm, openSelectPanel } from '../view/forms.js';
import { addFloorToCell, restackItems } from '../../../shared/map-format.js';
import { refreshBordersAt } from '../model/borders.js';
import { isStairsAccess, isEntranceType, conjuntoPartes } from '../../../shared/assets.js';
import { itemInfo } from '../../../shared/items.js';
import { brushCells, MAX_BRUSH, areaDrag, areaCells } from '../model/brush.js';

const BOT_LEVEL = 20;

// ================================================================================================================================================================================================================================================
// eraseTopmost
//
// A borracha tira só o que está mais em cima no sqm a cada passada (um traço
// passa uma vez por célula): bot, NPC, criatura, respawn, objetos do topo pra baixo,
// bordas (da mais nova pra mais antiga), buraco, piso de cima e, por último,
// o piso de baixo. Devolve o que tirou.

function eraseTopmost(cell) {
  if (cell.bot) { cell.bot = null; return 'bot'; }
  if (cell.npc) { cell.npc = null; return 'npc'; }
  if (cell.enemy) { cell.enemy = null; return 'enemy'; }
  if (cell.spawn) { cell.spawn = false; return 'spawn'; }
  if (cell.objects.length > 0) { return isStairsAccess(cell.objects.pop().type) ? 'stairs' : 'object'; }
  if (cell.borders.length > 0) { cell.borders.pop(); return 'border'; }
  if (cell.hole) { cell.hole = null; return 'hole'; }
  if (cell.floorTop) { cell.floorTop = null; return 'floor'; }
  if (cell.floor) { cell.floor = null; return 'floor'; }
  return null;
}

// ================================================================================================================================================================================================================================================
// addBorderPiece
// Borda posta à mão: entra por cima das outras, sem repetir a mesma peça.

function addBorderPiece(cell, piece) {
  if (cell.borders.some(b => b.type === piece.type && b.variant === piece.variant)) return;
  cell.borders.push({ type: piece.type, variant: piece.variant });
}

// ================================================================================================================================================================================================================================================
// applyTool

export function applyTool(x, y, clientX, clientY) {
  if (state.tool === 'select') {
    openSelectPanel(x, y, clientX, clientY);
    return;
  }
  if (state.tool === 'enemy') {
    openEnemyForm(x, y, clientX, clientY);
    return;
  }
  if (state.tool === 'npc') {
    const cell = state.layers[state.activeZ][`${x},${y}`];
    if (state.npcPaint) cell.npc = { type: state.npcPaint };
    updateStats();
    scheduleRender();
    return;
  }
  if (state.tool === 'bot') {
    const cell = state.layers[state.activeZ][`${x},${y}`];
    if (state.botPaint) cell.bot = { type: state.botPaint, lvl: BOT_LEVEL };
    updateStats();
    scheduleRender();
    return;
  }
  if (state.tool === 'spawn') {
    for (const other of Object.values(state.layers)) {
      Object.values(other).forEach(c => { c.spawn = false; });
    }
    state.layers[state.activeZ][`${x},${y}`].spawn = true;
    scheduleRender();
    return;
  }

  for (const cell of brushCells(x, y)) paintCell(cell.x, cell.y);
  updateStats();
  scheduleRender();
}

// ================================================================================================================================================================================================================================================
// paintCell
// A ferramenta num sqm (uma vez por traço).

function paintCell(x, y) {
  const strokeKey = `${x},${y}`;
  if (state.painting && state.strokeTouched.has(strokeKey)) return;
  state.strokeTouched.add(strokeKey);

  const layer = state.layers[state.activeZ];
  const cell = layer[strokeKey];

  if (state.tool === 'floor') {
    if (state.floorPaint && addFloorToCell(cell, state.floorPaint)) {
      if (state.floorBorders) refreshBordersAt(state.activeZ, x, y);
      else cell.borders = [];
    }
  } else if (state.tool === 'eraser') {
    const erased = eraseTopmost(cell);
    if (erased === 'stairs') refreshBordersAt(state.activeZ, x, y, true);
  } else if (state.tool === 'access') {
    placeAccess(layer, cell, x, y, state.accessPaint);
  } else if (state.tool === 'border') {
    if (state.borderPaint) addBorderPiece(cell, state.borderPaint);
  } else if (state.tool === 'border-eraser') {
    // Por camadas, como a borracha: cada passada tira só a borda de cima.
    cell.borders.pop();
  } else if (state.tool === 'safe') {
    if (state.strokeTouched.size === 1) state.safePaintValue = !cell.safe;
    cell.safe = state.safePaintValue;
  } else if (state.tool === 'house') {
    const house = state.housePaint;
    if (!house.name) return;
    if (state.strokeTouched.size === 1) state.safePaintValue = !(cell.house && cell.house.name === house.name);
    cell.house = state.safePaintValue ? { name: house.name, price: house.price } : null;
  } else if (state.tool === 'item' || state.tool === 'deco') {
    placeObject(layer, cell, x, y, state.tool === 'deco' ? state.decoPaint : state.itemPaint);
  } else if (state.tool === 'wall') {
    if (state.wallPaint) cell.objects.push({ type: state.wallPaint });
  }
}

// ================================================================================================================================================================================================================================================
// placeAccess
// Acesso posto no sqm, pela receita: escada (ou buraco de corda) entra uma só por sqm; nenhum mexe nas bordas;
// entrada (buraco, monte, bueiro) vai no lugar de buraco do sqm; o resto (teletransporte, degraus) é objeto comum.

function placeAccess(layer, cell, x, y, paint) {
  if (!paint) return;
  if (isStairsAccess(paint)) {
    if (cell.objects.some(o => isStairsAccess(o.type))) return;
    cell.objects.push({ type: paint });
    refreshBordersAt(state.activeZ, x, y, true);
  } else if (isEntranceType(paint)) {
    if (cell.hole === paint) return;
    cell.hole = paint;
  } else {
    placeObject(layer, cell, x, y, paint);
  }
}

// ================================================================================================================================================================================================================================================
// placeObject
// Objeto posto no sqm: conjunto de partes põe todas juntas; item empilhável soma na pilha de cima.

function placeObject(layer, cell, x, y, paint) {
  const parts = paint ? conjuntoPartes(paint) : [];
  if (parts.length) {
    for (const part of parts) {
      const target = layer[`${x + part.dx},${y + part.dy}`];
      if (!target) continue;
      target.objects.push({ type: part.type, step: 0 });
      restackItems(target.objects);
    }
  } else if (paint) {
    const top = cell.objects[cell.objects.length - 1];
    const stack = itemInfo(paint).stack;
    if (stack && top && top.type === paint && (top.count || 1) < stack) {
      top.count = (top.count || 1) + 1;
    } else {
      cell.objects.push({ type: paint, step: 0 });
    }
    restackItems(cell.objects);
  }
}

// ================================================================================================================================================================================================================================================
// updateCoordDisplay

export function updateCoordDisplay(evt) {
  const cell = cellFromEvent(evt);
  if (!cell) return;
  const coordLocal = document.getElementById('coordLocal');
  const coordWorld = document.getElementById('coordWorld');
  if (!coordLocal || !coordWorld) return;
  coordLocal.textContent = `${cell.x},${cell.y}`;
  coordWorld.textContent = `${cell.x},${cell.y}`;
}

canvas.addEventListener('mousedown', (evt) => {
  if (evt.button !== 0) return;
  const cell = cellFromEvent(evt);
  if (!cell) return;
  if (areaDrag(evt.shiftKey)) {
    state.area = { x0: cell.x, y0: cell.y, x1: cell.x, y1: cell.y, clientX: evt.clientX, clientY: evt.clientY };
    return;
  }
  state.painting = true;
  state.strokeTouched = new Set();
  applyTool(cell.x, cell.y, evt.clientX, evt.clientY);
});

canvas.addEventListener('mousemove', (evt) => {
  updateCoordDisplay(evt);
  const hover = cellFromEvent(evt);
  if (!state.hoverCell || !hover || hover.x !== state.hoverCell.x || hover.y !== state.hoverCell.y) {
    state.hoverCell = hover;
    scheduleOverlay();
  }
  if (state.area && hover && (hover.x !== state.area.x1 || hover.y !== state.area.y1)) {
    state.area.x1 = hover.x;
    state.area.y1 = hover.y;
    scheduleOverlay();
  }
  if (!state.painting) return;
  if ((state.tool === 'access' && isStairsAccess(state.accessPaint || '')) || state.tool === 'enemy' || state.tool === 'npc' || state.tool === 'bot' || state.tool === 'spawn' || state.tool === 'select') return;
  const cell = cellFromEvent(evt);
  if (!cell) return;
  applyTool(cell.x, cell.y, evt.clientX, evt.clientY);
});

canvas.addEventListener('mouseleave', () => {
  state.hoverCell = null;
  scheduleOverlay();
  const coordLocal = document.getElementById('coordLocal');
  const coordWorld = document.getElementById('coordWorld');
  if (coordLocal) coordLocal.textContent = '-';
  if (coordWorld) coordWorld.textContent = '-';
});

window.addEventListener('mouseup', () => {
  state.painting = false;
  if (state.area) fillArea();
});

// ================================================================================================================================================================================================================================================
// fillArea
// Solta o mouse: sem ter arrastado, pinta como o pincel naquele sqm; arrastando, a ferramenta roda uma vez em cada sqm
// do retângulo marcado.

function fillArea() {
  const area = state.area;
  state.area = null;
  state.strokeTouched = new Set();
  if (area.x0 === area.x1 && area.y0 === area.y1) {
    applyTool(area.x0, area.y0, area.clientX, area.clientY);
    return;
  }
  for (const cell of areaCells(area)) paintCell(cell.x, cell.y);
  updateStats();
  scheduleRender();
}

// Setas ↑/↓ aumentam e diminuem o pincel (fora de campos de texto).
window.addEventListener('keydown', (evt) => {
  if (evt.key !== 'ArrowUp' && evt.key !== 'ArrowDown') return;
  const tag = evt.target && evt.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  evt.preventDefault();
  const delta = evt.key === 'ArrowUp' ? 1 : -1;
  state.brushSize = Math.max(1, Math.min(MAX_BRUSH, state.brushSize + delta));
  scheduleOverlay();
});
// Esc desiste do retângulo que está sendo marcado.
window.addEventListener('keydown', (evt) => {
  if (evt.key !== 'Escape' || !state.area) return;
  state.area = null;
  scheduleOverlay();
});
