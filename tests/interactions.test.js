// tests/interactions.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect } from './helpers/fixture.js';
import { TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';
import { DUG_HOLE_MS } from '../js/systems/interactions.js';

const SIGN = 'estrutura/natureza/placa';
const BOOK = 'itens/livros/livro';
const CHEST = 'decoracao/moveis/bau';
const SPOT = 'estrutura/natureza/marca-de-corda';
const PILE = 'estrutura/natureza/monte';
const OPEN = 'estrutura/natureza/buraco';
const ROPE = 'itens/ferramentas/rope';
const SHOVEL = 'itens/ferramentas/shovel';
const BAG = 'itens/recipientes/bolsa';
const COIN = 'itens/valiosos/gold-coin';

const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, rotulo: `${grupo} › ${pasta}`, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(SIGN, { bloqueia: true, uso: 'placa' }),
  asset(BOOK, { move: true, peso: 13, uso: 'livro' }),
  asset(CHEST, { bloqueia: true, uso: 'bau-quest' }),
  asset(SPOT, { uso: 'corda' }),
  asset(PILE, { uso: 'pa', abreComo: OPEN }),
  asset(OPEN, {}),
  asset(ROPE, { move: true, peso: 18, uso: 'ferramenta-corda' }),
  asset(SHOVEL, { move: true, peso: 35, uso: 'ferramenta-pa' }),
  asset(BAG, { move: true, peso: 8, espacos: 4 }),
  asset(COIN, { move: true, peso: 0.1, empilhavel: true })
]);

// ================================================================================================================================================================================================================================================
// game
// Dois andares de chão (0 e 1), player em (5, 5) no térreo com uma bolsa e os
// objetos pedidos: [tipo, x, y, z, dados].

function game(objects = []) {
  const entries = objects.map(([type, x, y, z, dados]) => [type, x, y, z, 0, type === BOOK, false, type === SIGN || type === CHEST, null, null, dados]);
  const sim = buildGame({ objects: [...floorRect(0, 20, 0, 20, 0), ...floorRect(0, 20, 0, 20, 1), ...entries], player: { x: 5, y: 5, z: 0 } });
  sim.player.equip.mochila = { uid: 'bag0', type: BAG, items: new Array(4).fill(null) };
  sim.time = 1000;
  return sim;
}

function run(sim, ms) {
  const end = sim.time + ms;
  while (sim.time < end) sim.tick(sim.time + TICK_MS);
}

function send(sim, command) {
  sim.enqueue('player1', command);
  sim.tick(sim.time + TICK_MS);
  return sim.drainEvents();
}

const at = (sim, type) => sim.objects.find(o => o.id.startsWith(type + '_'));
const texts = (events) => events.filter(e => e.type === 'message').map(e => e.text);

test('placa: usar mostra o texto escrito no editor; longe, o player vai até ela', () => {
  const sim = game([[SIGN, 6, 5, 0, { texto: 'Bem-vindo à vila!' }], [SIGN, 12, 5, 0]]);
  const [near, far] = sim.objects.filter(o => o.id.startsWith(SIGN));
  assert.deepEqual(texts(send(sim, { type: 'useObject', id: near.id })), ['Bem-vindo à vila!']);
  send(sim, { type: 'useObject', id: far.id });
  const events = [];
  for (let i = 0; i < 60 && !texts(events).length; i++) events.push(...send(sim, { type: 'noop' }));
  assert.deepEqual(texts(events), ['Não há nada escrito.']);
  assert.ok(Math.abs(sim.player.x - 12) <= 1);
});

test('livro: no chão ou carregado, abre o texto; o texto vai junto quando pega', () => {
  const sim = game([[BOOK, 6, 5, 0, { texto: 'Era uma vez...' }]]);
  const book = at(sim, BOOK);
  const opened = send(sim, { type: 'useObject', id: book.id }).find(e => e.type === 'book');
  assert.equal(opened.text, 'Era uma vez...');
  send(sim, { type: 'moveInv', from: { t: 'g', id: book.id }, to: { t: 'c', uid: 'bag0', i: 0 } });
  const carried = sim.player.equip.mochila.items[0];
  assert.equal(carried.texto, 'Era uma vez...');
  const again = send(sim, { type: 'useItem', from: { t: 'c', uid: 'bag0', i: 0 } }).find(e => e.type === 'book');
  assert.equal(again.text, 'Era uma vez...');
  assert.equal(sim.player.toSave().equip.mochila.items[0].texto, 'Era uma vez...');
});

test('baú de quest: dá os itens do editor uma vez por player (fica salvo)', () => {
  const sim = game([[CHEST, 6, 5, 0, { itens: [{ tipo: COIN, count: 50 }, { tipo: ROPE, count: 1 }] }]]);
  const chest = at(sim, CHEST);
  assert.deepEqual(texts(send(sim, { type: 'useObject', id: chest.id })), ['Você encontrou 50 Gold Coin, Rope.']);
  const bag = sim.player.equip.mochila.items;
  assert.equal(bag[0].count, 50);
  assert.equal(bag[1].type, ROPE);
  assert.deepEqual(texts(send(sim, { type: 'useObject', id: chest.id })), ['Está vazio.']);
  assert.equal(bag.filter(Boolean).length, 2);
  assert.deepEqual(sim.player.toSave().quests, ['6,5,0']);
});

test('corda na marca de corda sobe pro andar de cima; a pá abre o monte em buraco, que fecha sozinho', () => {
  const sim = game([[SPOT, 6, 5, 0], [PILE, 5, 6, 1]]);
  const bag = sim.player.equip.mochila.items;
  bag[0] = { uid: 'r1', type: ROPE };
  bag[1] = { uid: 's1', type: SHOVEL };

  send(sim, { type: 'useItem', from: { t: 'c', uid: 'bag0', i: 0 }, target: { x: 9, y: 9, z: 0 } });
  assert.equal(sim.player.z, 0, 'longe da marca, não sobe');
  send(sim, { type: 'useItem', from: { t: 'c', uid: 'bag0', i: 0 }, target: { x: 6, y: 5, z: 0 } });
  assert.deepEqual([sim.player.x, sim.player.y, sim.player.z], [6, 6, 1]);

  const pile = at(sim, PILE);
  assert.deepEqual(texts(send(sim, { type: 'useObject', id: pile.id })), ['Use uma pá aqui pra abrir.']);
  send(sim, { type: 'useItem', from: { t: 'c', uid: 'bag0', i: 1 }, target: { x: 5, y: 6, z: 1 } });
  assert.equal(pile.dug, true);
  assert.ok(sim.world.getTransitionAt(5, 6, 1));
  run(sim, DUG_HOLE_MS + 2 * TICK_MS);
  assert.equal(pile.dug, false);
  assert.equal(sim.world.getTransitionAt(5, 6, 1), null);
});
