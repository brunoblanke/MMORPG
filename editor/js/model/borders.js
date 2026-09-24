// editor/js/model/borders.js

import { state } from './state.js';
import { getStairTop } from '../../../shared/stairs.js';
import { refreshBordersAround, rebuildLayerBorders, getStairTopKeys as stairTopKeysBelow } from '../../../shared/floor-borders.js';

// Bordas automáticas no estado do editor (regras em shared/floor-borders.js).
// Topo de escada fica sem piso (o jogo remove), então conta como vazio.

// ================================================================================================================================================================================================================================================
// getStairTopKeys
// Sqms do andar z que são topo de alguma escada do andar z-1.

export function getStairTopKeys(z) {
  return stairTopKeysBelow(state.layers[z - 1], z - 1);
}

// ================================================================================================================================================================================================================================================
// refreshBordersAt
// Piso, buraco ou escada mudou no sqm (x, y) do andar z: refaz as bordas em
// volta. Escada também muda o topo dela, no andar de cima.

export function refreshBordersAt(z, x, y, stairsChanged = false) {
  const layer = state.layers[z];
  if (layer) refreshBordersAround(layer, x, y, getStairTopKeys(z));
  if (!stairsChanged || !state.layers[z + 1]) return;
  const top = getStairTop(x, y, z);
  refreshBordersAround(state.layers[z + 1], top.x, top.y, getStairTopKeys(z + 1));
}

// ================================================================================================================================================================================================================================================
// rebuildBorders
// Refaz todas as bordas do andar z (descarta o que foi mexido à mão).

export function rebuildBorders(z) {
  if (state.layers[z]) rebuildLayerBorders(state.layers[z], getStairTopKeys(z));
}

// ================================================================================================================================================================================================================================================
// rebuildAllBorders
// Mapa antigo (sem bordas gravadas): gera as bordas de todos os andares.

export function rebuildAllBorders() {
  for (const z of state.layerOrder) rebuildBorders(z);
}
