// js/systems/creature-powers.js

import { Enemy, AI_STATE } from '../models/enemy.js';
import { getLevel } from '../core/geometry.js';
import { creaturePowers } from '../../shared/assets.js';
import { CONFIG } from '../config.js';
import { EFFECTS } from '../../shared/effects.js';
import { circleArea } from '../../shared/spells.js';

// O que a criatura faz além do golpe (shared/assets.js → creaturePowers),
// enquanto persegue um player no mesmo andar e fora da zona segura:
//   magias: a cada POWER_TRY_MS, cada uma com a chance dela (no máximo uma de
//   dano por vez; dano do tipo, sem defesa nem armadura; a de veneno deixa o
//   player envenenado):
//     tiro: num player até o alcance (CONFIG.mageRange se não disser) com
//     linha livre;
//     bola: tiro que explode num círculo em volta do player, e acerta todo
//     player dentro dele;
//     onda: leque pra frente dela, nas 8 direções (comprimento e abertura), pra
//     quem está nele;
//     cura: recupera vida dela mesma (se estiver ferida), perseguindo ou fugindo.
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
    const state = enemy.ai && enemy.ai.state;
    if ((state !== AI_STATE.CHASE && state !== AI_STATE.FLEE) || getLevel(enemy) !== getLevel(player)) return;
    if (this.sim.world.isInSafeZone(player) || now < (enemy.powerReadyAt || 0)) return;
    enemy.powerReadyAt = now + POWER_TRY_MS;
    const powers = creaturePowers(enemy.creature);
    const chasing = state === AI_STATE.CHASE;
    if (chasing && powers.summon && Math.random() < SUMMON_CHANCE) this.summon(enemy, powers.summon);
    let attacked = false;
    for (const attack of powers.attacks) {
      if (Math.random() * 100 >= attack.chance) continue;
      if (attack.shape === 'heal') this.heal(enemy, attack);
      else if (chasing && !attacked) attacked = this.cast(enemy, player, attack, now);
    }
  }

  // ================================================================================================================================================================================================================================================
  // cast
  // Lança a magia no player; devolve se saiu (alcance, linha livre e área).

  cast(enemy, player, attack, now) {
    let tiles;
    if (attack.shape === 'wave') {
      tiles = this.waveTiles(enemy, player, attack);
      if (!tiles.some(([x, y]) => x === player.x && y === player.y)) return false;
    } else {
      const range = Math.max(Math.abs(enemy.x - player.x), Math.abs(enemy.y - player.y));
      if (range > (attack.range || CONFIG.mageRange) || !this.sim.movement.hasLineOfSight(enemy, player)) return false;
      this.sim.emit({ type: 'missile', fromX: enemy.x, fromY: enemy.y, toX: player.x, toY: player.y, z: enemy.z || 0, kind: attack.element });
      tiles = attack.shape === 'ball' ? this.ballTiles(enemy, player, attack.radius) : [[player.x, player.y]];
    }
    this.strike(enemy, tiles, attack);
    enemy.lastAttackTime = now;
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // ballTiles
  // O círculo de raio radius em volta do alvo, só o que a explosão alcança (sem
  // atravessar parede).

  ballTiles(enemy, center, radius) {
    const origin = { x: center.x, y: center.y, z: enemy.z || 0 };
    return circleArea(radius)
      .map(([dx, dy]) => [center.x + dx, center.y + dy])
      .filter(([x, y]) => this.sim.world.isInside(x, y) && this.sim.movement.hasLineOfSight(origin, { x, y }));
  }

  // ================================================================================================================================================================================================================================================
  // waveTiles
  // O leque pra frente, na direção (das 8) mais perto do player: de 1 sqm de
  // largura perto dela até 2 × abertura + 1 no fim do comprimento, sem
  // atravessar parede.

  waveTiles(enemy, player, attack) {
    const step = Math.round(Math.atan2(player.y - enemy.y, player.x - enemy.x) / (Math.PI / 4));
    const ux = Math.round(Math.cos(step * Math.PI / 4));
    const uy = Math.round(Math.sin(step * Math.PI / 4));
    const norm = ux * ux + uy * uy;
    const tiles = [];
    for (let ry = -attack.length; ry <= attack.length; ry++) {
      for (let rx = -attack.length; rx <= attack.length; rx++) {
        const along = (rx * ux + ry * uy) / norm;
        const across = Math.abs(rx * uy - ry * ux) / norm;
        if (along < 1 || along > attack.length || across > Math.min(attack.spread, Math.floor(along / 2)) + 0.5) continue;
        const x = enemy.x + rx;
        const y = enemy.y + ry;
        if (this.sim.world.isInside(x, y) && this.sim.movement.hasLineOfSight(enemy, { x, y })) tiles.push([x, y]);
      }
    }
    return tiles;
  }

  // ================================================================================================================================================================================================================================================
  // strike
  // Fere todo player vivo nos sqms (fora da zona segura) e mostra o efeito do tipo.

  strike(enemy, tiles, attack) {
    const z = enemy.z || 0;
    const keys = new Set(tiles.map(([x, y]) => `${x},${y}`));
    for (const target of this.sim.players) {
      if (!target.isAlive() || (target.z || 0) !== z || !keys.has(`${target.x},${target.y}`) || this.sim.world.isInSafeZone(target)) continue;
      this.sim.conditions.hurt(target, this.roll(attack), attack.element);
      if (attack.element === 'poison') this.sim.conditions.add(target, 'poison', { damage: Math.max(1, Math.floor(attack.max / 4)), ticks: SPELL_POISON_TICKS });
    }
    if (EFFECTS[attack.element]) this.sim.emit({ type: 'effect', x: enemy.x, y: enemy.y, z, tiles, effect: attack.element });
  }

  // ================================================================================================================================================================================================================================================
  // heal
  // A criatura ferida recupera vida.

  heal(enemy, attack) {
    if (enemy.currentHp >= enemy.hp) return;
    enemy.currentHp = Math.min(enemy.hp, enemy.currentHp + this.roll(attack));
    this.sim.emit({ type: 'effect', x: enemy.x, y: enemy.y, z: enemy.z || 0, tiles: [[enemy.x, enemy.y]], effect: 'heal' });
  }

  // ================================================================================================================================================================================================================================================
  // roll
  // Um valor de min a max da magia.

  roll(attack) {
    return attack.min + Math.floor(Math.random() * (attack.max - attack.min + 1));
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
