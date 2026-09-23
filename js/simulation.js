// js/simulation.js

import { CONFIG } from './config.js';
import { World } from './core/world.js';
import { generateObjects, generateEnemies } from './models/game-object.js';
import { Player } from './models/player.js';
import { getMapSpawn } from '../shared/map-format.js';
import { distance } from './utils/helpers.js';
import { MovementController } from './systems/movement.js';
import { EnemyAI } from './systems/enemy-ai.js';
import { CombatController } from './systems/combat.js';
import { ObjectDragController } from './systems/object-drag.js';
import { LifeCycleController } from './systems/life-cycle.js';
import { PlayerControl } from './systems/player-control.js';

export const TICK_MS = 50;

// O jogo inteiro, sem navegador: mapa, jogadores, inimigos e cadáveres, num
// relógio próprio que avança de TICK_MS em TICK_MS (tick). Jogadores só agem
// por comandos (enqueue → systems/player-control.js), aplicados no começo do
// tick seguinte. O que a tela precisa mostrar e não é estado (dano, XP,
// mensagens) sai como eventos (drainEvents). Roda igual no navegador e no Node.

export class Simulation {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(mapData) {
    this.mapData = mapData;
    this.world = new World();
    this.objects = generateObjects(mapData);
    this.enemies = generateEnemies(mapData);
    this.players = [];
    this.deadBodies = [];

    this.world.load(this.objects);
    for (const enemy of this.enemies) this.world.addCreature(enemy);
    this.objectsById = new Map(this.objects.map(obj => [obj.id, obj]));

    this.time = 0;
    this.commands = [];
    this.events = [];
    this.scheduled = [];

    this.movement = new MovementController(this.world);
    this.movement.onNoPath = (entity) => this.emit({ type: 'message', playerId: entity.id, text: 'Não há caminho' });
    this.enemyAI = new EnemyAI(this.movement);
    this.combat = new CombatController(this);
    this.objectDrag = new ObjectDragController(this);
    this.lifeCycle = new LifeCycleController(this);
    this.control = new PlayerControl(this);
  }

  // ================================================================================================================================================================================================================================================
  // addPlayer
  // Entra no spawn do mapa.

  addPlayer(id, data = {}) {
    const spawn = getMapSpawn(this.mapData, { x: 132, y: 145, z: 0 });
    const player = new Player({ id, x: spawn.x, y: spawn.y, z: spawn.z, lvl: 10, ...data });
    const spot = this.findFreeSpot(player.x, player.y, player.z || 0);
    player.x = spot.x;
    player.y = spot.y;
    player.step = spot.step;
    player.renderStep = spot.step;
    player.renderX = spot.x;
    player.renderY = spot.y;
    this.players.push(player);
    this.world.addCreature(player);
    return player;
  }

  // ================================================================================================================================================================================================================================================
  // findFreeSpot
  // O sqm livre (pisável e sem ninguém) mais perto de (x, y, z), em anéis
  // cada vez maiores, com a altura em que se fica nele. Sem nenhum até o raio
  // 10, devolve o próprio (x, y).

  findFreeSpot(x, y, z) {
    for (let radius = 0; radius <= 10; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const px = x + dx;
          const py = y + dy;
          if (!this.world.isInside(px, py) || this.world.isBlocked(px, py, z) || this.world.getTransitionAt(px, py, z)) continue;
          const step = this.world.getPassableStep(px, py, z);
          if (step !== null) return { x: px, y: py, step };
        }
      }
    }
    return { x, y, step: 0 };
  }

  // ================================================================================================================================================================================================================================================
  // removePlayer

  removePlayer(id) {
    const player = this.getPlayer(id);
    if (!player) return;
    this.world.removeCreature(player);
    this.players = this.players.filter(p => p !== player);
  }

  // ================================================================================================================================================================================================================================================
  // getPlayer

  getPlayer(id) {
    return this.players.find(p => p.id === id) || null;
  }

  // ================================================================================================================================================================================================================================================
  // getItem
  // Objeto do mapa ou cadáver pelo id.

  getItem(id) {
    return this.objectsById.get(id) || this.deadBodies.find(c => c.id === id) || null;
  }

  // ================================================================================================================================================================================================================================================
  // closestPlayer
  // Jogador mais perto do inimigo (quem ele pode perseguir e atacar).

  closestPlayer(enemy) {
    let best = null;
    let bestDist = Infinity;
    for (const player of this.players) {
      const dist = distance(enemy.x, enemy.y, player.x, player.y) + Math.abs((enemy.z || 0) - (player.z || 0)) * 100;
      if (dist < bestDist) {
        best = player;
        bestDist = dist;
      }
    }
    return best;
  }

  // ================================================================================================================================================================================================================================================
  // searchBoundsAround
  // Área onde a busca de caminho tenta primeiro (fora dela só se não achar).

  searchBoundsAround(player, radius = 40) {
    return {
      minX: Math.max(0, player.x - radius),
      maxX: Math.min(CONFIG.mapWidth, player.x + radius + 1),
      minY: Math.max(0, player.y - radius),
      maxY: Math.min(CONFIG.mapHeight, player.y + radius + 1)
    };
  }

  // ================================================================================================================================================================================================================================================
  // enqueue

  enqueue(playerId, command) {
    this.commands.push({ playerId, command });
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
  // schedule
  // Roda fn() no primeiro tick em que o relógio passar de `at`.

  schedule(at, fn) {
    this.scheduled.push({ at, fn });
  }

  // ================================================================================================================================================================================================================================================
  // processCommands

  processCommands() {
    const commands = this.commands;
    this.commands = [];
    for (const { playerId, command } of commands) {
      const player = this.getPlayer(playerId);
      if (player) this.control.handle(player, command);
    }
  }

  // ================================================================================================================================================================================================================================================
  // runScheduled

  runScheduled() {
    const due = this.scheduled.filter(task => task.at <= this.time);
    if (due.length === 0) return;
    this.scheduled = this.scheduled.filter(task => task.at > this.time);
    for (const task of due) task.fn();
  }

  // ================================================================================================================================================================================================================================================
  // tick
  // Um passo da simulação no instante `now` (ms).

  tick(now) {
    this.time = now;
    this.processCommands();
    this.runScheduled();
    this.lifeCycle.processCorpseDecay(now);

    for (const player of this.players) {
      this.control.update(player, now);
    }

    for (const enemy of this.enemies) {
      const player = this.closestPlayer(enemy);
      const bounds = player ? this.searchBoundsAround(player) : null;
      this.enemyAI.update(enemy, player, this.enemies, now, bounds);
    }

    for (const player of this.players) {
      this.combat.processPlayer(player, now);
      this.combat.processEnemies(player, now);
    }

    this.movement.checkFloorTransitions([...this.players, ...this.enemies]);
    this.lifeCycle.processDeaths(now);
  }
}
