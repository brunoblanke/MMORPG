// editor/js/model/map-io.js

import { GRID } from '../config.js';
import { state, makeEmptyLayer } from './state.js';
import { serializeMapFromLayers, buildLayersFromMapData, loadMapDataFromURL } from '../../../shared/map-format.js';

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

  state.layers = layers;
  state.layerOrder = layerOrder.length ? layerOrder : [0];
  if (!state.layers[0]) {
    state.layers[0] = makeEmptyLayer();
    state.layerOrder.unshift(0);
  }
  state.activeZ = state.layerOrder[0];

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
