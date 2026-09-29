// tests/mage.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, wall, CREATURE } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { TICK_MS } from '../js/simulation.js';

const GROUND = floorRect(0, 29, 0, 29, 0);

setAssets([{ id: CREATURE, ferramenta: 'criaturas', grupo: 'criaturas', pasta: 'mamiferos', nome: 'teste', url: '/t.png', quadro: 32, quadros: 3, pecas: [], propriedades: { comportamento: 'mago' } }]);

// ================================================================================================================================================================================================================================================
// runFor

function runFor(sim, ms) {
  const events = [];
  const end = sim.time + ms;
  while (sim.time < end) {
    sim.tick(sim.time + TICK_MS);
    events.push(...sim.drainEvents());
  }
  return events;
}

const range = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

test('mago com o player colado se afasta pra fora da distância mínima', () => {
  const sim = buildGame({ objects: GROUND, enemies: [[11, 10, 0]], player: { x: 10, y: 10, z: 0 } });
  const mage = sim.enemies[0];
  runFor(sim, 3000);
  assert.ok(range(mage, sim.player) >= 3, `ficou a ${range(mage, sim.player)} sqm`);
});

test('mago ataca de longe com linha livre e não cola no player', () => {
  const sim = buildGame({ objects: GROUND, enemies: [[14, 10, 0]], player: { x: 10, y: 10, z: 0 } });
  const mage = sim.enemies[0];
  const events = runFor(sim, 4000);
  assert.ok(events.some(e => e.type === 'missile'), 'lançou projétil');
  assert.ok(events.some(e => e.type === 'damage' && e.targetId === sim.player.id), 'causou dano');
  assert.ok(range(mage, sim.player) >= 3);
});

test('parede entre o mago e o player barra o ataque de longe', () => {
  const walls = [];
  for (let y = 0; y <= 29; y++) walls.push(...wall(12, y));
  const sim = buildGame({ objects: [...GROUND, ...walls], enemies: [[14, 10, 0]], player: { x: 10, y: 10, z: 0 } });
  const events = runFor(sim, 4000);
  assert.ok(!events.some(e => e.type === 'damage' && e.targetId === sim.player.id));
});
