// tests/potion.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect } from './helpers/fixture.js';
import { TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';
import { stackFrame } from '../shared/items.js';

const BAG = 'itens/recipientes/bolsa';
const POTION = 'itens/liquidos/health-potion';
const MANA = 'itens/liquidos/mana-potion';
const MEAT = 'itens/comidas/meet';

const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, rotulo: `${grupo} › ${pasta}`, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(BAG, { move: true, peso: 10, espacos: 4 }),
  asset(POTION, { move: true, peso: 1.8, empilhavel: true, vidaMin: 125, vidaMax: 175 }),
  asset(MANA, { move: true, peso: 1.9, empilhavel: true, manaMin: 75, manaMax: 125 }),
  asset(MEAT, { move: true, peso: 13, empilhavel: true, alimento: 180 })
]);

// ================================================================================================================================================================================================================================================
// game
// Chão de 30×30 e player em (5, 5) com uma bolsa.

function game() {
  const sim = buildGame({ objects: floorRect(0, 29, 0, 29), player: { x: 5, y: 5, z: 0 } });
  sim.player.equip.mochila = { uid: 'bag0', type: BAG, items: new Array(4).fill(null) };
  sim.time = 1000;
  return sim;
}

// ================================================================================================================================================================================================================================================
// run

function run(sim, ms) {
  const end = sim.time + ms;
  while (sim.time < end) sim.tick(sim.time + TICK_MS);
}

// ================================================================================================================================================================================================================================================
// send

function send(sim, command) {
  sim.enqueue('player1', command);
  sim.tick(sim.time + TICK_MS);
  return sim.drainEvents().filter(e => e.type === 'message').map(e => e.text);
}

test('potion: usar no inventário recupera dentro da faixa do Tibia, gasta uma e espera 1s pro próximo', () => {
  const sim = game();
  const bag = sim.player.equip.mochila;
  bag.items[0] = { uid: 'p1', type: POTION, count: 3 };
  bag.items[1] = { uid: 'm1', type: MANA, count: 1 };
  sim.player.currentHp = 1;
  sim.player.mana = 0;

  send(sim, { type: 'useItem', from: { t: 'c', uid: bag.uid, i: 0 } });
  const healed = sim.player.currentHp - 1;
  assert.ok(healed >= 125 && healed <= 175, `curou ${healed}`);
  assert.equal(bag.items[0].count, 2);

  const messages = send(sim, { type: 'useItem', from: { t: 'c', uid: bag.uid, i: 1 } });
  assert.deepEqual(messages, ['Você está exausto.']);
  assert.equal(sim.player.mana, 0);

  run(sim, 1000);
  send(sim, { type: 'useItem', from: { t: 'c', uid: bag.uid, i: 1 } });
  assert.ok(sim.player.mana >= 75 && sim.player.mana <= 125);
  assert.equal(sim.player.mana <= sim.player.maxMana, true);
  assert.equal(bag.items[1], null);

  run(sim, 1000);
  sim.player.currentHp = sim.player.hp;
  send(sim, { type: 'useItem', from: { t: 'c', uid: bag.uid, i: 0 } });
  assert.equal(sim.player.currentHp, sim.player.hp, 'não passa da vida máxima');
  assert.equal(bag.items[0].count, 1);
});

test('comida: soma tempo de regeneração até 1200s e recupera 1 de vida e mana a cada 6s', () => {
  const sim = game();
  const bag = sim.player.equip.mochila;
  bag.items[0] = { uid: 'c1', type: MEAT, count: 10 };
  sim.player.currentHp = 10;
  sim.player.mana = 10;

  send(sim, { type: 'useItem', from: { t: 'c', uid: bag.uid, i: 0 } });
  assert.equal(bag.items[0].count, 9);
  assert.ok(sim.player.food > 179000 && sim.player.food <= 180000);

  run(sim, 12000);
  assert.equal(sim.player.currentHp, 12);
  assert.equal(sim.player.mana, 12);

  for (let i = 0; i < 5; i++) send(sim, { type: 'useItem', from: { t: 'c', uid: bag.uid, i: 0 } });
  assert.equal(bag.items[0].count, 4, 'come até encher (1200s)');
  const messages = send(sim, { type: 'useItem', from: { t: 'c', uid: bag.uid, i: 0 } });
  assert.deepEqual(messages, ['Você está cheio.']);
  assert.equal(bag.items[0].count, 4);
});

test('pilha: o quadro muda com a quantidade, como no Tibia', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9, 10, 24, 25, 49, 50, 100].map(stackFrame), [0, 1, 2, 3, 4, 4, 5, 5, 6, 6, 7, 7]);
});
