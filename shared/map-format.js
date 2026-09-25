// shared/map-format.js

import { ITEM_CATALOG } from './catalog.js';
import { getStairTarget } from './stairs.js';
import { borderEntryType, parseBorderType } from './floor-borders.js';

// Versão 2: as bordas dos pisos vêm gravadas (shared/floor-borders.js).
export const MAP_FORMAT_VERSION = 2;

// ================================================================================================================================================================================================================================================
// addFloorToCell
//
// Cada célula guarda no máximo 2 pisos, na ordem em que foram colocados:
// cell.floor (baixo) e cell.floorTop (cima). Um 3º piso descarta o mais
// antigo: o de cima desce e o novo vai pra cima. Repetir o tipo que já está
// no topo não faz nada.
//
// Todo piso guarda `seq`: a ordem global em que foi colocado. É ela que
// decide, entre pisos vizinhos, qual borda fica por cima (o mais novo).

let lastFloorSeq = 0;

export function addFloorToCell(cell, type, seq = null) {
  const topType = cell.floorTop ? cell.floorTop.type : (cell.floor ? cell.floor.type : null);
  if (topType === type) return false;

  const floor = { type, seq: seq ?? lastFloorSeq + 1 };
  lastFloorSeq = Math.max(lastFloorSeq, floor.seq);

  if (!cell.floor) {
    cell.floor = floor;
    return true;
  }
  if (cell.floorTop) cell.floor = cell.floorTop;
  cell.floorTop = floor;
  return true;
}

// ================================================================================================================================================================================================================================================
// restackItems
//
// Recalcula o step de cada item da célula pela ordem da pilha: o item fica
// sobre a altura dos itens COM volume que estão abaixo dele. Item sem volume
// não aumenta a altura — outro item colocado depois fica no mesmo step.

export function restackItems(objects) {
  let height = 0;
  for (const obj of objects) {
    const def = ITEM_CATALOG[obj.type];
    if (!def) continue;
    obj.step = height;
    if (def.hasVolume) height++;
  }
}

// ================================================================================================================================================================================================================================================
// collectObjectDescriptors

export function collectObjectDescriptors(mapData) {
  const descriptors = [];
  const counters = {};

  const nextId = (tipo) => {
    if (!counters[tipo]) counters[tipo] = 0;
    counters[tipo]++;
    return `${tipo}_${counters[tipo]}`;
  };

  (mapData.objetosData || []).forEach(([tipo, x, y, z, step, movable, hasVolume, blocksMovement, seq], index) => {
    descriptors.push({
      id: nextId(tipo),
      type: tipo,
      x, y, z,
      step: step || 0,
      movable: !!movable,
      hasVolume: !!hasVolume,
      blocksMovement: !!blocksMovement,
      // Pisos: ordem em que foram colocados (mapas antigos: ordem no arquivo).
      seq: Number.isFinite(seq) ? seq : index + 1
    });
  });

  // Escada: o destino é sempre fixo pela posição (shared/stairs.js); direção
  // e destino gravados no arquivo são ignorados.
  (mapData.transicoesData || []).forEach(([tipo, x, y, z]) => {
    const target = getStairTarget(x, y, z);
    descriptors.push({
      id: nextId(tipo),
      x, y, z,
      step: 0,
      movable: false,
      hasVolume: false,
      blocksMovement: false,
      stairDirection: 'up',
      targetX: target.x,
      targetY: target.y,
      targetZ: target.z,
      color: '#4CAF50'
    });
  });

  return descriptors;
}

// ================================================================================================================================================================================================================================================
// collectEnemyDescriptors

export function collectEnemyDescriptors(mapData) {
  return (mapData.enemyData || []).map(([x, y, z, lvl, spriteSize, type]) => ({
    x, y, z, lvl, spriteSize,
    type: type || 'Cave Rat'
  }));
}

// ================================================================================================================================================================================================================================================
// getMapSpawn

export function getMapSpawn(mapData, fallback) {
  return mapData.spawn || fallback;
}

// ================================================================================================================================================================================================================================================
// serializeMapFromLayers

export function serializeMapFromLayers(layerOrder, layers, GRID) {
  const objetosData = [];
  const transicoesData = [];
  const enemyData = [];
  const safeZoneData = [];
  let spawn = null;

  layerOrder.forEach((z) => {
    const layer = layers[z];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const cell = layer[`${x},${y}`];

        if (cell.floor) {
          // A ordem importa: a 2ª entrada de piso na mesma célula é a camada de cima.
          // O 9º campo é a ordem (seq) em que o piso foi colocado.
          objetosData.push([cell.floor.type, x, y, z, 0, false, false, false, cell.floor.seq]);
          if (cell.floorTop) {
            objetosData.push([cell.floorTop.type, x, y, z, 0, false, false, false, cell.floorTop.seq]);
          }
        }
        // Buraco é um item sobre o chão: vem antes dos objetos (em geral ord 1).
        if (cell.hole) {
          objetosData.push(['Hole', x, y, z, 0, false, false, false]);
        }

        // Bordas: sobre os pisos, na ordem em que ficam empilhadas.
        (cell.borders || []).forEach((piece) => {
          objetosData.push([borderEntryType(piece), x, y, z, 0, false, false, false]);
        });

        restackItems(cell.objects);
        cell.objects.forEach((obj) => {
          if (obj.type === 'Stairs') {
            // Destino gravado só pra referência: o jogo sempre recalcula (shared/stairs.js).
            const target = getStairTarget(x, y, z);
            transicoesData.push(['Stairs', x, y, z, 'up', target.x, target.y]);
          } else if (ITEM_CATALOG[obj.type]) {
            const def = ITEM_CATALOG[obj.type];
            objetosData.push([obj.type, x, y, z, obj.step || 0, def.movable, def.hasVolume, def.blocksMovement]);
          } else {
            const isCorner = obj.type === 'Wall-XY' || obj.type === 'Wall-YX';
            objetosData.push([obj.type, x, y, z, 0, false, !isCorner, true]);
          }
        });

        if (cell.enemy) {
          enemyData.push([x, y, z, cell.enemy.lvl, cell.enemy.spriteSize, cell.enemy.type || 'Cave Rat']);
        }

        if (cell.spawn && !spawn) {
          spawn = { x, y, z };
        }

        if (cell.safe) {
          safeZoneData.push([x, y, z]);
        }
      }
    }
  });

  return { version: MAP_FORMAT_VERSION, objetosData, transicoesData, enemyData, safeZoneData, spawn };
}

// ================================================================================================================================================================================================================================================
// makeEmptyLayerCells

function makeEmptyLayerCells(GRID) {
  const cells = {};
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      cells[`${x},${y}`] = { floor: null, floorTop: null, hole: false, borders: [], objects: [], enemy: null, spawn: false, safe: false };
    }
  }
  return cells;
}

// ================================================================================================================================================================================================================================================
// buildLayersFromMapData

export function buildLayersFromMapData(mapData, GRID) {
  const layers = {};
  const layerOrder = [];
  const stats = { floor: 0, border: 0, wall: 0, stairs: 0, item: 0, enemy: 0, safe: 0, outOfRange: 0, spawnFound: false };

  const ensureLayer = (z) => {
    if (!layers[z]) {
      layers[z] = makeEmptyLayerCells(GRID);
      layerOrder.push(z);
      layerOrder.sort((a, b) => a - b);
    }
  };

  const inRange = (x, y) => x >= 0 && y >= 0 && x < GRID && y < GRID;

  (mapData.objetosData || []).forEach((entry, index) => {
    const [type, x, y, z, step, , , , seq] = entry;
    if (!inRange(x, y)) { stats.outOfRange++; return; }
    ensureLayer(z);
    const cell = layers[z][`${x},${y}`];
    const border = parseBorderType(type);

    if (border) {
      cell.borders.push(border);
      stats.border++;
    } else if (type === 'Floor' || type === 'Floor2') {
      // Mesmo fallback do jogo (collectObjectDescriptors): sem seq, vale a ordem no arquivo.
      if (addFloorToCell(cell, type, Number.isFinite(seq) ? seq : index + 1)) stats.floor++;
    } else if (type === 'Hole') {
      cell.hole = true;
    } else if (ITEM_CATALOG[type]) {
      cell.objects.push({ type, step: step || 0 });
      stats.item++;
    } else {
      cell.objects.push({ type });
      stats.wall++;
    }
  });

  (mapData.transicoesData || []).forEach((entry) => {
    const [, x, y, z] = entry;
    if (!inRange(x, y)) { stats.outOfRange++; return; }
    ensureLayer(z);
    layers[z][`${x},${y}`].objects.push({ type: 'Stairs' });
    stats.stairs++;
  });

  (mapData.enemyData || []).forEach(([x, y, z, lvl, spriteSize, type]) => {
    if (!inRange(x, y)) { stats.outOfRange++; return; }
    ensureLayer(z);
    layers[z][`${x},${y}`].enemy = { type: type || 'Cave Rat', lvl, spriteSize };
    stats.enemy++;
  });

  (mapData.safeZoneData || []).forEach(([x, y, z]) => {
    if (!inRange(x, y)) { stats.outOfRange++; return; }
    ensureLayer(z);
    layers[z][`${x},${y}`].safe = true;
    stats.safe++;
  });

  if (mapData.spawn && inRange(mapData.spawn.x, mapData.spawn.y)) {
    ensureLayer(mapData.spawn.z);
    layers[mapData.spawn.z][`${mapData.spawn.x},${mapData.spawn.y}`].spawn = true;
    stats.spawnFound = true;
  }

  return { layers, layerOrder, stats };
}

// ================================================================================================================================================================================================================================================
// loadMapDataFromURL

export async function loadMapDataFromURL(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao carregar mapa (${response.status}): ${url}`);
  }
  return response.json();
}