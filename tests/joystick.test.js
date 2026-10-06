// tests/joystick.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directionFromOffset, followAnchor } from '../js/input/joystick.js';

test('o controle anda na direção do eixo que mais passou do centro', () => {
  assert.deepEqual(directionFromOffset(30, 5, 36), { dx: 1, dy: 0 });
  assert.deepEqual(directionFromOffset(-30, 5, 36), { dx: -1, dy: 0 });
  assert.deepEqual(directionFromOffset(4, 30, 36), { dx: 0, dy: 1 });
  assert.deepEqual(directionFromOffset(-4, -30, 36), { dx: 0, dy: -1 });
});

test('o controle anda na diagonal quando o arraste fica entre dois eixos', () => {
  assert.deepEqual(directionFromOffset(25, 25, 36), { dx: 1, dy: 1 });
  assert.deepEqual(directionFromOffset(-25, 25, 36), { dx: -1, dy: 1 });
  assert.deepEqual(directionFromOffset(25, -25, 36), { dx: 1, dy: -1 });
  assert.deepEqual(directionFromOffset(-25, -25, 36), { dx: -1, dy: -1 });
  assert.deepEqual(directionFromOffset(30, 10, 36), { dx: 1, dy: 0 });
});

test('perto do centro o controle não anda', () => {
  assert.equal(directionFromOffset(0, 0, 36), null);
  assert.equal(directionFromOffset(5, -5, 36), null);
});

test('o centro do joystick acompanha o dedo quando ele passa do alcance', () => {
  assert.deepEqual(followAnchor({ x: 100, y: 100 }, { x: 130, y: 100 }, 60), { x: 100, y: 100 });
  assert.deepEqual(followAnchor({ x: 100, y: 100 }, { x: 200, y: 100 }, 60), { x: 140, y: 100 });
  assert.deepEqual(followAnchor({ x: 100, y: 100 }, { x: 100, y: 0 }, 60), { x: 100, y: 60 });
});

test('o servidor anda na diagonal com walkDir (dx e dy juntos)', async () => {
  const { buildGame, floorRect } = await import('./helpers/fixture.js');
  const { TICK_MS } = await import('../js/simulation.js');
  const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 5, y: 5, z: 0 } });
  game.enqueue('player1', { type: 'walkDir', dx: 1, dy: 1 });
  const end = game.time + 1500;
  while (game.time < end) game.tick(game.time + TICK_MS);
  assert.ok(game.player.x > 5 && game.player.y > 5);
  assert.equal(game.player.x - 5, game.player.y - 5);
});
