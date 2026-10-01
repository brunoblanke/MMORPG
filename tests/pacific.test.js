// tests/pacific.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, CREATURE } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { AI_STATE } from '../js/models/enemy.js';
import { TICK_MS } from '../js/simulation.js';

const GROUND = floorRect(0, 29, 0, 29, 0);

setAssets([{ id: CREATURE, ferramenta: 'criaturas', grupo: 'criaturas', pasta: 'mamiferos', nome: 'deer', url: '/t.png', quadro: 32, quadros: 3, pecas: [], propriedades: { comportamento: 'pacifico' } }]);

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

test('pacífico (deer): com a vida cheia, foge de quem chega perto e nunca ataca', () => {
  const sim = buildGame({ objects: GROUND, enemies: [[11, 10, 0]], player: { x: 10, y: 10, z: 0 } });
  const enemy = sim.enemies[0];
  const hp = sim.player.currentHp;
  const events = runFor(sim, 300);
  assert.equal(enemy.ai.state, AI_STATE.FLEE);
  events.push(...runFor(sim, 3000));
  assert.ok(Math.abs(enemy.x - 10) + Math.abs(enemy.y - 10) > 2, `ficou em ${enemy.x},${enemy.y}`);
  assert.equal(sim.player.currentHp, hp);
  assert.equal(events.some(e => e.type === 'damage' && e.targetId === sim.player.id), false);
  assert.equal(sim.player.isTarget, false, 'não marca o player como ameaçado');
});

test('pacífico não entra no auto ataque, mas dá pra atacar clicando nele', () => {
  const sim = buildGame({ objects: GROUND, enemies: [[12, 10, 0]], player: { x: 10, y: 10, z: 0 } });
  const enemy = sim.enemies[0];
  sim.enqueue('player1', { type: 'toggleAttackMode' });
  runFor(sim, 200);
  assert.equal(sim.player.target, null);
  sim.enqueue('player1', { type: 'attack', targetId: enemy.id });
  runFor(sim, 100);
  assert.equal(sim.player.target, enemy);
});
