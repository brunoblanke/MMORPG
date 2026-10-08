// moba/engine/minions.js

import { MINIONS, WAVE } from './config.js';
import { lanePath } from './map.js';
import { createMinion } from './units.js';
import { moveToward } from './movement.js';
import { findEnemies, attack } from './combat.js';

// ================================================================================================================================================================================================================================================
// spawnWave
// Uma leva de minions de cada time (melee na frente, ranged atrás).

export function spawnWave(sim) {
  for (const team of ['blue', 'red']) {
    for (let i = 0; i < WAVE.melee + WAVE.ranged; i++) {
      const type = i < WAVE.melee ? 'melee' : 'ranged';
      const offset = (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * 0.9;
      sim.minions.push(createMinion(`m${++sim.minionCounter}`, team, type, offset));
    }
  }
}

// ================================================================================================================================================================================================================================================
// updateMinion
// Um minion: ataca o inimigo mais perto no alcance; senão vai atrás de quem entrou no raio de aggro (heróis e minions); senão segue a lane.

export function updateMinion(sim, minion, dt) {
  if (sim.time < minion.stunUntil) return;
  const stats = MINIONS[minion.type];
  const inRange = findEnemies(sim, minion, stats.range);
  if (inRange.length) {
    const target = inRange.find(enemy => enemy.kind !== 'structure') || inRange[0];
    if (sim.time >= minion.attackReadyAt) attack(sim, minion, target, stats.damage, stats.cooldown, stats.missile);
    return;
  }
  const chase = findEnemies(sim, minion, stats.aggro).find(enemy => enemy.kind !== 'structure');
  if (chase) {
    moveToward(sim, minion, chase.x, chase.y, stats.speed, dt);
    return;
  }
  const path = lanePath(minion.team);
  const point = path[Math.min(minion.pathIndex, path.length - 1)];
  if (moveToward(sim, minion, point.x, point.y, stats.speed, dt) && minion.pathIndex < path.length - 1) minion.pathIndex++;
}

