// tests/logout.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect } from './helpers/fixture.js';
import { TICK_MS } from '../js/simulation.js';
import { CONFIG } from '../js/config.js';

// ================================================================================================================================================================================================================================================
// run

function run(game, ms) {
  const end = game.time + ms;
  while (game.time < end) game.tick(game.time + TICK_MS);
}

CONFIG.disconnectGraceMs = 10000;

test('fora de combate, o corpo espera disconnectGraceMs pelo dono e depois sai', () => {
  const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 5, y: 5, z: 0 } });
  assert.equal(game.leaveGame('player1'), false);
  run(game, CONFIG.disconnectGraceMs - 2 * TICK_MS);
  assert.equal(game.findOffline(game.player.name), game.player, 'o dono volta e assume o corpo');
  run(game, 4 * TICK_MS);
  assert.equal(game.getPlayer('player1'), null);
  assert.deepEqual(game.drainLoggedOut().map(p => p.id), ['player1']);
});

test('em combate, o corpo fica no mapa e só sai depois de logoutCombatMs sem golpe', () => {
  const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 5, y: 5, z: 0 } });
  game.player.lastCombatTime = game.time;
  assert.equal(game.leaveGame('player1'), false);
  assert.equal(game.getPlayer('player1').offline, true);
  run(game, CONFIG.logoutCombatMs - 2 * TICK_MS);
  assert.ok(game.getPlayer('player1'), 'ainda no mapa');
  run(game, 4 * TICK_MS);
  assert.equal(game.getPlayer('player1'), null);
  assert.deepEqual(game.drainLoggedOut().map(p => p.id), ['player1']);
});

test('o corpo offline que apanha continua em combate e quem volta assume ele', () => {
  const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), enemies: [[6, 5, 0]], player: { x: 5, y: 5, z: 0 } });
  game.enemies[0].atk = 1;
  game.enemies[0].detectionRadius = 8;
  game.player.currentHp = game.player.hp;
  run(game, 5 * TICK_MS);
  game.player.lastCombatTime = game.time;
  assert.equal(game.leaveGame('player1'), false);
  run(game, CONFIG.logoutCombatMs + 5000);
  assert.ok(game.getPlayer('player1'), 'o inimigo seguiu batendo, então o corpo não saiu');
  assert.equal(game.findOffline(game.player.name), game.player);
  game.player.offline = false;
  assert.equal(game.findOffline(game.player.name), null);
});

test('em zona segura o corpo offline sai depois da espera, mesmo em combate', () => {
  const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), safe: [[5, 5, 0]], player: { x: 5, y: 5, z: 0 } });
  game.player.lastCombatTime = game.time;
  assert.equal(game.leaveGame('player1'), false);
  run(game, CONFIG.disconnectGraceMs + 4 * TICK_MS);
  assert.equal(game.getPlayer('player1'), null);
});

test('morrer offline tira o corpo logo depois', () => {
  const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 5, y: 5, z: 0 } });
  game.player.lastCombatTime = game.time;
  game.leaveGame('player1');
  game.player.currentHp = 0;
  run(game, 3 * TICK_MS);
  assert.equal(game.getPlayer('player1'), null);
});

test('levar golpe de criatura e dar golpe nela deixam o player em combate', () => {
  const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), enemies: [[6, 5, 0]], player: { x: 5, y: 5, z: 0 } });
  assert.equal(game.inCombat(game.player), false);
  game.enemies[0].atk = 1;
  game.enemies[0].detectionRadius = 8;
  run(game, 6000);
  assert.equal(game.inCombat(game.player), true);
  game.player.lastCombatTime = -Infinity;
  game.combat.attackTarget(game.player, game.enemies[0], game.time + 5000);
  assert.equal(game.inCombat(game.player, game.time + 5000), true);
});

test('com o auto ataque ligado o corpo fica no mapa sem limite e sai quando o auto ataque desliga', () => {
  const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 5, y: 5, z: 0 } });
  game.player.attackMode = true;
  assert.equal(game.leaveGame('player1'), false);
  run(game, CONFIG.logoutCombatMs * 3);
  assert.ok(game.getPlayer('player1'), 'continua online');
  game.player.attackMode = false;
  run(game, 4 * TICK_MS);
  assert.equal(game.getPlayer('player1'), null);
});

test('em zona segura o auto ataque não segura o corpo depois da espera', () => {
  const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), safe: [[5, 5, 0]], player: { x: 5, y: 5, z: 0 } });
  game.player.attackMode = true;
  game.leaveGame('player1');
  run(game, CONFIG.disconnectGraceMs + 4 * TICK_MS);
  assert.equal(game.getPlayer('player1'), null);
});
