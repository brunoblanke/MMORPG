// js/views/draw-order.js

import { CONFIG } from '../config.js';

// ================================================================================================================================================================================================================================================
// getEntityLevel
//
// Nível (andar) em que uma coisa está de fato. Itens/objetos ficam sempre no
// z em que foram colocados, por mais alta que seja a pilha. Player e
// inimigos sobem 1 andar a cada CONFIG.floorHeight volumes sob eles — são
// desenhados por cima do piso de cima, somem junto com ele sob um teto, etc.
//
// Usa a posição lógica (z/step), não a animada: no meio de um passo entre
// andares (pilha ↔ piso de cima) a posição animada passaria pelo andar de
// baixo e o player sumiria sob o piso por um instante. Durante o passo vale
// o maior entre o nível de onde saiu e o de onde vai chegar.

function levelOf(z, step, floorHeight) {
  return Math.floor(z || 0) + Math.floor((step || 0) / floorHeight);
}

export function getEntityLevel(entity) {
  const isCreature = entity.isPlayer === true || entity.type === 'enemy';
  if (!isCreature) return Math.floor(entity.z ?? 0);

  const floorHeight = CONFIG.floorHeight || 4;
  const level = levelOf(entity.z, entity.step, floorHeight);
  if (!entity.isMoving || entity.moveStartZ === undefined) return level;
  return Math.max(level, levelOf(entity.moveStartZ, entity.moveStartStep, floorHeight));
}

// ================================================================================================================================================================================================================================================
// getRoofLevel
//
// Se o player está sob um piso de andar acima — ou na margem em volta dele —,
// devolve o nível dele: tudo acima disso deve sumir (pisos, objetos,
// criaturas, cadáveres). Sem teto, devolve Infinity (nada some). Bordas não
// contam como teto.
// A margem é maior ao sul e a leste do piso: o andar de cima é montado
// deslocado 1 sqm pra cima e pra esquerda, então o prédio embaixo se estende
// 1 sqm a mais nesses lados.
// Na margem, o andar que ele alcança dali (em cima de floorHeight-1 volumes,
// o de cima) não conta: o piso pra onde ele vai subir continua aparecendo.

const ROOF_MARGIN_NORTH_WEST = 1;
const ROOF_MARGIN_SOUTH_EAST = 2;

function isInRoofMargin(player, obj) {
  const dx = player.x - obj.x;
  const dy = player.y - obj.y;
  return dx >= -ROOF_MARGIN_NORTH_WEST && dx <= ROOF_MARGIN_SOUTH_EAST &&
         dy >= -ROOF_MARGIN_NORTH_WEST && dy <= ROOF_MARGIN_SOUTH_EAST;
}

export function getRoofLevel(player, world) {
  const playerLevel = getEntityLevel(player);
  const reachLevel = levelOf(player.z, (player.step || 0) + 1, CONFIG.floorHeight || 4);
  for (let x = player.x - ROOF_MARGIN_SOUTH_EAST; x <= player.x + ROOF_MARGIN_NORTH_WEST; x++) {
    for (let y = player.y - ROOF_MARGIN_SOUTH_EAST; y <= player.y + ROOF_MARGIN_NORTH_WEST; y++) {
      const isPlayerTile = x === player.x && y === player.y;
      const underRoof = world.getObjectsAt(x, y).some(obj => {
        if (!obj.floorType || obj.isBorder) return false;
        const z = obj.z ?? 0;
        if (isPlayerTile) return z > playerLevel;
        return z > reachLevel && isInRoofMargin(player, obj);
      });
      if (underRoof) return playerLevel;
    }
  }
  return Infinity;
}

// ================================================================================================================================================================================================================================================
// compareDrawables

function compareDrawables(a, b) {
  if (a.level !== b.level) return a.level - b.level;

  const tileYA = Math.round(a.renderY);
  const tileYB = Math.round(b.renderY);
  if (tileYA !== tileYB) return tileYA - tileYB;

  const tileXA = Math.round(a.renderX);
  const tileXB = Math.round(b.renderX);
  if (tileXA !== tileXB) return tileXA - tileXB;

  const orderA = a.order || 0;
  const orderB = b.order || 0;
  return orderA - orderB;
}

// ================================================================================================================================================================================================================================================
// prepareDrawables

export function prepareDrawables(gameState) {
  const drawables = [];
  const player = gameState.player;
  const roofLevel = getRoofLevel(player, gameState.world);

  const push = (drawable, source) => {
    drawable.level = getEntityLevel(source);
    if (drawable.level > roofLevel) return;
    drawables.push(drawable);
  };

  for (const obj of gameState.objects) {
    if (obj.type === "enemy" || obj.hidden) continue;

    push({
      id: obj.id,
      x: obj.x,
      y: obj.y,
      z: obj.z ?? 0,
      step: obj.step ?? 0,
      renderX: obj.x,
      renderY: obj.y,
      hasVolume: obj.hasVolume || false,
      movable: obj.movable !== undefined ? obj.movable : true,
      blocksMovement: obj.blocksMovement || false,
      entity: obj,
      order: obj.order || 0,
      isFloor: !!obj.floorType
    }, obj);
  }

  for (const corpse of gameState.deadBodies) {
    push({
      x: corpse.x,
      y: corpse.y,
      z: corpse.z ?? 0,
      step: corpse.step ?? 0,
      renderX: corpse.x,
      renderY: corpse.y,
      isCorpse: true,
      hasVolume: corpse.hasVolume || false,
      blocksMovement: corpse.blocksMovement || false,
      movable: corpse.movable !== undefined ? corpse.movable : true,
      corpseIsPlayer: corpse.isPlayer || false,
      corpseCreature: corpse.creature,
      deathTime: corpse.deathTime || 0,
      order: corpse.order || 0,
      isFloor: false
    }, corpse);
  }

  push({
    x: player.renderX,
    y: player.renderY,
    z: player.renderZ ?? player.z ?? 0,
    step: player.renderStep ?? player.step ?? 0,
    renderX: player.renderX,
    renderY: player.renderY,
    entity: player,
    hasVolume: false,
    order: player.order || 0,
    isFloor: false
  }, player);

  for (const enemy of gameState.enemies) {
    push({
      x: enemy.renderX,
      y: enemy.renderY,
      z: enemy.renderZ ?? enemy.z ?? 0,
      step: enemy.renderStep ?? enemy.step ?? 0,
      renderX: enemy.renderX,
      renderY: enemy.renderY,
      entity: enemy,
      hasVolume: true,
      order: enemy.order || 0,
      isFloor: false
    }, enemy);
  }

  drawables.sort(compareDrawables);

  return drawables;
}
