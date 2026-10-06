// tests/events-floor.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect } from './helpers/fixture.js';
import { TICK_MS } from '../js/simulation.js';

// Os números de dano, cura, XP, efeitos e projéteis dizem em que andar
// aconteceram (z): quem está em outro andar não deve vê-los.

test('o golpe no inimigo de um andar sai com o z dele', () => {
  const sim = buildGame({ objects: [...floorRect(0, 12, 0, 12, 0), ...floorRect(0, 12, 0, 12, -1)], enemies: [[6, 5, -1]], player: { x: 5, y: 5, z: -1 } });
  const enemy = sim.enemies[0];
  enemy.hp = enemy.currentHp = 100000;
  let damage = null;
  for (let i = 0; i < 200 && !damage; i++) {
    sim.player.lastAttackTime = -1e9;
    sim.combat.attackTarget(sim.player, enemy, sim.time + TICK_MS, { melee: true });
    damage = sim.drainEvents().find(e => e.type === 'damage' && e.targetId === enemy.id) || null;
  }
  assert.ok(damage, 'houve dano');
  assert.equal(damage.z, -1);
});

test('todo evento com posição (x ou fromX) traz o z', () => {
  const sim = buildGame({ objects: floorRect(0, 12, 0, 12, 0), enemies: [[6, 5, 0]], player: { x: 5, y: 5, z: 0 } });
  sim.player.lastAttackTime = -1e9;
  sim.combat.attackTarget(sim.player, sim.enemies[0], sim.time + TICK_MS, { melee: true });
  sim.spells.showEffect(6, 5, 'fire');
  sim.emit({ type: 'xp', x: 1, y: 1, z: 0, amount: 1 });
  for (const event of sim.drainEvents()) {
    if (event.x !== undefined || event.fromX !== undefined) assert.notEqual(event.z, undefined, `evento ${event.type} sem z`);
  }
});
