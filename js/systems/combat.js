// js/systems/combat.js

import { isPositionAdjacentTo, distance } from '../utils/helpers.js';
import { getLevel } from '../core/geometry.js';
import { AI_STATE } from '../models/enemy.js';
import { creatureBehavior } from '../../shared/assets.js';
import { CONFIG } from '../config.js';
import { equipBonus, itemInfo } from '../../shared/items.js';
import { addSkillTry } from '../../shared/skills.js';

const FLOOR_DAMAGE_INTERVAL = 1000;

export class CombatController {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
  }

  // ================================================================================================================================================================================================================================================
  // calculateDamage

  calculateDamage(attacker, defender) {
    const baseDamage = attacker.atk + equipBonus(attacker.equip).atk;
    const defense = defender.def + equipBonus(defender.equip).def;
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
    if (attacker.isPlayer) this.trainSkill(attacker, equipBonus(attacker.equip).atkSkill);
    if (defender.isPlayer && defender.equip && defender.equip.escudo && itemInfo(defender.equip.escudo.type).slot === 'escudo') {
      this.trainSkill(defender, 'shielding');
    }
    this.sim.emit({ type: 'damage', targetId: defender.id, x: defender.x, y: defender.y, amount: damage });
    return hpLeft;
  }

  // ================================================================================================================================================================================================================================================
  // rangedAttack
  // Mago: ataca de até mageRange sqm, com linha livre de parede. O projétil
  // sai como evento pro navegador desenhar (missile).

  rangedAttack(enemy, player, now) {
    const range = Math.max(Math.abs(enemy.x - player.x), Math.abs(enemy.y - player.y));
    if (range > CONFIG.mageRange || !this.sim.movement.hasLineOfSight(enemy, player)) return;
    if (now - enemy.lastAttackTime < CONFIG.attackCooldown) return;
    this.sim.emit({ type: 'missile', fromX: enemy.x, fromY: enemy.y, toX: player.x, toY: player.y });
    this.attackTarget(enemy, player, now);
  }

  // ================================================================================================================================================================================================================================================
  // trainSkill
  // Um uso do skill (golpe com a arma, ataque recebido com escudo). Magic
  // level só sobe com magia (ainda não existe). Avisa quando sobe de nível.

  trainSkill(player, key) {
    if (!player.skills || key === 'magic') return;
    if (!addSkillTry(player.skills, key)) return;
    const names = { fist: 'Fist', club: 'Club', sword: 'Sword', axe: 'Axe', distance: 'Distance', shielding: 'Shielding', fishing: 'Fishing' };
    this.sim.emit({ type: 'message', playerId: player.id, text: `Você avançou em ${names[key]} (${player.skills[key].lvl}).` });
  }

  // ================================================================================================================================================================================================================================================
  // processFloorDamage
  // Piso que machuca (veneno, fogo…): tira vida ao entrar no sqm e a cada
  // FLOOR_DAMAGE_INTERVAL parado nele.

  processFloorDamage(player, now) {
    const z = player.z || 0;
    const damage = this.sim.world.floorDamageAt(player.x, player.y, z);
    if (!damage || !player.isAlive()) {
      player.floorDamageKey = null;
      return;
    }
    const key = `${player.x},${player.y},${z}`;
    if (key === player.floorDamageKey && now - player.lastFloorDamage < FLOOR_DAMAGE_INTERVAL) return;
    player.floorDamageKey = key;
    player.lastFloorDamage = now;
    player.takeDamage(damage, now);
    this.sim.emit({ type: 'damage', targetId: player.id, x: player.x, y: player.y, amount: damage });
  }

  // ================================================================================================================================================================================================================================================
  // processPlayer
  // Com alvo, o player está sempre num destes estados:
  //   perdeu o alvo (outro andar ou longe demais) → larga o alvo e avisa;
  //   colado no alvo → ataca;
  //   seguir ligado → anda até ele (pausa enquanto o player faz um caminho
  //   próprio, como ir abrir uma caixa, e volta a seguir ao chegar);
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
    } else if (player.autoFollow && !this.sim.control.isWalking(player)) {
      const searchBounds = this.sim.searchBoundsAround(player);
      this.sim.movement.moveTowardsPosition(player, target.x, target.y, now, target, searchBounds, this.sim.enemies);
    }
  }

  // ================================================================================================================================================================================================================================================
  // updateAutoAttack
  // Fila de inimigos que chegaram perto (entraram no raio de detecção, no
  // mesmo andar), na ordem em que chegaram; quem morre ou se afasta sai dela.
  // Criatura pacífica não entra (não ameaça: só vira alvo clicando nela).
  // No auto ataque, sem alvo, o player ataca o primeiro da fila — até ele
  // morrer ou o player trocar de alvo. Na zona segura não há fila.

  updateAutoAttack(player) {
    if (!player.isAlive() || this.sim.world.isInSafeZone(player)) {
      player.aggro = [];
      return;
    }
    const level = getLevel(player);
    const isNear = (enemy) => enemy.isAlive() && creatureBehavior(enemy.creature) !== 'pacifico' && getLevel(enemy) === level && enemy.isInDetectionRange(player.x, player.y);
    player.aggro = player.aggro.filter(isNear);
    for (const enemy of this.sim.enemies) {
      if (isNear(enemy) && !player.aggro.includes(enemy)) player.aggro.push(enemy);
    }
    if (!player.attackMode || player.target) return;
    const next = player.aggro.find(enemy => !this.isTargetLost(player, enemy));
    if (!next) return;
    player.target = next;
    player.autoFollow = player.followMode;
    console.log(`⚔️ Auto ataque: alvo ${next.id}`);
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
  // ser que o player esteja na zona segura ou o inimigo esteja fugindo. O
  // mago ataca de longe (rangedAttack); o pacífico nunca ataca.
  // player.isTarget: algum inimigo (não pacífico) o vê (marca vermelha no player).

  processEnemies(player, now) {
    if (this.sim.world.isInSafeZone(player)) {
      player.isTarget = false;
      return;
    }

    let anyEnemyInRange = false;

    for (const enemy of this.sim.enemies) {
      if (!enemy.isAlive() || creatureBehavior(enemy.creature) === 'pacifico') continue;
      if (!enemy.isInDetectionRange(player.x, player.y)) continue;
      anyEnemyInRange = true;

      const isAdjacent = isPositionAdjacentTo(enemy.x, enemy.y, player.x, player.y);
      const canReach = getLevel(enemy) === getLevel(player);
      const fleeing = enemy.ai && enemy.ai.state === AI_STATE.FLEE;
      if (!canReach || fleeing || !player.isAlive()) continue;
      if (creatureBehavior(enemy.creature) === 'mago') {
        this.rangedAttack(enemy, player, now);
      } else if (isAdjacent) {
        this.attackTarget(enemy, player, now);
      }
    }

    player.isTarget = anyEnemyInRange;
  }
}
