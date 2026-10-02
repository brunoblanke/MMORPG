// editor/js/model/borders.js

import { state } from './state.js';
import { getStairTop } from '../../../shared/stairs.js';
import { objectUse } from '../../../shared/assets.js';
import { refreshBordersAround, getStairTopKeys as stairTopKeysBelow } from '../../../shared/floor-borders.js';

// Bordas automáticas no estado do editor (regras em shared/floor-borders.js).
// Topo de escada fica sem piso (o jogo remove), então conta como vazio.

// ================================================================================================================================================================================================================================================
// getStairTopKeys
// Sqms do andar z que são topo de alguma escada do andar z-1.

export function getStairTopKeys(z) {
  return stairTopKeysBelow(state.layers[z - 1], z - 1);
}

// ================================================================================================================================================================================================================================================
// getRopeTopKeys
// Sqms do andar z acima de uma marca de corda do andar z-1 (Uso corda): pra
// onde a corda leva. Só marcação: o piso fica.

export function getRopeTopKeys(z) {
  const keys = new Set();
  const below = state.layers[z - 1];
  if (!below) return keys;
  for (const [key, cell] of Object.entries(below)) {
    if (!cell.objects.some(o => objectUse(o.type) === 'corda')) continue;
    const [x, y] = key.split(',').map(Number);
    const top = getStairTop(x, y, z - 1);
    keys.add(`${top.x},${top.y}`);
  }
  return keys;
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
