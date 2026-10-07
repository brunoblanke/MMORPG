// shared/simulator-map.js

export const ARENA_FLOOR = 'estrutura/pisos/piso-grama-1';
export const ARENA = { minX: 8, maxX: 47, minY: 8, maxY: 32, spawn: { x: 16, y: 20, z: 0 } };

// ================================================================================================================================================================================================================================================
// buildArenaMap
// O mapa do simulador (simulador.html): um campo de grama vazio, sem criaturas nem zona segura.

export function buildArenaMap() {
  const tiles = [];
  let seq = 0;
  for (let y = ARENA.minY; y <= ARENA.maxY; y++) {
    for (let x = ARENA.minX; x <= ARENA.maxX; x++) tiles.push([ARENA_FLOOR, x, y, 0, 0, false, false, false, ++seq]);
  }
  return { version: 3, objetosData: tiles, transicoesData: [], enemyData: [], npcData: [], safeZoneData: [], houseData: [], spawn: { ...ARENA.spawn } };
}
