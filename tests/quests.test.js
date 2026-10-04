// tests/quests.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setAssets } from '../shared/assets.js';
import { buildMapData, floorRect, CREATURE } from './helpers/fixture.js';
import { Simulation, TICK_MS } from '../js/simulation.js';
import { REPLY_DELAY_MS } from '../js/systems/npcs.js';
import { moneyOf } from '../js/systems/trade.js';

const NPC = 'personagens/npcs/fazendeiro';
const BAG = 'itens/recipientes/bag';
const CHEESE = 'itens/comidas/cheese';
const ROPE = 'itens/ferramentas/rope';
const GOLD = 'itens/valiosos/gold-coin';
const asset = (id, propriedades, ferramenta = 'objetos') => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta, grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

const MISSIONS = [
  { nome: 'Queijos', palavras: 'queijo, queijos', tipo: 'item', alvo: CHEESE, quantidade: 3, pedido: 'Me traz 3 queijos? (sim / não)', recompensa: { tipo: ROPE, count: 1 }, xp: 50, moedas: 20 },
  { nome: 'Ratos', palavras: 'ratos, praga', tipo: 'matar', alvo: CREATURE, quantidade: 2, xp: 100 }
];

// ================================================================================================================================================================================================================================================
// game
// O fazendeiro (NPC do gerador, com as missões) colado no player.

function game() {
  setAssets([
    asset(NPC, { comportamento: 'npc', conversa: { oi: 'Olá!', raio: 0, missoes: MISSIONS } }, 'criaturas'),
    asset(CREATURE, { vida: 10, xp: 5 }, 'criaturas'),
    asset(BAG, { move: true, peso: 8, espacos: 8 }), asset(CHEESE, { move: true, peso: 1, empilhavel: true }),
    asset(ROPE, { move: true, peso: 18 }), asset(GOLD, { move: true, peso: 0.1, empilhavel: true })
  ]);
  const map = buildMapData({ objects: floorRect(0, 20, 0, 20, 0), enemies: [[15, 15, 0], [16, 16, 0]], spawn: { x: 10, y: 10, z: 0 } });
  map.npcData = [[NPC, 10, 9, 0]];
  const sim = new Simulation(map);
  sim.time = 1000;
  sim.player = sim.addPlayer('player1', { name: 'Ana' });
  sim.player.equip.mochila = { uid: 'b', type: BAG, items: new Array(8).fill(null) };
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

test('missão de trazer item: aceita, diz quanto falta e, com os itens, entrega e ganha a recompensa', () => {
  const sim = game();
  const player = sim.player;
  say(sim, 'oi');
  assert.deepEqual(say(sim, 'queijo'), ['Me traz 3 queijos? (sim / não)']);
  say(sim, 'sim');
  assert.equal(player.missions['fazendeiro/queijos'].state, 'active');
  player.equip.mochila.items[0] = { uid: 'q', type: CHEESE, count: 2 };
  assert.match(say(sim, 'queijos').join(), /2\/3/);
  player.equip.mochila.items[0].count = 4;
  const xp = player.xp + player.lvl * 1e6;
  assert.match(say(sim, 'queijos').join(), /Muito obrigado/);
  assert.equal(player.equip.mochila.items[0].count, 1);
  assert.ok(player.equip.mochila.items.some(item => item && item.type === ROPE));
  assert.equal(moneyOf(player), 20);
  assert.ok(player.xp + player.lvl * 1e6 > xp);
  assert.match(say(sim, 'queijos').join(), /já me ajudou/);
});

test('missão de matar: conta as criaturas que o player matou e fica guardada com o personagem', () => {
  const sim = game();
  const player = sim.player;
  say(sim, 'oi');
  say(sim, 'praga');
  say(sim, 'sim');
  const [first] = sim.enemies;
  first.damageBy = new Map([[player.id, 10]]);
  first.currentHp = 0;
  sim.tick(sim.time + TICK_MS);
  assert.equal(player.missions['fazendeiro/ratos'].count, 1);
  assert.match(say(sim, 'ratos').join(), /1\/2/);

  const saved = JSON.parse(JSON.stringify(player.toSave()));
  const back = sim.addPlayer('volta', { name: 'Volta', saved });
  assert.deepEqual(back.missions['fazendeiro/ratos'], player.missions['fazendeiro/ratos']);
});

test('não quer a missão: nada começa', () => {
  const sim = game();
  say(sim, 'oi');
  say(sim, 'queijo');
  assert.match(say(sim, 'não').join(), /outra hora/);
  assert.equal(sim.player.missions['fazendeiro/queijos'], undefined);
});
