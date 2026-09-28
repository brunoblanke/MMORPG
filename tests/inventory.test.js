// tests/inventory.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, buildMapData } from './helpers/fixture.js';
import { Simulation, TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';
import { serializeState, applyState } from '../js/net/protocol.js';
import { World } from '../js/core/world.js';
import { generateObjects } from '../js/models/game-object.js';

const BAG = 'itens/recipientes/bolsa';
const CHEST = 'itens/recipientes/caixote';
const SWORD = 'itens/espadas/espada';
const AXE = 'itens/machados/machado';
const COIN = 'itens/valiosos/moeda';
const SHIELD = 'itens/escudos/escudo';

const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, rotulo: `${grupo} › ${pasta}`, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(BAG, { move: true, peso: 10, espacos: 4 }),
  asset(CHEST, { move: true, peso: 100, espacos: 6 }),
  asset(SWORD, { move: true, peso: 30, atk: 12, ml: 1 }),
  asset(AXE, { move: true, peso: 40 }),
  asset(SHIELD, { move: true, peso: 50, def: 8, atk: 2 }),
  asset(COIN, { move: true, peso: 0.1, empilhavel: true })
]);

// ================================================================================================================================================================================================================================================
// game
// Chão de 30×30, player em (5, 5) e itens soltos no mapa: [tipo, x, y].

function game(items = []) {
  const objects = [...floorRect(0, 29, 0, 29), ...items.map(([type, x, y]) => [type, x, y, 0, 0, 1, 0, 0])];
  const sim = buildGame({ objects, player: { x: 5, y: 5, z: 0 } });
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
  return sim.drainEvents().filter(e => e.type === 'message').map(e => e.text);
}

function groundAt(sim, x, y) {
  return sim.objects.filter(o => o.itemData !== undefined || o.id.startsWith('itens/')).filter(o => o.x === x && o.y === y && sim.world.objects.has(o));
}

test('quem entra pela primeira vez ganha a mochila; o inventário troca e o item de antes volta', () => {
  const sim = game();
  const bag = sim.player.equip.mochila;
  assert.equal(bag.type, BAG);
  bag.items[0] = { uid: 'x1', type: AXE };
  sim.player.equip.arma = { uid: 'x2', type: SWORD };

  send(sim, { type: 'moveInv', from: { t: 'c', uid: bag.uid, i: 0 }, to: { t: 'e', key: 'arma' } });
  assert.equal(sim.player.equip.arma.type, AXE);
  assert.equal(bag.items[0].type, SWORD);

  assert.deepEqual(send(sim, { type: 'moveInv', from: { t: 'e', key: 'arma' }, to: { t: 'e', key: 'cabeca' } }), ['Esse item não vai nesse espaço.']);
});

test('container não troca: vai pro primeiro espaço vazio; cheio, Sem espaço; em cima de caixa, entra nela', () => {
  const sim = game();
  const bag = sim.player.equip.mochila;
  const inner = { uid: 'b2', type: BAG, items: [null, null, null, null] };
  bag.items = [{ uid: 'a', type: SWORD }, inner, null, null];
  sim.player.equip.arma = { uid: 'w', type: AXE };

  send(sim, { type: 'moveInv', from: { t: 'e', key: 'arma' }, to: { t: 'c', uid: bag.uid, i: 0 } });
  assert.equal(bag.items[0].type, SWORD);
  assert.equal(bag.items[2].type, AXE);

  send(sim, { type: 'moveInv', from: { t: 'c', uid: bag.uid, i: 2 }, to: { t: 'c', uid: bag.uid, i: 1 } });
  assert.equal(bag.items[2], null);
  assert.equal(inner.items[0].type, AXE);

  bag.items[2] = { uid: 'c', type: SWORD };
  bag.items[3] = { uid: 'd', type: SWORD };
  sim.player.equip.arma = { uid: 'e', type: AXE };
  assert.deepEqual(send(sim, { type: 'moveInv', from: { t: 'e', key: 'arma' }, to: { t: 'c', uid: bag.uid, i: 0 } }), ['Sem espaço.']);
  assert.equal(sim.player.equip.arma.type, AXE);
  assert.deepEqual(send(sim, { type: 'moveInv', from: { t: 'c', uid: bag.uid, i: 1 }, to: { t: 'c', uid: inner.uid, i: 1 } }), ['Não dá pra pôr uma caixa dentro dela mesma.']);
});

test('solto no espaço da mochila, o item entra nela; em cima de caixa que não é minha, vai pro primeiro espaço vazio', () => {
  const sim = game([[CHEST, 6, 5]]);
  const bag = sim.player.equip.mochila;
  sim.player.equip.arma = { uid: 'w', type: AXE };
  send(sim, { type: 'moveInv', from: { t: 'e', key: 'arma' }, to: { t: 'e', key: 'mochila' } });
  assert.equal(sim.player.equip.arma, null);
  assert.equal(bag.items[0].type, AXE);
  assert.equal(sim.player.equip.mochila, bag);

  const chest = groundAt(sim, 6, 5)[0];
  send(sim, { type: 'openContainer', itemId: chest.id });
  const box = sim.inventory.groundItem(chest);
  const inner = { uid: 'b9', type: BAG, items: [null, null, null, null] };
  box.items[0] = inner;
  send(sim, { type: 'moveInv', from: { t: 'c', uid: bag.uid, i: 0 }, to: { t: 'c', uid: box.uid, i: 0 } });
  assert.equal(inner.items[0], null);
  assert.equal(box.items[1].type, AXE);
});

test('pilhas: Shift move só uma parte e pilhas iguais se juntam até 100', () => {
  const sim = game();
  const bag = sim.player.equip.mochila;
  bag.items[0] = { uid: 'm1', type: COIN, count: 80 };
  bag.items[1] = { uid: 'm2', type: COIN, count: 50 };

  send(sim, { type: 'moveInv', from: { t: 'c', uid: bag.uid, i: 0 }, to: { t: 'c', uid: bag.uid, i: 2 }, amount: 30 });
  assert.deepEqual([bag.items[0].count, bag.items[2].count], [50, 30]);

  send(sim, { type: 'moveInv', from: { t: 'c', uid: bag.uid, i: 1 }, to: { t: 'c', uid: bag.uid, i: 0 } });
  assert.equal(bag.items[0].count, 100);
  assert.equal(bag.items[1], null);
});

test('pegar do chão: longe, o player anda até ficar colado; a cap não deixa passar do peso', () => {
  const sim = game([[SWORD, 10, 5], [CHEST, 6, 5]]);
  const bag = sim.player.equip.mochila;
  const sword = groundAt(sim, 10, 5)[0];

  send(sim, { type: 'moveInv', from: { t: 'g', id: sword.id }, to: { t: 'c', uid: bag.uid, i: 0 } });
  assert.equal(bag.items[0], null);
  run(sim, 4000);
  assert.equal(bag.items[0].type, SWORD);
  assert.ok(Math.abs(sim.player.x - 10) <= 1);
  assert.equal(groundAt(sim, 10, 5).length, 0);

  sim.player.lvl = 1;
  const chest = groundAt(sim, 6, 5)[0];
  sim.player.x = 5; sim.player.y = 5;
  const heavy = { uid: 'h', type: CHEST, items: new Array(6).fill(null).map((_, i) => ({ uid: `s${i}`, type: AXE })) };
  sim.inventory.groundItem(chest);
  chest.itemData = heavy;
  const messages = send(sim, { type: 'moveInv', from: { t: 'g', id: chest.id }, to: { t: 'c', uid: bag.uid, i: 1 } });
  assert.match(messages[0], /^Pesado demais/);
  assert.equal(bag.items[1], null);
});

test('jogar no chão até 25 sqm; o item aparece no espelho do navegador e some quando é pego', () => {
  const sim = game();
  const bag = sim.player.equip.mochila;
  bag.items[0] = { uid: 'j', type: AXE };

  const mirror = { world: new World(), players: [], enemies: [], deadBodies: [], objects: generateObjects(sim.mapData) };
  mirror.world.load(mirror.objects);
  mirror.objectsById = new Map(mirror.objects.map(o => [o.id, o]));

  assert.deepEqual(send(sim, { type: 'moveInv', from: { t: 'c', uid: bag.uid, i: 0 }, to: { t: 'w', x: 5, y: 29, z: 0 } }), []);
  const thrown = groundAt(sim, 5, 29);
  assert.equal(thrown.length, 1);
  applyState(mirror, { time: sim.time, state: serializeState(sim, 'player1') }, 'player1', 0);
  assert.ok(mirror.objectsById.has(thrown[0].id));
  assert.equal(mirror.inventoryView.equip.mochila.items[0], null);

  sim.player.equip.arma = { uid: 'k', type: SWORD };
  sim.player.x = 29; sim.player.y = 29;
  assert.deepEqual(send(sim, { type: 'moveInv', from: { t: 'e', key: 'arma' }, to: { t: 'w', x: 0, y: 0, z: 0 } }), ['Longe demais: dá pra jogar até 25 sqm.']);

  sim.player.x = 5; sim.player.y = 28;
  send(sim, { type: 'moveInv', from: { t: 'g', id: thrown[0].id }, to: { t: 'c', uid: bag.uid, i: 0 } });
  applyState(mirror, { time: sim.time, state: serializeState(sim, 'player1') }, 'player1', 0);
  assert.equal(mirror.objectsById.has(thrown[0].id), false);
  assert.equal(bag.items[0].type, AXE);
});

test('caixa no chão abre só colado e fecha quando o player se afasta', () => {
  const sim = game([[CHEST, 9, 5]]);
  const chest = groundAt(sim, 9, 5)[0];

  send(sim, { type: 'openContainer', itemId: chest.id });
  assert.equal(sim.inventory.viewFor(sim.player).opened.length, 0);
  run(sim, 3000);
  const opened = sim.inventory.viewFor(sim.player).opened;
  assert.equal(opened.length, 1);
  assert.equal(opened[0].item.items.length, 6);

  send(sim, { type: 'walkTo', x: 3, y: 5, z: 0 });
  run(sim, 4000);
  assert.equal(sim.inventory.viewFor(sim.player).opened.length, 0);
});

test('cadáver é container com o loot; duplo clique leva o player até ele e abre', () => {
  const mapData = buildMapData({ objects: floorRect(0, 29, 0, 29), enemies: [[12, 12, 0]], spawn: { x: 5, y: 5, z: 0 } });
  const sim = new Simulation(mapData, { lootTable: { 'criaturas/mamiferos/teste': [{ tipo: COIN, chance: 1, min: 5, max: 5 }, { tipo: SWORD, chance: 1 }] } });
  sim.time = 1000;
  const player = sim.addPlayer('player1', { name: 'Ana' });
  const enemy = sim.enemies[0];
  enemy.currentHp = 0;
  sim.tick(sim.time + TICK_MS);
  const corpse = sim.deadBodies.find(c => c.type === 'enemy_corpse');
  assert.deepEqual(corpse.itemData.items.slice(0, 2).map(i => i && [i.type, i.count || 1]), [[COIN, 5], [SWORD, 1]]);

  sim.enqueue('player1', { type: 'openContainer', itemId: corpse.id });
  run(sim, 5000);
  assert.equal(Math.max(Math.abs(player.x - 12), Math.abs(player.y - 12)) <= 1, true);
  const opened = sim.inventory.viewFor(player).opened;
  assert.equal(opened.length, 1);
  assert.equal(opened[0].corpse, true);

  const bag = player.equip.mochila;
  sim.enqueue('player1', { type: 'moveInv', from: { t: 'c', uid: corpse.itemData.uid, i: 1 }, to: { t: 'c', uid: bag.uid, i: 0 } });
  sim.tick(sim.time + TICK_MS);
  assert.equal(bag.items[0].type, SWORD);
  assert.equal(corpse.itemData.items[1], null);
});

test('corpo que some no caminho: o player termina de andar até o sqm colado e não abre nada', () => {
  const mapData = buildMapData({ objects: floorRect(0, 29, 0, 29), enemies: [[15, 5, 0]], spawn: { x: 5, y: 5, z: 0 } });
  const sim = new Simulation(mapData, { lootTable: {} });
  sim.time = 1000;
  const player = sim.addPlayer('player1', { name: 'Bia' });
  sim.enemies[0].currentHp = 0;
  sim.tick(sim.time + TICK_MS);
  const corpse = sim.deadBodies.find(c => c.type === 'enemy_corpse');

  sim.enqueue('player1', { type: 'openContainer', itemId: corpse.id });
  sim.tick(sim.time + TICK_MS);
  sim.lifeCycle.removeCorpse(corpse);
  run(sim, 6000);
  assert.deepEqual([player.x, player.y], [14, 5]);
  assert.equal(sim.inventory.viewFor(player).opened.length, 0);
});

test('personagem volta com os itens e o layout', () => {
  const mapData = buildMapData({ objects: floorRect(0, 29, 0, 29), spawn: { x: 5, y: 5, z: 0 } });
  const sim = new Simulation(mapData);
  const player = sim.addPlayer('p1', { name: 'Ana' });
  player.equip.mochila.items[0] = { uid: 'z', type: COIN, count: 42 };
  sim.inventory.saveLayout(player, { left: [], right: [{ ref: 'inventory' }] });
  const saved = JSON.parse(JSON.stringify(player.toSave()));

  const again = new Simulation(mapData).addPlayer('p2', { name: 'Ana', saved });
  assert.equal(again.equip.mochila.type, BAG);
  assert.equal(again.equip.mochila.items[0].count, 42);
  assert.deepEqual(again.uiLayout, { left: [], right: [{ ref: 'inventory' }] });
});

test('player morto: o corpo fica com a mochila e, por sorteio, outros itens; ele volta sem eles', () => {
  const sim = game();
  const player = sim.player;
  const bag = player.equip.mochila;
  player.equip.arma = { uid: 'w1', type: SWORD };
  player.equip.escudo = null;
  player.equip.pes = { uid: 'w2', type: AXE };
  const rolls = [0.1, 0.9];
  const random = Math.random;
  Math.random = () => rolls.length ? rolls.shift() : 0.99;
  try {
    player.currentHp = 0;
    sim.tick(sim.time + TICK_MS);
  } finally {
    Math.random = random;
  }
  const corpse = sim.deadBodies.find(c => c.type === 'player_corpse');
  assert.deepEqual(corpse.itemData.items.filter(Boolean).map(i => i.uid), [bag.uid, 'w1']);
  assert.equal(player.equip.mochila, null);
  assert.equal(player.equip.arma, null);
  assert.equal(player.equip.pes.uid, 'w2');

  sim.enqueue('player1', { type: 'openContainer', itemId: corpse.id });
  run(sim, 4000);
  const opened = sim.inventory.viewFor(player).opened;
  assert.equal(opened.length, 1);
  assert.equal(opened[0].name, player.name);
});

test('skills começam no padrão do 7.6 e voltam com o personagem', () => {
  const mapData = buildMapData({ objects: floorRect(0, 29, 0, 29), spawn: { x: 5, y: 5, z: 0 } });
  const player = new Simulation(mapData).addPlayer('p1', { name: 'Ana' });
  assert.deepEqual(player.skills.sword, { lvl: 10, pct: 0 });
  assert.deepEqual(player.skills.magic, { lvl: 0, pct: 0 });
  player.skills.sword = { lvl: 42, pct: 37 };
  const saved = JSON.parse(JSON.stringify(player.toSave()));
  const again = new Simulation(mapData).addPlayer('p2', { name: 'Ana', saved });
  assert.deepEqual(again.skills.sword, { lvl: 42, pct: 37 });
  assert.equal(again.skills.fishing.lvl, 10);
});

test('atk, def e ml dos itens do inventário somam nos skills e no combate', () => {
  const sim = game();
  const player = sim.player;
  const base = sim.combat.calculateDamage(player, { def: 0 });
  player.equip.arma = { uid: 's1', type: SWORD };
  player.equip.escudo = { uid: 's2', type: SHIELD };
  player.equip.mochila.items[0] = { uid: 's3', type: SWORD };
  const stats = sim.inventory.viewFor(player).stats;
  assert.equal(stats.skills.sword.bonus, 14);
  assert.equal(stats.skills.shielding.bonus, 8);
  assert.equal(stats.skills.magic.bonus, 1);
  assert.equal(stats.skills.axe.bonus, 0);
  assert.ok(sim.combat.calculateDamage(player, { def: 0 }) > base);
  assert.equal(stats.maxMana, player.maxMana);
});
