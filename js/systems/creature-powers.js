// js/systems/creature-powers.js

import { Enemy, AI_STATE } from '../models/enemy.js';
import { getLevel } from '../core/geometry.js';
import { creaturePowers, creatureBehavior } from '../../shared/assets.js';
import { CONFIG } from '../config.js';
import { EFFECTS } from '../../shared/effects.js';
import { circleArea, AREAS } from '../../shared/spells.js';
import { FIELDS } from '../../shared/conditions.js';
import { AROUND, ringArea, lineTiles, waveOffsets, beamOffsets, sweepOffsets } from '../../shared/spell-areas.js';

// O que a criatura faz além do golpe (shared/assets.js → creaturePowers),
// enquanto persegue um player no mesmo andar e fora da zona segura:
//   magias: a cada POWER_TRY_MS, cada uma com a chance dela (no máximo uma de
//   dano por vez; dano do tipo, sem defesa nem armadura; a de veneno deixa o
//   player envenenado):
//     tiro: num player até o alcance (CONFIG.mageRange se não disser) com
//     linha livre; bola, cruz, anel no alvo e campo: no alvo, em área;
//     onda, raio e varredura: na direção em que ela está virada (ela vira pro
//     player antes de lançar), pra quem está na
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
const FROM_AFAR = ['shot', 'ball', 'cross', 'field', 'chain', 'slow', 'wave', 'beam'];

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
    if (this.sim.world.isInSafeZone(player)) return;
    if (state === AI_STATE.CHASE && now - (enemy.lastMoveTime || 0) > enemy.getStepInterval() && this.shootsFromAfar(enemy)) this.sim.movement.faceTowards(enemy, player.x - enemy.x, player.y - enemy.y);
    if (now < (enemy.powerReadyAt || 0)) return;
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
  // shootsFromAfar
  // A criatura ataca de longe (mago ou com magia de alvo, onda ou raio): parada (sem andar há mais que um passo; no servidor isMoving
  // não zera sozinho), fica virada pro player.

  shootsFromAfar(enemy) {
    return creatureBehavior(enemy.creature) === 'mago' || creaturePowers(enemy.creature).attacks.some(attack => FROM_AFAR.includes(attack.shape));
  }

  // ================================================================================================================================================================================================================================================
  // cast
  // Lança a magia no player; devolve se saiu (alcance, linha livre e área).

  cast(enemy, player, attack, now) {
    if (DIRECTIONAL.includes(attack.shape)) this.sim.movement.faceTowards(enemy, player.x - enemy.x, player.y - enemy.y);
    const area = this.areaOf(enemy, player, attack);
    if (!area) return false;
    if (area.missile) {
      const kind = attack.element || (FIELDS[attack.field] && FIELDS[attack.field].kind);
      this.sim.emit({ type: 'missile', fromX: enemy.x, fromY: enemy.y, toX: player.x, toY: player.y, z: enemy.z || 0, kind });
    }
    if (attack.shape === 'field') this.placeFields(enemy, area.tiles, attack);
    else if (attack.shape === 'slow') this.slow(enemy, area.tiles, attack);
    else this.strike(enemy, area.tiles, attack, area.victims);
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
    if (DIRECTIONAL.includes(shape) || shape === 'around' || ((shape === 'ring' || shape === 'ball') && attack.center === 'self')) {
      const tiles = shape === 'wave' ? this.waveTiles(enemy, attack)
        : shape === 'beam' ? this.beamTiles(enemy, attack)
        : shape === 'sweep' ? this.sweepTiles(enemy)
        : this.visibleTiles(enemy, shape === 'around' ? AROUND : shape === 'ball' ? circleArea(attack.radius) : ringArea(attack.radius));
      return tiles.some(([x, y]) => x === player.x && y === player.y) ? { tiles, missile: false } : null;
    }
    const range = Math.max(Math.abs(enemy.x - player.x), Math.abs(enemy.y - player.y));
    if (range > (attack.range || CONFIG.mageRange) || !this.sim.movement.hasLineOfSight(enemy, player)) return null;
    if (shape === 'chain') return this.chainOf(enemy, player, attack);
    const around = shape === 'ball' ? circleArea(attack.radius)
      : shape === 'cross' ? AREAS.cross
      : shape === 'ring' ? ringArea(attack.radius)
      : shape === 'field' && attack.radius > 0 ? circleArea(attack.radius)
      : [[0, 0]];
    return { tiles: this.visibleTiles({ x: player.x, y: player.y, z: enemy.z || 0 }, around), missile: shape !== 'slow' };
  }

  // ================================================================================================================================================================================================================================================
  // visibleTiles
  // Os sqms de area (deslocamentos) em volta de center que a explosão alcança:
  // dentro do mapa e sem parede no caminho.

  visibleTiles(center, area) {
    const from = { x: center.x, y: center.y, z: center.z || 0 };
    return area
      .map(([dx, dy]) => [center.x + dx, center.y + dy])
      .filter(([x, y]) => this.sim.world.isInside(x, y) && this.sim.world.hasFloorAt(x, y, from.z) && this.sim.movement.hasLineOfSight(from, { x, y }));
  }

  // ================================================================================================================================================================================================================================================
  // reach
  // Dos deslocamentos de offsets a partir de enemy, só os sqms dentro do mapa e com linha livre.

  reach(enemy, offsets) {
    return offsets.map(([dx, dy]) => [enemy.x + dx, enemy.y + dy])
      .filter(([x, y]) => this.sim.world.isInside(x, y) && this.sim.world.hasFloorAt(x, y, enemy.z || 0) && this.sim.movement.hasLineOfSight(enemy, { x, y }));
  }

  // ================================================================================================================================================================================================================================================
  // waveTiles
  // O leque pra frente, na direção em que a criatura está virada (spell-areas.js), sem atravessar parede.

  waveTiles(enemy, attack) {
    return this.reach(enemy, waveOffsets(attack, enemy.direction));
  }

  // ================================================================================================================================================================================================================================================
  // beamTiles
  // A linha reta de comprimento sqm na direção em que a criatura está virada (a parede corta).

  beamTiles(enemy, attack) {
    const tiles = [];
    for (const [x, y] of beamOffsets(attack, enemy.direction).map(([dx, dy]) => [enemy.x + dx, enemy.y + dy])) {
      if (!this.sim.world.isInside(x, y) || !this.sim.world.hasFloorAt(x, y, enemy.z || 0) || !this.sim.movement.hasLineOfSight(enemy, { x, y })) break;
      tiles.push([x, y]);
    }
    return tiles;
  }

  // ================================================================================================================================================================================================================================================
  // sweepTiles
  // Os 3 sqms colados na frente (a direção em que está virada e as duas do lado).

  sweepTiles(enemy) {
    return this.reach(enemy, sweepOffsets(enemy.direction));
  }

  // ================================================================================================================================================================================================================================================
  // chainOf
  // A corrente: parte dela até o player e pula pro player mais perto do último
  // (até alcanceSalto sqm, com linha livre), até saltos jogadores no total.
  // Devolve os sqms do caminho e quem ela acerta.

  chainOf(enemy, player, attack) {
    const z = enemy.z || 0;
    const victims = [player];
    const tiles = lineTiles(enemy, player);
    let from = player;
    while (victims.length < attack.jumps) {
      const next = this.sim.players
        .filter(p => p.isAlive() && !victims.includes(p) && (p.z || 0) === z && !this.sim.world.isInSafeZone(p) && Math.max(Math.abs(p.x - from.x), Math.abs(p.y - from.y)) <= attack.jumpRange && this.sim.movement.hasLineOfSight(from, p))
        .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
      if (!next) break;
      tiles.push(...lineTiles(from, next));
      victims.push(next);
      from = next;
    }
    return { tiles, missile: false, victims };
  }

  // ================================================================================================================================================================================================================================================
  // slow
  // Deixa o player nos sqms lento (speed negativa por ms).

  slow(enemy, tiles, attack) {
    const z = enemy.z || 0;
    const keys = new Set(tiles.map(([x, y]) => `${x},${y}`));
    for (const target of this.sim.players) {
      if (!target.isAlive() || (target.z || 0) !== z || !keys.has(`${target.x},${target.y}`) || this.sim.world.isInSafeZone(target)) continue;
      this.sim.conditions.add(target, 'slow', { speed: attack.speed, ms: attack.ms });
      this.sim.emit({ type: 'effect', x: target.x, y: target.y, z, tiles: [[target.x, target.y]], effect: 'poff' });
    }
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
  // Fere todo player vivo nos sqms (ou na lista victims), fora da zona
  // segura, e mostra o efeito do tipo.

  strike(enemy, tiles, attack, victims = null) {
    const z = enemy.z || 0;
    const keys = new Set(tiles.map(([x, y]) => `${x},${y}`));
    for (const target of victims || this.sim.players) {
      if (!target.isAlive() || (target.z || 0) !== z || (!victims && !keys.has(`${target.x},${target.y}`)) || this.sim.world.isInSafeZone(target)) continue;
      this.sim.conditions.hurt(target, this.roll(attack), attack.element);
      if (attack.element === 'poison') this.sim.conditions.add(target, 'poison', { damage: Math.max(1, Math.floor(attack.max / 4)), ticks: SPELL_POISON_TICKS });
    }
    if (EFFECTS[attack.element]) this.sim.emit({ type: 'effect', x: enemy.x, y: enemy.y, z, tiles, effect: attack.element });
  }

  // ================================================================================================================================================================================================================================================
  // heal
  // A criatura ferida recupera vida.

  heal(enemy, attack) {
    if (enemy.conditions && enemy.conditions.slow) {
      delete enemy.conditions.slow;
      this.sim.conditions.applySpeed(enemy);
    }
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
  // resisted
  // O dano depois da resistência da criatura ao tipo (100 = igual, 0 = imune);
  // player não tem resistência (por enquanto).

  resisted(entity, element, amount) {
    if (entity.isPlayer || !entity.creature) return amount;
    const percent = creaturePowers(entity.creature).resistances[element || 'physical'];
    return percent === undefined ? amount : Math.round(amount * percent / 100);
  }

  // ================================================================================================================================================================================================================================================
  // reflect
  // Parry: a criatura devolve parte do dano a quem bateu nela, com a chance
  // dela (o golpe devolvido não reflete de novo).

  reflect(attacker, defender, damage) {
    if (!attacker.isPlayer || defender.isPlayer || !defender.creature || damage <= 0 || !attacker.isAlive()) return;
    const reflect = creaturePowers(defender.creature).reflect;
    if (!reflect || Math.random() * 100 >= reflect.chance) return;
    this.sim.conditions.hurt(attacker, Math.max(1, Math.round(damage * reflect.percent / 100)), 'physical');
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
