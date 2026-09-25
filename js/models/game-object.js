// js/models/game-object.js

import { randEnemyColor } from '../utils/helpers.js';
import { Enemy } from './enemy.js';
import { computeBorderPieces } from '../../shared/floor-variant.js';
import { isFloorType, isHoleType, objectIdType, splitType, pieceType, interiorVariant, getAsset } from '../../shared/assets.js';
import { collectObjectDescriptors, collectEnemyDescriptors } from '../../shared/map-format.js';
import { getStairTop, getStairTopTarget, getHoleTarget } from '../../shared/stairs.js';
import { parseBorderType, hasSavedBorders } from '../../shared/floor-borders.js';

export class GameObject {
  constructor(data) {
    this.id = data.id;
    this.x = data.x;
    this.y = data.y;
    this.z = data.z || 0;
    this.step = data.step || 0;
    this.movable = data.movable !== undefined ? data.movable : true;
    this.hasVolume = data.hasVolume || false;
    this.blocksMovement = data.blocksMovement || false;

    if (data.stairDirection) {
      this.stairDirection = data.stairDirection;
      this.targetX = data.targetX;
      this.targetY = data.targetY;
      this.targetZ = data.targetZ;
    }

    // Piso e borda: floorType é a folha do piso ('estrutura/pisos/…').
    const type = objectIdType(data.id);
    this.floorType = isFloorType(type) ? splitType(type).asset : null;

    if (data.order !== undefined) {
      this.order = data.order;
    } else if (this.floorType) {
      this.order = -1;
    } else {
      this.order = 0;
      this.inStack = true;
    }
  }
}

// ================================================================================================================================================================================================================================================
// generateObjects
// Bordas: as gravadas no mapa (versão 2 em diante, editáveis no editor) ou,
// em mapa antigo, geradas aqui pelos pisos (generateFloorBorders).

export function generateObjects(mapData) {
  let objs = [];
  const savedBorders = [];

  collectObjectDescriptors(mapData).forEach((descriptor) => {
    const piece = parseBorderType(descriptor.type);
    if (piece) {
      savedBorders.push(createBorder(piece, descriptor, savedBorders.length + 1));
      return;
    }
    const obj = new GameObject(descriptor);
    if (descriptor.color) obj.color = descriptor.color;
    obj.seq = descriptor.seq;
    objs.push(obj);
  });

  objs = applyTransitions(objs);
  const visibleFloorsByZ = applyFloorVariants(objs);
  objs.push(...(hasSavedBorders(mapData) ? savedBorders : generateFloorBorders(objs, visibleFloorsByZ)));
  assignGroundOrder(objs);

  return objs;
}

// ================================================================================================================================================================================================================================================
// createBorder
// Peça de borda (id no formato do sprite: '<piso>#<peça>_<n>'): só desenho,
// não bloqueia nem vira chão pisável.

function createBorder(piece, position, counter) {
  const border = new GameObject({
    id: `${pieceType(piece.type, piece.variant)}_${counter}`,
    x: position.x,
    y: position.y,
    z: position.z,
    step: 0,
    order: 0,
    movable: false,
    hasVolume: false,
    blocksMovement: false
  });
  border.isBorder = true;
  return border;
}

// ================================================================================================================================================================================================================================================
// applyTransitions
//
// Escadas, topos de escada e buracos (regras em shared/stairs.js):
//   - cada escada ganha um TOPO no andar de cima: um buraco invisível (o
//     sprite da escada já cobre esse sqm) que desce até o pé da escada. Piso
//     pintado ali é removido — o topo é sempre um vão;
//   - buraco comum é um item sobre o chão do sqm (em geral ord 1) e desce
//     na diagonal (x+1, y+1) pro andar de baixo.
// Nenhum dos dois impede borda do piso vizinho. Todos viram transição no
// World (getTransitionAt) pra movimentação.

function applyTransitions(objs) {
  const stairTops = [];
  for (const obj of objs) {
    if (obj.stairDirection !== 'up') continue;
    const top = getStairTop(obj.x, obj.y, obj.z);
    const target = getStairTopTarget(obj.x, obj.y, obj.z);
    const stairTop = new GameObject({
      id: `StairTop_${stairTops.length + 1}`,
      x: top.x, y: top.y, z: top.z,
      order: 0,
      movable: false, hasVolume: false, blocksMovement: false,
      stairDirection: 'down', targetX: target.x, targetY: target.y, targetZ: target.z
    });
    stairTop.hidden = true;
    stairTops.push(stairTop);
  }

  const topKeys = new Set(stairTops.map(t => `${t.x},${t.y},${t.z}`));
  const result = objs.filter(obj => !(obj.floorType && topKeys.has(`${obj.x},${obj.y},${obj.z}`)));
  result.push(...stairTops);

  for (const obj of result) {
    if (isHoleType(objectIdType(obj.id))) {
      const target = getHoleTarget(obj.x, obj.y, obj.z);
      obj.stairDirection = 'down';
      obj.targetX = target.x;
      obj.targetY = target.y;
      obj.targetZ = target.z;
    }
  }

  return result;
}

// ================================================================================================================================================================================================================================================
// assignGroundOrder
//
// "Chão" de cada sqm = pisos + bordas, empilhados na ordem de desenho: piso
// de baixo, piso de cima e as bordas dos vizinhos (da mais antiga pra mais
// nova). O order é a posição nessa pilha contada do topo: o de cima é 0, o
// de baixo dele -1, e assim por diante. O que fica sobre o chão (itens,
// criaturas) continua a mesma pilha a partir de 1 (core/world.js).

function assignGroundOrder(objs) {
  const groundByTile = new Map();
  for (const obj of objs) {
    if (!obj.floorType) continue;
    const key = `${obj.x},${obj.y},${obj.z}`;
    if (!groundByTile.has(key)) groundByTile.set(key, []);
    groundByTile.get(key).push(obj);
  }
  for (const ground of groundByTile.values()) {
    ground.forEach((obj, i) => { obj.order = i - (ground.length - 1); });
  }
}

// ================================================================================================================================================================================================================================================
// applyFloorVariants
//
// Até 2 pisos por célula, igual ao editor (cell.floor / cell.floorTop): a 1ª
// entrada de piso numa célula é a de baixo, a 2ª é a de cima. Todo piso é
// ladrilho cheio (uma das variações do meio da folha, sorteada pela posição);
// as bordas ficam pra fora, em generateFloorBorders.
// Devolve Map<z, Map<'x,y', { type, seq }>> com o piso VISÍVEL de cada célula.

function applyFloorVariants(objs) {
  const visibleFloorsByZ = new Map();
  const layerCountByKey = new Map();
  const counters = {};

  for (const obj of objs) {
    if (!obj.floorType) continue;
    if (!visibleFloorsByZ.has(obj.z)) visibleFloorsByZ.set(obj.z, new Map());

    const key = `${obj.x},${obj.y}`;
    const layerIndex = layerCountByKey.get(`${key},${obj.z}`) || 0;
    if (layerIndex > 1) continue;
    layerCountByKey.set(`${key},${obj.z}`, layerIndex + 1);
    visibleFloorsByZ.get(obj.z).set(key, { type: obj.floorType, seq: obj.seq });

    counters[obj.floorType] = (counters[obj.floorType] || 0) + 1;
    const variations = (getAsset(obj.floorType) || {}).variacoes || 4;
    obj.id = `${pieceType(obj.floorType, interiorVariant(obj.x, obj.y, obj.z, variations))}_${counters[obj.floorType]}`;
  }

  return visibleFloorsByZ;
}

// ================================================================================================================================================================================================================================================
// generateFloorBorders
//
// Cria as peças de borda pra fora de cada piso visível (por z), usando a
// MESMA função (computeBorderPieces) que o editor usa em canvas-renderer.js:
// a borda de um piso só aparece sobre célula vazia ou sobre piso colocado
// antes dele. Uma célula pode receber várias peças (ex.: canto interno = n + o).
// São apenas decorativas: não bloqueiam movimento nem entram no
// pilha do World — só dá pra pisar numa borda se houver piso embaixo dela.

function generateFloorBorders(objs, visibleFloorsByZ) {
  // Andares diferentes são desenhados na mesma posição de tela, do z menor
  // pro maior. Por isso a borda de um andar de cima pode (e deve) avançar
  // sobre o piso do andar de baixo. Topo de escada não impede borda; buraco
  // sim: o sqm do buraco fica sem borda, pra dar pra ver o andar de baixo
  // por dentro dele.
  const borderObjs = [];
  let borderCounter = 0;
  const holeKeys = new Set(objs
    .filter(obj => isHoleType(objectIdType(obj.id)))
    .map(obj => `${obj.x},${obj.y},${obj.z}`));

  for (const [z, visibleFloors] of visibleFloorsByZ) {
    const candidates = new Set();
    for (const key of visibleFloors.keys()) {
      const [fx, fy] = key.split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          candidates.add(`${fx + dx},${fy + dy}`);
        }
      }
    }

    const getFloor = (x, y) => visibleFloors.get(`${x},${y}`) || null;

    for (const key of candidates) {
      const [x, y] = key.split(',').map(Number);
      if (holeKeys.has(`${x},${y},${z}`)) continue;
      for (const piece of computeBorderPieces(x, y, getFloor, getFloor(x, y))) {
        borderCounter++;
        const border = new GameObject({
          id: `${pieceType(piece.type, piece.variant)}_${borderCounter}`,
          x: x,
          y: y,
          z: z,
          step: 0,
          order: 0,
          movable: false,
          hasVolume: false,
          blocksMovement: false
        });
        border.isBorder = true;
        borderObjs.push(border);
      }
    }
  }

  return borderObjs;
}

// ================================================================================================================================================================================================================================================
// generateOrganicFloorArea
//
// Ferramenta pontual, não usada automaticamente pela geração do nível.
// Roda um autômato celular pra "corroer" as bordas de um retângulo e devolver
// um Set de coordenadas "x,y" com formato mais orgânico, tipo ilha.

export function generateOrganicFloorArea(minX, maxX, minY, maxY, iterations = 3, erosionChance = 0.3) {
  const grid = {};
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      grid[`${x},${y}`] = true;
    }
  }

  for (let iter = 0; iter < iterations; iter++) {
    const toRemove = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (!grid[`${x},${y}`]) continue;
        let neighbors = 0;
        if (grid[`${x - 1},${y}`]) neighbors++;
        if (grid[`${x + 1},${y}`]) neighbors++;
        if (grid[`${x},${y - 1}`]) neighbors++;
        if (grid[`${x},${y + 1}`]) neighbors++;
        if (neighbors < 3 && Math.random() < erosionChance) {
          toRemove.push(`${x},${y}`);
        }
      }
    }
    toRemove.forEach(key => delete grid[key]);
  }

  return new Set(Object.keys(grid));
}

export function generateEnemies(mapData) {
  const enemies = [];

  collectEnemyDescriptors(mapData).forEach((descriptor, i) => {
    const enemy = new Enemy({
      id: "ini" + (i + 1),
      type: "enemy",
      x: descriptor.x,
      y: descriptor.y,
      z: descriptor.z,
      color: randEnemyColor(),
      lvl: descriptor.lvl,
      creature: descriptor.type
    });
    enemies.push(enemy);
  });

  return enemies;
}