// tests/movement.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, pile, hole, wall, placeAt } from './helpers/fixture.js';

const GROUND = floorRect(0, 14, 0, 14, 0);
const ROOF = floorRect(3, 8, 3, 8, 1);

// ================================================================================================================================================================================================================================================
// building
// Térreo de 0..14 e um andar de cima em 3..8 (visualmente sobre 4..9 do térreo).

function building(...extra) {
  return buildGame({ objects: [...GROUND, ...ROOF, ...extra.flat()] });
}

// ================================================================================================================================================================================================================================================
// landing

function landing(game, x, y, z, step, dx, dy) {
  const result = game.movementController.simulateMove({ x, y, z, step }, dx, dy);
  return result && { x: result.x, y: result.y, z: result.z, step: result.step };
}

test('sobe um volume por vez, nunca dois', () => {
  const game = building(pile(6, 12, 1), pile(7, 12, 2));
  assert.deepEqual(landing(game, 6, 13, 0, 0, 0, -1), { x: 6, y: 12, z: 0, step: 1 });
  assert.equal(landing(game, 7, 13, 0, 0, 0, -1), null);
  assert.deepEqual(landing(game, 6, 12, 0, 1, 1, 0), { x: 7, y: 12, z: 0, step: 2 });
});

test('da pilha de 3 volumes sobe pro andar de cima nas 4 direções (encostada no prédio)', () => {
  const game = building(pile(6, 10, 3), pile(3, 6, 3), pile(10, 6, 3), pile(6, 3, 3));
  assert.deepEqual(landing(game, 6, 10, 0, 3, 0, -1), { x: 5, y: 8, z: 1, step: 0 });
  assert.deepEqual(landing(game, 3, 6, 0, 3, 1, 0), { x: 3, y: 5, z: 1, step: 0 });
  assert.deepEqual(landing(game, 10, 6, 0, 3, -1, 0), { x: 8, y: 5, z: 1, step: 0 });
  assert.deepEqual(landing(game, 6, 3, 0, 3, 0, 1), { x: 5, y: 3, z: 1, step: 0 });
});

test('indo pra leste/sul a pilha pode estar a 2 sqm; pra norte/oeste não', () => {
  const game = building(pile(2, 6, 3), pile(6, 2, 3), pile(6, 11, 3), pile(11, 6, 3));
  assert.deepEqual(landing(game, 2, 6, 0, 3, 1, 0), { x: 3, y: 5, z: 1, step: 0 });
  assert.deepEqual(landing(game, 6, 2, 0, 3, 0, 1), { x: 5, y: 3, z: 1, step: 0 });
  assert.equal(landing(game, 6, 11, 0, 3, 0, -1), null);
  assert.equal(landing(game, 11, 6, 0, 3, -1, 0), null);
});

test('pilha de 2 volumes não alcança o andar de cima', () => {
  const game = building(pile(6, 10, 2));
  assert.equal(landing(game, 6, 10, 0, 2, 0, -1), null);
});

test('do andar de cima desce pra pilha de 3 volumes, o espelho da subida', () => {
  const game = building(pile(6, 10, 3));
  assert.deepEqual(landing(game, 5, 8, 1, 0, 0, 1), { x: 6, y: 10, z: 0, step: 3 });
  assert.equal(landing(game, 6, 8, 1, 0, 0, 1), null);
});

test('buraco leva pro sqm (x+1, y+1) do andar de baixo; sem piso embaixo não derruba', () => {
  const game = building(hole(5, 5, 1), hole(40, 40, 1));
  const fall = game.movementController.simulateMove({ x: 4, y: 5, z: 1, step: 0 }, 1, 0);
  assert.deepEqual({ x: fall.x, y: fall.y, z: fall.z, step: fall.step }, { x: 6, y: 6, z: 0, step: 0 });
  assert.deepEqual(fall.via, { x: 5, y: 5, z: 1 });
  assert.deepEqual(landing(game, 39, 40, 1, 0, 1, 0), { x: 40, y: 40, z: 1, step: 0 });
});

test('escada leva pra (x-1, y-2) de cima e o topo dela desce pra frente do pé', () => {
  const game = buildGame({ objects: [...GROUND, ...ROOF], stairs: [[7, 10, 0]] });
  assert.deepEqual(landing(game, 7, 11, 0, 0, 0, -1), { x: 6, y: 8, z: 1, step: 0 });
  assert.deepEqual(landing(game, 6, 8, 1, 0, 0, 1), { x: 7, y: 11, z: 0, step: 0 });
});

test('moveEntity troca de andar pela pilha e checkFloorTransitions aplica o buraco', () => {
  const game = building(pile(6, 10, 3), hole(5, 7, 1));
  const { player, movementController } = game;
  placeAt(game, player, 6, 10, 0, 3);

  assert.equal(movementController.moveEntity(player, 0, -1, 1000), true);
  assert.deepEqual([player.x, player.y, player.z, player.step], [5, 8, 1, 0]);
  assert.deepEqual(game.world.getTileEntities(5, 8, 1), [player]);

  assert.equal(movementController.moveEntity(player, 0, -1, 5000), true);
  movementController.checkFloorTransitions([player]);
  assert.deepEqual([player.x, player.y, player.z], [6, 8, 0]);
});

test('criatura bloqueia o passo; parede também', () => {
  const game = buildGame({ objects: [...GROUND, ...wall(5, 5)], enemies: [[7, 5, 0]] });
  assert.equal(landing(game, 4, 5, 0, 0, 1, 0), null);
  assert.equal(landing(game, 6, 5, 0, 0, 1, 0), null);
  assert.deepEqual(landing(game, 6, 5, 0, 0, 0, 1), { x: 6, y: 6, z: 0, step: 0 });
});

test('caminho entre andares sobe por uma escadinha de volumes', () => {
  const game = building(pile(6, 12, 1), pile(6, 11, 2), pile(6, 10, 3));
  const path = game.movementController.findPath({ x: 6, y: 13, z: 0, step: 0 }, { x: 5, y: 5, z: 1 });
  assert.ok(path.length > 0);
  const last = path[path.length - 1];
  assert.deepEqual([last.x, last.y, last.z], [5, 5, 1]);
  assert.ok(path.some(p => p.x === 6 && p.y === 10 && p.step === 3));
});

test('sem rota pro andar de cima quando não há pilha, escada nem buraco', () => {
  const game = building();
  const path = game.movementController.findPath({ x: 6, y: 13, z: 0, step: 0 }, { x: 5, y: 5, z: 1 });
  assert.deepEqual(path, []);
});
