// editor/js/model/history.js
//
// Desfazer/refazer (Ctrl+Z / Ctrl+Shift+Z), até MAX_STEPS passos. Cada passo
// é uma foto do mapa inteiro no mesmo formato do map.json (compacto: só o que
// existe). commitHistory() compara com a última foto e, se algo mudou, vira
// um passo — é chamado ao fim de cada ação (traço do mouse, clique em painel).

import { GRID } from '../config.js';
import { state, makeAllLayers } from './state.js';
import { serializeMapFromLayers, buildLayersFromMapData } from '../../../shared/map-format.js';

const MAX_STEPS = 10;

let current = null;
const undoStack = [];
const redoStack = [];

// ================================================================================================================================================================================================================================================
// takeSnapshot

function takeSnapshot() {
  return JSON.stringify({
    layerOrder: state.layerOrder,
    map: serializeMapFromLayers(state.layerOrder, state.layers, GRID)
  });
}

// ================================================================================================================================================================================================================================================
// restoreSnapshot

function restoreSnapshot(snapshot) {
  const { layerOrder, map } = JSON.parse(snapshot);
  const { layers } = buildLayersFromMapData(map, GRID);
  // Andares vazios não aparecem no map.json; makeAllLayers recria todos.
  state.layers = makeAllLayers(layers);
  state.layerOrder = layerOrder;
  if (!layerOrder.includes(state.activeZ)) state.activeZ = layerOrder[0];
}

// ================================================================================================================================================================================================================================================
// resetHistory

export function resetHistory() {
  current = takeSnapshot();
  undoStack.length = 0;
  redoStack.length = 0;
}

// ================================================================================================================================================================================================================================================
// commitHistory

export function commitHistory() {
  if (current === null) return;
  const snapshot = takeSnapshot();
  if (snapshot === current) return;
  undoStack.push(current);
  if (undoStack.length > MAX_STEPS) undoStack.shift();
  redoStack.length = 0;
  current = snapshot;
}

// ================================================================================================================================================================================================================================================
// undo / redo — devolvem true se algo mudou

export function undo() {
  commitHistory();
  if (undoStack.length === 0) return false;
  redoStack.push(current);
  current = undoStack.pop();
  restoreSnapshot(current);
  return true;
}

export function redo() {
  if (redoStack.length === 0) return false;
  undoStack.push(current);
  current = redoStack.pop();
  restoreSnapshot(current);
  return true;
}
