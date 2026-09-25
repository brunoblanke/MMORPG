// js/controller/canvas-input.js

import { canvas, cellFromEvent, scheduleRender } from '../view/canvas-renderer.js';
import { state } from '../model/state.js';
import { updateStats } from '../view/tools-panel.js';
import { openEnemyForm } from '../view/forms.js';
import { addFloorToCell, restackItems } from '../../../shared/map-format.js';
import { refreshBordersAt } from '../model/borders.js';
import { isStairsType } from '../../../shared/assets.js';

// ================================================================================================================================================================================================================================================
// eraseTopmost
//
// A borracha tira só o que está mais em cima no sqm a cada passada (um traço
// passa uma vez por célula): criatura, respawn, objetos do topo pra baixo,
// bordas (da mais nova pra mais antiga), buraco, piso de cima e, por último,
// o piso de baixo. Devolve o que tirou.

function eraseTopmost(cell) {
  if (cell.enemy) { cell.enemy = null; return 'enemy'; }
  if (cell.spawn) { cell.spawn = false; return 'spawn'; }
  if (cell.objects.length > 0) { return isStairsType(cell.objects.pop().type) ? 'stairs' : 'object'; }
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
  if (state.tool === 'stairs') {
    // Destino é fixo pela posição (shared/stairs.js): só escolhe o desenho.
    const cell = state.layers[state.activeZ][`${x},${y}`];
    if (state.stairsPaint && !cell.objects.some(o => isStairsType(o.type))) {
      cell.objects.push({ type: state.stairsPaint });
      refreshBordersAt(state.activeZ, x, y, true);
    }
    updateStats();
    scheduleRender();
    return;
  }
  if (state.tool === 'enemy') {
    openEnemyForm(x, y, clientX, clientY);
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

  const strokeKey = `${x},${y}`;
  if (state.painting && state.strokeTouched.has(strokeKey)) return;
  state.strokeTouched.add(strokeKey);

  const layer = state.layers[state.activeZ];
  const cell = layer[strokeKey];

  if (state.tool === 'floor') {
    if (state.floorPaint && addFloorToCell(cell, state.floorPaint)) refreshBordersAt(state.activeZ, x, y);
  } else if (state.tool === 'eraser') {
    const erased = eraseTopmost(cell);
    if (erased === 'floor' || erased === 'hole' || erased === 'stairs') refreshBordersAt(state.activeZ, x, y, erased === 'stairs');
  } else if (state.tool === 'hole') {
    if (state.holePaint && cell.hole !== state.holePaint) {
      cell.hole = state.holePaint;
      refreshBordersAt(state.activeZ, x, y);
    }
  } else if (state.tool === 'border') {
    if (state.borderPaint) addBorderPiece(cell, state.borderPaint);
  } else if (state.tool === 'border-eraser') {
    cell.borders = [];
  } else if (state.tool === 'safe') {
    if (state.strokeTouched.size === 1) state.safePaintValue = !cell.safe;
    cell.safe = state.safePaintValue;
  } else if (state.tool === 'item') {
    if (state.itemPaint) {
      cell.objects.push({ type: state.itemPaint, step: 0 });
      restackItems(cell.objects);
    }
  } else if (state.tool === 'wall') {
    if (state.wallPaint) cell.objects.push({ type: state.wallPaint });
  }

  updateStats();
  scheduleRender();
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
  const cell = cellFromEvent(evt);
  if (!cell) return;
  state.painting = true;
  state.strokeTouched = new Set();
  applyTool(cell.x, cell.y, evt.clientX, evt.clientY);
});

canvas.addEventListener('mousemove', (evt) => {
  updateCoordDisplay(evt);
  if (!state.painting) return;
  if (state.tool === 'stairs' || state.tool === 'enemy' || state.tool === 'spawn') return;
  const cell = cellFromEvent(evt);
  if (!cell) return;
  applyTool(cell.x, cell.y, evt.clientX, evt.clientY);
});

canvas.addEventListener('mouseleave', () => {
  const coordLocal = document.getElementById('coordLocal');
  const coordWorld = document.getElementById('coordWorld');
  if (coordLocal) coordLocal.textContent = '-';
  if (coordWorld) coordWorld.textContent = '-';
});

window.addEventListener('mouseup', () => { state.painting = false; });