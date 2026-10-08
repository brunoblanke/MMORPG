// moba/engine/abilities.js

import { HEROES } from './config.js';
import { normalize, distance, distanceToSegment, inCone } from './geometry.js';
import { dealDamage, heal, findEnemies, gap } from './combat.js';
import { abilityScale } from './stats.js';
import { resolveTerrain } from './movement.js';

// ================================================================================================================================================================================================================================================
// damageOf
// O dano (ou cura) da habilidade no nível do herói.

function damageOf(sim, ability, hero, key = 'damage') {
  return (ability[key] + (ability[`${key}PerLevel`] || 0) * (hero.level - 1)) * abilityScale(sim, hero, ability);
}

// ================================================================================================================================================================================================================================================
// hit
// Dano da habilidade em cada alvo da lista (com a lentidão, se ela tem).

function hit(sim, hero, ability, targets) {
  for (const target of targets) {
    dealDamage(sim, hero, target, damageOf(sim, ability, hero), ability.element);
    if (ability.stun && target.kind !== 'structure' && target.alive) target.stunUntil = sim.time + ability.stun;
    if (ability.slow && target.kind === 'hero' && target.alive) {
      target.slowFactor = ability.slow.factor;
      target.slowUntil = sim.time + ability.slow.seconds;
    }
  }
}

// ================================================================================================================================================================================================================================================
// enemiesIn
// Os inimigos que passam no teste (a função recebe cada um).

function enemiesIn(sim, hero, test) {
  return findEnemies(sim, hero, 40).filter(test);
}

// ================================================================================================================================================================================================================================================
// aimOf
// A direção unitária do herói até o ponto mirado (a de frente, se o ponto é o próprio herói).

function aimOf(hero, tx, ty) {
  const aim = normalize(tx - hero.x, ty - hero.y);
  return aim.x === 0 && aim.y === 0 ? hero.facing : aim;
}

// ================================================================================================================================================================================================================================================
// cast
// Lança a habilidade slot (0, 1 ou 2) do herói na direção do ponto (tx, ty). Devolve false se não deu (morto, em espera, sem mana).

export function cast(sim, hero, slot, tx, ty) {
  const ability = HEROES[hero.vocation].abilities[slot];
  if (!ability || !hero.alive || sim.time < hero.cooldowns[slot] || sim.time < hero.stunUntil || hero.mana < ability.mana) return false;
  if (ability.unlock && hero.level < ability.unlock) return false;
  const aim = aimOf(hero, tx, ty);
  const done = RUNNERS[ability.kind](sim, hero, ability, aim, tx, ty);
  if (done === false) return false;
  hero.mana -= ability.mana;
  hero.cooldowns[slot] = sim.time + ability.cooldown;
  hero.facing = aim;
  sim.emit({ type: 'cast', heroId: hero.id, slot, name: ability.name });
  return true;
}

const RUNNERS = {
  massHeal(sim, hero, ability) {
    const allies = sim.heroes.filter(ally => ally.team === hero.team && ally.alive && distance(hero.x, hero.y, ally.x, ally.y) <= ability.radius);
    for (const ally of allies) {
      heal(sim, ally, damageOf(sim, ability, hero, 'amount'));
      sim.emit({ type: 'effect', name: ability.effect, x: ally.x, y: ally.y, radius: 1 });
    }
  },

  around(sim, hero, ability) {
    sim.emit({ type: 'effect', name: ability.effect, x: hero.x, y: hero.y, radius: ability.radius });
    hit(sim, hero, ability, enemiesIn(sim, hero, enemy => gap(hero, enemy) <= ability.radius));
  },

  dash(sim, hero, ability, aim) {
    for (let travelled = 0; travelled < ability.distance; travelled += 0.5) {
      hero.x += aim.x * 0.5;
      hero.y += aim.y * 0.5;
      resolveTerrain(sim, hero);
    }
    sim.emit({ type: 'effect', name: ability.effect, x: hero.x, y: hero.y, radius: ability.radius });
    hit(sim, hero, ability, enemiesIn(sim, hero, enemy => gap(hero, enemy) <= ability.radius));
  },

  haste(sim, hero, ability) {
    hero.hasteFactor = ability.factor;
    hero.hasteUntil = sim.time + ability.seconds;
    sim.emit({ type: 'effect', name: ability.effect, x: hero.x, y: hero.y, radius: 1 });
  },

  line(sim, hero, ability, aim) {
    const endX = hero.x + aim.x * ability.length;
    const endY = hero.y + aim.y * ability.length;
    sim.emit({ type: 'missile', kind: ability.missile, fromX: hero.x, fromY: hero.y, toX: endX, toY: endY });
    hit(sim, hero, ability, enemiesIn(sim, hero, enemy => distanceToSegment(enemy.x, enemy.y, hero.x, hero.y, endX, endY).distance <= ability.width / 2 + enemy.radius));
  },

  ball(sim, hero, ability, aim, tx, ty) {
    const reach = Math.min(ability.range, distance(hero.x, hero.y, tx, ty));
    const x = hero.x + aim.x * reach;
    const y = hero.y + aim.y * reach;
    sim.emit({ type: 'missile', kind: ability.missile, fromX: hero.x, fromY: hero.y, toX: x, toY: y });
    sim.emit({ type: 'effect', name: ability.effect, x, y, radius: ability.radius });
    hit(sim, hero, ability, enemiesIn(sim, hero, enemy => distance(x, y, enemy.x, enemy.y) - enemy.radius <= ability.radius));
  },

  cone(sim, hero, ability, aim) {
    sim.emit({ type: 'effect', name: ability.effect, x: hero.x, y: hero.y, radius: ability.length, dirX: aim.x, dirY: aim.y, cone: true });
    hit(sim, hero, ability, enemiesIn(sim, hero, enemy => inCone(hero.x, hero.y, aim.x, aim.y, ability.length, ability.halfAngle, enemy.x, enemy.y, enemy.radius)));
  },

  heal(sim, hero, ability, aim, tx, ty) {
    const allies = sim.heroes.filter(ally => ally.team === hero.team && ally.alive && distance(hero.x, hero.y, ally.x, ally.y) <= ability.range);
    const target = allies.sort((a, b) => distance(a.x, a.y, tx, ty) - distance(b.x, b.y, tx, ty))[0] || hero;
    heal(sim, target, damageOf(sim, ability, hero, 'amount'));
    sim.emit({ type: 'effect', name: ability.effect, x: target.x, y: target.y, radius: 1 });
  }
};

