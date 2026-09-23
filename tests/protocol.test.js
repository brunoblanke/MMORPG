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
