import { isPositionAdjacentTo, getLevel } from '../utils/helpers.js';
import { CONFIG } from '../config.js';

export class CombatController {
  constructor() {}

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

  attackTarget(attacker, defender, timestamp, renderer, offset, particleController) {
    if (timestamp - attacker.lastAttackTime < CONFIG.attackCooldown) return false;
    if (!defender.isAlive()) return false;

    const damage = this.calculateDamage(attacker, defender);
    const isDead = defender.takeDamage(damage);
    attacker.lastAttackTime = timestamp;

    if (particleController) {
      particleController.spawnDamage(defender.x, defender.y, damage, renderer);
    }
    
    defender.hitFlash = true;
    setTimeout(() => {
      defender.hitFlash = false;
    }, 150);

    return isDead;
  }

  // ================================================================================================================================================================================================================================================
// processCombat

processCombat(player, selectedEnemy, enemies, timestamp, renderer, movementController, offset, particleController, camera) {
  let anyEnemyInRange = false;
  
  if (selectedEnemy && selectedEnemy.isAlive()) {
    selectedEnemy.isTarget = true;
    
    const isAdjacent = isPositionAdjacentTo(player.x, player.y, selectedEnemy.x, selectedEnemy.y);
    
    const canReach = getLevel(player) === getLevel(selectedEnemy);
    
    if (isAdjacent && canReach) {
      this.attackTarget(player, selectedEnemy, timestamp, renderer, offset, particleController);
    } else if (movementController.autoFollow) {
      const searchBounds = camera.getPathfindingBounds();
      movementController.moveTowardsPosition(player, selectedEnemy.x, selectedEnemy.y, timestamp, selectedEnemy, searchBounds, enemies);
    } else {
      console.log(`⚠️ Nem atacando nem perseguindo: isAdjacent=${isAdjacent} canReach=${canReach} autoFollow=${movementController.autoFollow}`);
    }
  }

  for (const enemy of enemies) {
    if (!enemy.isAlive()) continue;
    
    const playerInDetection = enemy.isInDetectionRange(player.x, player.y);
    const isAdjacent = isPositionAdjacentTo(enemy.x, enemy.y, player.x, player.y);
    
    const canReach = getLevel(enemy) === getLevel(player);
    
    if (playerInDetection) {
      anyEnemyInRange = true;
      
      if (isAdjacent && canReach && player.isAlive()) {
        player.isTarget = true;
        this.attackTarget(enemy, player, timestamp, renderer, offset, particleController);
      }
    }
  }
  
  if (!anyEnemyInRange) {
    player.isTarget = false;
  } else {
    player.isTarget = true;
  }
}
}