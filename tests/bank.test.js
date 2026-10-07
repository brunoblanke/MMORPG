// tests/bank.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMapData, floorRect } from './helpers/fixture.js';
import { Simulation, TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';
import { GREET_WORDS, BYE_WORDS, BANK_LINES } from '../shared/npcs.js';
import { REPLY_DELAY_MS } from '../js/systems/npcs.js';
import { moneyOf } from '../js/systems/trade.js';

const BAG = 'itens/recipientes/backpack-azul';
const GOLD = 'itens/valiosos/gold-coin';
const PLATINUM = 'itens/valiosos/platinum-coin';
const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([asset(BAG, { move: true, peso: 18, espacos: 20 }), asset(GOLD, { move: true, empilhavel: true }), asset(PLATINUM, { move: true, empilhavel: true })]);

const BANKER = {
  id: 'banqueiro',
  name: 'Banqueiro',
  gender: 'male',
  at: { dx: 1, dy: 0 },
  radius: 0,
  greet: { words: GREET_WORDS, reply: 'Olá, {nome}!' },
  bye: { words: BYE_WORDS, reply: 'Até mais.' },
  topics: [],
  bank: true,
  bankLines: Object.fromEntries(Object.entries(BANK_LINES).map(([key, line]) => [key, line.text]))
};

// ================================================================================================================================================================================================================================================
// game
// Ana ao lado do banqueiro com 150 moedas de ouro na mochila; Bia online e Carol guardada (offline).

function game(gold = 150) {
  const sim = new Simulation(buildMapData({ objects: floorRect(0, 30, 0, 30, 0), spawn: { x: 10, y: 10, z: 0 } }), { npcs: [BANKER], characters: { carol: { name: 'Carol', bank: 5 } } });
  sim.time = 1000;
  const ana = sim.addPlayer('p1', { name: 'Ana' });
  const bia = sim.addPlayer('p2', { name: 'Bia' });
  ana.equip.mochila = { uid: 'b1', type: BAG, items: [{ uid: 'g1', type: GOLD, count: gold }, ...new Array(19).fill(null)] };
  return { sim, ana, bia };
}

function say(sim, text) {
  sim.enqueue('p1', { type: 'say', text });
  const events = [];
  const end = sim.time + REPLY_DELAY_MS + 3 * TICK_MS;
  while (sim.time < end) {
    sim.tick(sim.time + TICK_MS);
    events.push(...sim.drainEvents());
  }
  return events.filter(e => e.npc).map(e => e.text).pop();
}

test('banco: saldo, depositar e sacar pedem confirmação e mexem no dinheiro da mochila', () => {
  const { sim, ana } = game();
  say(sim, 'oi');
  assert.match(say(sim, 'saldo'), /saldo é de 0/);
  assert.match(say(sim, 'depositar 100'), /Quer depositar 100/);
  assert.equal(ana.bank || 0, 0);
  assert.match(say(sim, 'sim'), /depositei 100.*saldo agora é de 100/);
  assert.equal(ana.bank, 100);
  assert.equal(moneyOf(ana), 50);
  assert.match(say(sim, 'sacar 30'), /Quer sacar 30/);
  assert.match(say(sim, 'sim'), /30 moedas.*saldo agora é de 70/);
  assert.equal(ana.bank, 70);
  assert.equal(moneyOf(ana), 80);
  say(sim, 'depositar tudo');
  say(sim, 'sim');
  assert.equal(ana.bank, 150);
  assert.equal(moneyOf(ana), 0);
  say(sim, 'sacar tudo');
  say(sim, 'sim');
  assert.equal(ana.bank, 0);
  assert.equal(moneyOf(ana), 150);
});

test('banco: sem a quantia, sem saldo, sem número ou depois de dizer não, nada muda', () => {
  const { sim, ana } = game();
  say(sim, 'oi');
  assert.match(say(sim, 'depositar 1000'), /não tem essa quantia/);
  assert.match(say(sim, 'sacar 10'), /saldo não chega/);
  assert.match(say(sim, 'depositar'), /Diga quanto/);
  say(sim, 'depositar 50');
  assert.match(say(sim, 'não'), /Tudo bem/);
  assert.equal(ana.bank || 0, 0);
  assert.equal(moneyOf(ana), 150);
});

test('banco: transferir pra quem está no jogo e pra quem está guardado; nome que não existe ou o próprio não vale', () => {
  const { sim, ana, bia } = game();
  say(sim, 'oi');
  ana.bank = 100;
  assert.match(say(sim, 'transferir 20 para Bia'), /transferir 20 moedas de ouro para Bia/);
  assert.match(say(sim, 'sim'), /transferi 20 moedas para Bia/);
  assert.equal(ana.bank, 80);
  assert.equal(bia.bank, 20);
  say(sim, 'transferir 10 para carol');
  say(sim, 'sim');
  assert.equal(ana.bank, 70);
  assert.equal(sim.savedCharacters.carol.bank, 15);
  assert.match(say(sim, 'transferir 10 para Zeca'), /Não conheço ninguém com o nome Zeca/);
  assert.match(say(sim, 'transferir 10 para Ana'), /Não conheço/);
  assert.match(say(sim, 'transferir 500 para Bia'), /saldo não chega/);
  assert.equal(ana.bank, 70);
});

test('banco: trocar junta as moedas nas maiores; o saldo fica guardado no personagem', () => {
  const { sim, ana } = game();
  say(sim, 'oi');
  say(sim, 'trocar');
  const types = ana.equip.mochila.items.filter(Boolean).map(item => `${item.type.split('/').pop()}:${item.count}`).sort();
  assert.deepEqual(types, ['gold-coin:50', 'platinum-coin:1']);
  ana.bank = 1234;
  const saved = ana.toSave();
  assert.equal(saved.bank, 1234);
  const again = sim.addPlayer('p3', { name: 'Ana2', saved });
  assert.equal(again.bank, 1234);
});

test('compra: o troco nunca se perde, mesmo com uma pilha só de moedas e a mochila quase cheia', async () => {
  const { buy } = await import('../js/systems/trade.js');
  const { sim, ana } = game(150);
  ana.lvl = 100;
  ana.applyLevelStats();
  setAssets([asset(BAG, { move: true, peso: 18, espacos: 3 }), asset(GOLD, { move: true, empilhavel: true, peso: 0.01 }), asset(PLATINUM, { move: true, empilhavel: true, peso: 0.01 }), asset('itens/ferramentas/rope', { move: true, peso: 1 })]);
  ana.equip.mochila = { uid: 'b2', type: BAG, items: [{ uid: 'g1', type: GOLD, count: 150 }, null, null] };
  assert.equal(buy(sim, ana, 'itens/ferramentas/rope', 10), 'ok');
  assert.equal(moneyOf(ana), 140);
  ana.equip.mochila = { uid: 'b3', type: BAG, items: [{ uid: 'g2', type: GOLD, count: 150 }, { uid: 'x', type: 'itens/ferramentas/rope' }, null] };
  assert.equal(buy(sim, ana, 'itens/ferramentas/rope', 10), 'space');
  assert.equal(moneyOf(ana), 150);
  assert.equal(ana.equip.mochila.items.filter(Boolean).length, 2);
});
