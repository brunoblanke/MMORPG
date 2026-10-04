// shared/map-format.js

import { isFloorType, isEntranceFolder, isStairsType, isItemType, objectProps, stairKind } from './assets.js';
import { getStairTarget } from './stairs.js';
import { borderEntryType, parseBorderType, mergeSavedInnerCorners } from './floor-borders.js';

// Versão 2: as bordas dos pisos vêm gravadas (shared/floor-borders.js).
// Versão 3: os tipos são as folhas do gerador (shared/assets.js).
export const MAP_FORMAT_VERSION = 3;

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
    if (!isItemType(obj.type)) continue;
    obj.step = height;
    if (objectProps(obj.type).hasVolume) height++;
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

  (mapData.objetosData || []).forEach(([tipo, x, y, z, step, movable, hasVolume, blocksMovement, seq, count, dados], index) => {
    descriptors.push({
      id: nextId(tipo),
      type: tipo,
      x, y, z,
      step: step || 0,
      movable: !!movable,
      hasVolume: !!hasVolume,
      blocksMovement: !!blocksMovement,
      // Pisos: ordem em que foram colocados (mapas antigos: ordem no arquivo).
      seq: Number.isFinite(seq) ? seq : index + 1,
      count: Number.isInteger(count) && count > 1 ? count : undefined,
      data: dados && typeof dados === 'object' ? dados : undefined
    });
  });

  // Escada: o destino é sempre fixo pela posição (shared/stairs.js); direção
  // e destino gravados no arquivo são ignorados.
  (mapData.transicoesData || []).forEach(([tipo, x, y, z]) => {
    if (!isStairsType(tipo)) {
      descriptors.push({ id: nextId(tipo), type: tipo, x, y, z, step: 0, movable: false, hasVolume: false, blocksMovement: false, seq: 0 });
      return;
    }
    const kind = stairKind(tipo);
    const target = getStairTarget(x, y, z, kind);
    descriptors.push({
      id: nextId(tipo),
      x, y, z,
      step: 0,
      movable: false,
      hasVolume: false,
      blocksMovement: false,
      stairDirection: 'up',
      manualStairs: kind === 'reta',
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
    x, y, z, lvl, spriteSize, type
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
  const npcData = [];
  const safeZoneData = [];
  const houseData = [];
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
          objetosData.push([cell.hole, x, y, z, 0, false, false, false]);
        }

        // Bordas: sobre os pisos, na ordem em que ficam empilhadas.
        (cell.borders || []).forEach((piece) => {
          objetosData.push([borderEntryType(piece), x, y, z, 0, false, false, false]);
        });

        restackItems(cell.objects);
        cell.objects.forEach((obj) => {
          if (isStairsType(obj.type)) {
            // Destino gravado só pra referência: o jogo sempre recalcula (shared/stairs.js).
            const target = getStairTarget(x, y, z, stairKind(obj.type));
            transicoesData.push([obj.type, x, y, z, 'up', target.x, target.y]);
          } else {
            // Paredes e objetos: o comportamento vai gravado (o servidor não lê as folhas).
            const props = objectProps(obj.type);
            const step = isItemType(obj.type) ? obj.step || 0 : 0;
            const entry = [obj.type, x, y, z, step, props.movable, props.hasVolume, props.blocksMovement];
            const hasData = obj.dados && Object.keys(obj.dados).length > 0;
            if (obj.count > 1 || hasData) entry.push(null, obj.count > 1 ? obj.count : null);
            if (hasData) entry.push(obj.dados);
            objetosData.push(entry);
          }
        });

        if (cell.enemy) {
          enemyData.push([x, y, z, cell.enemy.lvl, cell.enemy.spriteSize, cell.enemy.type]);
        }

        if (cell.npc) {
          npcData.push([cell.npc.type, x, y, z]);
        }

        if (cell.spawn && !spawn) {
          spawn = { x, y, z };
        }

        if (cell.safe) {
          safeZoneData.push([x, y, z]);
        }

        if (cell.house) {
          houseData.push([x, y, z, cell.house.name, cell.house.price]);
        }
      }
    }
  });

  return { version: MAP_FORMAT_VERSION, objetosData, transicoesData, enemyData, npcData, safeZoneData, houseData, spawn };
}

// ================================================================================================================================================================================================================================================
// makeEmptyLayerCells

function makeEmptyLayerCells(GRID) {
  const cells = {};
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      cells[`${x},${y}`] = { floor: null, floorTop: null, hole: null, borders: [], objects: [], enemy: null, npc: null, spawn: false, safe: false, house: null };
    }
  }
  return cells;
}

// ================================================================================================================================================================================================================================================
// buildLayersFromMapData

export function buildLayersFromMapData(mapData, GRID) {
  const layers = {};
  const layerOrder = [];
  const stats = { floor: 0, border: 0, wall: 0, stairs: 0, item: 0, enemy: 0, npc: 0, safe: 0, outOfRange: 0, spawnFound: false };

  const ensureLayer = (z) => {
    if (!layers[z]) {
      layers[z] = makeEmptyLayerCells(GRID);
      layerOrder.push(z);
      layerOrder.sort((a, b) => a - b);
    }
  };

  const inRange = (x, y) => x >= 0 && y >= 0 && x < GRID && y < GRID;

  (mapData.objetosData || []).forEach((entry, index) => {
    const [type, x, y, z, step, , , , seq, count, dados] = entry;
    if (!inRange(x, y)) { stats.outOfRange++; return; }
    ensureLayer(z);
    const cell = layers[z][`${x},${y}`];
    const border = parseBorderType(type);

    if (border) {
      cell.borders.push(border);
      stats.border++;
    } else if (isFloorType(type)) {
      // Mesmo fallback do jogo (collectObjectDescriptors): sem seq, vale a ordem no arquivo.
      if (addFloorToCell(cell, type, Number.isFinite(seq) ? seq : index + 1)) stats.floor++;
    } else if (isEntranceFolder(type)) {
      cell.hole = type;
    } else if (isItemType(type)) {
      const item = { type, step: step || 0 };
      if (Number.isInteger(count) && count > 1) item.count = count;
      if (dados && typeof dados === 'object') item.dados = dados;
      cell.objects.push(item);
      stats.item++;
    } else {
      cell.objects.push(dados && typeof dados === 'object' ? { type, dados } : { type });
      stats.wall++;
    }
  });

  (mapData.transicoesData || []).forEach((entry) => {
    const [type, x, y, z] = entry;
    if (!inRange(x, y)) { stats.outOfRange++; return; }
    ensureLayer(z);
    layers[z][`${x},${y}`].objects.push({ type });
    stats.stairs++;
  });

  (mapData.enemyData || []).forEach(([x, y, z, lvl, spriteSize, type]) => {
    if (!inRange(x, y)) { stats.outOfRange++; return; }
    ensureLayer(z);
    layers[z][`${x},${y}`].enemy = { type, lvl, spriteSize };
    stats.enemy++;
  });

  (mapData.npcData || []).forEach(([type, x, y, z]) => {
    if (!inRange(x, y)) { stats.outOfRange++; return; }
    ensureLayer(z);
    layers[z][`${x},${y}`].npc = { type };
    stats.npc++;
  });

  (mapData.safeZoneData || []).forEach(([x, y, z]) => {
    if (!inRange(x, y)) { stats.outOfRange++; return; }
    ensureLayer(z);
    layers[z][`${x},${y}`].safe = true;
    stats.safe++;
  });

  (mapData.houseData || []).forEach(([x, y, z, name, price]) => {
    if (!inRange(x, y) || typeof name !== 'string') { stats.outOfRange++; return; }
    ensureLayer(z);
    layers[z][`${x},${y}`].house = { name, price: Math.max(0, Math.floor(Number(price)) || 0) };
  });

  if (mapData.spawn && inRange(mapData.spawn.x, mapData.spawn.y)) {
    ensureLayer(mapData.spawn.z);
    layers[mapData.spawn.z][`${mapData.spawn.x},${mapData.spawn.y}`].spawn = true;
    stats.spawnFound = true;
  }

  for (const layer of Object.values(layers)) {
    for (const cell of Object.values(layer)) {
      if (cell.borders.length > 1) cell.borders = mergeSavedInnerCorners(cell.borders);
    }
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