// tests/npc.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMapData, floorRect } from './helpers/fixture.js';
import { Simulation, TICK_MS } from '../js/simulation.js';
import { GREET_WORDS, BYE_WORDS } from '../shared/npcs.js';
import { WELCOME_COOLDOWN_MS, REPLY_DELAY_MS, SPEECH_MAX_LENGTH } from '../js/systems/npcs.js';

// ================================================================================================================================================================================================================================================
// game
// Mapa com o guia (2 sqm a oeste e 1 ao norte do spawn) e o player longe dele.

const GUIDE = {
  id: 'guia',
  name: 'Guia',
  gender: 'male',
  at: { dx: -2, dy: -1 },
  radius: 2,
  welcome: 'Bem-vindo, aventureiro!',
  greet: { words: GREET_WORDS, reply: 'Olá, {nome}! Posso falar sobre combate e poções.' },
  bye: { words: BYE_WORDS, reply: 'Até mais, {nome}. Boa aventura!' },
  topics: [
    { words: ['combate', 'atacar'], reply: 'Clique numa criatura pra atacar.' },
    { words: ['pocoes', 'pocao'], reply: 'Clique na poção e depois em você.' },
    { words: ['comida'], reply: 'Comer recupera vida.' }
  ]
};

function game() {
  const defs = [GUIDE];
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

test('fora de conversa o guia passeia em volta do lugar dele; conversando, fica parado', () => {
  const sim = game();
  const guide = sim.npcs[0];
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    run(sim, 1000);
    seen.add(`${guide.x},${guide.y}`);
    assert.ok(Math.hypot(guide.x - guide.home.x, guide.y - guide.home.y) <= guide.radius);
  }
  assert.ok(seen.size >= 3, `andou por ${seen.size} sqms`);
  moveTo(sim, guide.x + 1, guide.y);
  say(sim, 'oi');
  const at = [guide.x, guide.y];
  run(sim, 10000);
  assert.deepEqual([guide.x, guide.y], at);
});

test('NPC criado no gerador e posto pelo editor: lugar, folha, conversa e não vira inimigo', async () => {
  const { setAssets } = await import('../shared/assets.js');
  const { serializeMapFromLayers, buildLayersFromMapData } = await import('../shared/map-format.js');
  const SMITH = 'criaturas/npcs/ferreiro';
  setAssets([{ id: SMITH, ferramenta: 'criaturas', grupo: 'criaturas', pasta: 'npcs', nome: 'ferreiro', rotulo: 'criaturas › npcs', url: '/f.png', quadro: 32, quadros: 3, pecas: [], propriedades: {
    comportamento: 'npc',
    conversa: { boasVindas: 'Olá, viajante.', oi: 'Oi, {nome}! Pergunte sobre espadas.', tchau: '', raio: 0, topicos: [{ palavras: 'Espadas, ESPADA', resposta: 'Espada usa sword.' }, { palavras: '', resposta: 'vazio' }] }
  } }]);
  const mapData = buildMapData({ objects: floorRect(0, 30, 0, 30, 0), spawn: { x: 10, y: 10, z: 0 } });
  mapData.npcData = [[SMITH, 20, 20, 0]];
  mapData.enemyData = [[22, 22, 0, 1, 32, SMITH]];
  const sim = new Simulation(mapData, { npcs: [] });
  sim.time = 1000;
  assert.equal(sim.enemies.length, 0);
  const smith = sim.npcs[0];
  assert.deepEqual([smith.name, smith.creature, smith.x, smith.y, smith.radius], ['Ferreiro', SMITH, 20, 20, 0]);
  sim.player = sim.addPlayer('player1', { name: 'Bia' });
  moveTo(sim, 21, 20);
  assert.deepEqual(npcLines(run(sim, 1000)), ['Olá, viajante.']);
  assert.deepEqual(npcLines(say(sim, 'oi')), ['Oi, Bia! Pergunte sobre espadas.']);
  assert.deepEqual(npcLines(say(sim, 'e as espadas?')), ['Espada usa sword.']);
  assert.deepEqual(npcLines(say(sim, 'tchau')), ['Até mais, Bia.']);
  const { layers } = buildLayersFromMapData(mapData, 40);
  assert.deepEqual(layers[0]['20,20'].npc, { type: SMITH });
  assert.deepEqual(serializeMapFromLayers([0], layers, 40).npcData, [[SMITH, 20, 20, 0]]);
});

test('conversando o NPC para; volta a passear com o tchau ou quando o player se afasta', () => {
  const sim = game();
  const guide = sim.npcs[0];
  const walksWithin = (ms) => {
    const seen = new Set();
    for (let t = 0; t < ms; t += 500) {
      run(sim, 500);
      seen.add(`${guide.x},${guide.y}`);
    }
    return seen.size > 1;
  };
  moveTo(sim, guide.x + 1, guide.y + 1);
  say(sim, 'oi');
  assert.equal(walksWithin(15000), false);
  say(sim, 'tchau');
  assert.equal(walksWithin(30000), true);
  moveTo(sim, guide.x + 1, guide.y + 1);
  say(sim, 'oi');
  assert.equal(walksWithin(10000), false);
  moveTo(sim, 25, 25);
  assert.deepEqual(npcLines(run(sim, 1000)), ['Até mais, Ana. Boa aventura!']);
  assert.equal(walksWithin(30000), true);
});

test('calado por FOCUS_IDLE_MS (30 s) na conversa, o NPC se despede', async () => {
  const { FOCUS_IDLE_MS } = await import('../js/systems/npcs.js');
  assert.equal(FOCUS_IDLE_MS, 30000);
  const sim = game();
  const guide = sim.npcs[0];
  moveTo(sim, guide.x + 1, guide.y);
  run(sim, 1000);
  say(sim, 'oi');
  assert.deepEqual(npcLines(run(sim, FOCUS_IDLE_MS - 2000)), []);
  assert.deepEqual(npcLines(run(sim, 3000)), ['Até mais, Ana. Boa aventura!']);
});
