// tests/enemy-ai.test.js

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, wall, placeAt } from './helpers/fixture.js';
import { EnemyAI } from '../js/controllers/enemy-ai.js';
import { isPositionAdjacentTo } from '../js/utils/helpers.js';

const GROUND = floorRect(0, 24, 0, 24, 0);
const originalRandom = Math.random;

beforeEach(() => {
  let seed = 42;
  Math.random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
});

afterEach(() => {
  Math.random = originalRandom;
});

// ================================================================================================================================================================================================================================================
// run
// Roda a IA de todos os inimigos, quadro a quadro, por `ms` milissegundos.

function run(game, ms, onFrame = () => {}) {
  const ai = new EnemyAI(game.movementController);
  for (let t = 1000; t <= 1000 + ms; t += 50) {
    for (const enemy of game.enemies) {
      ai.update(enemy, game.player, game.enemies, t);
    }
    onFrame(t);
  }
}

// ================================================================================================================================================================================================================================================
// room
// Paredes em volta de um quadrado de centro (cx, cy) e raio r, sem porta.

function room(cx, cy, r) {
  const walls = [];
  for (let d = -r; d <= r; d++) {
    walls.push(...wall(cx + d, cy - r), ...wall(cx + d, cy + r));
    if (Math.abs(d) < r) walls.push(...wall(cx - r, cy + d), ...wall(cx + r, cy + d));
  }
  return walls;
}

test('inimigos cercam o player, cada um num sqm colado nele', () => {
  const game = buildGame({
    objects: GROUND,
    enemies: [[16, 12, 0], [16, 10, 0], [7, 12, 0], [12, 16, 0]],
    player: { x: 12, y: 12, z: 0 }
  });

  run(game, 20000);

  const spots = game.enemies.map(e => `${e.x},${e.y}`);
  assert.equal(new Set(spots).size, game.enemies.length);
  for (const enemy of game.enemies) {
    assert.ok(isPositionAdjacentTo(enemy.x, enemy.y, 12, 12), `${enemy.id} em ${enemy.x},${enemy.y}`);
  }
});

test('cercando, dois inimigos nunca ocupam o mesmo sqm', () => {
  const game = buildGame({
    objects: GROUND,
    enemies: [[16, 12, 0], [17, 12, 0], [16, 13, 0], [17, 11, 0], [8, 12, 0]],
    player: { x: 12, y: 12, z: 0 }
  });

  run(game, 25000, () => {
    const spots = game.enemies.map(e => `${e.x},${e.y},${e.z}`);
    assert.equal(new Set(spots).size, spots.length);
    assert.ok(!game.enemies.some(e => e.x === 12 && e.y === 12));
    const slots = game.enemies.filter(e => e.isChasing && e.chaseTarget).map(e => `${e.chaseTarget.x},${e.chaseTarget.y}`);
    assert.equal(new Set(slots).size, slots.length);
  });
});

test('casa trancada: sem rota até o player, o inimigo volta a patrulhar', () => {
  const game = buildGame({
    objects: [...GROUND, ...room(12, 12, 2)],
    enemies: [[17, 12, 0]],
    player: { x: 12, y: 12, z: 0 }
  });
  const enemy = game.enemies[0];

  run(game, 200);
  assert.equal(enemy.isChasing, false);
  assert.ok(enemy.noRouteUntil > 0);

  run(game, 15000, () => {
    assert.ok(Math.abs(enemy.x - 12) > 1 || Math.abs(enemy.y - 12) > 1);
  });
});

test('casa com porta: o inimigo entra e alcança o player', () => {
  const walls = room(12, 12, 2).filter(([, x, y]) => !(x === 14 && y === 12));
  const game = buildGame({
    objects: [...GROUND, ...walls],
    enemies: [[18, 12, 0]],
    player: { x: 12, y: 12, z: 0 }
  });

  run(game, 10000);
  const enemy = game.enemies[0];
  assert.ok(isPositionAdjacentTo(enemy.x, enemy.y, 12, 12), `em ${enemy.x},${enemy.y}`);
});

test('player em outro andar (sobre a pilha alta) não é perseguido', () => {
  const game = buildGame({
    objects: GROUND,
    enemies: [[16, 12, 0]],
    player: { x: 12, y: 12, z: 0 }
  });
  placeAt(game, game.player, 12, 12, 0, 4);

  run(game, 3000);
  assert.equal(game.enemies[0].isChasing, false);
});

test('patrulha fica dentro da área do inimigo', () => {
  const game = buildGame({
    objects: GROUND,
    enemies: [[6, 6, 0]],
    player: { x: 22, y: 22, z: 0 }
  });
  const enemy = game.enemies[0];
  const visited = new Set();

  run(game, 60000, () => {
    visited.add(`${enemy.x},${enemy.y}`);
    assert.ok(enemy.isInPatrolZone(enemy.x, enemy.y) || Math.hypot(enemy.x - 6, enemy.y - 6) <= enemy.patrolRadius + 1.5);
  });
  assert.ok(visited.size > 3);
});
