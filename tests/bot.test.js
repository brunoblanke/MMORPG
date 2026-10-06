// tests/bot.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMapData, floorRect } from './helpers/fixture.js';
import { Simulation, TICK_MS } from '../js/simulation.js';

// ================================================================================================================================================================================================================================================
// game
// Ana (player1) ao lado do bot de teste em (8, 5).

function game() {
  const sim = new Simulation(buildMapData({ objects: floorRect(0, 20, 0, 20, 0), spawn: { x: 5, y: 5, z: 0 } }), { bots: [{ name: 'Alvo', x: 8, y: 5, z: 0, lvl: 20 }] });
  sim.player = sim.addPlayer('player1', { name: 'Ana' });
  sim.player.lvl = 20;
  sim.player.applyLevelStats();
  sim.player.food = Number.MAX_SAFE_INTEGER;
  return sim;
}

test('o bot de teste fica no lugar, é um player que não revida e tem o nome dele', () => {
  const sim = game();
  const bot = sim.players.find(p => p.isBot);
  assert.equal(bot.name, 'Alvo');
  assert.deepEqual([bot.x, bot.y, bot.z], [8, 5, 0]);
  sim.player.currentHp = sim.player.hp - 20;
  const hp = sim.player.currentHp;
  for (let t = 0; t < 10000; t += TICK_MS) sim.tick(sim.time + TICK_MS);
  assert.deepEqual([bot.x, bot.y], [8, 5]);
  assert.ok(sim.player.currentHp >= hp);
});

test('o bot morre e renasce na hora, no mesmo lugar, com a vida cheia', () => {
  const sim = game();
  const bot = sim.players.find(p => p.isBot);
  bot.currentHp = 0;
  sim.tick(sim.time + TICK_MS);
  assert.equal(bot.currentHp, bot.hp);
  assert.deepEqual([bot.x, bot.y], [8, 5]);
  assert.equal(sim.deadBodies.length, 0);
  assert.ok(sim.players.includes(bot));
});

test('matar o bot sem justificativa dá a caveira branca e conta frag; 3 dão a vermelha', () => {
  const sim = game();
  const bot = sim.players.find(p => p.isBot);
  for (let i = 0; i < 3; i++) {
    sim.player.lastAttackTime = -1e9;
    sim.combat.attackTarget(sim.player, bot, sim.time);
    bot.currentHp = 0;
    sim.tick(sim.time + TICK_MS);
  }
  assert.equal(sim.player.frags.length, 3);
  assert.equal(sim.social.skullOf(sim.player), 'red');
});
