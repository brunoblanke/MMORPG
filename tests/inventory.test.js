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
const BOOTS = 'itens/botas/boots-of-haste';
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
  asset(COIN, { move: true, peso: 0.1, empilhavel: true }),
  asset(BOOTS, { move: true, peso: 8, speed: 20 })
]);

// ================================================================================================================================================================================================================================================
// game
// Chão de 30×30, player em (5, 5) e itens soltos no mapa: [tipo, x, y].

function game(items = [], { withBag = true } = {}) {
  const objects = [...floorRect(0, 29, 0, 29), ...items.map(([type, x, y]) => [type, x, y, 0, 0, 1, 0, 0])];
  const sim = buildGame({ objects, player: { x: 5, y: 5, z: 0 } });
  if (withBag) sim.player.equip.mochila = { uid: 'bag0', type: BAG, items: new Array(4).fill(null) };
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

test('quem entra pela primeira vez começa sem nada', () => {
  const sim = game([], { withBag: false });
  assert.ok(Object.values(sim.player.equip).every(item => item === null));
});

test('o inventário troca e o item de antes volta', () => {
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
  assert.equal(bag.items[1].count, 30, 'o que vinha depois sobe pro espaço que ficou vazio');
  assert.equal(bag.items[2], null);
});

test('container se organiza sozinho: sem espaços vazios entre os itens', () => {
  const sim = game();
  const bag = sim.player.equip.mochila;
  bag.items[0] = { uid: 'a', type: SWORD };
  bag.items[1] = { uid: 'b', type: AXE };
  bag.items[2] = { uid: 'c', type: SHIELD };
  send(sim, { type: 'moveInv', from: { t: 'c', uid: bag.uid, i: 1 }, to: { t: 'e', key: 'arma' } });
  assert.deepEqual(bag.items.slice(0, 3).map(i => i && i.uid), ['a', 'c', null]);

  send(sim, { type: 'moveInv', from: { t: 'e', key: 'arma' }, to: { t: 'c', uid: bag.uid, i: 3 } });
  assert.deepEqual(bag.items.slice(0, 4).map(i => i && i.uid), ['a', 'c', 'b', null], 'solto num espaço lá no fim, vai pro primeiro livre');
});

test('item solto em cima de uma caixa no mapa fica em cima dela (não entra)', () => {
  const sim = game([[SWORD, 6, 5], [CHEST, 7, 5]]);
  for (const obj of groundAt(sim, 7, 5)) obj.hasVolume = true;
  const sword = groundAt(sim, 6, 5)[0];
  const box = groundAt(sim, 7, 5).find(o => o !== sword);
  send(sim, { type: 'moveItem', itemId: sword.id, x: 7, y: 5, z: 0 });
  assert.deepEqual([sword.x, sword.y], [7, 5]);
  assert.equal(groundAt(sim, 7, 5).length, 2);
  assert.ok(sim.inventory.groundItem(box).items.every(i => i === null));
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
  const heavy = { uid: 'h', type: CHEST, items: new Array(50).fill(null).map((_, i) => ({ uid: `s${i}`, type: AXE })) };
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

test('caixa no chão: de longe, o player anda até o lado e abre; fecha quando ele se afasta', () => {
  const sim = game([[CHEST, 9, 5]]);
  const chest = groundAt(sim, 9, 5)[0];

  send(sim, { type: 'openContainer', itemId: chest.id });
  assert.equal(sim.inventory.viewFor(sim.player).opened.length, 0);
  run(sim, 3000);
  assert.deepEqual([sim.player.x, sim.player.y], [8, 5]);
  const opened = sim.inventory.viewFor(sim.player).opened;
  assert.equal(opened.length, 1);
  assert.equal(opened[0].item.items.length, 6);

  send(sim, { type: 'walkTo', x: 3, y: 5, z: 0 });
  run(sim, 4000);
  assert.equal(sim.inventory.viewFor(sim.player).opened.length, 0);
});

test('cadáver é container com o loot; abre com o player em cima dele', () => {
  const mapData = buildMapData({ objects: floorRect(0, 29, 0, 29), enemies: [[12, 12, 0]], spawn: { x: 5, y: 5, z: 0 } });
  const sim = new Simulation(mapData, { lootTable: { 'criaturas/mamiferos/teste': [{ tipo: COIN, chance: 1, min: 5, max: 5 }, { tipo: SWORD, chance: 1 }] } });
  sim.time = 1000;
  const player = sim.addPlayer('player1', { name: 'Ana' });
  player.equip.mochila = { uid: 'bag0', type: BAG, items: new Array(4).fill(null) };
  const enemy = sim.enemies[0];
  enemy.currentHp = 0;
  sim.tick(sim.time + TICK_MS);
  const corpse = sim.deadBodies.find(c => c.type === 'enemy_corpse');
  assert.deepEqual(corpse.itemData.items.slice(0, 2).map(i => i && [i.type, i.count || 1]), [[COIN, 5], [SWORD, 1]]);

  sim.enqueue('player1', { type: 'walkTo', x: 12, y: 12, z: 0 });
  run(sim, 5000);
  sim.enqueue('player1', { type: 'openContainer', itemId: corpse.id });
  sim.tick(sim.time + TICK_MS);
  assert.deepEqual([player.x, player.y], [12, 12]);
  const opened = sim.inventory.viewFor(player).opened;
  assert.equal(opened.length, 1);
  assert.equal(opened[0].corpse, true);

  const bag = player.equip.mochila;
  sim.enqueue('player1', { type: 'moveInv', from: { t: 'c', uid: corpse.itemData.uid, i: 1 }, to: { t: 'c', uid: bag.uid, i: 0 } });
  sim.tick(sim.time + TICK_MS);
  assert.equal(bag.items[0].type, SWORD);
  assert.equal(corpse.itemData.items[1], null);
});

test('personagem volta com os itens e o layout', () => {
  const mapData = buildMapData({ objects: floorRect(0, 29, 0, 29), spawn: { x: 5, y: 5, z: 0 } });
  const sim = new Simulation(mapData);
  const player = sim.addPlayer('p1', { name: 'Ana' });
  player.equip.mochila = { uid: 'bag0', type: BAG, items: new Array(4).fill(null) };
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
  assert.deepEqual(player.skills.sword, { lvl: 10, pct: 0, tries: 0 });
  assert.deepEqual(player.skills.magic, { lvl: 0, pct: 0, tries: 0 });
  player.skills.sword = { lvl: 11, pct: 50, tries: 50 };
  const saved = JSON.parse(JSON.stringify(player.toSave()));
  const again = new Simulation(mapData).addPlayer('p2', { name: 'Ana', saved });
  assert.deepEqual(again.skills.sword, { lvl: 11, pct: 50, tries: 50 });
  assert.equal(again.skills.fishing.lvl, 10);
});

test('arma, escudo e armadura entram na fórmula do Tibia; só o ml soma no skill', () => {
  const sim = game();
  const player = sim.player;
  const fist = sim.combat.maxDamage(player);
  assert.equal(fist, Math.round(Math.floor(player.lvl / 5) + ((10 / 4 + 1) * (7 / 3) * 1.03) / 1.2));
  player.equip.arma = { uid: 's1', type: SWORD };
  player.equip.escudo = { uid: 's2', type: SHIELD };
  player.equip.mochila.items[0] = { uid: 's3', type: SWORD };
  assert.equal(sim.combat.maxDamage(player), Math.round(Math.floor(player.lvl / 5) + ((10 / 4 + 1) * (12 / 3) * 1.03) / 1.2));
  assert.equal(sim.combat.defenseOf(player, 100000), Math.floor((10 / 4 + 2.23) * 8 * 0.15));
  assert.equal(sim.combat.defenseOf(player, 0), Math.floor((10 / 4 + 2.23) * 8 * 0.15 * 0.75), 'logo depois de atacar a defesa cai');
  const stats = sim.inventory.viewFor(player).stats;
  assert.equal(stats.skills.sword.bonus, 0);
  assert.equal(stats.skills.magic.bonus, 1);
  for (let i = 0; i < 200; i++) {
    const hit = sim.combat.calculateDamage(player, { atk: 0, def: 0, isPlayer: false }, 0);
    assert.ok(hit >= 0 && hit <= sim.combat.maxDamage(player));
  }
  assert.equal(stats.maxMana, player.maxMana);
});

test('skill sobe com o uso: golpe com machado treina axe, ataque recebido com escudo treina shielding', () => {
  const sim = game();
  const player = sim.player;
  player.equip.arma = { uid: 'a1', type: AXE };
  player.equip.escudo = { uid: 'e1', type: SHIELD };
  const enemy = { isPlayer: false, atk: 1, def: 0, currentHp: 1e9, lastAttackTime: -1e9, isAlive: () => true, takeDamage(n) { this.currentHp -= n; return this.currentHp; } };
  let now = 10000;
  for (let i = 0; i < 100; i++) {
    player.lastAttackTime = -1e9;
    sim.combat.attackTarget(player, enemy, now);
    enemy.lastAttackTime = -1e9;
    sim.combat.attackTarget(enemy, player, now);
    player.currentHp = player.hp;
    now += 10;
  }
  assert.equal(player.skills.axe.lvl, 11);
  assert.equal(player.skills.shielding.lvl, 11);
  assert.equal(player.skills.sword.lvl, 10);
  assert.ok(sim.drainEvents().some(e => e.type === 'message' && e.text === 'Você avançou em Axe (11).'));
});

test('bota com speed soma na velocidade do player enquanto está nos pés', () => {
  const sim = game();
  const player = sim.player;
  player.spd = 60;
  const base = player.spd;
  const baseDelay = player.getStepInterval();
  player.equip.pes = { uid: 'b1', type: BOOTS };
  assert.equal(player.spd, base + 20);
  assert.ok(player.getStepInterval() < baseDelay);
  player.equip.pes = null;
  player.equip.mochila.items[0] = { uid: 'b1', type: BOOTS };
  assert.equal(player.spd, base);
});

test('equipamento e container não empilham, mesmo marcados como empilháveis no gerador', async () => {
  const { itemInfo } = await import('../shared/items.js');
  setAssets([
    asset('itens/escudos/marcado', { move: true, empilhavel: true, def: 5 }),
    asset('itens/recipientes/marcada', { move: true, empilhavel: true, espacos: 8 }),
    asset(COIN, { move: true, peso: 0.1, empilhavel: true })
  ]);
  assert.equal(itemInfo('itens/escudos/marcado').stack, 0);
  assert.equal(itemInfo('itens/recipientes/marcada').stack, 0);
  assert.equal(itemInfo(COIN).stack, 100);
});

test('personagem novo nasce com a bag simples e a tocha na mão; quem volta fica com o que tinha', async () => {
  const { STARTER_BAG, STARTER_TORCH } = await import('../shared/items.js');
  setAssets([asset(STARTER_BAG, { move: true, peso: 8, espacos: 8 }), asset(STARTER_TORCH, { move: true, peso: 5, luz: 6 }), asset(SWORD, { move: true, peso: 30 })]);
  const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 2, y: 2, z: 0 } });
  const fresh = game.addPlayer('novo', { name: 'Novo' });
  assert.equal(fresh.equip.mochila.type, STARTER_BAG);
  assert.equal(fresh.equip.mochila.items.length, 8);
  assert.equal(fresh.equip.escudo.type, STARTER_TORCH);
  const back = game.addPlayer('volta', { name: 'Volta', saved: { equip: { arma: { type: SWORD } } } });
  assert.equal(back.equip.mochila, null);
  assert.equal(back.equip.arma.type, SWORD);
});

test('ring of healing: no espaço do anel recupera 6 de vida e 24 de mana a cada 6 s e dura 7,5 min; fora dele, nada', () => {
  const RING = 'itens/aneis/ring-of-healing';
  setAssets([asset(RING, { move: true, peso: 0.8, duracao: 450, regenVida: 6, regenMana: 24 })]);
  const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 2, y: 2, z: 0 } });
  const player = game.player;
  player.currentHp = 10;
  player.mana = 0;
  player.food = 0;
  player.equip.anel = { uid: 'r1', type: RING };
  const run = (ms) => { const end = game.time + ms; while (game.time < end) game.tick(game.time + TICK_MS); };
  run(6000 + TICK_MS);
  assert.equal(player.currentHp, 16);
  assert.equal(player.mana, 24);
  run(450000);
  assert.equal(player.equip.anel, null, 'acabou');
  player.equip.municao = { uid: 'r2', type: RING };
  const hp = player.currentHp;
  run(12000);
  assert.equal(player.currentHp, hp, 'no espaço de munição não regenera');
  assert.equal(player.equip.municao.fuel, undefined, 'nem gasta');
});
