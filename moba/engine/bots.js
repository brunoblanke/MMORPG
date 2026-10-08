// moba/engine/bots.js

import { HEROES } from './config.js';
import { distance } from './geometry.js';
import { SPAWNS, structureLayout } from './map.js';
import { cast } from './abilities.js';
import { findEnemies, gap } from './combat.js';

const THINK_EVERY_TICKS = 6;

// ================================================================================================================================================================================================================================================
// runBots
// A cada THINK_EVERY_TICKS, cada herói que não é de um jogador decide o que fazer.

export function runBots(sim) {
  if (sim.tickCount % THINK_EVERY_TICKS !== 0) return;
  for (const hero of sim.heroes) if (!hero.human && hero.alive) think(sim, hero);
}

// ================================================================================================================================================================================================================================================
// reaches
// A habilidade (de dano) alcança o inimigo agora.

function reaches(hero, ability, enemy) {
  const range = distance(hero.x, hero.y, enemy.x, enemy.y);
  if (ability.kind === 'ball') return range - enemy.radius <= ability.range + ability.radius * 0.5;
  if (ability.kind === 'line') return range <= ability.length;
  if (ability.kind === 'cone') return range <= ability.length * 0.9;
  if (ability.kind === 'around') return gap(hero, enemy) <= ability.radius;
  if (ability.kind === 'dash') return range > 3 && range <= ability.distance + ability.radius;
  return false;
}

// ================================================================================================================================================================================================================================================
// useAbilities
// Lança o que está pronto: cura no aliado ferido (druid), o resto no inimigo que alcança (o herói antes do minion); haste pra perseguir.

function useAbilities(sim, hero, enemies) {
  const abilities = HEROES[hero.vocation].abilities;
  const wounded = sim.heroes.find(ally => ally.team === hero.team && ally.alive && ally.hp < ally.maxHp * 0.55 && distance(hero.x, hero.y, ally.x, ally.y) <= 7);
  abilities.forEach((ability, slot) => {
    if (sim.time < hero.cooldowns[slot] || hero.mana < ability.mana) return;
    if (ability.kind === 'heal') {
      if (wounded) cast(sim, hero, slot, wounded.x, wounded.y);
      return;
    }
    if (ability.kind === 'haste') {
      if (!hero.hasteUntil || sim.time >= hero.hasteUntil) {
        const heroNear = enemies.find(enemy => enemy.kind === 'hero' && gap(hero, enemy) < 10);
        if (heroNear) cast(sim, hero, slot, heroNear.x, heroNear.y);
      }
      return;
    }
    const heroTarget = enemies.find(enemy => enemy.kind === 'hero' && reaches(hero, ability, enemy));
    const groupTarget = ability.kind === 'around' || ability.kind === 'ball' || ability.kind === 'cone'
      ? enemies.filter(enemy => enemy.kind !== 'structure' && reaches(hero, ability, enemy))
      : [];
    const target = heroTarget || (groupTarget.length >= 3 ? groupTarget[0] : null);
    if (target) cast(sim, hero, slot, target.x, target.y);
  });
}

// ================================================================================================================================================================================================================================================
// pickTarget
// O alvo do ataque básico: herói quase morto, senão o minion mais perto, senão o herói, senão a estrutura (só no alcance).

function pickTarget(sim, hero, range) {
  const near = findEnemies(sim, hero, range);
  const weak = near.find(enemy => enemy.kind === 'hero' && enemy.hp < enemy.maxHp * 0.4);
  return weak || near.find(enemy => enemy.kind === 'minion') || near.find(enemy => enemy.kind === 'hero') || near[0] || null;
}

// ================================================================================================================================================================================================================================================
// stagingPoint
// Onde o herói fica: um pouco atrás do minion aliado mais adiantado; sem minions, na torre de fora.

function stagingPoint(sim, hero) {
  const direction = hero.team === 'blue' ? 1 : -1;
  const allies = sim.minions.filter(minion => minion.team === hero.team && minion.alive);
  const front = allies.sort((a, b) => (b.x - a.x) * direction)[0];
  const outer = structureLayout(hero.team).find(structure => structure.kind === 'tower' && structure.order === 0);
  const slot = sim.heroes.filter(item => item.team === hero.team).indexOf(hero);
  const spread = (slot - 1.5) * 1.2;
  if (front) return { x: front.x - direction * 2.5, y: 15 + spread };
  return { x: outer.x - direction * 2, y: 15 + spread };
}

// ================================================================================================================================================================================================================================================
// think
// Uma decisão: recuar com a vida baixa; senão lançar habilidades, escolher alvo e acompanhar a leva.

function think(sim, hero) {
  const stats = HEROES[hero.vocation];
  const enemies = findEnemies(sim, hero, 12);
  const spawn = SPAWNS[hero.team];
  const threatened = enemies.some(enemy => enemy.kind !== 'minion' && gap(hero, enemy) < 9);
  if (hero.hp < hero.maxHp * 0.3 && threatened) {
    hero.attackTargetId = null;
    hero.moveTarget = { x: spawn.x, y: spawn.y };
    return;
  }
  if (hero.hp < hero.maxHp * 0.7 && distance(hero.x, hero.y, spawn.x, spawn.y) < 7) {
    hero.attackTargetId = null;
    hero.moveTarget = null;
    return;
  }
  useAbilities(sim, hero, enemies);
  const target = pickTarget(sim, hero, stats.range + 1.5);
  if (target) {
    hero.attackTargetId = target.id;
    return;
  }
  hero.attackTargetId = null;
  hero.moveTarget = stagingPoint(sim, hero);
}
