// moba/engine/structures.js

import { STRUCTURES } from './config.js';
import { findEnemies, attack } from './combat.js';

// ================================================================================================================================================================================================================================================
// updateStructure
// A torre ataca o minion inimigo mais perto no alcance (se não há, o herói); o nexus não ataca.

export function updateStructure(sim, structure) {
  const stats = STRUCTURES[structure.structure];
  if (!structure.alive || stats.range <= 0 || sim.time < structure.attackReadyAt) return;
  const targets = findEnemies(sim, structure, stats.range).filter(enemy => enemy.kind !== 'structure');
  const target = targets.find(enemy => enemy.kind === 'minion') || targets[0];
  if (target) attack(sim, structure, target, stats.damage, stats.cooldown, stats.missile, 'energy');
}
