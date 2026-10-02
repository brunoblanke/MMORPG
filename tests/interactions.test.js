// tests/interactions.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect } from './helpers/fixture.js';
import { TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';

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
const STONE_PILE = 'estrutura/entradas/buraco-pedra-fechado';
const STONE_HOLE = 'estrutura/entradas/buraco-pedra-aberto';
const SHADOW = 'estrutura/escadas/sombra-buraco';
const GRATE = 'estrutura/entradas/bueiro';

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
  asset(COIN, { move: true, peso: 0.1, empilhavel: true }),
  asset(STONE_PILE, { uso: 'pa', abreComo: STONE_HOLE }),
  asset(STONE_HOLE, {}),
  asset(SHADOW, { uso: 'corda' }),
  asset(GRATE, { uso: 'descer' })
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

test('placa: usar mostra o texto escrito no editor; longe, o player vai até ela; sem texto, nada', () => {
  const sim = game([[SIGN, 6, 5, 0, { texto: 'Bem-vindo à vila!' }], [SIGN, 12, 5, 0]]);
  const [near, far] = sim.objects.filter(o => o.id.startsWith(SIGN));
  const sign = send(sim, { type: 'useObject', id: near.id }).find(e => e.type === 'signText');
  assert.deepEqual([sign.text, sign.x, sign.y, sign.z], ['Bem-vindo à vila!', 6, 5, 0]);
  send(sim, { type: 'useObject', id: far.id });
  const events = [];
  for (let i = 0; i < 60; i++) events.push(...send(sim, { type: 'noop' }));
  assert.deepEqual(events.filter(e => e.type === 'signText'), []);
  assert.ok(Math.abs(sim.player.x - 12) <= 1);
});

test('placa: o texto sai na cor escolhida no editor (verde se não escolheu)', () => {
  const sim = game([[SIGN, 6, 5, 0, { texto: 'Perigo!', cor: 'danger' }], [SIGN, 4, 5, 0, { texto: 'Oi' }], [SIGN, 5, 6, 0, { texto: 'Lago', cor: 'blue' }]]);
  const [red, green, blue] = sim.objects.filter(o => o.id.startsWith(SIGN));
  const kind = (events) => events.find(e => e.type === 'signText').kind;
  assert.equal(kind(send(sim, { type: 'useObject', id: red.id })), 'danger');
  assert.equal(kind(send(sim, { type: 'useObject', id: green.id })), 'info');
  assert.equal(kind(send(sim, { type: 'useObject', id: blue.id })), 'blue');
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

test('corda na marca de corda sobe pro andar de cima; a pá abre o monte em buraco, que fica aberto', () => {
  const sim = game([[SPOT, 6, 5, 0], [PILE, 5, 6, 1]]);
  const bag = sim.player.equip.mochila.items;
  bag[0] = { uid: 'r1', type: ROPE };
  bag[1] = { uid: 's1', type: SHOVEL };

  send(sim, { type: 'useItem', from: { t: 'c', uid: 'bag0', i: 0 }, target: { x: 9, y: 9, z: 0 } });
  assert.equal(sim.player.z, 0, 'sem marca de corda no sqm, nada acontece');
  send(sim, { type: 'useItem', from: { t: 'c', uid: 'bag0', i: 0 }, target: { x: 6, y: 5, z: 0 } });
  assert.deepEqual([sim.player.x, sim.player.y, sim.player.z], [5, 5, 1], 'ao sul do buraco de cima (1 ao norte e 1 a oeste da marca)');

  const pile = at(sim, PILE);
  assert.deepEqual(texts(send(sim, { type: 'useObject', id: pile.id })), []);
  send(sim, { type: 'useItem', from: { t: 'c', uid: 'bag0', i: 1 }, target: { x: 5, y: 6, z: 1 } });
  assert.equal(pile.dug, true);
  assert.ok(sim.world.getTransitionAt(5, 6, 1));
  run(sim, 10 * 60000);
  assert.equal(pile.dug, true, 'fica aberto até o servidor reiniciar');
  assert.ok(sim.world.getTransitionAt(5, 6, 1));
});

test('corda e pá de longe: o player anda até o lado e usa ao chegar', () => {
  const sim = game([[SPOT, 12, 5, 0], [PILE, 5, 12, 1]]);
  const bag = sim.player.equip.mochila.items;
  bag[0] = { uid: 'r1', type: ROPE };
  bag[1] = { uid: 's1', type: SHOVEL };
  send(sim, { type: 'useItem', from: { t: 'c', uid: 'bag0', i: 0 }, target: { x: 12, y: 5, z: 0 } });
  assert.equal(sim.player.z, 0);
  for (let i = 0; i < 200 && sim.player.z === 0; i++) send(sim, { type: 'noop' });
  assert.deepEqual([sim.player.x, sim.player.y, sim.player.z], [11, 5, 1]);
  run(sim, 1000);
  send(sim, { type: 'useItem', from: { t: 'c', uid: 'bag0', i: 1 }, target: { x: 5, y: 12, z: 1 } });
  const pile = at(sim, PILE);
  for (let i = 0; i < 300 && !pile.dug; i++) send(sim, { type: 'noop' });
  assert.equal(pile.dug, true);
  assert.ok(Math.max(Math.abs(sim.player.x - 5), Math.abs(sim.player.y - 12)) <= 1);
});

test('com Uso, a pasta não manda: monte da pá em Entradas não é buraco e marca de corda em Escadas não é escada', async () => {
  const { buildGame: build, floorRect: floors } = await import('./helpers/fixture.js');
  const sim = build({ objects: [...floors(0, 20, 0, 20, 0), ...floors(0, 20, 0, 20, 1), [STONE_PILE, 6, 5, 0, 0, false, false, false]], player: { x: 5, y: 5, z: 0 } });
  assert.equal(sim.world.getTransitionAt(6, 5, 0), null, 'o monte fechado não derruba ninguém');
  const mapData = { objetosData: floors(0, 5, 0, 5, 0), transicoesData: [[SHADOW, 2, 2, 0, 'up', 1, 2]], spawn: { x: 1, y: 1, z: 0 } };
  const { Simulation } = await import('../js/simulation.js');
  const other = new Simulation(mapData);
  assert.equal(other.world.getTransitionAt(2, 2, 0), null, 'a marca de corda não sobe sozinha');
  assert.ok(other.objects.some(o => o.id.startsWith(SHADOW + '_')));
});

test('bueiro: pisar não derruba; usar leva pro andar de baixo', () => {
  const entries = [[GRATE, 5, 6, 1, 0, false, false, false]];
  const up = buildGame({ objects: [...floorRect(0, 20, 0, 20, 0), ...floorRect(0, 20, 0, 20, 1), ...entries], player: { x: 5, y: 5, z: 1 } });
  up.time = 1000;
  assert.equal(up.world.getTransitionAt(5, 6, 1), null);
  const grate = up.objects.find(o => o.id.startsWith(GRATE + '_'));
  up.enqueue('player1', { type: 'useObject', id: grate.id });
  up.tick(up.time + TICK_MS);
  assert.deepEqual([up.player.x, up.player.y, up.player.z], [6, 7, 0], '1 ao sul e 1 ao leste, no andar de baixo');
});

test('container fixo no mapa começa com os itens do editor e abre sem ser pego', () => {
  const box = 'decoracao/moveis/caixa';
  setAssets([asset(box, { bloqueia: true, espacos: 4 }), asset(COIN, { move: true, peso: 0.1, empilhavel: true }), asset(ROPE, { move: true, peso: 18, uso: 'ferramenta-corda' })]);
  const sim = buildGame({ objects: [...floorRect(0, 20, 0, 20, 0), [box, 6, 5, 0, 0, false, false, true, null, null, { itens: [{ tipo: COIN, count: 30 }, { tipo: ROPE, count: 1 }] }]], player: { x: 5, y: 5, z: 0 } });
  const obj = sim.objects.find(o => o.id.startsWith(box + '_'));
  assert.equal(sim.inventory.isOpenable(obj), true);
  assert.equal(sim.inventory.isPickable(obj), false);
  const items = sim.inventory.groundItem(obj).items;
  assert.equal(items[0].count, 30);
  assert.equal(items[1].type, ROPE);
  assert.equal(items[2], null);
});

test('bueiro em cima do topo de uma escada: pisar não desce', () => {
  setAssets([asset(GRATE, { uso: 'descer' })]);
  const up = buildGame({ objects: [...floorRect(0, 20, 0, 20, 0), ...floorRect(0, 20, 0, 20, 1), [GRATE, 5, 6, 1, 0, false, false, false]], stairs: [[6, 7, 0]], player: { x: 4, y: 6, z: 1 } });
  up.time = 1000;
  assert.equal(up.world.getTransitionAt(5, 6, 1), null);
  assert.equal(up.world.hasFloorAt(5, 6, 1), true);
  up.enqueue('player1', { type: 'walkTo', x: 5, y: 6, z: 1 });
  run(up, 2000);
  assert.deepEqual([up.player.x, up.player.y, up.player.z], [5, 6, 1]);
});

test('criatura não sobe em caixa nem pisa em escada ou buraco; só sobe puxada pela corda no buraco', async () => {
  const { hole, pile, buildGame: build, floorRect: floors, CREATURE } = await import('./helpers/fixture.js');
  setAssets([asset(ROPE, { move: true, peso: 18, uso: 'ferramenta-corda' }), asset(BAG, { move: true, peso: 8, espacos: 4 })]);
  const sim = build({ objects: [...floors(0, 20, 0, 20, 0), ...floors(0, 20, 0, 20, 1), ...pile(8, 5, 1, 0), ...hole(10, 10, 1)], enemies: [[11, 11, 0]], player: { x: 9, y: 10, z: 1 } });
  const enemy = sim.enemies[0];
  const { resolveStep } = await import('../js/core/movement.js');
  const ground = { groundOnly: true };
  assert.equal(resolveStep(sim.world, { x: 7, y: 5, z: 0, step: 0 }, 1, 0, ground), null, 'não sobe na caixa');
  assert.ok(resolveStep(sim.world, { x: 7, y: 5, z: 0, step: 0 }, 1, 0), 'o player sobe');
  assert.equal(resolveStep(sim.world, { x: 9, y: 10, z: 1, step: 0 }, 1, 0, { ...ground, transitions: true }), null, 'não pisa no buraco');
  sim.player.equip.mochila = { uid: 'bag0', type: BAG, items: [{ uid: 'r1', type: ROPE }, null, null, null] };
  sim.time = 1000;
  sim.enqueue('player1', { type: 'useItem', from: { t: 'c', uid: 'bag0', i: 0 }, target: { x: 10, y: 10, z: 1 } });
  sim.tick(sim.time + TICK_MS);
  assert.equal(enemy.z, 1, 'puxada pela corda');
  assert.ok(Math.max(Math.abs(enemy.x - 10), Math.abs(enemy.y - 10)) <= 1);
  assert.equal(enemy.creature, CREATURE);
});

test('conferência do mundo: avisa placa sem texto, baú sem itens e objeto sem folha no gerador', async () => {
  const { validateWorld } = await import('../js/core/validate.js');
  setAssets([asset(SIGN, { bloqueia: true, uso: 'placa' }), asset(CHEST, { bloqueia: true, uso: 'bau-quest' })]);
  const sim = game([[SIGN, 6, 5, 0], [SIGN, 7, 5, 0, { texto: 'ok' }], [CHEST, 8, 5, 0], ['itens/sumiu/nada', 9, 5, 0]]);
  const warnings = validateWorld(sim);
  assert.ok(warnings.some(w => w.startsWith('Placa sem texto') && w.includes('6,5,0')));
  assert.ok(!warnings.some(w => w.includes('7,5,0')));
  assert.ok(warnings.some(w => w.startsWith('Baú de quest sem itens') && w.includes('8,5,0')));
  assert.ok(warnings.some(w => w.includes('itens/sumiu/nada') && w.includes('9,5,0')));
});
