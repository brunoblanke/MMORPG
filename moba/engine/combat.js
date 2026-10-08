// moba/engine/combat.js

import { GOLD, XP, RESPAWN, FOUNTAIN } from './config.js';
import { distance } from './geometry.js';
import { grantXp } from './units.js';
import { SPAWNS } from './map.js';

// ================================================================================================================================================================================================================================================
// isTargetable
// Estrutura só pode ser atacada quando as de fora do time dela já caíram.

export function isTargetable(sim, unit) {
  if (!unit.alive) return false;
  if (unit.kind !== 'structure') return true;
  return !sim.structures.some(other => other.team === unit.team && other.alive && other.order < unit.order);
}

// ================================================================================================================================================================================================================================================
// gap
// A folga entre as bordas de dois círculos (negativa se encostam).

export function gap(a, b) {
  return distance(a.x, a.y, b.x, b.y) - a.radius - b.radius;
}

// ================================================================================================================================================================================================================================================
// findEnemies
// Os inimigos vivos e atacáveis a até range da borda de unit, do mais perto pro mais longe.

export function findEnemies(sim, unit, range) {
  return sim.units().filter(other => other.team !== unit.team && isTargetable(sim, other) && gap(unit, other) <= range)
    .sort((a, b) => gap(unit, a) - gap(unit, b));
}

// ================================================================================================================================================================================================================================================
// dealDamage
// O dano depois da armadura (físico) ou da resistência mágica; mostra o número e mata se a vida acaba.

export function dealDamage(sim, source, target, amount, element = 'physical') {
  if (!isTargetable(sim, target)) return 0;
  const defense = element === 'physical' ? target.armor : target.magicResist;
  const dealt = Math.max(1, Math.round(amount * 100 / (100 + defense)));
  target.hp -= dealt;
  sim.emit({ type: 'damage', x: target.x, y: target.y, amount: dealt, element, targetId: target.id });
  if (target.hp <= 0) kill(sim, source, target);
  return dealt;
}

// ================================================================================================================================================================================================================================================
// heal
// Cura o herói (até a vida máxima) e mostra o número.

export function heal(sim, hero, amount) {
  const healed = Math.min(hero.maxHp - hero.hp, Math.round(amount));
  hero.hp += healed;
  if (healed > 0) sim.emit({ type: 'heal', x: hero.x, y: hero.y, amount: healed, targetId: hero.id });
  return healed;
}

// ================================================================================================================================================================================================================================================
// heroesNear
// Os heróis vivos do time (sem contar os de fora do raio de XP) perto de (x, y).

function heroesNear(sim, team, x, y) {
  return sim.heroes.filter(hero => hero.team === team && hero.alive && distance(hero.x, hero.y, x, y) <= XP.shareRadius);
}

// ================================================================================================================================================================================================================================================
// kill
// A unidade morreu: recompensas (ouro e XP), respawn do herói e fim da partida se for o nexus.

export function kill(sim, source, target) {
  target.alive = false;
  target.hp = 0;
  const enemyTeam = target.team === 'blue' ? 'red' : 'blue';
  sim.emit({ type: 'death', x: target.x, y: target.y, targetId: target.id, kind: target.kind });
  if (target.kind === 'minion') {
    if (source && source.kind === 'hero') source.gold += GOLD.minion;
    const near = heroesNear(sim, enemyTeam, target.x, target.y);
    for (const hero of near) grantXp(hero, XP.minion / near.length);
  } else if (target.kind === 'hero') {
    target.deaths++;
    target.respawnAt = sim.time + RESPAWN.base + RESPAWN.perLevel * target.level;
    target.moveTarget = null;
    target.attackTargetId = null;
    if (source && source.kind === 'hero') {
      source.kills++;
      source.gold += GOLD.hero;
    }
    const near = heroesNear(sim, enemyTeam, target.x, target.y);
    for (const hero of near) grantXp(hero, (XP.hero * target.level) / near.length);
  } else {
    for (const hero of sim.heroes) if (hero.team === enemyTeam) hero.gold += GOLD.tower;
    if (target.structure === 'nexus') {
      sim.over = true;
      sim.winner = enemyTeam;
      sim.emit({ type: 'victory', team: enemyTeam });
    }
  }
}

// ================================================================================================================================================================================================================================================
// respawnHero
// O herói volta na fonte da base, com vida e mana cheias.

export function respawnHero(sim, hero) {
  const spawn = SPAWNS[hero.team];
  hero.alive = true;
  hero.hp = hero.maxHp;
  hero.mana = hero.maxMana;
  hero.x = spawn.x;
  hero.y = spawn.y;
  hero.moveTarget = null;
  hero.attackTargetId = null;
  hero.slowUntil = 0;
  hero.hasteUntil = 0;
  sim.emit({ type: 'respawn', x: hero.x, y: hero.y, targetId: hero.id });
}

// ================================================================================================================================================================================================================================================
// inFountain
// O herói está na fonte da própria base (regenera rápido).

export function inFountain(hero) {
  const spawn = SPAWNS[hero.team];
  return distance(hero.x, hero.y, spawn.x, spawn.y) <= FOUNTAIN.radius;
}

// ================================================================================================================================================================================================================================================
// attack
// Um ataque básico de attacker em target: dano na hora e, se tem projétil, o desenho dele.

export function attack(sim, attacker, target, damage, cooldown, missile, element = 'physical') {
  attacker.attackReadyAt = sim.time + cooldown;
  if (missile) sim.emit({ type: 'missile', kind: missile, fromX: attacker.x, fromY: attacker.y, toX: target.x, toY: target.y });
  else sim.emit({ type: 'swing', x: attacker.x, y: attacker.y, toX: target.x, toY: target.y });
  dealDamage(sim, attacker, target, damage, element);
}
