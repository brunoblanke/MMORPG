// tests/combat.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect } from './helpers/fixture.js';
import { TICK_MS } from '../js/simulation.js';

test('alvo em outro andar não é aceito (e não gera "Alvo perdido")', () => {
  const game = buildGame({ objects: [...floorRect(0, 14, 0, 14, 0), ...floorRect(0, 14, 0, 14, -1)], enemies: [[6, 5, -1]], player: { x: 5, y: 5, z: 0 } });
  const enemy = game.enemies[0];
  game.enqueue('player1', { type: 'attack', targetId: enemy.id });
  game.tick(game.time + TICK_MS);
  game.tick(game.time + TICK_MS);
  assert.equal(game.player.target, null);
  assert.deepEqual(game.drainEvents().filter(e => e.type === 'message').map(e => e.text), []);
});
