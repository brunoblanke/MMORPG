// editor/js/model/borders.js

import { state } from './state.js';
import { getStairTop } from '../../../shared/stairs.js';
import { objectUse } from '../../../shared/assets.js';
import { refreshBordersAround, getStairTopKeys as stairTopKeysBelow } from '../../../shared/floor-borders.js';

// Bordas automáticas no estado do editor (regras em shared/floor-borders.js). Só o piso pintado gera borda: escada
// (e o topo dela, sem piso no andar de cima) não mexe nas bordas.

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
// Piso pintado no sqm (x, y) do andar z: refaz as bordas em volta (só o piso pintado gera borda automática; borracha,
// objetos, paredes e acessos não mexem nelas). Escada só esquece os topos guardados
// (desenho), sem mexer em borda nenhuma.

export function refreshBordersAt(z, x, y, stairsChanged = false) {
  if (stairsChanged) {
    forgetTops();
    return;
  }
  const layer = state.layers[z];
  if (layer) refreshBordersAround(layer, x, y);
}
