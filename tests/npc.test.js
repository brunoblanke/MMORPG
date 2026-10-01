// tests/npc.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMapData, floorRect } from './helpers/fixture.js';
import { Simulation, TICK_MS } from '../js/simulation.js';
import { NPC_DEFS } from '../shared/npcs.js';
import { WELCOME_COOLDOWN_MS, REPLY_DELAY_MS, SPEECH_MAX_LENGTH } from '../js/systems/npcs.js';

// ================================================================================================================================================================================================================================================
// game
// Mapa com o guia (2 sqm a oeste e 1 ao norte do spawn) e o player longe dele.

function game() {
  const defs = NPC_DEFS.map(def => ({ ...def, at: { dx: -2, dy: -1 } }));
  const sim = new Simulation(buildMapData({ objects: floorRect(0, 30, 0, 30, 0), spawn: { x: 10, y: 10, z: 0 } }), { npcs: defs });
  sim.time = 1000;
  sim.player = sim.addPlayer('player1', { name: 'Ana' });
  sim.world.moveEntityTile(sim.player, sim.player.x, sim.player.y, 0, 25, 25, 0);
  Object.assign(sim.player, { x: 25, y: 25, renderX: 25, renderY: 25 });
  return sim;
}

function run(sim, ms) {
  const events = [];
  const end = sim.time + ms;
  while (sim.time < end) {
    sim.tick(sim.time + TICK_MS);
    events.push(...sim.drainEvents());
  }
  return events;
}

function moveTo(sim, x, y) {
  sim.world.moveEntityTile(sim.player, sim.player.x, sim.player.y, 0, x, y, 0);
  Object.assign(sim.player, { x, y, renderX: x, renderY: y });
}

function say(sim, text) {
  sim.enqueue('player1', { type: 'say', text });
  return run(sim, REPLY_DELAY_MS + 3 * TICK_MS).filter(e => e.type === 'speech');
}

const npcLines = (events) => events.filter(e => e.npc).map(e => e.text);

test('o guia fica no mapa, bloqueia o sqm e não entra no battle nem vira alvo', () => {
  const sim = game();
  const guide = sim.npcs[0];
  assert.deepEqual([guide.x, guide.y, guide.z], [8, 9, 0]);
  assert.equal(sim.world.isBlocked(8, 9, 0), true);
  sim.enqueue('player1', { type: 'attack', targetId: guide.id });
  run(sim, 2 * TICK_MS);
  assert.equal(sim.player.target, null);
});

test('chegando perto, o guia dá boas-vindas uma vez (de novo só depois do intervalo)', () => {
  const sim = game();
  assert.deepEqual(npcLines(run(sim, 1000)), []);
  moveTo(sim, 9, 10);
  assert.deepEqual(npcLines(run(sim, 1000)), ['Bem-vindo, aventureiro!']);
  moveTo(sim, 25, 25);
  run(sim, 500);
  moveTo(sim, 9, 10);
  assert.deepEqual(npcLines(run(sim, 1000)), []);
  moveTo(sim, 25, 25);
  run(sim, WELCOME_COOLDOWN_MS);
  moveTo(sim, 9, 10);
  assert.deepEqual(npcLines(run(sim, 1000)), ['Bem-vindo, aventureiro!']);
});

test('fala do player aparece em cima dele, no sqm onde estava; texto limitado e limpo', () => {
  const sim = game();
  const events = say(sim, `  muito   ${'a'.repeat(200)}  `);
  const mine = events.find(e => !e.npc);
  assert.equal(mine.name, 'Ana');
  assert.deepEqual([mine.x, mine.y, mine.z], [25, 25, 0]);
  assert.equal(mine.text.length, SPEECH_MAX_LENGTH);
  assert.ok(mine.text.startsWith('muito a'));
  assert.deepEqual(say(sim, '   '), []);
});

test('conversa: palavra antes do oi é ignorada; oi responde; tópicos e tchau', () => {
  const sim = game();
  moveTo(sim, 9, 10);
  run(sim, 1000);
  assert.deepEqual(npcLines(say(sim, 'combate')), []);
  assert.match(npcLines(say(sim, 'Olá!'))[0], /^Olá, Ana! Posso falar sobre/);
  assert.match(npcLines(say(sim, 'como é o COMBATE?'))[0], /Clique numa criatura pra atacar/);
  assert.match(npcLines(say(sim, 'e as poções'))[0], /Clique na poção/);
  assert.deepEqual(npcLines(say(sim, 'xyz')), []);
  assert.deepEqual(npcLines(say(sim, 'tchau')), ['Até mais, Ana. Boa aventura!']);
  assert.deepEqual(npcLines(say(sim, 'comida')), []);
});

test('longe o guia não ouve; quem se afasta sai da conversa', () => {
  const sim = game();
  assert.deepEqual(npcLines(say(sim, 'oi')), []);
  moveTo(sim, 9, 10);
  run(sim, 1000);
  say(sim, 'oi');
  moveTo(sim, 25, 25);
  run(sim, 500);
  moveTo(sim, 9, 10);
  assert.deepEqual(npcLines(say(sim, 'comida')), []);
});

test('o NPC vai pro navegador pelo estado e aparece no espelho', async () => {
  const { serializeState, applyState } = await import('../js/net/protocol.js');
  const { World } = await import('../js/core/world.js');
  const sim = game();
  const state = serializeState(sim, 'player1');
  assert.deepEqual(state.npcs.map(n => [n.id, n.name, n.x, n.y]), [['npc-guia', 'Guia', 8, 9]]);
  const mirror = { world: new World(), objectsById: new Map(), objects: [], players: [], enemies: [], deadBodies: [] };
  applyState(mirror, { time: sim.time, state }, 'player1', 0);
  assert.equal(mirror.npcs[0].isNpc, true);
  assert.equal(mirror.npcs[0].name, 'Guia');
});
