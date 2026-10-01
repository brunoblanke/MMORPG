// tests/delta.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeDelta, decodeDelta } from '../js/net/delta.js';
import { buildGame, floorRect } from './helpers/fixture.js';
import { serializeState, VIEW_RANGE_X } from '../js/net/protocol.js';
import { TICK_MS } from '../js/simulation.js';

test('diferença: só o que mudou vai; o navegador remonta o mesmo estado', () => {
  const a = { players: [{ id: 'p', x: 1, y: 1, hp: 10 }], enemies: [{ id: 'e1', x: 5, lvl: 3 }, { id: 'e2', x: 7, lvl: 1 }], npcs: [], corpses: [], items: [{ id: 'i', x: 2, lit: true }], doors: [], dug: [], you: { target: null } };
  const b = { players: [{ id: 'p', x: 2, y: 1, hp: 10 }], enemies: [{ id: 'e1', x: 5, lvl: 3 }, { id: 'e3', x: 9, lvl: 2 }], npcs: [], corpses: [], items: [{ id: 'i', x: 2 }], doors: [], dug: [], you: { target: null } };
  const first = encodeDelta(null, a);
  const mirror = decodeDelta(null, first);
  assert.deepEqual(mirror, a);
  const delta = encodeDelta(a, b);
  assert.deepEqual(delta.players.changed, [{ id: 'p', x: 2 }]);
  assert.deepEqual(delta.enemies, { changed: [{ id: 'e3', x: 9, lvl: 2 }], gone: ['e2'] });
  assert.deepEqual(delta.items.changed, [{ id: 'i', $d: ['lit'] }]);
  assert.equal(delta.you, undefined, 'sem mudança, nem vai');
  const next = decodeDelta(mirror, delta);
  const byId = (list) => Object.fromEntries(list.map(e => [e.id, e]));
  for (const key of ['players', 'enemies', 'items']) assert.deepEqual(byId(next[key]), byId(b[key]));
  assert.deepEqual(encodeDelta(b, b), {});
});

test('cada jogador recebe só o que está perto; num jogo parado quase nada vai pela rede', () => {
  const sim = buildGame({ objects: floorRect(0, 120, 0, 20, 0), enemies: [[8, 5, 0], [5 + VIEW_RANGE_X + 10, 5, 0]], player: { x: 5, y: 5, z: 0 } });
  for (const e of sim.enemies) e.patrolRadius = 0;
  const state = serializeState(sim, 'player1', true);
  assert.deepEqual(state.enemies.map(e => e.id), [sim.enemies[0].id]);
  let sent = state;
  sim.tick(sim.time + TICK_MS);
  const next = serializeState(sim, 'player1', true);
  const size = JSON.stringify(encodeDelta(sent, next)).length;
  assert.ok(size < 400, `diferença de ${size} bytes`);
  sent = next;
});
