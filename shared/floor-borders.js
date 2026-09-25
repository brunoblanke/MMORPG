// shared/floor-borders.js

import { computeBorderPieces } from './floor-variant.js';
import { getStairTop } from './stairs.js';
import { isFloorType, isStairsType } from './assets.js';

// Bordas de piso como peças do mapa. O editor gera sozinho (ao pintar ou
// apagar piso, buraco ou escada, recalcula os 3×3 em volta) e dá pra tirar
// ou pôr uma a uma. No map.json cada borda é uma entrada 'Border:<piso>:<peça>'
// (o piso é a folha, ex.: 'Border:estrutura/pisos/piso-grama-1:n').
// Mapas até a versão 1 não tinham bordas gravadas: o jogo as gerava na hora.

export const BORDER_PREFIX = 'Border:';
export const BORDER_VARIANTS = ['n', 's', 'l', 'o', 'nl', 'no', 'sl', 'so', 'int-nl', 'int-no', 'int-sl', 'int-so'];
export const BORDERS_SAVED_SINCE_VERSION = 2;

// ================================================================================================================================================================================================================================================
// borderEntryType

export function borderEntryType(piece) {
  return `${BORDER_PREFIX}${piece.type}:${piece.variant}`;
}

// ================================================================================================================================================================================================================================================
// parseBorderType
// 'Border:estrutura/pisos/piso-grama-1:nl' → { type: 'estrutura/pisos/piso-grama-1',
// variant: 'nl' }; outro tipo → null.

export function parseBorderType(type) {
  if (typeof type !== 'string' || !type.startsWith(BORDER_PREFIX)) return null;
  const [floorType, variant] = type.slice(BORDER_PREFIX.length).split(':');
  if (!isFloorType(floorType) || !BORDER_VARIANTS.includes(variant)) return null;
  return { type: floorType, variant };
}

// ================================================================================================================================================================================================================================================
// hasSavedBorders
// O mapa já traz as bordas (versão 2 em diante)?

export function hasSavedBorders(mapData) {
  return (mapData.version || 1) >= BORDERS_SAVED_SINCE_VERSION;
}

// ================================================================================================================================================================================================================================================
// getStairTopKeys
// Sqms do andar de cima que são topo de alguma escada da camada `below`
// (andar zBelow): ficam sem piso, então contam como vazios pras bordas.

export function getStairTopKeys(below, zBelow) {
  const keys = new Set();
  if (!below) return keys;
  for (const [key, cell] of Object.entries(below)) {
    if (!cell.objects.some(o => isStairsType(o.type))) continue;
    const [x, y] = key.split(',').map(Number);
    const top = getStairTop(x, y, zBelow);
    keys.add(`${top.x},${top.y}`);
  }
  return keys;
}

// ================================================================================================================================================================================================================================================
// visibleBorderFloor
// Piso de cima da célula (todo piso tem borda automática).

function visibleBorderFloor(cell) {
  return cell.floorTop || cell.floor || null;
}

// ================================================================================================================================================================================================================================================
// computeCellBorders
// Bordas automáticas da célula (x, y) de uma camada do editor. voidKeys:
// sqms sem piso por serem topo de escada. Célula com buraco não recebe borda
// (dá pra ver o andar de baixo por dentro dele).

export function computeCellBorders(layer, x, y, voidKeys = new Set()) {
  const key = `${x},${y}`;
  const cell = layer[key];
  if (!cell || cell.hole) return [];

  const getFloor = (nx, ny) => {
    const neighborKey = `${nx},${ny}`;
    const neighbor = layer[neighborKey];
    return neighbor && !voidKeys.has(neighborKey) ? visibleBorderFloor(neighbor) : null;
  };
  const cellFloor = voidKeys.has(key) ? null : visibleBorderFloor(cell);
  return computeBorderPieces(x, y, getFloor, cellFloor).map(({ type, variant }) => ({ type, variant }));
}

// ================================================================================================================================================================================================================================================
// refreshBordersAround
// Refaz as bordas automáticas da célula (x, y) e das 8 vizinhas (só elas
// podem mudar quando o piso dessa célula muda).

export function refreshBordersAround(layer, x, y, voidKeys) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cell = layer[`${x + dx},${y + dy}`];
      if (cell) cell.borders = computeCellBorders(layer, x + dx, y + dy, voidKeys);
    }
  }
}

// ================================================================================================================================================================================================================================================
// rebuildLayerBorders
// Refaz todas as bordas da camada (descarta as que foram mexidas à mão).

export function rebuildLayerBorders(layer, voidKeys) {
  for (const key of Object.keys(layer)) {
    const [x, y] = key.split(',').map(Number);
    layer[key].borders = computeCellBorders(layer, x, y, voidKeys);
  }
}
