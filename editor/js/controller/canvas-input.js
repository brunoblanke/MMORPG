// js/controller/canvas-input.js

import { canvas, cellFromEvent, scheduleRender } from '../view/canvas-renderer.js';
import { state, TOOLS } from '../model/state.js';
import { updateStats } from '../view/tools-panel.js';
import { openEnemyForm } from '../view/forms.js';
import { addFloorToCell, restackItems } from '../../../shared/map-format.js';
import { isTibiaGround } from '../../../shared/tibia-registry.js';

// ================================================================================================================================================================================================================================================
// eraseTopmost
//
// A borracha tira só o que está mais em cima no sqm a cada passada (um traço
// passa uma vez por célula): criatura, respawn, objetos do topo pra baixo,
// buraco, piso de cima e, por último, o piso de baixo.

function eraseTopmost(cell) {
  if (cell.enemy) { cell.enemy = null; return; }
  if (cell.spawn) { cell.spawn = false; return; }
  if (cell.objects.length > 0) { cell.objects.pop(); return; }
  if (cell.hole) { cell.hole = false; return; }
  if (cell.floorTop) { cell.floorTop = null; return; }
  cell.floor = null;
}

// ================================================================================================================================================================================================================================================
// applyTool

export function applyTool(x, y, clientX, clientY) {
  if (state.tool === 'stairs') {
    // Destino é fixo pela posição (shared/stairs.js): não há nada pra escolher.
    const cell = state.layers[state.activeZ][`${x},${y}`];
    if (!cell.objects.some(o => o.type === 'Stairs')) cell.objects.push({ type: 'Stairs' });
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
    addFloorToCell(cell, state.floorPaint);
  } else if (state.tool === 'eraser') {
    eraseTopmost(cell);
  } else if (state.tool === 'hole') {
    cell.hole = true;
  } else if (state.tool === 'safe') {
    if (state.strokeTouched.size === 1) state.safePaintValue = !cell.safe;
    cell.safe = state.safePaintValue;
  } else if (state.tool === 'item') {
    cell.objects.push({ type: state.itemPaint, step: 0 });
    restackItems(cell.objects);
  } else if (state.tool === 'tibia' && state.tibiaPaint) {
    if (isTibiaGround(state.tibiaPaint)) {
      addFloorToCell(cell, state.tibiaPaint);
    } else {
      cell.objects.push({ type: state.tibiaPaint, step: 0 });
      restackItems(cell.objects);
    }
  } else {
    const t = TOOLS.find(t => t.id === state.tool);
    if (t && t.obj) {
      cell.objects.push({ type: t.obj });
    }
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