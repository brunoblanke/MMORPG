// js/models/game-object.js

import { randEnemyColor } from '../utils/helpers.js';
import { Enemy } from './enemy.js';
import { objectProps, startsActive, isFloorType, isHoleType, isEntranceFolder, objectUse, objectIdType, splitType, pieceType, floorMiddle, getAsset, creatureBehavior } from '../../shared/assets.js';
import { abreParaOAndarDeBaixo } from '../../shared/ficha.js';
import { collectObjectDescriptors, collectEnemyDescriptors } from '../../shared/map-format.js';
import { getStairTop, getStairTopTarget, getHoleTarget } from '../../shared/stairs.js';
import { parseBorderType, mergeSavedInnerCorners } from '../../shared/floor-borders.js';

export class GameObject {
  constructor(data) {
    this.id = data.id;
    this.x = data.x;
    this.y = data.y;
    this.z = data.z || 0;
    this.step = data.step || 0;
    this.movable = data.movable !== undefined ? data.movable : true;
    this.hasVolume = data.hasVolume || false;
    const props = this.hasVolume ? objectProps(objectIdType(this.id)) : null;
    this.volume = this.hasVolume ? (props.volume || 1) : 0;
    this.climb = this.hasVolume ? props.climb : 1;
    this.blocksMovement = data.blocksMovement || false;
    this.temporary = !!data.temporary;
    this.ownerId = data.ownerId || null;
    this.hidden = !!data.hidden;
    this.active = !!data.active;

    if (data.stairDirection) {
      this.stairDirection = data.stairDirection;
      this.targetX = data.targetX;
      this.targetY = data.targetY;
      this.targetZ = data.targetZ;
      this.manualStairs = !!data.manualStairs;
      this.stairFacing = data.stairFacing || 'norte';
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
// Bordas: as gravadas no mapa (editáveis no editor).

export function generateObjects(mapData) {
  let objs = [];
  const bordersByCell = new Map();

  collectObjectDescriptors(mapData).forEach((descriptor) => {
    const piece = parseBorderType(descriptor.type);
    if (piece) {
      const key = `${descriptor.x},${descriptor.y},${descriptor.z}`;
      if (!bordersByCell.has(key)) bordersByCell.set(key, { position: descriptor, pieces: [] });
      bordersByCell.get(key).pieces.push(piece);
      return;
    }
    const obj = new GameObject(descriptor);
    if (descriptor.color) obj.color = descriptor.color;
    obj.seq = descriptor.seq;
    if (descriptor.count) obj.count = descriptor.count;
    if (descriptor.data) obj.data = descriptor.data;
    if (!obj.hidden && descriptor.type && startsActive(descriptor.type)) obj.active = true;
    objs.push(obj);
  });

  const savedBorders = [];
  for (const { position, pieces } of bordersByCell.values()) {
    for (const piece of mergeSavedInnerCorners(pieces)) savedBorders.push(createBorder(piece, position, savedBorders.length + 1));
  }

  objs = applyTransitions(objs);
  applyFloorVariants(objs);
  objs.push(...savedBorders);
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
//     pro mesmo sqm do andar de baixo;
//   - topo de escada com uma entrada desenhada por cima (alçapão) mantém o
//     piso: o alçapão fica sobre ele e a descida continua sendo a da escada;
//   - entrada que se usa (bueiro: Uso descer; monte: Uso pá) tira o topo:
//     pisar não desce, só usando (systems/interactions.js).
// Nenhum dos dois impede borda do piso vizinho. Todos viram transição no
// World (getTransitionAt) pra movimentação.

function applyTransitions(objs) {
  const stairTops = [];
  for (const obj of objs) {
    if (obj.stairDirection !== 'up') continue;
    const top = getStairTop(obj.x, obj.y, obj.z);
    const target = getStairTopTarget(obj.x, obj.y, obj.z, obj.manualStairs ? 'reta' : 'normal', obj.stairFacing);
    const stairTop = new GameObject({
      id: `StairTop_${stairTops.length + 1}`,
      x: top.x, y: top.y, z: top.z,
      order: 0,
      movable: false, hasVolume: false, blocksMovement: false,
      stairDirection: 'down', targetX: target.x, targetY: target.y, targetZ: target.z
    });
    stairTop.hidden = true;
    stairTop.isStairTop = true;
    stairTops.push(stairTop);
  }

  const holeKeys = new Set(objs.filter(obj => isEntranceFolder(objectIdType(obj.id))).map(obj => `${obj.x},${obj.y},${obj.z}`));
  const topKeys = new Set(stairTops.map(t => `${t.x},${t.y},${t.z}`).filter(key => !holeKeys.has(key)));
  const closedKeys = new Set(objs.filter(obj => abreParaOAndarDeBaixo(objectIdType(obj.id))).map(obj => `${obj.x},${obj.y},${obj.z}`));
  const result = objs.filter(obj => !(obj.floorType && topKeys.has(`${obj.x},${obj.y},${obj.z}`)));
  result.push(...stairTops.filter(top => !closedKeys.has(`${top.x},${top.y},${top.z}`)));

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
// as bordas são as gravadas no mapa.

function applyFloorVariants(objs) {
  const layerCountByKey = new Map();
  const counters = {};

  for (const obj of objs) {
    if (!obj.floorType) continue;
    const key = `${obj.x},${obj.y}`;
    const layerIndex = layerCountByKey.get(`${key},${obj.z}`) || 0;
    if (layerIndex > 1) continue;
    layerCountByKey.set(`${key},${obj.z}`, layerIndex + 1);

    counters[obj.floorType] = (counters[obj.floorType] || 0) + 1;
    obj.id = `${pieceType(obj.floorType, floorMiddle(obj.floorType, obj.x, obj.y, obj.z))}_${counters[obj.floorType]}`;
  }
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

  collectEnemyDescriptors(mapData).filter(descriptor => creatureBehavior(descriptor.type) !== 'npc').forEach((descriptor, i) => {
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