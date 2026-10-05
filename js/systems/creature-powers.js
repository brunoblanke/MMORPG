// js/systems/creature-powers.js

import { Enemy, AI_STATE } from '../models/enemy.js';
import { getLevel } from '../core/geometry.js';
import { creaturePowers } from '../../shared/assets.js';
import { CONFIG } from '../config.js';
import { EFFECTS } from '../../shared/effects.js';

// O que a criatura faz além do golpe (shared/assets.js → creaturePowers),
// enquanto persegue um player no mesmo andar e fora da zona segura:
//   magia: a cada POWER_TRY_MS, com a chance dela, lança no player até
//   CONFIG.mageRange sqm com linha livre (dano do tipo, sem defesa nem
//   armadura; a de veneno deixa o player envenenado);
//   invocar: a cada POWER_TRY_MS, com SUMMON_CHANCE, chama a criatura dela
//   ao lado (até o máximo vivo). Invocada não dá XP nem loot, não renasce e
//   morre junto com quem invocou.
// O veneno do golpe fica no combate (combat.js).

export const POWER_TRY_MS = 2000;
export const SUMMON_CHANCE = 0.25;
const SPELL_POISON_TICKS = 5;

export class CreaturePowers {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
    this.summonCounter = 0;
  }

  // ================================================================================================================================================================================================================================================
  // update

  update(enemy, player, now) {
    if (!enemy.isAlive() || !player || !player.isAlive()) return;
    if (!enemy.ai || enemy.ai.state !== AI_STATE.CHASE || getLevel(enemy) !== getLevel(player)) return;
    if (this.sim.world.isInSafeZone(player) || now < (enemy.powerReadyAt || 0)) return;
    enemy.powerReadyAt = now + POWER_TRY_MS;
    const powers = creaturePowers(enemy.creature);
    if (powers.summon && Math.random() < SUMMON_CHANCE) this.summon(enemy, powers.summon);
    if (powers.spell && Math.random() * 100 < powers.spell.chance) this.cast(enemy, player, powers.spell, now);
  }

  // ================================================================================================================================================================================================================================================
  // cast

  cast(enemy, player, spell, now) {
    const range = Math.max(Math.abs(enemy.x - player.x), Math.abs(enemy.y - player.y));
    if (range > CONFIG.mageRange || !this.sim.movement.hasLineOfSight(enemy, player)) return false;
    const damage = Math.ceil(spell.damage / 2) + Math.floor(Math.random() * (Math.floor(spell.damage / 2) + 1));
    this.sim.emit({ type: 'missile', fromX: enemy.x, fromY: enemy.y, toX: player.x, toY: player.y, kind: spell.kind });
    this.sim.conditions.hurt(player, damage, spell.kind);
    if (EFFECTS[spell.kind]) this.sim.emit({ type: 'effect', x: player.x, y: player.y, tiles: [[player.x, player.y]], effect: spell.kind });
    if (spell.kind === 'poison') this.sim.conditions.add(player, 'poison', { damage: Math.max(1, Math.floor(spell.damage / 4)), ticks: SPELL_POISON_TICKS });
    enemy.lastAttackTime = now;
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // summon
  // A criatura invocada nasce num sqm livre colado em quem invocou.

  summon(master, { type, max }) {
    const alive = this.sim.enemies.filter(e => e.summonedBy === master.id && e.isAlive()).length;
    if (alive >= max) return null;
    const z = master.z || 0;
    const spot = this.freeSpotAround(master.x, master.y, z);
    if (!spot) return null;
    this.summonCounter++;
    const minion = new Enemy({
      id: `${master.id}_inv${this.summonCounter}`,
      lvl: master.lvl,
      creature: type,
      type: 'enemy',
      x: spot.x,
      y: spot.y,
      z,
      step: spot.step,
      height: 1,
      summonedBy: master.id
    });
    minion.xp = 0;
    this.sim.enemies.push(minion);
    this.sim.world.addCreature(minion);
    return minion;
  }

  // ================================================================================================================================================================================================================================================
  // freeSpotAround

  freeSpotAround(x, y, z) {
    const world = this.sim.world;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const px = x + dx;
      const py = y + dy;
      if (!world.isInside(px, py) || world.isBlocked(px, py, z) || world.getTransitionAt(px, py, z) || world.isSafe(px, py, z)) continue;
      const step = world.getPassableStep(px, py, z);
      if (step !== null) return { x: px, y: py, step };
    }
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // dismissSummons
  // Quem invocou morreu: as invocadas dele morrem junto.

  dismissSummons(master) {
    for (const enemy of this.sim.enemies) {
      if (enemy.summonedBy === master.id) enemy.currentHp = 0;
    }
  }
}
