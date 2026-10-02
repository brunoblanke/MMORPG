// tests/trade.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setAssets } from '../shared/assets.js';
import { GREET_WORDS, BYE_WORDS } from '../shared/npcs.js';
import { buildMapData, floorRect } from './helpers/fixture.js';
import { Simulation, TICK_MS } from '../js/simulation.js';
import { REPLY_DELAY_MS } from '../js/systems/npcs.js';
import { moneyOf } from '../js/systems/trade.js';

const BAG = 'itens/recipientes/bag';
const ROPE = 'itens/ferramentas/rope';
const GOLD = 'itens/valiosos/gold-coin';
const PLATINUM = 'itens/valiosos/platinum-coin';

const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, rotulo: `${grupo} › ${pasta}`, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

// ================================================================================================================================================================================================================================================
// game
// Vendedor colado no player, que vende corda por 50 (e compra o que estiver em buys).

function game(coins, buys = []) {
  setAssets([
    asset(BAG, { move: true, peso: 8, espacos: 8 }), asset(ROPE, { move: true, peso: 18 }),
    asset(GOLD, { move: true, peso: 0.1, empilhavel: true }), asset(PLATINUM, { move: true, peso: 0.1, empilhavel: true })
  ]);
  const seller = {
    id: 'vendedor', name: 'Vendedor', gender: 'male', pos: { x: 10, y: 9, z: 0 }, radius: 0, welcome: '',
    greet: { words: GREET_WORDS, reply: 'Olá!' }, bye: { words: BYE_WORDS, reply: 'Até mais.' }, topics: [],
    shop: [{ type: ROPE, price: 50, name: 'Rope', words: ['corda', 'rope'] }],
    buys
  };
  const sim = new Simulation(buildMapData({ objects: floorRect(0, 20, 0, 20, 0), spawn: { x: 10, y: 10, z: 0 } }), { npcs: [seller] });
  sim.time = 1000;
  sim.player = sim.addPlayer('player1', { name: 'Ana' });
  sim.player.equip.mochila = { uid: 'b', type: BAG, items: [...coins, ...new Array(8 - coins.length).fill(null)] };
  return sim;
}

function say(sim, text) {
  sim.enqueue('player1', { type: 'say', text });
  const events = [];
  const end = sim.time + REPLY_DELAY_MS + 3 * TICK_MS;
  while (sim.time < end) {
    sim.tick(sim.time + TICK_MS);
    events.push(...sim.drainEvents());
  }
  return events.filter(e => e.type === 'speech' && e.npc).map(e => e.text);
}

test('vendedor: lista, confirma o preço e vende; paga com platinum e devolve o troco', () => {
  const sim = game([{ uid: 'c1', type: PLATINUM, count: 1 }, { uid: 'c2', type: GOLD, count: 20 }]);
  say(sim, 'oi');
  assert.match(say(sim, 'oferta').join(), /Rope \(50 moedas\)/);
  assert.match(say(sim, 'corda').join(), /Rope por 50/);
  assert.deepEqual(say(sim, 'sim'), ['Aqui está. Obrigado!']);
  const bag = sim.player.equip.mochila.items;
  assert.ok(bag.some(item => item && item.type === ROPE));
  assert.equal(moneyOf(sim.player), 70);
  assert.ok(!bag.some(item => item && item.type === PLATINUM));
});

test('vendedor: sem dinheiro não vende; não desiste', () => {
  const sim = game([{ uid: 'c2', type: GOLD, count: 20 }]);
  say(sim, 'oi');
  say(sim, 'rope');
  assert.deepEqual(say(sim, 'sim'), ['Você não tem dinheiro suficiente.']);
  say(sim, 'corda');
  assert.deepEqual(say(sim, 'não'), ['Tudo bem.']);
  assert.equal(moneyOf(sim.player), 20);
  assert.ok(!sim.player.equip.mochila.items.some(item => item && item.type === ROPE));
});

test('falas do gerador substituem as padrão; vazias ficam com a padrão', async () => {
  const { npcDefFromAsset, SHOP_LINES, fillLine } = await import('../shared/npcs.js');
  setAssets([
    asset(ROPE, { move: true, peso: 18 }),
    { ...asset('criaturas/humanos/lojista', { comportamento: 'npc', conversa: { vende: [{ tipo: ROPE, preco: 50 }], falasVenda: { vendido: 'Boa compra, {nome}!' } } }), ferramenta: 'criaturas' }
  ]);
  const def = npcDefFromAsset('criaturas/humanos/lojista', { x: 1, y: 1, z: 0 });
  assert.equal(def.shopLines.vendido, 'Boa compra, {nome}!');
  assert.equal(def.shopLines.semDinheiro, SHOP_LINES.semDinheiro.text);
  assert.equal(fillLine(def.shopLines.confirmar, { item: 'Rope', preco: 50 }), 'Quer comprar Rope por 50 moedas de ouro? (sim / não)');
});

test('NPC que compra: vender com quantidade pede a confirmação; sim tira da mochila e paga em moedas, juntando nas pilhas', () => {
  const sim = game([{ uid: 'c2', type: GOLD, count: 20 }, { uid: 'r1', type: ROPE }, { uid: 'r2', type: ROPE }, { uid: 'r3', type: ROPE }], [{ type: ROPE, price: 40, name: 'Rope', words: ['corda', 'rope'] }]);
  say(sim, 'oi');
  assert.match(say(sim, 'trade').join(), /Eu compro: Rope \(40 moedas\)/);
  assert.match(say(sim, 'vender').join(), /O que você quer me vender\? Eu compro: Rope/);
  assert.match(say(sim, '2 corda').join(), /vender 2 Rope por 80/);
  assert.deepEqual(say(sim, 'sim'), ['Negócio fechado!']);
  const bag = sim.player.equip.mochila.items;
  assert.equal(bag.filter(item => item && item.type === ROPE).length, 1);
  assert.equal(moneyOf(sim.player), 100);
  assert.equal(bag.filter(item => item && item.type === GOLD).length, 1);
});

test('NPC que compra: sem o item na mochila não paga nada; mais de 100 de ouro vira platinum', () => {
  const sim = game([{ uid: 'r1', type: ROPE }], [{ type: ROPE, price: 150, name: 'Rope', words: ['rope'] }]);
  say(sim, 'oi');
  say(sim, 'sell');
  say(sim, '3 rope');
  assert.deepEqual(say(sim, 'sim'), ['Você não tem 3 Rope.']);
  assert.equal(moneyOf(sim.player), 0);
  say(sim, 'sell rope');
  say(sim, 'sim');
  const bag = sim.player.equip.mochila.items;
  assert.ok(bag.some(item => item && item.type === PLATINUM && item.count === 1));
  assert.ok(bag.some(item => item && item.type === GOLD && item.count === 50));
  assert.ok(!bag.some(item => item && item.type === ROPE));
});
