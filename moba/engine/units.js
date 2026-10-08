// moba/engine/units.js

import { HEROES, MINIONS, STRUCTURES, MAX_LEVEL, GOLD } from './config.js';
import { SPAWNS } from './map.js';

// ================================================================================================================================================================================================================================================
// heroStat
// Um número do herói no nível level: base + crescimento por nível.

export function heroStat(vocation, key, level) {
  const hero = HEROES[vocation];
  return hero[key] + (hero[`${key}PerLevel`] || 0) * (level - 1);
}

// ================================================================================================================================================================================================================================================
// xpToLevel
// O XP que falta pra subir do nível level pro seguinte.

export function xpToLevel(level) {
  return 100 + 60 * (level - 1);
}

// ================================================================================================================================================================================================================================================
// createHero
// O herói de uma vocação num time, parado na fonte da base, com os 3 poderes prontos.

export function createHero(id, team, vocation, offset = 0) {
  const stats = HEROES[vocation];
  const spawn = SPAWNS[team];
  return {
    id, kind: 'hero', team, vocation, human: false, alive: true,
    x: spawn.x, y: spawn.y + offset, radius: stats.radius, facing: { x: team === 'blue' ? 1 : -1, y: 0 },
    level: 1, xp: 0, gold: GOLD.start, kills: 0, deaths: 0,
    hp: stats.hp, maxHp: stats.hp, mana: stats.mana, maxMana: stats.mana, armor: stats.armor, magicResist: stats.magicResist,
    cooldowns: stats.abilities.map(() => 0), attackReadyAt: 0, respawnAt: 0,
    moveTarget: null, attackTargetId: null, slowUntil: 0, slowFactor: 1, hasteUntil: 0, hasteFactor: 1
  };
}

// ================================================================================================================================================================================================================================================
// applyLevel
// Recalcula vida e mana máximas do nível atual, mantendo a mesma fração de cada uma.

export function applyLevel(hero) {
  const hpFraction = hero.hp / hero.maxHp;
  const manaFraction = hero.mana / hero.maxMana;
  hero.maxHp = Math.round(heroStat(hero.vocation, 'hp', hero.level));
  hero.maxMana = Math.round(heroStat(hero.vocation, 'mana', hero.level));
  hero.hp = Math.round(hero.maxHp * hpFraction);
  hero.mana = Math.round(hero.maxMana * manaFraction);
}

// ================================================================================================================================================================================================================================================
// grantXp
// Dá XP ao herói e sobe de nível (até MAX_LEVEL).

export function grantXp(hero, amount) {
  if (hero.level >= MAX_LEVEL) return;
  hero.xp += amount;
  while (hero.level < MAX_LEVEL && hero.xp >= xpToLevel(hero.level)) {
    hero.xp -= xpToLevel(hero.level);
    hero.level++;
    applyLevel(hero);
  }
}

// ================================================================================================================================================================================================================================================
// createMinion
// Um minion (melee ou ranged) na base do time, seguindo a lane.

export function createMinion(id, team, type, offset = 0) {
  const stats = MINIONS[type];
  const spawn = SPAWNS[team];
  return {
    id, kind: 'minion', team, type, alive: true, x: spawn.x + (team === 'blue' ? 3 : -3), y: spawn.y + offset, radius: stats.radius,
    hp: stats.hp, maxHp: stats.hp, armor: stats.armor, magicResist: 0, pathIndex: 0, targetId: null, attackReadyAt: 0, nextThinkAt: 0
  };
}

// ================================================================================================================================================================================================================================================
// createStructure
// Uma torre ou o nexus (a ordem decide quando ele pode ser atacado).

export function createStructure(spec) {
  const stats = STRUCTURES[spec.kind];
  return {
    id: spec.id, kind: 'structure', structure: spec.kind, team: spec.team, order: spec.order, alive: true,
    x: spec.x, y: spec.y, radius: stats.radius, hp: stats.hp, maxHp: stats.hp, armor: stats.armor, magicResist: 0, attackReadyAt: 0
  };
}
