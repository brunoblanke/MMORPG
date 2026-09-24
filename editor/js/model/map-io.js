// editor/js/model/map-io.js

import { GRID } from '../config.js';
import { state, makeAllLayers } from './state.js';
import { getAllFloors, isValidFloor, GROUND_FLOOR } from '../../../shared/constants.js';
import { serializeMapFromLayers, buildLayersFromMapData, loadMapDataFromURL } from '../../../shared/map-format.js';
import { hasSavedBorders } from '../../../shared/floor-borders.js';
import { rebuildAllBorders } from './borders.js';

// Mesmo arquivo que o jogo carrega (js/config.js → mapDataUrl).
const MAP_URL = '../data/map.json';
const SAVE_URL = '/api/save-map';

let lastSavedJson = null;

// ================================================================================================================================================================================================================================================
// buildMapData

function buildMapData() {
  return serializeMapFromLayers(state.layerOrder, state.layers, GRID);
}

// ================================================================================================================================================================================================================================================
// loadMapIntoState

export async function loadMapIntoState() {
  const mapData = await loadMapDataFromURL(MAP_URL);
  const { layers, layerOrder } = buildLayersFromMapData(mapData, GRID);

  const outside = layerOrder.filter(z => !isValidFloor(Number(z)));
  if (outside.length) {
    console.warn(`⚠️ Andares fora da faixa ignorados (serão removidos ao salvar): ${outside.join(', ')}`);
  }

  state.layers = makeAllLayers(layers);
  state.layerOrder = getAllFloors();
  state.activeZ = GROUND_FLOOR;

  // Mapa de antes das bordas gravadas: gera todas (igual ao que o jogo fazia).
  if (!hasSavedBorders(mapData)) rebuildAllBorders();

  lastSavedJson = JSON.stringify(buildMapData());
}

// ================================================================================================================================================================================================================================================
// saveMap

export async function saveMap() {
  const mapData = buildMapData();
  const response = await fetch(SAVE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapData)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.message || `HTTP ${response.status}`);
  }
  lastSavedJson = JSON.stringify(mapData);
}

// ================================================================================================================================================================================================================================================
// hasUnsavedChanges

export function hasUnsavedChanges() {
  return lastSavedJson !== null && JSON.stringify(buildMapData()) !== lastSavedJson;
}
