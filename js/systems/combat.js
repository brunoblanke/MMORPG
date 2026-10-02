// js/systems/combat.js

import { isPositionAdjacentTo, distance } from '../utils/helpers.js';
import { getLevel } from '../core/geometry.js';
import { AI_STATE } from '../models/enemy.js';
import { creatureBehavior } from '../../shared/assets.js';
import { CONFIG } from '../config.js';
import { equipBonus, itemInfo } from '../../shared/items.js';
import { addSkillTry } from '../../shared/skills.js';

// Auto ataque: alvo sem caminho por UNREACHABLE_MS é largado e ignorado por SKIP_TARGET_MS.
export const UNREACHABLE_MS = 1500;
export const SKIP_TARGET_MS = 5000;

const FLOOR_DAMAGE_INTERVAL = 1000;

// Fórmula do Tibia (TFS 1.4), modo "balanced" (o padrão do cliente):
// golpe do player = 0..máximo (sorteio normal), com máximo =
// nível/5 + ((skill/4 + 1) × ataque/3 × 1,03) / 1,2 — sem arma, ataque 7 no
// fist. Criatura: 0..ataque dela. O golpe perde a defesa (entre metade e
// ela toda) e depois a armadura (entre metade e ela toda, menos 1).
// Defesa do player = (skill/4 + 2,23) × defesa do escudo (ou da arma, ou 7
// sem nada) × 0,15 (× 0,75 logo depois de atacar).
const ATTACK_FACTOR = 1.2;
const DEFENSE_FACTOR_AFTER_ATTACK = 0.75;
const FIST_ATTACK = 7;
const FIST_DEFENSE = 7;
const ARMOR_SLOTS = ['cabeca', 'amuleto', 'corpo', 'pernas', 'pes', 'anel'];

// ================================================================================================================================================================================================================================================
// normalRandom
// Inteiro entre min e max puxado pro meio (normal com média no centro), como
// o normal_random do Tibia.

function normalRandom(min, max) {
  let v;
  do {
    const u = 1 - Math.random();
    const w = Math.random();
    v = 0.5 + 0.25 * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w);
  } while (v < 0 || v > 1);
  return min + Math.round((max - min) * v);
}

// ================================================================================================================================================================================================================================================
// uniformRandom

function uniformRandom(min, max) {
  return max <= min ? min : min + Math.floor(Math.random() * (max - min + 1));
}

export class CombatController {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
  }

  // ================================================================================================================================================================================================================================================
  // maxDamage
  // O maior golpe possível: do player pela fórmula do Tibia (nível, skill da
  // arma na mão e ataque dela); da criatura, o ataque dela.

  maxDamage(attacker) {
    if (!attacker.isPlayer) return Math.max(0, attacker.atk || 0);
    const weapon = attacker.equip && attacker.equip.arma;
    const info = weapon ? itemInfo(weapon.type) : null;
    const skillKey = (info && info.weaponSkill) || 'fist';
    const skill = (attacker.skills && attacker.skills[skillKey] ? attacker.skills[skillKey].lvl : 10);
    const attack = info && info.weaponSkill ? info.atk : FIST_ATTACK;
    return Math.round(Math.floor(attacker.lvl / 5) + (((skill / 4) + 1) * (attack / 3) * 1.03) / ATTACK_FACTOR);
  }

  // ================================================================================================================================================================================================================================================
  // defenseOf
  // Defesa de quem apanha: da criatura, a do gerador; do player, a do escudo
  // (com shielding), senão a da arma (com o skill dela), senão 7 (fist).

  defenseOf(defender, now) {
    if (!defender.isPlayer) return Math.max(0, defender.defense ?? defender.def ?? 0);
    const equip = defender.equip || {};
    const skills = defender.skills || {};
    const weapon = equip.arma ? itemInfo(equip.arma.type) : null;
    const shield = equip.escudo ? itemInfo(equip.escudo.type) : null;
    let value = FIST_DEFENSE;
    let skill = skills.fist ? skills.fist.lvl : 10;
    if (weapon && weapon.weaponSkill) {
      value = weapon.def;
      skill = skills[weapon.weaponSkill] ? skills[weapon.weaponSkill].lvl : 10;
    }
    if (shield && shield.slot === 'escudo') {
      value = shield.def;
      skill = skills.shielding ? skills.shielding.lvl : 10;
    }
    const recentlyAttacked = now - (defender.lastAttackTime || 0) < CONFIG.attackCooldown;
    return Math.floor((skill / 4 + 2.23) * value * 0.15 * (recentlyAttacked ? DEFENSE_FACTOR_AFTER_ATTACK : 1));
  }

  // ================================================================================================================================================================================================================================================
  // armorOf
  // Armadura: da criatura, a do gerador; do player, a soma do que veste.

  armorOf(defender) {
    if (!defender.isPlayer) return Math.max(0, defender.def || 0);
    const equip = defender.equip || {};
    return ARMOR_SLOTS.reduce((sum, key) => sum + (equip[key] ? itemInfo(equip[key].type).def : 0), 0);
  }

  // ================================================================================================================================================================================================================================================
  // calculateDamage
  // Um golpe: sorteio de 0 ao máximo, menos a defesa (se o golpe é corpo a
  // corpo) e a armadura. Pode dar 0 (bloqueado).

  calculateDamage(attacker, defender, now = this.sim.time || 0, { melee = true } = {}) {
    let damage = normalRandom(0, this.maxDamage(attacker));
    if (melee && damage > 0) {
      const defense = this.defenseOf(defender, now);
      damage -= uniformRandom(Math.floor(defense / 2), defense);
    }
    if (damage > 0) {
      const armor = this.armorOf(defender);
      if (armor > 3) damage -= uniformRandom(Math.floor(armor / 2), armor - (armor % 2 + 1));
      else if (armor > 0) damage--;
    }
    return Math.max(0, damage);
  }

  // ================================================================================================================================================================================================================================================
  // attackTarget
  // Um golpe; bloqueado (0 de dano) vira o evento block (a fumacinha na tela).

  attackTarget(attacker, defender, now, { melee = true } = {}) {
    if (now - attacker.lastAttackTime < CONFIG.attackCooldown) return false;
    if (!defender.isAlive()) return false;

    const damage = this.calculateDamage(attacker, defender, now, { melee });
    attacker.lastAttackTime = now;
    if (attacker.isPlayer) this.trainSkill(attacker, equipBonus(attacker.equip).atkSkill);
    if (defender.isPlayer && defender.equip && defender.equip.escudo && itemInfo(defender.equip.escudo.type).slot === 'escudo') {
      this.trainSkill(defender, 'shielding');
    }
    if (damage <= 0) {
      this.sim.emit({ type: 'block', targetId: defender.id, x: defender.x, y: defender.y });
      return defender.currentHp;
    }
    if (attacker.isPlayer && !defender.isPlayer) this.recordDamage(defender, attacker, Math.min(damage, defender.currentHp));
    const hpLeft = defender.takeDamage(damage, now);
    this.sim.emit({ type: 'damage', targetId: defender.id, x: defender.x, y: defender.y, amount: damage });
    return hpLeft;
  }

  // ================================================================================================================================================================================================================================================
  // recordDamage
  // Quanto de vida cada player tirou da criatura (pra dividir a XP na morte).

  recordDamage(creature, player, amount) {
    if (amount <= 0) return;
    if (!creature.damageBy) creature.damageBy = new Map();
    creature.damageBy.set(player.id, (creature.damageBy.get(player.id) || 0) + amount);
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
    this.attackTarget(enemy, player, now, { melee: false });
  }

  // ================================================================================================================================================================================================================================================
  // trainSkill
  // Um uso do skill (golpe com a arma, ataque recebido com escudo; o magic
  // level sobe com magia, em spells.js). Avisa quando sobe de nível.

  trainSkill(player, key) {
    if (!player.skills || key === 'magic') return;
    if (!addSkillTry(player.skills, key, player.vocation)) return;
    const names = { fist: 'Fist', club: 'Club', sword: 'Sword', axe: 'Axe', distance: 'Distance', shielding: 'Shielding', fishing: 'Fishing' };
    this.sim.emit({ type: 'message', playerId: player.id, text: `Você avançou em ${names[key]} (${player.skills[key].lvl}).`, kind: 'info' });
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
  //   perdeu o alvo (outro andar ou longe demais) → larga o alvo;
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
      return;
    }

    if (isPositionAdjacentTo(player.x, player.y, target.x, target.y)) {
      player.unreachableSince = null;
      this.attackTarget(player, target, now);
    } else if (player.autoFollow && !this.sim.control.isWalking(player)) {
      const searchBounds = this.sim.searchBoundsAround(player);
      const reachable = this.sim.movement.moveTowardsPosition(player, target.x, target.y, now, target, searchBounds, this.sim.enemies);
      this.checkUnreachable(player, target, reachable, now);
    }
  }

  // ================================================================================================================================================================================================================================================
  // checkUnreachable
  // Com o auto ataque ligado, alvo sem caminho até ele por UNREACHABLE_MS
  // (fugiu pra onde não dá pra chegar) é largado e ignorado por
  // SKIP_TARGET_MS: o auto ataque passa pro próximo da fila.

  checkUnreachable(player, target, reachable, now) {
    if (reachable || !player.attackMode) {
      player.unreachableSince = null;
      return;
    }
    if (player.unreachableSince == null) player.unreachableSince = now;
    if (now - player.unreachableSince < UNREACHABLE_MS) return;
    player.unreachableSince = null;
    player.skipTarget = { id: target.id, until: now + SKIP_TARGET_MS };
    player.target = null;
  }

  // ================================================================================================================================================================================================================================================
  // updateAutoAttack
  // Fila de inimigos que chegaram perto (entraram no raio de detecção, no
  // mesmo andar), na ordem em que chegaram; quem morre ou se afasta sai dela.
  // Criatura pacífica não entra (não ameaça: só vira alvo clicando nela).
  // No auto ataque, o alvo é o inimigo da fila mais perto do player: se outro
  // ficar mais perto (o alvo fugiu, outro encostou), troca — menos seguindo o
  // alvo com caminho até ele (sem caminho, checkUnreachable o larga). Na
  // zona segura não há fila.

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
    if (!player.attackMode) return;
    const skip = player.skipTarget && this.sim.time < player.skipTarget.until ? player.skipTarget.id : null;
    const gap = (enemy) => Math.max(Math.abs(enemy.x - player.x), Math.abs(enemy.y - player.y));
    let next = null;
    for (const enemy of player.aggro) {
      if (enemy.id === skip || this.isTargetLost(player, enemy)) continue;
      if (!next || gap(enemy) < gap(next)) next = enemy;
    }
    const current = player.target;
    if (!next || next === current) return;
    if (current && current.isAlive() && (player.autoFollow || gap(current) <= gap(next))) return;
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
