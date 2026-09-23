// tests/world.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../js/core/world.js';

// ================================================================================================================================================================================================================================================
// makeWorld

function makeWorld() {
  const world = new World(20, 20);
  const floor = { id: 'Floor_1', x: 5, y: 5, z: 0, floorType: 'Floor' };
  const wall = { id: 'Parede-X_1', x: 6, y: 5, z: 0, blocksMovement: true, inStack: true };
  const box = { id: 'Parcel_1', x: 5, y: 5, z: 0, hasVolume: true, step: 0, inStack: true };
  world.load([floor, wall, box]);
  return { world, floor, wall, box };
}

// ================================================================================================================================================================================================================================================
// creature

function creature(props) {
  return { step: 0, isAlive: () => true, ...props };
}

test('piso, pilha e altura do sqm', () => {
  const { world, box } = makeWorld();
  assert.equal(world.hasFloorAt(5, 5, 0), true);
  assert.equal(world.hasFloorAt(5, 5, 1), false);
  assert.equal(world.getStepHeight(5, 5, 0), 1);
  assert.equal(world.getPassableStep(5, 5, 0), 1);
  assert.equal(world.getPassableStep(7, 7, 0), null);
  assert.equal(box.order, 1);
});

test('parede bloqueia e acompanha o objeto quando ele é movido', () => {
  const { world, wall } = makeWorld();
  assert.equal(world.isBlocked(6, 5, 0), true);
  world.moveObject(wall, 7, 5, 0);
  assert.equal(world.isBlocked(6, 5, 0), false);
  assert.equal(world.isBlocked(7, 5, 0), true);
  assert.deepEqual(world.getObjectsAt(7, 5), [wall]);
  assert.deepEqual(world.getObjectsAt(6, 5), []);
});

test('criaturas bloqueiam; inimigos podem ser ignorados na busca de rota', () => {
  const { world } = makeWorld();
  const player = creature({ isPlayer: true, x: 2, y: 2, z: 0 });
  const enemy = creature({ type: 'enemy', x: 3, y: 3, z: 0 });
  world.addCreature(player);
  world.addCreature(enemy);

  assert.equal(world.isBlocked(2, 2, 0), true);
  assert.equal(world.isBlocked(3, 3, 0), true);
  assert.equal(world.isBlocked(3, 3, 1), false);
  assert.equal(world.isBlocked(3, 3, 0, enemy), false);
  assert.equal(world.isBlocked(3, 3, 0, null, true), false);
  assert.equal(world.isBlocked(2, 2, 0, null, true), true);
});

test('criatura morta e cadáver não bloqueiam', () => {
  const { world } = makeWorld();
  const enemy = creature({ type: 'enemy', x: 3, y: 3, z: 0, isAlive: () => false });
  const corpse = { isCorpse: true, isPlayer: true, type: 'player_corpse', x: 4, y: 4, z: 0 };
  world.addCreature(enemy);
  world.addToTile(corpse, 4, 4, 0);
  assert.equal(world.isBlocked(3, 3, 0), false);
  assert.equal(world.isBlocked(4, 4, 0), false);
});

test('item colocado depois fica abaixo das criaturas na pilha', () => {
  const { world, box } = makeWorld();
  const player = creature({ isPlayer: true, x: 5, y: 5, z: 0 });
  world.addCreature(player);
  const item = { id: 'Fire_Sword_1', x: 5, y: 5, z: 0 };
  world.addToTile(item, 5, 5, 0);
  assert.deepEqual(world.getTileEntities(5, 5, 0), [box, item, player]);
  assert.deepEqual([box.order, item.order, player.order], [1, 2, 3]);
});

test('transição conta como pisável', () => {
  const world = new World(20, 20);
  const hole = { id: 'Hole_1', x: 8, y: 8, z: 1, stairDirection: 'down', targetX: 9, targetY: 9, targetZ: 0, inStack: true };
  world.load([hole]);
  assert.equal(world.getTransitionAt(8, 8, 1), hole);
  assert.equal(world.getPassableStep(8, 8, 1), 0);
});
