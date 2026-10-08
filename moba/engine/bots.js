// moba/engine/bots.js

import { HEROES, ITEMS, MAX_ITEMS } from './config.js';
import { distance } from './geometry.js';
import { SPAWNS, structureLayout, LANE_Y } from './map.js';
import { cast } from './abilities.js';
import { findEnemies, gap, inFountain } from './combat.js';
import { buy, usePotion } from './shop.js';

const THINK_EVERY_TICKS = 6;
const BUILDS = {
  knight: ['boots-of-haste', 'giant-sword', 'crown-armor', 'dragon-shield', 'fire-axe'],
  paladin: ['short-sword', 'boots-of-haste', 'might-ring', 'giant-sword', 'crown-helmet'],
  sorcerer: ['spellbook', 'boots-of-haste', 'wand-of-inferno', 'blue-robe', 'life-ring'],
  druid: ['spellbook', 'life-ring', 'boots-of-haste', 'wand-of-inferno', 'stone-skin-amulet']
};

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
    if (ability.kind === 'massHeal') {
      const hurt = sim.heroes.filter(ally => ally.team === hero.team && ally.alive && ally.hp < ally.maxHp * 0.6 && distance(hero.x, hero.y, ally.x, ally.y) <= ability.radius);
      if (hurt.length >= 2) cast(sim, hero, slot, hero.x, hero.y);
      return;
    }
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
    const groupTarget = !ability.unlock && (ability.kind === 'around' || ability.kind === 'ball' || ability.kind === 'cone')
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
  const near = findEnemies(sim, hero, range).filter(enemy => enemy.kind !== 'neutral');
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
  if (front) return { x: front.x - direction * 2.5, y: LANE_Y + spread };
  return { x: outer.x - direction * 2, y: LANE_Y + spread };
}

// ================================================================================================================================================================================================================================================
// nextPurchase
// O próximo equipamento da build que o herói ainda não tem (ou null se a mochila está cheia).

function nextPurchase(hero) {
  if (hero.items.length >= MAX_ITEMS) return null;
  return BUILDS[hero.vocation].find(id => !hero.items.includes(id)) || null;
}

// ================================================================================================================================================================================================================================================
// shop
// Na fonte: compra o que a build pede e poções de vida (até 2). Devolve se comprou algo.

function shop(sim, hero) {
  let bought = false;
  for (let step = 0; step < 6; step++) {
    const potions = hero.items.filter(id => id === 'health-potion').length;
    const next = nextPurchase(hero);
    if (next && buy(sim, hero, next)) bought = true;
    else if (potions < 2 && hero.items.length < MAX_ITEMS - 1 && buy(sim, hero, 'health-potion')) bought = true;
    else break;
  }
  return bought;
}

// ================================================================================================================================================================================================================================================
// drink
// Bebe poção de vida (ou de mana, pros magos) quando precisa.

function drink(sim, hero) {
  const health = hero.items.indexOf('health-potion');
  const mana = hero.items.indexOf('mana-potion');
  if (health >= 0 && hero.hp < hero.maxHp * 0.4) usePotion(sim, hero, health);
  else if (mana >= 0 && hero.mana < hero.maxMana * 0.2) usePotion(sim, hero, mana);
}

// ================================================================================================================================================================================================================================================
// jungleTarget
// O knight caça os acampamentos do próprio lado (sem os bosses) enquanto estiver forte e sem herói inimigo por perto.

function jungleTarget(sim, hero, enemies) {
  if (hero.vocation !== 'knight' || hero.level > 8 || hero.hp < hero.maxHp * 0.6 || enemies.some(enemy => enemy.kind === 'hero')) return null;
  const mine = (neutral) => (hero.team === 'blue' ? neutral.x < 60 : neutral.x > 60);
  return sim.neutrals.filter(neutral => neutral.alive && !neutral.boss && mine(neutral))
    .sort((a, b) => distance(hero.x, hero.y, a.x, a.y) - distance(hero.x, hero.y, b.x, b.y))[0] || null;
}

// ================================================================================================================================================================================================================================================
// think
// Uma decisão: poções e compras; recuar com a vida baixa ou pra gastar o ouro; senão lançar habilidades, caçar a selva (knight), escolher alvo e acompanhar a leva.

function think(sim, hero) {
  const stats = HEROES[hero.vocation];
  const around = findEnemies(sim, hero, 12);
  const enemies = around.filter(enemy => enemy.kind !== 'neutral');
  const provoked = around.some(enemy => enemy.kind === 'neutral' && enemy.targetId === hero.id);
  const spawn = SPAWNS[hero.team];
  const threatened = provoked || enemies.some(enemy => enemy.kind !== 'minion' && gap(hero, enemy) < 9);
  drink(sim, hero);
  if (inFountain(hero)) shop(sim, hero);
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
  const next = nextPurchase(hero);
  const wantsShop = next && hero.gold >= ITEMS[next].cost && !threatened && !enemies.some(enemy => enemy.kind === 'hero');
  if (wantsShop && !inFountain(hero)) {
    hero.attackTargetId = null;
    hero.moveTarget = { x: spawn.x, y: spawn.y };
    return;
  }
  useAbilities(sim, hero, enemies);
  const target = pickTarget(sim, hero, stats.range + 1.5);
  if (target) {
    hero.attackTargetId = target.id;
    return;
  }
  const camp = jungleTarget(sim, hero, enemies);
  if (camp) {
    hero.attackTargetId = camp.id;
    return;
  }
  hero.attackTargetId = null;
  hero.moveTarget = stagingPoint(sim, hero);
}
