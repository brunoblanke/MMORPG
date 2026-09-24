// tests/simulation.test.js

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildGame, floorRect, pile, hole } from './helpers/fixture.js';
import { Simulation, TICK_MS } from '../js/simulation.js';
import { CONFIG } from '../js/config.js';

const GROUND = floorRect(0, 24, 0, 24, 0);
const originalRandom = Math.random;

beforeEach(() => {
  seedRandom(42);
});

afterEach(() => {
  Math.random = originalRandom;
});

// ================================================================================================================================================================================================================================================
// seedRandom

function seedRandom(seed) {
  Math.random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

// ================================================================================================================================================================================================================================================
// runFor
// Avança a simulação `ms` milissegundos, tick a tick. Devolve os eventos.

function runFor(sim, ms) {
  const events = [];
  const end = sim.time + ms;
  while (sim.time + TICK_MS <= end) {
    sim.tick(sim.time + TICK_MS);
    events.push(...sim.drainEvents());
  }
  return events;
}

test('walkTo leva o player até o sqm, passo a passo', () => {
  const sim = buildGame({ objects: GROUND, player: { x: 2, y: 2, z: 0 } });
  sim.enqueue('player1', { type: 'walkTo', x: 8, y: 2, z: 0 });

  runFor(sim, 700);
  assert.ok(sim.player.x > 2 && sim.player.x < 8, `x=${sim.player.x}`);

  runFor(sim, 3000);
  assert.deepEqual([sim.player.x, sim.player.y], [8, 2]);
  assert.equal(sim.player.walk.path.length, 0);
});

test('walkDir anda enquanto a direção está ligada e para com 0,0', () => {
  const sim = buildGame({ objects: GROUND, player: { x: 2, y: 5, z: 0 } });
  sim.enqueue('player1', { type: 'walkDir', dx: 1, dy: 0 });
  runFor(sim, 1000);
  const moved = sim.player.x;
  assert.ok(moved >= 4, `x=${moved}`);

  sim.enqueue('player1', { type: 'walkDir', dx: 0, dy: 0 });
  runFor(sim, 1000);
  assert.equal(sim.player.x, moved);
});

test('walkTo no próprio sqm, em cima de volume, desce pro vizinho', () => {
  const sim = buildGame({ objects: [...GROUND, ...pile(5, 5, 1)], player: { x: 5, y: 5, z: 0 } });
  sim.player.step = 1;
  sim.enqueue('player1', { type: 'walkTo', x: 5, y: 5, z: 0 });
  runFor(sim, 1000);
  assert.equal(sim.player.step, 0);
  assert.notDeepEqual([sim.player.x, sim.player.y], [5, 5]);
});

test('attack: segue o alvo, mata, ganha XP e o inimigo renasce depois', () => {
  const sim = buildGame({ objects: GROUND, enemies: [[12, 5, 0, 1]], player: { x: 2, y: 5, z: 0 } });
  const enemy = sim.enemies[0];
  sim.enqueue('player1', { type: 'attack', targetId: enemy.id });

  const events = runFor(sim, 30000);
  assert.ok(events.some(e => e.type === 'damage'));
  const xp = events.find(e => e.type === 'xp');
  assert.ok(xp, 'sem evento de XP');
  assert.ok(sim.player.xp > 0);
  assert.equal(sim.player.target, null);
  assert.ok(sim.deadBodies.some(c => c.type === 'enemy_corpse'));

  const respawnedAt = xp.time + CONFIG.enemyRespawnTime;
  assert.ok(sim.time >= respawnedAt ? sim.enemies.length === 1 : sim.enemies.length === 0);
  runFor(sim, CONFIG.enemyRespawnTime + TICK_MS);
  assert.equal(sim.enemies.length, 1);
  assert.equal(sim.enemies[0].id, enemy.id);
});

test('moveItem longe do player: ele vai até o item e arrasta ao chegar', () => {
  const sim = buildGame({ objects: [...GROUND, ...pile(10, 5, 1)], player: { x: 2, y: 5, z: 0 } });
  const parcel = sim.objects.find(o => o.id.startsWith('Parcel'));
  sim.enqueue('player1', { type: 'moveItem', itemId: parcel.id, x: 11, y: 6, z: 0 });

  runFor(sim, 5000);
  assert.deepEqual([parcel.x, parcel.y], [11, 6]);
  assert.equal(sim.player.pendingDrag, null);
});

test('player morto deixa cadáver e volta pro spawn com vida cheia', () => {
  const sim = buildGame({ objects: GROUND, player: { x: 3, y: 3, z: 0 } });
  sim.enqueue('player1', { type: 'walkTo', x: 9, y: 3, z: 0 });
  runFor(sim, 2000);
  const deathPlace = [sim.player.x, sim.player.y];
  sim.player.currentHp = 0;

  const events = runFor(sim, TICK_MS);
  assert.ok(events.some(e => e.type === 'death'));
  assert.deepEqual([sim.player.x, sim.player.y], [3, 3]);
  assert.equal(sim.player.currentHp, sim.player.hp);
  const corpse = sim.deadBodies.find(c => c.type === 'player_corpse');
  assert.deepEqual([corpse.x, corpse.y], deathPlace);
  assert.deepEqual(sim.world.getTileEntities(3, 3, 0), [sim.player]);
});

test('cadáver some depois do tempo de decomposição', () => {
  const sim = buildGame({ objects: GROUND, player: { x: 3, y: 3, z: 0 } });
  sim.player.currentHp = 0;
  runFor(sim, TICK_MS);
  assert.equal(sim.deadBodies.length, 1);
  runFor(sim, CONFIG.corpseFrameDuration * CONFIG.corpseFrameCount + TICK_MS);
  assert.equal(sim.deadBodies.length, 0);
});

test('comandos de um jogador que não existe são ignorados', () => {
  const sim = buildGame({ objects: GROUND });
  sim.enqueue('ninguem', { type: 'walkTo', x: 5, y: 5, z: 0 });
  assert.doesNotThrow(() => runFor(sim, 500));
});

test('dois jogadores na mesma simulação se bloqueiam', () => {
  const sim = buildGame({ objects: GROUND, player: { x: 2, y: 2, z: 0 } });
  const other = sim.addPlayer('player2', { x: 4, y: 2, z: 0 });
  sim.enqueue('player1', { type: 'walkDir', dx: 1, dy: 0 });
  runFor(sim, 2000);
  assert.deepEqual([sim.player.x, other.x], [3, 4]);
});

test('mesmo mapa, mesmos comandos e mesmo sorteio: mesmo resultado', () => {
  const mapData = JSON.parse(fs.readFileSync(new URL('../data/map.json', import.meta.url), 'utf8'));

  const play = () => {
    seedRandom(7);
    const sim = new Simulation(mapData);
    sim.addPlayer('player1');
    sim.time = 1000;
    sim.enqueue('player1', { type: 'walkDir', dx: 1, dy: 0 });
    runFor(sim, 3000);
    sim.enqueue('player1', { type: 'walkDir', dx: 0, dy: 0 });
    sim.enqueue('player1', { type: 'attack', targetId: sim.enemies[1].id });
    runFor(sim, 20000);
    return JSON.stringify({
      players: sim.players.map(p => [p.x, p.y, p.z, p.step, p.currentHp, p.xp]),
      enemies: sim.enemies.map(e => [e.id, e.x, e.y, e.z, e.currentHp, e.ai.state]),
      corpses: sim.deadBodies.map(c => [c.x, c.y, c.type])
    });
  };

  assert.equal(play(), play());
});

test('o mapa real roda sem navegador: 2 minutos de jogo', () => {
  const mapData = JSON.parse(fs.readFileSync(new URL('../data/map.json', import.meta.url), 'utf8'));
  const sim = new Simulation(mapData);
  sim.addPlayer('player1');
  sim.time = 1000;

  const started = performance.now();
  sim.enqueue('player1', { type: 'walkDir', dx: 1, dy: 1 });
  runFor(sim, 120000);
  const elapsed = performance.now() - started;

  assert.equal(sim.players.length, 1);
  assert.ok(elapsed < 20000, `demorou ${elapsed.toFixed(0)} ms`);
});

test('jogadores entram e renascem em sqms livres, nunca um em cima do outro', () => {
  const sim = buildGame({ objects: GROUND, player: { x: 5, y: 5, z: 0 } });
  const others = [sim.addPlayer('player2'), sim.addPlayer('player3')];
  const spots = [sim.player, ...others].map(p => `${p.x},${p.y}`);
  assert.equal(new Set(spots).size, 3);
  assert.deepEqual([sim.player.x, sim.player.y], [5, 5]);

  sim.enqueue('player1', { type: 'walkTo', x: 12, y: 5, z: 0 });
  runFor(sim, 3000);
  sim.player.currentHp = 0;
  runFor(sim, TICK_MS);
  const after = [sim.player, ...others].map(p => `${p.x},${p.y}`);
  assert.equal(new Set(after).size, 3);
  assert.ok(Math.abs(sim.player.x - 5) <= 1 && Math.abs(sim.player.y - 5) <= 1);
});

test('spawn num andar acima do térreo: o jogador nasce e renasce nele', () => {
  const sim = buildGame({ objects: [...GROUND, ...floorRect(3, 8, 3, 8, 2)], player: { x: 5, y: 5, z: 2 } });
  assert.deepEqual([sim.player.x, sim.player.y, sim.player.z], [5, 5, 2]);
  assert.deepEqual(sim.world.getTileEntities(5, 5, 2), [sim.player]);

  sim.player.currentHp = 0;
  runFor(sim, TICK_MS);
  assert.deepEqual([sim.player.x, sim.player.y, sim.player.z], [5, 5, 2]);
});

test('inimigo morto renasce no lugar original do mapa, mesmo tendo perseguido pra longe', () => {
  const sim = buildGame({ objects: GROUND, enemies: [[18, 18, 0, 1]], player: { x: 12, y: 18, z: 0 } });
  const enemy = sim.enemies[0];
  runFor(sim, 6000);
  assert.ok(enemy.x !== 18 || enemy.y !== 18, 'o inimigo deveria ter saído do lugar perseguindo');

  sim.enqueue('player1', { type: 'walkTo', x: 2, y: 2, z: 0 });
  runFor(sim, 8000);
  assert.equal(enemy.ai.state, 'patrol');
  assert.ok(enemy.patrolCenterX !== 18 || enemy.patrolCenterY !== 18, 'a patrulha deveria ter mudado de centro');

  enemy.currentHp = 0;
  runFor(sim, CONFIG.enemyRespawnTime + 2 * TICK_MS);
  const reborn = sim.enemies.find(e => e.id === enemy.id);
  assert.ok(reborn && reborn !== enemy);
  assert.deepEqual([reborn.x, reborn.y, reborn.z], [18, 18, 0]);
  assert.deepEqual([reborn.patrolCenterX, reborn.patrolCenterY], [18, 18]);
});

test('se tiver alguém no lugar original, o inimigo renasce no sqm livre mais perto', () => {
  const sim = buildGame({ objects: GROUND, enemies: [[18, 18, 0, 1]], safe: [[18, 18, 0]], player: { x: 2, y: 2, z: 0 } });
  const enemy = sim.enemies[0];
  enemy.currentHp = 0;
  runFor(sim, TICK_MS);
  sim.world.moveEntityTile(sim.player, sim.player.x, sim.player.y, 0, 18, 18, 0);
  Object.assign(sim.player, { x: 18, y: 18 });
  runFor(sim, CONFIG.enemyRespawnTime + TICK_MS);
  const reborn = sim.enemies.find(e => e.id === enemy.id);
  assert.ok(Math.max(Math.abs(reborn.x - 18), Math.abs(reborn.y - 18)) === 1, `em ${reborn.x},${reborn.y}`);
});

// ================================================================================================================================================================================================================================================
// targetStill
// Player com alvo num inimigo que não sai do lugar (não vê o player nem patrulha).

function targetStill(enemyAt, playerAt) {
  const sim = buildGame({ objects: GROUND, enemies: [enemyAt], player: playerAt });
  const enemy = sim.enemies[0];
  enemy.detectionRadius = 0;
  enemy.patrolRadius = 0;
  sim.enqueue('player1', { type: 'attack', targetId: enemy.id });
  sim.tick(sim.time + TICK_MS);
  return { sim, enemy };
}

test('alvo com seguir desligado: o player espera sem andar nem atacar e continua com o alvo', () => {
  const { sim, enemy } = targetStill([10, 5, 0], { x: 4, y: 5, z: 0 });
  sim.enqueue('player1', { type: 'toggleFollow' });
  const events = runFor(sim, 3000);
  assert.deepEqual([sim.player.x, sim.player.y], [4, 5]);
  assert.equal(sim.player.target, enemy);
  assert.ok(!events.some(e => e.type === 'damage'));

  sim.enqueue('player1', { type: 'attack', targetId: enemy.id });
  assert.ok(runFor(sim, 8000).some(e => e.type === 'damage'), 'clicar no alvo de novo volta a seguir e atacar');
});

test('alvo longe demais é perdido, com aviso', () => {
  const { sim } = targetStill([4 + CONFIG.targetLoseRange + 2, 5, 0], { x: 4, y: 5, z: 0 });
  const events = runFor(sim, 200);
  assert.equal(sim.player.target, null);
  assert.ok(events.some(e => e.type === 'message' && e.text === 'Alvo perdido'));
});

test('alvo em outro andar é perdido', () => {
  const sim = buildGame({ objects: [...GROUND, ...floorRect(0, 24, 0, 24, 1)], enemies: [[8, 5, 1]], player: { x: 4, y: 5, z: 0 } });
  sim.enemies[0].detectionRadius = 0;
  sim.player.target = sim.enemies[0];
  runFor(sim, 200);
  assert.equal(sim.player.target, null);
});

test('clique anda só no andar do player: contorna escada e buraco e não troca de andar', () => {
  const objects = [...floorRect(0, 14, 0, 14, 0), ...floorRect(0, 14, 0, 14, 1), ...floorRect(0, 14, 0, 14, -1), ...hole(7, 5, 0)];
  const sim = buildGame({ objects, stairs: [[7, 10, 0]], player: { x: 7, y: 12, z: 0 } });
  const visited = [];
  const track = () => visited.push(`${sim.player.x},${sim.player.y},${sim.player.z}`);

  sim.enqueue('player1', { type: 'walkTo', x: 7, y: 2, z: 0 });
  for (let i = 0; i < 200; i++) { runFor(sim, TICK_MS); track(); }
  assert.deepEqual([sim.player.x, sim.player.y, sim.player.z], [7, 2, 0]);
  assert.ok(!visited.includes('7,10,0') && !visited.includes('7,5,0'), 'pisou na escada ou no buraco');

  sim.enqueue('player1', { type: 'walkTo', x: 6, y: 8, z: 1 });
  runFor(sim, 5000);
  assert.deepEqual([sim.player.x, sim.player.y, sim.player.z], [6, 8, 0]);
});
