// moba/engine/heroes.js

import { HEROES, FOUNTAIN, GOLD } from './config.js';
import { attackOf, cooldownOf } from './stats.js';
import { moveToward, speedOf } from './movement.js';
import { isTargetable, gap, attack, respawnHero, inFountain } from './combat.js';

// ================================================================================================================================================================================================================================================
// updateHero
// Um herói: renasce se morreu e já deu o tempo; regenera; e anda ou ataca conforme a ordem dada (alvo de ataque ou ponto de destino).

export function updateHero(sim, hero, dt) {
  if (!hero.alive) {
    if (sim.time >= hero.respawnAt) respawnHero(sim, hero);
    return;
  }
  const stats = HEROES[hero.vocation];
  const boost = inFountain(hero) ? FOUNTAIN : null;
  hero.hp = Math.min(hero.maxHp, hero.hp + (boost ? boost.hpRegen : stats.hpRegen + hero.bonus.hpRegen) * dt);
  hero.mana = Math.min(hero.maxMana, hero.mana + (boost ? boost.manaRegen : stats.manaRegen) * dt);
  hero.gold += GOLD.perSecond * dt;
  if (sim.time < hero.stunUntil) return;
  const target = hero.attackTargetId ? sim.getUnit(hero.attackTargetId) : null;
  if (hero.attackTargetId && (!target || target.team === hero.team || !isTargetable(sim, target))) hero.attackTargetId = null;
  if (target && hero.attackTargetId) {
    if (gap(hero, target) <= stats.range) {
      hero.facing = { x: Math.sign(target.x - hero.x) || hero.facing.x, y: 0 };
      if (sim.time >= hero.attackReadyAt) attack(sim, hero, target, attackOf(sim, hero), cooldownOf(hero, stats.cooldown), stats.missile, stats.element);
    } else {
      moveToward(sim, hero, target.x, target.y, speedOf(sim, hero, stats.speed), dt);
    }
    return;
  }
  if (hero.moveTarget && moveToward(sim, hero, hero.moveTarget.x, hero.moveTarget.y, speedOf(sim, hero, stats.speed), dt)) hero.moveTarget = null;
}
