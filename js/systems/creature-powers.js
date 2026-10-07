// js/systems/creature-powers.js

import { Enemy, AI_STATE } from '../models/enemy.js';
import { getLevel } from '../core/geometry.js';
import { creaturePowers } from '../../shared/assets.js';
import { CONFIG } from '../config.js';
import { EFFECTS } from '../../shared/effects.js';
import { circleArea, AREAS } from '../../shared/spells.js';
import { FIELDS } from '../../shared/conditions.js';

// O que a criatura faz além do golpe (shared/assets.js → creaturePowers),
// enquanto persegue um player no mesmo andar e fora da zona segura:
//   magias: a cada POWER_TRY_MS, cada uma com a chance dela (no máximo uma de
//   dano por vez; dano do tipo, sem defesa nem armadura; a de veneno deixa o
//   player envenenado):
//     tiro: num player até o alcance (CONFIG.mageRange se não disser) com
//     linha livre; bola, cruz, anel no alvo e campo: no alvo, em área;
//     onda, raio e varredura: na direção dele (8 direções), pra quem está na
//     área; redor e anel: em volta dela; cura: recupera vida dela mesma (se
//     estiver ferida), perseguindo ou fugindo.
//   invocar: a cada POWER_TRY_MS, com SUMMON_CHANCE, chama a criatura dela
//   ao lado (até o máximo vivo). Invocada não dá XP nem loot, não renasce e
//   morre junto com quem invocou.
// O veneno do golpe fica no combate (combat.js).

export const POWER_TRY_MS = 2000;
export const SUMMON_CHANCE = 0.25;
const SPELL_POISON_TICKS = 5;
const DIRECTIONAL = ['wave', 'beam', 'sweep'];
const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

// ================================================================================================================================================================================================================================================
// ringArea
// O aro de raio r (os sqms a r sqm do centro, sem o miolo).

function ringArea(r) {
  const tiles = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.hypot(dx, dy);
      if (d >= r - 0.5 && d < r + 0.5) tiles.push([dx, dy]);
    }
  }
  return tiles;
}

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
    const area = this.areaOf(enemy, player, attack);
    if (!area) return false;
    if (area.missile) {
      const kind = attack.element || (FIELDS[attack.field] && FIELDS[attack.field].kind);
      this.sim.emit({ type: 'missile', fromX: enemy.x, fromY: enemy.y, toX: player.x, toY: player.y, z: enemy.z || 0, kind });
    }
    if (attack.shape === 'field') this.placeFields(enemy, area.tiles, attack);
    else this.strike(enemy, area.tiles, attack);
    enemy.lastAttackTime = now;
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // areaOf
  // Os sqms que a magia alcança e se sai um projétil, ou null se não dá pra
  // lançar agora: as de direção (onda, raio, varredura) e as em volta dela
  // (redor, anel) precisam do player dentro da área; as de alvo (tiro, bola,
  // cruz, anel no alvo, campo) do alcance e da linha livre.

  areaOf(enemy, player, attack) {
    const shape = attack.shape;
    if (DIRECTIONAL.includes(shape) || shape === 'around' || (shape === 'ring' && attack.center === 'self')) {
      const tiles = shape === 'wave' ? this.waveTiles(enemy, player, attack)
        : shape === 'beam' ? this.beamTiles(enemy, player, attack)
        : shape === 'sweep' ? this.sweepTiles(enemy, player)
        : this.visibleTiles(enemy, shape === 'around' ? AROUND : ringArea(attack.radius));
      return tiles.some(([x, y]) => x === player.x && y === player.y) ? { tiles, missile: false } : null;
    }
    const range = Math.max(Math.abs(enemy.x - player.x), Math.abs(enemy.y - player.y));
    if (range > (attack.range || CONFIG.mageRange) || !this.sim.movement.hasLineOfSight(enemy, player)) return null;
    const around = shape === 'ball' ? circleArea(attack.radius)
      : shape === 'cross' ? AREAS.cross
      : shape === 'ring' ? ringArea(attack.radius)
      : shape === 'field' && attack.radius > 0 ? circleArea(attack.radius)
      : [[0, 0]];
    return { tiles: this.visibleTiles({ x: player.x, y: player.y, z: enemy.z || 0 }, around), missile: true };
  }

  // ================================================================================================================================================================================================================================================
  // visibleTiles
  // Os sqms de area (deslocamentos) em volta de center que a explosão alcança:
  // dentro do mapa e sem parede no caminho.

  visibleTiles(center, area) {
    const from = { x: center.x, y: center.y, z: center.z || 0 };
    return area
      .map(([dx, dy]) => [center.x + dx, center.y + dy])
      .filter(([x, y]) => this.sim.world.isInside(x, y) && this.sim.movement.hasLineOfSight(from, { x, y }));
  }

  // ================================================================================================================================================================================================================================================
  // direction
  // A direção (das 8, como passo de 45°) de enemy pra player: [ux, uy] e o passo.

  direction(enemy, player) {
    const step = Math.round(Math.atan2(player.y - enemy.y, player.x - enemy.x) / (Math.PI / 4));
    return { step, ux: Math.round(Math.cos(step * Math.PI / 4)), uy: Math.round(Math.sin(step * Math.PI / 4)) };
  }

  // ================================================================================================================================================================================================================================================
  // waveTiles
  // O leque pra frente, na direção (das 8) mais perto do player: a largura de
  // cada fileira vem de attack.widths (ex. 1-3-3-5) ou, sem elas, vai de 1 sqm
  // perto até 2 × abertura + 1; sem atravessar parede.

  waveTiles(enemy, player, attack) {
    const { ux, uy } = this.direction(enemy, player);
    const norm = ux * ux + uy * uy;
    const widths = attack.widths || [];
    const half = (along) => widths.length
      ? (widths[Math.min(widths.length, Math.max(1, Math.round(along))) - 1] - 1) / 2
      : Math.min(attack.spread, Math.floor(along / 2));
    const tiles = [];
    for (let ry = -attack.length; ry <= attack.length; ry++) {
      for (let rx = -attack.length; rx <= attack.length; rx++) {
        const along = (rx * ux + ry * uy) / norm;
        const across = Math.abs(rx * uy - ry * ux) / norm;
        if (along < 1 || along > attack.length || across > half(along) + 0.5) continue;
        const x = enemy.x + rx;
        const y = enemy.y + ry;
        if (this.sim.world.isInside(x, y) && this.sim.movement.hasLineOfSight(enemy, { x, y })) tiles.push([x, y]);
      }
    }
    return tiles;
  }

  // ================================================================================================================================================================================================================================================
  // beamTiles
  // A linha reta de comprimento sqm na direção do player (a parede corta).

  beamTiles(enemy, player, attack) {
    const { ux, uy } = this.direction(enemy, player);
    const tiles = [];
    for (let k = 1; k <= attack.length; k++) {
      const x = enemy.x + ux * k;
      const y = enemy.y + uy * k;
      if (!this.sim.world.isInside(x, y) || !this.sim.movement.hasLineOfSight(enemy, { x, y })) break;
      tiles.push([x, y]);
    }
    return tiles;
  }

  // ================================================================================================================================================================================================================================================
  // sweepTiles
  // Os 3 sqms colados na frente (a direção do player e as duas do lado).

  sweepTiles(enemy, player) {
    const { step } = this.direction(enemy, player);
    return [-1, 0, 1]
      .map(turn => [enemy.x + Math.round(Math.cos((step + turn) * Math.PI / 4)), enemy.y + Math.round(Math.sin((step + turn) * Math.PI / 4))])
      .filter(([x, y]) => this.sim.world.isInside(x, y) && this.sim.movement.hasLineOfSight(enemy, { x, y }));
  }

  // ================================================================================================================================================================================================================================================
  // placeFields
  // Cria o campo da magia nos sqms (menos zona segura).

  placeFields(enemy, tiles, attack) {
    const z = enemy.z || 0;
    for (const [x, y] of tiles) {
      if (!this.sim.world.isSafe(x, y, z)) this.sim.conditions.placeField(attack.field, x, y, z);
    }
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
