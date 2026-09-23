// tests/helpers/fixture.js

import { World } from '../../js/core/world.js';
import { generateObjects, generateEnemies } from '../../js/models/game-object.js';
import { Player } from '../../js/models/player.js';
import { MovementController } from '../../js/controllers/movement.js';

// ================================================================================================================================================================================================================================================
// floorRect

export function floorRect(minX, maxX, minY, maxY, z = 0) {
  const tiles = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tiles.push(['Floor', x, y, z, 0, 0, 0, 0]);
    }
  }
  return tiles;
}

// ================================================================================================================================================================================================================================================
// wall

export function wall(x, y, z = 0) {
  return [['Wall-X', x, y, z, 0, 0, 0, 1]];
}

// ================================================================================================================================================================================================================================================
// pile

export function pile(x, y, height, z = 0) {
  const boxes = [];
  for (let step = 0; step < height; step++) {
    boxes.push(['Parcel', x, y, z, step, 1, 1, 0]);
  }
  return boxes;
}

// ================================================================================================================================================================================================================================================
// hole

export function hole(x, y, z) {
  return [['Hole', x, y, z, 1, 0, 0, 0]];
}

// ================================================================================================================================================================================================================================================
// buildGame
// Monta o mundo como o GameController faz: objetos do mapa, inimigos e o
// player, nessa ordem. Devolve o que os controladores esperam em `game`.

export function buildGame({ objects = [], stairs = [], enemies = [], player = { x: 1, y: 1, z: 0 } }) {
  const mapData = {
    objetosData: objects,
    transicoesData: stairs.map(([x, y, z]) => ['Stairs', x, y, z]),
    enemyData: enemies.map(([x, y, z, lvl = 5]) => [x, y, z, lvl, 32, 'Cave Rat'])
  };

  const world = new World();
  const gameObjects = generateObjects(mapData);
  const gameEnemies = generateEnemies(mapData);
  const gamePlayer = new Player({ ...player, lvl: 10 });

  world.load(gameObjects);
  for (const enemy of gameEnemies) world.addCreature(enemy);
  world.addCreature(gamePlayer);

  const movementController = new MovementController(world);

  return {
    world,
    objects: gameObjects,
    enemies: gameEnemies,
    player: gamePlayer,
    deadBodies: [],
    movementController,
    inputController: { isMovingToTarget: false, setTarget() {} }
  };
}

// ================================================================================================================================================================================================================================================
// placeAt
// Põe a criatura direto no sqm (x, y, z) sobre `step` volumes, sem animação.

export function placeAt(game, entity, x, y, z, step = 0) {
  game.world.moveEntityTile(entity, entity.x, entity.y, entity.z || 0, x, y, z);
  entity.x = x;
  entity.y = y;
  entity.z = z;
  entity.step = step;
  entity.lastMoveTime = -Infinity;
}
