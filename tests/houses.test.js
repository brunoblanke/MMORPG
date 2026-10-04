// tests/houses.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMapData, floorRect, placeAt } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { Simulation, TICK_MS } from '../js/simulation.js';
import { moneyOf } from '../js/systems/trade.js';

const BAG = 'itens/recipientes/bag';
const GOLD = 'itens/valiosos/gold-coin';
const ROPE = 'itens/ferramentas/rope';
const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([asset(BAG, { move: true, peso: 8, espacos: 4 }), asset(GOLD, { move: true, peso: 0.1, empilhavel: true }), asset(ROPE, { move: true, peso: 18 })]);

// ================================================================================================================================================================================================================================================
// game
// A Casa Azul (10..12, 10..12) por 100; Ana dentro dela com 150 moedas e Bia
// do lado de fora.

function game(houses = {}) {
  const map = buildMapData({ objects: floorRect(0, 29, 0, 29, 0), spawn: { x: 5, y: 5, z: 0 } });
  map.houseData = [];
  for (let y = 10; y <= 12; y++) for (let x = 10; x <= 12; x++) map.houseData.push([x, y, 0, 'Casa Azul', 100]);
  const sim = new Simulation(map, { houses });
  sim.time = 1000;
  const ana = sim.addPlayer('player1', { name: 'Ana' });
  const bia = sim.addPlayer('player2', { name: 'Bia' });
  placeAt(sim, ana, 11, 11, 0);
  placeAt(sim, bia, 13, 11, 0);
  ana.equip.mochila = { uid: 'bag', type: BAG, items: [{ uid: 'g', type: GOLD, count: 100 }, { uid: 'g2', type: GOLD, count: 50 }, null, null] };
  return { sim, ana, bia };
}

function say(sim, id, text) {
  sim.enqueue(id, { type: 'say', text });
  sim.tick(sim.time + TICK_MS);
  return sim.drainEvents().filter(e => e.type === 'message' && e.playerId === sim.getPlayer(id).id).map(e => e.text);
}

test('casa: entrar mostra o preço; !comprarcasa paga e ela vira do player; outro não entra até ser convidado', () => {
  const { sim, ana, bia } = game();
  assert.ok(sim.world.isSafe(11, 11, 0));
  assert.match(say(sim, 'player1', '!casa').join(), /à venda por 100/);
  assert.match(say(sim, 'player1', '!comprarcasa').join(), /agora é sua/);
  assert.equal(moneyOf(ana), 50);
  assert.equal(sim.world.houseAt(11, 11, 0).owner, 'Ana');
  assert.equal(sim.movement.resolveStep(bia, -1, 0), null);
  assert.equal(sim.movement.findPath(bia, { x: 11, y: 11, z: 0 }).length, 0);
  say(sim, 'player1', '!convidar bia');
  assert.ok(sim.movement.resolveStep(bia, -1, 0));
  placeAt(sim, bia, 12, 12, 0);
  say(sim, 'player1', '!tirar Bia');
  assert.equal(sim.world.houseAt(bia.x, bia.y, 0), null);
  assert.match(say(sim, 'player2', '!comprarcasa').join(), /Entre na casa/);
});

test('casa: os itens do chão dela e o dono ficam guardados e voltam com o servidor novo', () => {
  const { sim, ana } = game();
  say(sim, 'player1', '!comprarcasa');
  sim.inventory.spawnGroundItem({ uid: 'r', type: ROPE }, 10, 10, 0);
  sim.inventory.spawnGroundItem({ uid: 'r2', type: ROPE }, 20, 20, 0);
  const saved = JSON.parse(JSON.stringify(sim.houses.toSave()));
  assert.equal(saved['Casa Azul'].owner, 'Ana');
  assert.equal(saved['Casa Azul'].items.length, 1);

  const again = game(saved);
  assert.equal(again.sim.world.houseAt(10, 10, 0).owner, 'Ana');
  assert.ok(again.sim.objects.some(o => o.itemData && o.itemData.type === ROPE && o.x === 10 && o.y === 10));
  assert.match(say(again.sim, 'player1', '!deixarcasa').join(), /deixou/);
  assert.equal(again.sim.world.houseAt(10, 10, 0).owner, null);
  assert.ok(ana);
});

test('casa: quem já tem uma não compra outra, e sem dinheiro não compra', () => {
  const { sim, ana } = game();
  ana.equip.mochila.items[0] = null;
  assert.match(say(sim, 'player1', '!comprarcasa').join(), /100 moedas/);
  assert.equal(sim.world.houseAt(11, 11, 0).owner, null);
});

test('casa: quem não pode entrar também não joga nem pega item lá dentro', () => {
  const { sim, bia } = game();
  say(sim, 'player1', '!comprarcasa');
  bia.equip.mochila = { uid: 'bag2', type: BAG, items: [{ uid: 'r', type: ROPE }, null, null, null] };
  sim.enqueue('player2', { type: 'moveInv', from: { t: 'c', uid: 'bag2', i: 0 }, to: { t: 'w', x: 12, y: 11, z: 0 }, amount: 1 });
  sim.tick(sim.time + TICK_MS);
  assert.equal(bia.equip.mochila.items[0].type, ROPE);
  const inside = sim.inventory.spawnGroundItem({ uid: 'r3', type: ROPE }, 12, 11, 0);
  sim.enqueue('player2', { type: 'moveInv', from: { t: 'g', id: inside.id }, to: { t: 'c', uid: 'bag2', i: 1 }, amount: 1 });
  sim.tick(sim.time + TICK_MS);
  assert.ok(sim.objects.includes(inside));
});
