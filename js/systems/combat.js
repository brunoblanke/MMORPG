// js/systems/combat.js

import { isPositionAdjacentTo, distance } from '../utils/helpers.js';
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
  // Com alvo, o player está sempre num destes estados:
  //   perdeu o alvo (outro andar ou longe demais) → larga o alvo e avisa;
  //   colado no alvo → ataca;
  //   seguir ligado → anda até ele;
  //   seguir desligado (andou pelas teclas) → só espera: ataca se o alvo
  //   encostar, e o clique no alvo liga o seguir de novo.

  processPlayer(player, now) {
    const target = player.target;
    if (!target) return;
    if (!target.isAlive()) {
      player.target = null;
      return;
    }

    if (this.isTargetLost(player, target)) {
      player.target = null;
      this.sim.emit({ type: 'message', playerId: player.id, text: 'Alvo perdido' });
      return;
    }

    if (isPositionAdjacentTo(player.x, player.y, target.x, target.y)) {
      this.attackTarget(player, target, now);
    } else if (player.autoFollow) {
      const searchBounds = this.sim.searchBoundsAround(player);
      this.sim.movement.moveTowardsPosition(player, target.x, target.y, now, target, searchBounds, this.sim.enemies);
    }
  }

  // ================================================================================================================================================================================================================================================
  // isTargetLost
  // Alvo em outro andar ou a mais de targetLoseRange sqms.

  isTargetLost(player, target) {
    if (getLevel(player) !== getLevel(target)) return true;
    return distance(player.x, player.y, target.x, target.y) > CONFIG.targetLoseRange;
  }

  // ================================================================================================================================================================================================================================================
  // processEnemies
  // Inimigo que vê o player e está colado nele, no mesmo andar, ataca — a não
  // ser que o player esteja na zona segura.
  // player.isTarget: algum inimigo o vê (marca vermelha no player).

  processEnemies(player, now) {
    if (this.sim.world.isInSafeZone(player)) {
      player.isTarget = false;
      return;
    }

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
