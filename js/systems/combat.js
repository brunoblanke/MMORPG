// js/systems/combat.js

import { isPositionAdjacentTo, distance } from '../utils/helpers.js';
import { getLevel } from '../core/geometry.js';
import { AI_STATE } from '../models/enemy.js';
import { creatureBehavior, creaturePowers } from '../../shared/assets.js';
import { CONFIG } from '../config.js';
import { equipBonus, itemInfo, newItem } from '../../shared/items.js';
import { addSkillTry } from '../../shared/skills.js';
import { AMMO_CONDITIONS } from '../../shared/conditions.js';
import { WANDS, WAND_RANGE } from '../../shared/spells.js';
import { MISSILES } from '../../shared/effects.js';

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

// Distância: arma de disparo (arco, besta) atira a munição do espaço de
// munição até LAUNCHER_RANGE sqm; arma de arremesso (lança, de pilha) é
// jogada até THROWN_RANGE e cai no sqm do alvo. Cada tiro gasta uma
// unidade; acerta com DISTANCE_HIT_BASE + skill de distância (%), até
// DISTANCE_HIT_MAX. Não passa pela defesa, só pela armadura.
export const LAUNCHER_RANGE = 6;
export const THROWN_RANGE = 4;
const DISTANCE_HIT_BASE = 40;
const DISTANCE_HIT_MAX = 90;
const NO_AMMO_WARN_MS = 5000;

// Criatura com veneno no gerador: o golpe que acerta deixa envenenado
// (o veneno dela por vez, POISON_HIT_TICKS vezes).
const POISON_HIT_TICKS = 6;

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

  maxDamage(attacker, attackValue = null) {
    if (!attacker.isPlayer) return Math.max(0, attacker.atk || 0);
    const weapon = attacker.equip && attacker.equip.arma;
    const info = weapon ? itemInfo(weapon.type) : null;
    const skillKey = (info && info.weaponSkill) || 'fist';
    const skill = (attacker.skills && attacker.skills[skillKey] ? attacker.skills[skillKey].lvl : 10);
    const attack = attackValue ?? (info && info.weaponSkill ? info.atk : FIST_ATTACK);
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

  calculateDamage(attacker, defender, now = this.sim.time || 0, { melee = true, attack = null } = {}) {
    let damage = normalRandom(0, this.maxDamage(attacker, attack));
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

  attackTarget(attacker, defender, now, { melee = true, attack = null } = {}) {
    if (now - attacker.lastAttackTime < CONFIG.attackCooldown) return false;
    if (!defender.isAlive()) return false;

    this.markCombat(attacker, defender, now);
    const damage = this.calculateDamage(attacker, defender, now, { melee, attack });
    attacker.lastAttackTime = now;
    if (attacker.isPlayer) this.trainSkill(attacker, equipBonus(attacker.equip).atkSkill);
    if (defender.isPlayer && defender.equip && defender.equip.escudo && itemInfo(defender.equip.escudo.type).slot === 'escudo') {
      this.trainSkill(defender, 'shielding');
    }
    if (attacker.isPlayer && defender.isPlayer) this.sim.social.onPlayerAttack(attacker, defender, now);
    if (damage <= 0) return defender.currentHp;
    if (attacker.isPlayer && !defender.isPlayer) this.recordDamage(defender, attacker, Math.min(damage, defender.currentHp));
    const hpLeft = defender.takeDamage(damage, now);
    this.sim.emit({ type: 'damage', targetId: defender.id, x: defender.x, y: defender.y, z: defender.z || 0, amount: damage });
    const poison = attacker.isPlayer ? 0 : creaturePowers(attacker.creature).poison;
    if (poison && melee) this.sim.conditions.add(defender, 'poison', { damage: poison, ticks: POISON_HIT_TICKS });
    return hpLeft;
  }

  // ================================================================================================================================================================================================================================================
  // markCombat
  // Golpe dado ou levado: os players dessa luta ficam em combate (não saem do
  // jogo na hora; simulation.js → inCombat).

  markCombat(a, b, now) {
    if (a.isPlayer) a.lastCombatTime = now;
    if (b.isPlayer) b.lastCombatTime = now;
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
    this.sim.emit({ type: 'missile', fromX: enemy.x, fromY: enemy.y, toX: player.x, toY: player.y, z: enemy.z || 0 });
    this.attackTarget(enemy, player, now, { melee: false });
  }

  // ================================================================================================================================================================================================================================================
  // rangedWeapon
  // A arma de distância do player: { range, attack, ammoKey, thrown }, a
  // wand ou rod ({ range, wand }), ou { error } (sem munição; wand de outra
  // vocação, sem o nível ou sem mana), ou null (não é de distância).

  rangedWeapon(player) {
    const weapon = player.equip && player.equip.arma;
    const info = weapon ? itemInfo(weapon.type) : null;
    const wand = weapon ? WANDS[weapon.type] : null;
    if (wand) {
      if (!wand.vocations.includes(player.vocation)) return { error: `Só ${wand.vocations[0]} usa essa arma.` };
      if (player.lvl < wand.lvl) return { error: `Você precisa do nível ${wand.lvl} pra usar essa arma.` };
      if (player.mana < wand.mana) return { error: 'Você não tem mana suficiente.' };
      return { range: WAND_RANGE, wand };
    }
    if (!info || info.weaponSkill !== 'distance') return null;
    if (info.stack) return { range: THROWN_RANGE, attack: info.atk, ammoKey: 'arma', thrown: true };
    const ammo = player.equip.municao;
    const ammoInfo = ammo ? itemInfo(ammo.type) : null;
    if (!ammoInfo || ammoInfo.weaponSkill !== 'distance' || ammoInfo.slot !== 'municao') return { error: 'Você está sem munição.' };
    return { range: LAUNCHER_RANGE, attack: info.atk + ammoInfo.atk, ammoKey: 'municao', thrown: false };
  }

  // ================================================================================================================================================================================================================================================
  // canShoot
  // O alvo está no alcance da arma de distância, com linha livre de parede.

  canShoot(player, target, ranged) {
    if (!ranged || ranged.error) return false;
    const gap = Math.max(Math.abs(target.x - player.x), Math.abs(target.y - player.y));
    return gap <= ranged.range && this.sim.movement.hasLineOfSight(player, target);
  }

  // ================================================================================================================================================================================================================================================
  // shoot
  // Um tiro de distância: gasta uma unidade da munição (ou a lança, que cai
  // no sqm do alvo), treina distance e acerta pela chance do skill (a
  // flecha envenenada deixa o alvo envenenado).

  shoot(player, target, ranged, now) {
    if (now - player.lastAttackTime < CONFIG.attackCooldown || !target.isAlive()) return;
    if (ranged.wand) return this.zap(player, target, ranged.wand, now);
    const ammo = player.equip[ranged.ammoKey];
    ammo.count = (ammo.count || 1) - 1;
    if (ammo.count <= 0) player.equip[ranged.ammoKey] = null;
    const ammoName = ammo.type.split('/').pop();
    const kind = MISSILES[ammoName] ? ammoName : ranged.thrown ? 'spear' : 'arrow';
    this.sim.emit({ type: 'missile', fromX: player.x, fromY: player.y, toX: target.x, toY: target.y, z: player.z || 0, kind });
    if (ranged.thrown) {
      const inventory = this.sim.inventory;
      inventory.mergeGroundStack(inventory.spawnGroundItem(newItem(inventory.nextUid(), ammo.type, 1), target.x, target.y, target.z || 0));
    }
    const skill = player.skills && player.skills.distance ? player.skills.distance.lvl : 10;
    if (Math.random() * 100 < Math.min(DISTANCE_HIT_MAX, DISTANCE_HIT_BASE + skill)) {
      this.attackTarget(player, target, now, { melee: false, attack: ranged.attack });
      const effect = AMMO_CONDITIONS[ammo.type];
      if (effect) this.sim.conditions.add(target, effect.kind, { ...effect, source: player });
      return;
    }
    player.lastAttackTime = now;
    this.trainSkill(player, 'distance');
  }

  // ================================================================================================================================================================================================================================================
  // zap
  // Tiro de wand ou rod: gasta a mana dela (que treina o magic level) e fere
  // o alvo com o dano do tipo dela.

  zap(player, target, wand, now) {
    player.lastAttackTime = now;
    player.mana -= wand.mana;
    const spells = this.sim.spells;
    this.sim.emit({ type: 'missile', fromX: player.x, fromY: player.y, toX: target.x, toY: target.y, z: player.z || 0, kind: wand.element });
    spells.hurt(player, target, wand.min + Math.floor(Math.random() * (wand.max - wand.min + 1)), now, wand.element);
    spells.showEffect(target.x, target.y, wand.element, undefined, target.z || 0);
    if (addSkillTry(player.skills, 'magic', player.vocation, wand.mana)) {
      this.sim.emit({ type: 'message', playerId: player.id, text: `Você avançou para magic level ${player.skills.magic.lvl}.`, kind: 'info' });
    }
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
    this.sim.emit({ type: 'damage', targetId: player.id, x: player.x, y: player.y, z: player.z || 0, amount: damage });
  }

  // ================================================================================================================================================================================================================================================
  // processPlayer
  // Com alvo, o player está sempre num destes estados:
  //   perdeu o alvo (outro andar ou longe demais) → larga o alvo;
  //   colado no alvo → ataca (com arma de distância: no alcance dela, com
  //   linha livre; sem munição, avisa e não ataca);
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

    const ranged = this.rangedWeapon(player);
    const adjacent = isPositionAdjacentTo(player.x, player.y, target.x, target.y);
    if (ranged && ranged.error) {
      if (this.canShoot(player, target, { range: LAUNCHER_RANGE }) && now >= (player.noAmmoWarnAt || 0)) {
        player.noAmmoWarnAt = now + NO_AMMO_WARN_MS;
        this.sim.emit({ type: 'message', playerId: player.id, text: ranged.error, kind: 'warn' });
      }
    } else if (ranged && this.canShoot(player, target, ranged)) {
      player.unreachableSince = null;
      this.shoot(player, target, ranged, now);
    } else if (!ranged && adjacent) {
      player.unreachableSince = null;
      this.attackTarget(player, target, now);
    }
    if (!adjacent && player.autoFollow && !player.offline && !this.sim.control.isWalking(player)) {
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
  // Alvo em outro andar ou a mais de targetLoseRange sqms; player que não dá
  // mais pra atacar (saiu, entrou na zona segura, na mesma party).

  isTargetLost(player, target) {
    if (target.isPlayer && !this.sim.social.canAttack(player, target)) return true;
    if (getLevel(player) !== getLevel(target)) return true;
    return distance(player.x, player.y, target.x, target.y) > CONFIG.targetLoseRange;
  }

  // ================================================================================================================================================================================================================================================
  // processEnemies
  // Inimigo que vê o player e está colado nele, no mesmo andar, ataca — a não
  // ser que o player esteja na zona segura ou o inimigo esteja fugindo. O
  // mago ataca de longe (rangedAttack); o pacífico nunca ataca.
  // player.isTarget: algum inimigo está atacando ele (perseguindo, no mesmo
  // andar): a borda vermelha em volta do player.

  processEnemies(player, now) {
    if (this.sim.world.isInSafeZone(player)) {
      player.isTarget = false;
      return;
    }

    let attacked = false;

    for (const enemy of this.sim.enemies) {
      if (!enemy.isAlive() || creatureBehavior(enemy.creature) === 'pacifico') continue;
      if (!enemy.isInDetectionRange(player.x, player.y)) continue;

      const isAdjacent = isPositionAdjacentTo(enemy.x, enemy.y, player.x, player.y);
      const canReach = getLevel(enemy) === getLevel(player);
      const fleeing = enemy.ai && enemy.ai.state === AI_STATE.FLEE;
      if (!canReach || fleeing || !player.isAlive()) continue;
      if (enemy.ai.state === AI_STATE.CHASE && this.sim.closestPlayer(enemy) === player) attacked = true;
      if (creatureBehavior(enemy.creature) === 'mago') {
        this.rangedAttack(enemy, player, now);
      } else if (isAdjacent) {
        this.attackTarget(enemy, player, now);
      }
    }

    player.isTarget = attacked;
  }
}
