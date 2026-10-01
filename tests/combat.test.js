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

test('auto ataque: alvo que ficou inacessível é largado e o próximo da fila vira alvo', async () => {
  const { wall } = await import('./helpers/fixture.js');
  const { UNREACHABLE_MS } = await import('../js/systems/combat.js');
  const walls = [];
  for (let x = 13; x <= 17; x++) for (let y = 3; y <= 7; y++) if (x === 13 || x === 17 || y === 3 || y === 7) walls.push(...wall(x, y));
  const game = buildGame({ objects: [...floorRect(0, 24, 0, 24, 0), ...walls], enemies: [[15, 5, 0], [5, 9, 0]], player: { x: 10, y: 5, z: 0 } });
  const [trapped, free] = game.enemies;
  for (const e of game.enemies) { e.detectionRadius = 8; e.atk = 0; }
  game.player.attackMode = true;
  game.player.target = trapped;
  game.player.autoFollow = true;
  const end = game.time + UNREACHABLE_MS + 3000;
  while (game.time < end) game.tick(game.time + TICK_MS);
  assert.notEqual(game.player.target, trapped);
  assert.equal(game.player.target, free);
});
