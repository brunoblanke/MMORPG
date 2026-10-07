// tests/background-tab.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, buildMapData, floorRect } from './helpers/fixture.js';
import { serializeState } from '../js/net/protocol.js';
import { RemoteSession } from '../js/net/remote-session.js';
import { TICK_MS } from '../js/simulation.js';

const GROUND = floorRect(0, 24, 0, 24, 0);

// ================================================================================================================================================================================================================================================
// stateMessage

function stateMessage(sim, events) {
  sim.tick(sim.time + TICK_MS);
  return JSON.parse(JSON.stringify({ type: 'state', time: sim.time, state: serializeState(sim, 'player1'), events }));
}

test('com a aba em segundo plano, efeitos visuais antigos são descartados na volta; o que não é visual e o estado ficam', () => {
  const sim = buildGame({ objects: GROUND, player: { x: 2, y: 2, z: 0 } });
  const session = new RemoteSession(buildMapData({ objects: GROUND }), { addEventListener() {} }, 'player1');
  const hit = { type: 'damage', targetId: 'player1', x: 2, y: 2, z: 0, amount: 5 };
  const talk = { type: 'speech', x: 2, y: 2, z: 0, text: 'oi' };
  const book = { type: 'book', playerId: 'player1', title: 't', text: 'x' };
  session.inbox.push({ message: stateMessage(sim, [hit, talk, book]), receivedAt: 1000 });
  session.inbox.push({ message: stateMessage(sim, [hit, talk]), receivedAt: 59500 });

  const events = session.update(60000);

  assert.deepEqual(events.map(e => e.type), ['book', 'damage', 'speech']);
  assert.ok(session.player);
});
