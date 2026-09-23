// tests/progression.test.js

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, safeRect } from './helpers/fixture.js';
import { Player } from '../js/models/player.js';
import { calculateStats } from '../js/utils/helpers.js';
import { TICK_MS } from '../js/simulation.js';

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
// runFor

function runFor(sim, ms) {
  const events = [];
  const end = sim.time + ms;
  while (sim.time + TICK_MS <= end) {
    sim.tick(sim.time + TICK_MS);
    events.push(...sim.drainEvents());
  }
  return events;
}

test('subir de nível guarda o XP que sobra e melhora os atributos', () => {
  const player = new Player({ x: 0, y: 0, lvl: 1 });
  assert.equal(player.nextLevelXp, 120);

  assert.equal(player.gainXp(130), 1);
  assert.equal(player.lvl, 2);
  assert.equal(player.xp, 10);
  const stats = calculateStats(2);
  assert.deepEqual([player.maxHp, player.currentHp, player.atk, player.def, player.spd], [stats.hp, stats.hp, stats.atk, stats.def, stats.spd]);

  assert.equal(player.gainXp(500), 3);
  assert.equal(player.lvl, 5);
  assert.equal(player.xp, 500 + 10 - 140 - 160 - 180);
});

test('matar um inimigo dá o XP inteiro dele e pode subir o nível', () => {
  const sim = buildGame({ objects: GROUND, enemies: [[8, 5, 0, 30]], player: { x: 2, y: 5, z: 0 } });
  const enemy = sim.enemies[0];
  const reward = enemy.xp;
  sim.player.atk = 999;
  sim.player.xp = sim.player.nextLevelXp - 1;
  const lvlBefore = sim.player.lvl;

  sim.enqueue('player1', { type: 'attack', targetId: enemy.id });
  const events = runFor(sim, 8000);

  assert.equal(events.find(e => e.type === 'xp').amount, reward);
  assert.ok(events.some(e => e.type === 'levelUp' && e.lvl === lvlBefore + 1));
  assert.equal(sim.player.lvl, lvlBefore + 1);
  assert.equal(sim.player.xp, reward - 1);
});

test('na zona segura os inimigos não perseguem nem atacam; fora dela, sim', () => {
  const sim = buildGame({
    objects: GROUND,
    enemies: [[12, 5, 0, 5]],
    safe: safeRect(2, 6, 3, 7),
    player: { x: 4, y: 5, z: 0 }
  });
  const enemy = sim.enemies[0];
  const hp = sim.player.currentHp;

  runFor(sim, 8000);
  assert.equal(enemy.ai.state, 'patrol');
  assert.equal(sim.player.currentHp, hp);
  assert.equal(sim.player.isTarget, false);

  sim.enqueue('player1', { type: 'walkTo', x: 9, y: 5, z: 0 });
  runFor(sim, 8000);
  assert.equal(enemy.ai.state, 'chase');
  assert.ok(sim.player.currentHp < hp);
});

test('entrar na zona segura faz o inimigo colado parar de atacar e voltar a patrulhar', () => {
  const sim = buildGame({
    objects: GROUND,
    enemies: [[10, 5, 0, 5]],
    safe: safeRect(2, 6, 3, 7),
    player: { x: 9, y: 5, z: 0 }
  });
  const enemy = sim.enemies[0];
  runFor(sim, 3000);
  assert.equal(enemy.ai.state, 'chase');

  sim.player.currentHp = sim.player.maxHp;
  sim.enqueue('player1', { type: 'walkTo', x: 3, y: 5, z: 0 });
  runFor(sim, 4000);
  const hpInside = sim.player.currentHp;
  runFor(sim, 6000);

  assert.ok(sim.world.isInSafeZone(sim.player));
  assert.equal(enemy.ai.state, 'patrol');
  assert.equal(sim.player.currentHp, hpInside);
});

test('zona segura vale só no andar pintado', () => {
  const sim = buildGame({ objects: GROUND, safe: safeRect(2, 4, 2, 4, 1), player: { x: 3, y: 3, z: 0 } });
  assert.equal(sim.world.isInSafeZone(sim.player), false);
  assert.equal(sim.world.isSafe(3, 3, 1), true);
});

test('inimigo colado na borda da zona segura não ataca quem está dentro', () => {
  const sim = buildGame({
    objects: GROUND,
    enemies: [[7, 5, 0, 5]],
    safe: safeRect(2, 6, 3, 7),
    player: { x: 6, y: 5, z: 0 }
  });
  const hp = sim.player.currentHp;
  for (let t = 1000; t <= 6000; t += TICK_MS) {
    sim.time = t;
    sim.combat.processEnemies(sim.player, t);
  }
  assert.equal(sim.player.currentHp, hp);
});
