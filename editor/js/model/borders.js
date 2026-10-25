// editor/js/model/borders.js

import { state } from './state.js';
import { getStairTop } from '../../../shared/stairs.js';
import { objectUse } from '../../../shared/assets.js';
import { refreshBordersAround, getStairTopKeys as stairTopKeysBelow } from '../../../shared/floor-borders.js';

// Bordas automáticas no estado do editor (regras em shared/floor-borders.js).
// Topo de escada fica sem piso (o jogo remove), então conta como vazio.

// Os topos de escada e de corda percorrem o andar de baixo inteiro: ficam guardados até a ação terminar (soltar o
// mouse, clicar, tecla) ou uma escada mudar, e por andar (desfazer e carregar trocam o andar inteiro).
let topsCache = new WeakMap();

// ================================================================================================================================================================================================================================================
// forgetTops
// Esquece os topos guardados (o andar de baixo pode ter mudado).

export function forgetTops() {
  topsCache = new WeakMap();
}

for (const event of ['mouseup', 'click', 'keydown']) window.addEventListener(event, forgetTops, true);

// ================================================================================================================================================================================================================================================
// cachedTops

function cachedTops(below, kind, compute) {
  if (!below) return new Set();
  let entry = topsCache.get(below);
  if (!entry) topsCache.set(below, entry = {});
  if (!entry[kind]) entry[kind] = compute();
  return entry[kind];
}

// ================================================================================================================================================================================================================================================
// getStairTopKeys
// Sqms do andar z que são topo de alguma escada do andar z-1.

export function getStairTopKeys(z) {
  const below = state.layers[z - 1];
  return cachedTops(below, 'stairs', () => stairTopKeysBelow(below, z - 1));
}

// ================================================================================================================================================================================================================================================
// getRopeTopKeys
// Sqms do andar z acima de uma marca de corda do andar z-1 (Uso corda): pra
// onde a corda leva. Só marcação: o piso fica.

export function getRopeTopKeys(z) {
  const below = state.layers[z - 1];
  return cachedTops(below, 'rope', () => ropeTopKeys(below, z));
}

// ================================================================================================================================================================================================================================================
// ropeTopKeys

function ropeTopKeys(below, z) {
  const keys = new Set();
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
  if (stairsChanged) forgetTops();
  const layer = state.layers[z];
  if (layer) refreshBordersAround(layer, x, y, getStairTopKeys(z));
  if (!stairsChanged || !state.layers[z + 1]) return;
  const top = getStairTop(x, y, z);
  refreshBordersAround(state.layers[z + 1], top.x, top.y, getStairTopKeys(z + 1));
}
