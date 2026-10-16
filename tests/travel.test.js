// tests/travel.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMapData, floorRect } from './helpers/fixture.js';
import { Simulation, TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';
import { GREET_WORDS, BYE_WORDS, TRAVEL_LINES } from '../shared/npcs.js';
import { REPLY_DELAY_MS } from '../js/systems/npcs.js';
import { moneyOf } from '../js/systems/trade.js';

const BAG = 'itens/recipientes/backpack-azul';
const GOLD = 'itens/valiosos/gold-coin';
const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([asset(BAG, { move: true, peso: 18, espacos: 20 }), asset(GOLD, { move: true, empilhavel: true })]);

const CAPTAIN = {
  id: 'capitao',
  name: 'Capitão',
  gender: 'male',
  at: { dx: 1, dy: 0 },
  radius: 0,
  greet: { words: GREET_WORDS, reply: 'Olá, {nome}!' },
  bye: { words: BYE_WORDS, reply: 'Até mais.' },
  topics: [],
  travel: [
    { name: 'Ilha', words: ['ilha', 'barco'], dest: { x: 25, y: 25, z: 0 }, price: 30, level: 0 },
    { name: 'Torre', words: ['torre'], dest: { x: 20, y: 5, z: 0 }, price: 10, level: 200 }
  ],
  travelLines: Object.fromEntries(Object.entries(TRAVEL_LINES).map(([key, line]) => [key, line.text]))
};

function game(gold = 50) {
  const sim = new Simulation(buildMapData({ objects: floorRect(0, 30, 0, 30, 0), spawn: { x: 10, y: 10, z: 0 } }), { npcs: [CAPTAIN] });
  sim.time = 1000;
  const ana = sim.addPlayer('p1', { name: 'Ana' });
  ana.equip.mochila = { uid: 'b1', type: BAG, items: [{ uid: 'g1', type: GOLD, count: gold }, ...new Array(19).fill(null)] };
  return { sim, ana };
}

function say(sim, text) {
  sim.enqueue('p1', { type: 'say', text });
  const events = [];
  const end = sim.time + REPLY_DELAY_MS * 4 + 3 * TICK_MS;
  while (sim.time < end) {
    sim.tick(sim.time + TICK_MS);
    events.push(...sim.drainEvents());
  }
  return events.filter(e => e.npc).map(e => e.text).pop();
}

test('viagem: o NPC lista os destinos, pede a confirmação, cobra e leva o player', () => {
  const { sim, ana } = game();
  say(sim, 'oi');
  assert.match(say(sim, 'viagem'), /Ilha \(30 moedas\), Torre \(10 moedas\)/);
  assert.match(say(sim, 'ilha'), /Quer ir para Ilha por 30/);
  assert.equal(moneyOf(ana), 50);
  say(sim, 'sim');
  assert.equal(moneyOf(ana), 20);
  assert.ok(Math.abs(ana.x - 25) <= 1 && Math.abs(ana.y - 25) <= 1);
});

test('viagem: sem dinheiro não vai, sem o nível o NPC recusa e não desiste leva ninguém', () => {
  const { sim, ana } = game(5);
  say(sim, 'oi');
  say(sim, 'ilha');
  assert.match(say(sim, 'sim'), /não tem 30 moedas/);
  assert.ok(ana.x < 20);
  assert.match(say(sim, 'torre'), /nível 200/);
  say(sim, 'ilha');
  assert.match(say(sim, 'não'), /Tudo bem/);
  assert.ok(ana.x < 20);
});
