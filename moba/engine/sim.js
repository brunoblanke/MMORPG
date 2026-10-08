// moba/engine/sim.js

import { TICK_MS, TEAMS, VOCATIONS, WAVE, ARENA } from './config.js';
import { structureLayout } from './map.js';
import { createHero, createStructure } from './units.js';
import { updateHero } from './heroes.js';
import { updateMinion, spawnWave } from './minions.js';
import { updateStructure } from './structures.js';
import { separate } from './movement.js';
import { isTargetable } from './combat.js';
import { cast } from './abilities.js';
import { runBots } from './bots.js';

// ================================================================================================================================================================================================================================================
// A partida: 2 times de 4 heróis (uma de cada vocação), minions em ondas, torres e nexus. A simulação
// é pura (sem relógio nem rede): tick() avança TICK_MS; command() recebe as ordens do jogador;
// snapshot() é o que o cliente desenha.

export class MobaSim {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor({ bots = true } = {}) {
    this.bots = bots;
    this.time = 0;
    this.tickCount = 0;
    this.over = false;
    this.winner = null;
    this.events = [];
    this.minionCounter = 0;
    this.nextWaveAt = WAVE.first;
    this.heroes = [];
    this.minions = [];
    this.structures = TEAMS.flatMap(team => structureLayout(team).map(createStructure));
    TEAMS.forEach(team => VOCATIONS.forEach((vocation, index) => {
      this.heroes.push(createHero(`${team}-${vocation}`, team, vocation, (index - 1.5) * 1.1));
    }));
  }

  // ================================================================================================================================================================================================================================================
  // units
  // Todas as unidades vivas (heróis, minions e estruturas).

  units() {
    return [...this.heroes, ...this.minions, ...this.structures].filter(unit => unit.alive);
  }

  // ================================================================================================================================================================================================================================================
  // getUnit

  getUnit(id) {
    return [...this.heroes, ...this.minions, ...this.structures].find(unit => unit.id === id) || null;
  }

  // ================================================================================================================================================================================================================================================
  // emit

  emit(event) {
    this.events.push({ ...event, time: this.time });
  }

  // ================================================================================================================================================================================================================================================
  // drainEvents

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  // ================================================================================================================================================================================================================================================
  // command
  // Ordem do jogador pro herói heroId: { type: 'move', x, y } | { type: 'attack', targetId } | { type: 'cast', slot, x, y } | { type: 'stop' }.

  command(heroId, command) {
    const hero = this.heroes.find(item => item.id === heroId);
    if (!hero || !hero.alive || this.over || !command) return;
    if (command.type === 'move' && Number.isFinite(command.x) && Number.isFinite(command.y)) {
      hero.moveTarget = { x: Math.min(Math.max(command.x, 0), ARENA.width), y: Math.min(Math.max(command.y, 0), ARENA.height) };
      hero.attackTargetId = null;
    } else if (command.type === 'attack') {
      const target = this.getUnit(command.targetId);
      if (target && target.team !== hero.team && isTargetable(this, target)) {
        hero.attackTargetId = target.id;
        hero.moveTarget = null;
      }
    } else if (command.type === 'cast') {
      cast(this, hero, command.slot, Number(command.x), Number(command.y));
    } else if (command.type === 'stop') {
      hero.moveTarget = null;
      hero.attackTargetId = null;
    }
  }

  // ================================================================================================================================================================================================================================================
  // tick
  // Avança TICK_MS: waves, bots, heróis, minions, torres e a separação das unidades.

  tick() {
    if (this.over) return;
    const dt = TICK_MS / 1000;
    this.tickCount++;
    this.time = this.tickCount * dt;
    if (this.time >= this.nextWaveAt) {
      spawnWave(this);
      this.nextWaveAt += WAVE.every;
    }
    if (this.bots) runBots(this);
    for (const hero of this.heroes) updateHero(this, hero, dt);
    for (const minion of this.minions) if (minion.alive) updateMinion(this, minion, dt);
    for (const structure of this.structures) updateStructure(this, structure);
    separate(this);
    this.minions = this.minions.filter(minion => minion.alive);
  }

  // ================================================================================================================================================================================================================================================
  // snapshot
  // O estado que o cliente desenha, mais os eventos do tick (dano, projéteis, efeitos).

  snapshot() {
    const round = (value) => Math.round(value * 100) / 100;
    return {
      time: round(this.time), over: this.over, winner: this.winner,
      heroes: this.heroes.map(hero => ({
        id: hero.id, team: hero.team, vocation: hero.vocation, human: hero.human, alive: hero.alive, x: round(hero.x), y: round(hero.y),
        facing: hero.facing, hp: Math.round(hero.hp), maxHp: hero.maxHp, mana: Math.round(hero.mana), maxMana: hero.maxMana, level: hero.level,
        xp: Math.round(hero.xp), gold: Math.floor(hero.gold), kills: hero.kills, deaths: hero.deaths,
        cooldowns: hero.cooldowns.map(readyAt => round(Math.max(0, readyAt - this.time))), respawnIn: round(Math.max(0, hero.respawnAt - this.time)),
        slowed: this.time < hero.slowUntil, hasted: this.time < hero.hasteUntil
      })),
      minions: this.minions.map(minion => ({ id: minion.id, team: minion.team, type: minion.type, x: round(minion.x), y: round(minion.y), hp: Math.round(minion.hp), maxHp: minion.maxHp })),
      structures: this.structures.map(structure => ({
        id: structure.id, team: structure.team, structure: structure.structure, x: structure.x, y: structure.y, hp: Math.round(structure.hp),
        maxHp: structure.maxHp, alive: structure.alive, protected: !isTargetable(this, { ...structure, alive: true })
      }))
    };
  }
}
