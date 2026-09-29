// tests/flee.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, placeAt, CREATURE } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { AI_STATE } from '../js/models/enemy.js';
import { TICK_MS } from '../js/simulation.js';

const GROUND = floorRect(0, 29, 0, 29, 0);

setAssets([{ id: CREATURE, ferramenta: 'criaturas', grupo: 'criaturas', pasta: 'mamiferos', nome: 'teste', url: '/t.png', quadro: 32, quadros: 3, pecas: [], propriedades: { foge: 20 } }]);

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

test('com a vida no limite de fuga, o inimigo para de atacar e se afasta do player', () => {
  const sim = buildGame({ objects: GROUND, enemies: [[11, 10, 0]], player: { x: 10, y: 10, z: 0 } });
  const enemy = sim.enemies[0];
  enemy.currentHp = Math.floor(enemy.maxHp * 0.2);
  const events = [];
  let fled = false;
  let farthest = 0;
  for (let t = 0; t < 3000; t += TICK_MS) {
    events.push(...runFor(sim, TICK_MS));
    if (enemy.ai.state === AI_STATE.FLEE) fled = true;
    farthest = Math.max(farthest, Math.max(Math.abs(enemy.x - 10), Math.abs(enemy.y - 10)));
  }
  assert.ok(fled, 'entrou em fuga');
  assert.ok(farthest >= 5, 'se afastou do player');
  assert.ok(!events.some(e => e.type === 'damage' && e.targetId === sim.player.id), 'fugindo não ataca');
  assert.equal(enemy.ai.state, AI_STATE.PATROL, 'longe do player (fora da visão), volta a patrulhar');
});

test('com vida acima do limite, o inimigo não foge', () => {
  const sim = buildGame({ objects: GROUND, enemies: [[11, 10, 0]], player: { x: 10, y: 10, z: 0 } });
  const enemy = sim.enemies[0];
  enemy.currentHp = Math.floor(enemy.maxHp * 0.5);
  runFor(sim, 1000);
  assert.notEqual(enemy.ai.state, AI_STATE.FLEE);
});
