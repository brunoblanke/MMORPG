// tests/protocol.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, buildMapData, floorRect, pile } from './helpers/fixture.js';
import { serializeState, applyState } from '../js/net/protocol.js';
import { World } from '../js/core/world.js';
import { generateObjects } from '../js/models/game-object.js';
import { TICK_MS } from '../js/simulation.js';

const GROUND = floorRect(0, 24, 0, 24, 0);

// ================================================================================================================================================================================================================================================
// makeMirror
// O que o navegador monta no modo online (RemoteSession), sem o WebSocket.

function makeMirror(mapData) {
  const world = new World();
  const objects = generateObjects(mapData);
  world.load(objects);
  return { world, objects, objectsById: new Map(objects.map(o => [o.id, o])), players: [], enemies: [], deadBodies: [] };
}

// ================================================================================================================================================================================================================================================
// sync
// Um tick no servidor e o estado (pela ida e volta em JSON) aplicado no espelho.

function sync(sim, mirror, playerId) {
  sim.tick(sim.time + TICK_MS);
  const message = JSON.parse(JSON.stringify({ type: 'state', time: sim.time, state: serializeState(sim, playerId), events: sim.drainEvents() }));
  applyState(mirror, message, playerId, 5000);
}

// ================================================================================================================================================================================================================================================
// snapshotOf

function snapshotOf(source) {
  return JSON.stringify({
    players: source.players.map(p => [p.id, p.x, p.y, p.z, p.step, p.currentHp]),
    enemies: source.enemies.map(e => [e.id, e.x, e.y, e.z, e.currentHp]),
    corpses: source.deadBodies.map(c => [c.id, c.x, c.y, c.z])
  });
}

test('o espelho do navegador fica igual à simulação do servidor', () => {
  const objects = [...GROUND, ...pile(8, 8, 1)];
  const enemies = [[15, 5, 0, 1], [3, 15, 0, 1]];
  const sim = buildGame({ objects, enemies, player: { x: 2, y: 2, z: 0 } });
  sim.addPlayer('player2', { x: 20, y: 20, z: 0 });
  const mirror = makeMirror(buildMapData({ objects, enemies }));

  sim.enqueue('player1', { type: 'attack', targetId: sim.enemies[0].id });
  sim.enqueue('player2', { type: 'walkTo', x: 10, y: 12, z: 0 });
  sim.enqueue('player1', { type: 'moveItem', itemId: 'Parcel_1', x: 9, y: 9, z: 0 });

  for (let i = 0; i < 400; i++) sync(sim, mirror, 'player1');

  assert.equal(snapshotOf(mirror), snapshotOf(sim));
  for (const entity of [...mirror.players, ...mirror.enemies]) {
    assert.deepEqual(mirror.world.getTileEntities(entity.x, entity.y, entity.z).includes(entity), true);
  }
  const parcel = mirror.objectsById.get('Parcel_1');
  const real = sim.getItem('Parcel_1');
  assert.deepEqual([parcel.x, parcel.y, parcel.z], [real.x, real.y, real.z]);
});

test('só o dono recebe o próprio alvo e caminho', () => {
  const sim = buildGame({ objects: GROUND, enemies: [[10, 10, 0]], player: { x: 2, y: 2, z: 0 } });
  sim.addPlayer('player2', { x: 5, y: 5, z: 0 });
  sim.enqueue('player1', { type: 'attack', targetId: sim.enemies[0].id });
  sim.tick(TICK_MS);

  assert.equal(serializeState(sim, 'player1').you.target, sim.enemies[0].id);
  assert.equal(serializeState(sim, 'player2').you.target, null);
});

test('quem sai do servidor some do espelho', () => {
  const sim = buildGame({ objects: GROUND, player: { x: 2, y: 2, z: 0 } });
  sim.addPlayer('player2', { x: 5, y: 5, z: 0 });
  const mirror = makeMirror(buildMapData({ objects: GROUND }));
  sync(sim, mirror, 'player1');
  assert.equal(mirror.players.length, 2);

  sim.removePlayer('player2');
  sync(sim, mirror, 'player1');
  assert.deepEqual(mirror.players.map(p => p.id), ['player1']);
  assert.deepEqual(mirror.world.getTileEntities(5, 5, 0), []);
});

test('o gênero do jogador vai pro espelho; valor desconhecido vira masculino', async () => {
  const { normalizeGender } = await import('../js/net/protocol.js');
  assert.equal(normalizeGender('female'), 'female');
  assert.equal(normalizeGender('outro'), 'male');
  assert.equal(normalizeGender(undefined), 'male');

  const sim = buildGame({ objects: GROUND, player: { x: 2, y: 2, z: 0 } });
  sim.addPlayer('player2', { name: 'Ana', gender: 'female' });
  const mirror = makeMirror(buildMapData({ objects: GROUND }));
  sync(sim, mirror, 'player1');
  assert.deepEqual(mirror.players.map(p => [p.id, p.gender]), [['player1', 'male'], ['player2', 'female']]);
});

test('volume tirado de baixo do player: no espelho ele desce na hora, sem animar', () => {
  const objects = [...GROUND, ...pile(5, 5, 1)];
  const sim = buildGame({ objects, player: { x: 4, y: 5, z: 0 } });
  const mirror = makeMirror(buildMapData({ objects }));
  sim.enqueue('player1', { type: 'walkTo', x: 5, y: 5, z: 0 });
  for (let i = 0; i < 40; i++) sync(sim, mirror, 'player1');
  const onPile = mirror.players.find(p => p.id === 'player1');
  assert.equal(onPile.step, 1);

  const parcel = sim.getItem('Parcel_1');
  sim.objectDrag.moveObject(sim.player, parcel, 6, 5, 0);
  sync(sim, mirror, 'player1');
  const fallen = mirror.players.find(p => p.id === 'player1');
  assert.equal(fallen.step, 0);
  assert.equal(fallen.isMoving, false);
  assert.equal(fallen.renderStep, 0);
});

test('troca de andar (buraco) aparece direto no espelho, sem deslizar', () => {
  const objects = [...GROUND, ...floorRect(0, 24, 0, 24, 1), ['estrutura/entradas/teste', 6, 5, 1, 0, 0, 0, 0]];
  const sim = buildGame({ objects, player: { x: 4, y: 5, z: 1 } });
  const mirror = makeMirror(buildMapData({ objects }));
  sim.enqueue('player1', { type: 'walkTo', x: 6, y: 5, z: 1 });
  let seen = null;
  for (let i = 0; i < 60 && !seen; i++) {
    sync(sim, mirror, 'player1');
    const me = mirror.players.find(p => p.id === 'player1');
    if (me && me.z === 0) seen = me;
  }
  assert.deepEqual([seen.x, seen.y, seen.z], [6, 5, 0]);
  assert.equal(seen.isMoving, false);
  assert.deepEqual([seen.renderX, seen.renderY, seen.renderZ], [6, 5, 0]);
});

test('porta aberta no servidor abre no espelho do navegador (desenho e bloqueio)', () => {
  const door = ['estrutura/paredes/teste#porta-y', 6, 5, 0, 0, 0, 1, 1];
  const mapData = buildMapData({ objects: [...GROUND, door], spawn: { x: 5, y: 5, z: 0 } });
  const sim = buildGame({ objects: [...GROUND, door], player: { x: 5, y: 5, z: 0 } });
  const mirror = makeMirror(mapData);
  sync(sim, mirror, 'player1');
  assert.ok(mirror.world.isBlocked(6, 5, 0));

  sim.enqueue('player1', { type: 'useDoor', x: 6, y: 5, z: 0 });
  sync(sim, mirror, 'player1');
  assert.ok(!mirror.world.isBlocked(6, 5, 0));
  assert.match(mirror.world.getDoorAt(6, 5, 0).id, /#porta-y-aberta_/);
});
