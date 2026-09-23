// js/systems/combat.js

import { isPositionAdjacentTo } from '../utils/helpers.js';
import { getLevel } from '../core/geometry.js';
import { CONFIG } from '../config.js';

export class CombatController {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
  }

  // ================================================================================================================================================================================================================================================
  // calculateDamage

  calculateDamage(attacker, defender) {
    const baseDamage = attacker.atk;
    const defense = defender.def;
    const rawDamage = baseDamage - Math.floor(defense / 2);
    return Math.max(1, Math.round(rawDamage * CONFIG.damageScale));
  }

  // ================================================================================================================================================================================================================================================
  // attackTarget

  attackTarget(attacker, defender, now) {
    if (now - attacker.lastAttackTime < CONFIG.attackCooldown) return false;
    if (!defender.isAlive()) return false;

    const damage = this.calculateDamage(attacker, defender);
    const hpLeft = defender.takeDamage(damage, now);
    attacker.lastAttackTime = now;
    this.sim.emit({ type: 'damage', targetId: defender.id, x: defender.x, y: defender.y, amount: damage });
    return hpLeft;
  }

  // ================================================================================================================================================================================================================================================
  // processPlayer
  // O player ataca o alvo colado nele, no mesmo andar; senão, com o seguir
  // ligado, vai até ele.

  processPlayer(player, now) {
    const target = player.target;
    if (!target || !target.isAlive()) return;

    const isAdjacent = isPositionAdjacentTo(player.x, player.y, target.x, target.y);
    const canReach = getLevel(player) === getLevel(target);

    if (isAdjacent && canReach) {
      this.attackTarget(player, target, now);
    } else if (player.autoFollow) {
      const searchBounds = this.sim.searchBoundsAround(player);
      this.sim.movement.moveTowardsPosition(player, target.x, target.y, now, target, searchBounds, this.sim.enemies);
    } else {
      console.log(`⚠️ Nem atacando nem perseguindo: isAdjacent=${isAdjacent} canReach=${canReach} autoFollow=${player.autoFollow}`);
    }
  }

  // ================================================================================================================================================================================================================================================
  // processEnemies
  // Inimigo que vê o player e está colado nele, no mesmo andar, ataca.
  // player.isTarget: algum inimigo o vê (marca vermelha no player).

  processEnemies(player, now) {
    let anyEnemyInRange = false;

    for (const enemy of this.sim.enemies) {
      if (!enemy.isAlive()) continue;
      if (!enemy.isInDetectionRange(player.x, player.y)) continue;
      anyEnemyInRange = true;

      const isAdjacent = isPositionAdjacentTo(enemy.x, enemy.y, player.x, player.y);
      const canReach = getLevel(enemy) === getLevel(player);
      if (isAdjacent && canReach && player.isAlive()) {
        this.attackTarget(enemy, player, now);
      }
    }

    player.isTarget = anyEnemyInRange;
  }
}
