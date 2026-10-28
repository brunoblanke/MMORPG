// tests/hunger.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect } from './helpers/fixture.js';
import { TICK_MS } from '../js/simulation.js';
import { CONFIG } from '../js/config.js';
import { CONDITIONS } from '../shared/conditions.js';
import { FOOD_MAX_SECONDS } from '../shared/items.js';
import { setAssets } from '../shared/assets.js';

const BAG = 'itens/recipientes/bolsa-de-teste';
const MEAT = 'itens/comidas/carne-de-teste';

setAssets([
  { id: BAG, ferramenta: 'objetos', grupo: 'itens', pasta: 'recipientes', nome: 'bolsa-de-teste', url: '/b.png', quadro: 32, quadros: 1, pecas: [], propriedades: { move: true, espacos: 4 } },
  { id: MEAT, ferramenta: 'objetos', grupo: 'itens', pasta: 'comidas', nome: 'carne-de-teste', url: '/m.png', quadro: 32, quadros: 1, pecas: [], propriedades: { move: true, empilhavel: true, peso: 1, alimento: 180 } }
]);

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

test('sem comida o player perde 1% da vida máxima no mesmo intervalo do veneno', () => {
  withStarvation(() => {
    const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 5, y: 5, z: 0 } });
    const { player } = game;
    player.food = 0;
    const per = Math.max(1, Math.round(player.hp * 0.01));
    const start = player.currentHp;
    run(game, CONDITIONS.poison.interval * 5 + TICK_MS);
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
    run(game, CONDITIONS.poison.interval * 2 + TICK_MS);
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
    run(game, CONDITIONS.poison.interval * 3);
    assert.equal(game.getPlayer('player1'), null, 'morreu de fome, voltou ao spawn e saiu do mapa');
  });
});

// ================================================================================================================================================================================================================================================
// hungerMessages

function hungerMessages(game) {
  return game.events.filter(e => e.type === 'message' && e.text === 'Você está com fome.');
}

test('o player novo começa com a comida cheia', () => {
  const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 5, y: 5, z: 0 } });
  const fresh = game.addPlayer('player2');
  assert.equal(fresh.food, FOOD_MAX_SECONDS * 1000);
});

test('sem comida avisa "Você está com fome." de 10 em 10 segundos até o player comer', () => {
  withStarvation(() => {
    const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 5, y: 5, z: 0 } });
    game.player.food = 3000;
    game.player.currentHp = game.player.hp = 100000;
    run(game, 25000);
    assert.equal(game.player.food, 0);
    assert.equal(hungerMessages(game).length, 3);
    game.player.food = 60000;
    game.events = [];
    run(game, 20000);
    assert.equal(hungerMessages(game).length, 0);
  });
});

test('com o auto ataque ligado, o player come sozinho o 1º alimento da mochila assim que a comida acaba', () => {
  withStarvation(() => {
    const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 5, y: 5, z: 0 } });
    const { player } = game;
    player.equip.mochila = { uid: 'b1', type: BAG, items: [null, { uid: 'm1', type: MEAT, count: 2 }, null, null] };
    player.food = 0;
    player.attackMode = false;
    run(game, TICK_MS * 2);
    assert.equal(player.equip.mochila.items[1].count, 2, 'sem auto ataque não come');
    player.attackMode = true;
    const hp = player.currentHp;
    run(game, TICK_MS * 2);
    assert.equal(player.equip.mochila.items[1].count, 1, 'comeu um');
    assert.ok(player.food > 170000);
    assert.equal(player.currentHp, hp, 'não passou fome');
    run(game, TICK_MS * 4);
    assert.equal(player.equip.mochila.items[1].count, 1, 'só come de novo quando a comida acabar');
  });
});
