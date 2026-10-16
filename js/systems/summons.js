// js/systems/summons.js

import { getLevel } from '../core/geometry.js';
import { distance, isPositionAdjacentTo } from '../utils/helpers.js';

// Criaturas invocadas por player (utevo res): seguem quem invocou, atacam o alvo dele ou quem o ataca e somem
// com o tempo, quando ele morre ou sai do jogo. Os inimigos que elas feriram revidam nelas. Fora das regras
// dos inimigos (enemy.pet): não perseguem o dono, não dão loot nem XP (o dano que causam conta pro dono).

export const SUMMON_LIMIT = 2;
export const SUMMON_MS = 5 * 60 * 1000;
export const SUMMON_REACH = 7;
export const SUMMON_FOLLOW = 2;
export const SUMMON_LEASH = 14;
export const SUMMON_AGGRO_MS = 8000;

export class SummonController {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
  }

  // ================================================================================================================================================================================================================================================
  // call
  // Invoca a criatura colada no player. Devolve false se já tem SUMMON_LIMIT ou não há sqm livre.

  call(player, creature) {
    const minion = this.sim.powers.summon(player, { type: creature, max: SUMMON_LIMIT });
    if (!minion) return false;
    minion.pet = true;
    minion.summonUntil = (this.sim.time || 0) + SUMMON_MS;
    this.sim.spells.showEffect(minion.x, minion.y, 'magic-red', undefined, minion.z || 0);
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // count
  // Quantas invocadas vivas o player tem.

  count(player) {
    return this.sim.enemies.filter(e => e.pet && e.summonedBy === player.id && e.isAlive()).length;
  }

  // ================================================================================================================================================================================================================================================
  // dismiss
  // Some com a invocada sem cadáver.

  dismiss(pet) {
    this.sim.spells.showEffect(pet.x, pet.y, 'poff', undefined, pet.z || 0);
    this.sim.world.removeCreature(pet);
    const index = this.sim.enemies.indexOf(pet);
    if (index > -1) this.sim.enemies.splice(index, 1);
    for (const player of this.sim.players) {
      if (player.target === pet) player.target = null;
    }
  }

  // ================================================================================================================================================================================================================================================
  // update
  // Um tick da invocada: some se o tempo acabou ou o dono morreu/saiu; senão ataca o alvo do dono (ou o
  // inimigo que o persegue) ou segue o dono. Os inimigos que ela feriu revidam.

  update(pet, now) {
    const master = this.sim.getPlayer(pet.summonedBy);
    if (!pet.isAlive()) return;
    if (!master || !master.isAlive() || master.offline || now >= pet.summonUntil) {
      this.dismiss(pet);
      return;
    }
    const level = getLevel(pet);
    if (level !== getLevel(master) || distance(pet.x, pet.y, master.x, master.y) > SUMMON_LEASH) {
      this.bringBack(pet, master);
      return;
    }
    this.retaliate(pet, now);
    const target = this.targetOf(pet, master);
    const enemies = this.sim.enemies;
    if (!target) {
      if (distance(pet.x, pet.y, master.x, master.y) > SUMMON_FOLLOW) this.sim.movement.moveTowardsPosition(pet, master.x, master.y, now, master, null, enemies);
      return;
    }
    if (!isPositionAdjacentTo(pet.x, pet.y, target.x, target.y)) {
      this.sim.movement.moveTowardsPosition(pet, target.x, target.y, now, target, null, enemies);
      return;
    }
    const before = target.currentHp;
    this.sim.combat.attackTarget(pet, target, now);
    if (before > target.currentHp) this.sim.combat.recordDamage(target, master, before - target.currentHp);
    this.sim.combat.markCombat(master, target, now);
    target.petAggro = { id: pet.id, until: now + SUMMON_AGGRO_MS };
  }

  // ================================================================================================================================================================================================================================================
  // targetOf
  // O alvo do dono, se é inimigo ao alcance; senão o inimigo mais perto que persegue o dono.

  targetOf(pet, master) {
    const level = getLevel(pet);
    const valid = (enemy) => enemy && !enemy.isPlayer && enemy.isAlive() && !enemy.pet && getLevel(enemy) === level && !this.sim.world.isInSafeZone(enemy);
    if (valid(master.target) && distance(pet.x, pet.y, master.target.x, master.target.y) <= SUMMON_REACH) return master.target;
    let best = null;
    for (const enemy of this.sim.enemies) {
      if (!valid(enemy) || !enemy.ai || enemy.ai.state !== 'chase' || distance(enemy.x, enemy.y, master.x, master.y) > 3) continue;
      if (!best || distance(enemy.x, enemy.y, pet.x, pet.y) < distance(best.x, best.y, pet.x, pet.y)) best = enemy;
    }
    return best;
  }

  // ================================================================================================================================================================================================================================================
  // retaliate
  // Os inimigos colados na invocada que ela feriu há pouco batem nela.

  retaliate(pet, now) {
    for (const enemy of this.sim.enemies) {
      const aggro = enemy.petAggro;
      if (!aggro || aggro.id !== pet.id || now >= aggro.until || !enemy.isAlive() || enemy.pet) continue;
      if (isPositionAdjacentTo(enemy.x, enemy.y, pet.x, pet.y) && getLevel(enemy) === getLevel(pet)) this.sim.combat.attackTarget(enemy, pet, now);
    }
  }

  // ================================================================================================================================================================================================================================================
  // bringBack
  // Invocada que ficou pra trás (outro andar ou longe demais) aparece colada no dono.

  bringBack(pet, master) {
    const spot = this.sim.powers.freeSpotAround(master.x, master.y, master.z || 0);
    if (!spot) return;
    this.sim.world.moveEntityTile(pet, pet.x, pet.y, pet.z || 0, spot.x, spot.y, master.z || 0);
    Object.assign(pet, { x: spot.x, y: spot.y, z: master.z || 0, step: spot.step, isMoving: false });
    pet.route = { path: null, x: null, y: null };
  }
}
