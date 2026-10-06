// tests/hunger.test.js

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

// ================================================================================================================================================================================================================================================
// withStarvation
// Liga a fome (os outros testes rodam com ela desligada, no fixture).

function withStarvation(fn) {
  const before = CONFIG.starveHpPercent;
  CONFIG.starveHpPercent = 1;
  try {
    fn();
  } finally {
    CONFIG.starveHpPercent = before;
  }
}

test('sem comida o player perde 1% da vida máxima por segundo', () => {
  withStarvation(() => {
    const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 5, y: 5, z: 0 } });
    const { player } = game;
    player.food = 0;
    const per = Math.max(1, Math.round(player.hp * 0.01));
    const start = player.currentHp;
    run(game, 5000 + TICK_MS);
    assert.equal(player.currentHp, start - 5 * per);
  });
});

test('com comida no estômago não perde vida de fome', () => {
  withStarvation(() => {
    const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 5, y: 5, z: 0 } });
    const { player } = game;
    player.food = 60000;
    const start = player.currentHp;
    run(game, 10000);
    assert.ok(player.currentHp >= start);
  });
});

test('comer para a fome e a vida volta a regenerar', () => {
  withStarvation(() => {
    const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 5, y: 5, z: 0 } });
    const { player } = game;
    player.food = 0;
    run(game, 3000);
    const hurt = player.currentHp;
    assert.ok(hurt < player.hp);
    player.food = 60000;
    run(game, 12000);
    assert.ok(player.currentHp > hurt);
  });
});

test('o corpo offline também passa fome e a fome pode matar', () => {
  withStarvation(() => {
    const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 5, y: 5, z: 0 } });
    const { player } = game;
    player.food = 0;
    player.currentHp = 3;
    player.lastCombatTime = game.time;
    game.leaveGame('player1');
    run(game, 4000);
    assert.equal(game.getPlayer('player1'), null, 'morreu de fome, voltou ao spawn e saiu do mapa');
  });
});
