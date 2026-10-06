// js/simulation.js

import { CONFIG } from './config.js';
import { TICK_MS } from '../shared/constants.js';
import { World } from './core/world.js';
import { generateObjects, generateEnemies } from './models/game-object.js';
import { Player } from './models/player.js';
import { getMapSpawn } from '../shared/map-format.js';
import { distance } from './utils/helpers.js';
import { MovementController } from './systems/movement.js';
import { EnemyAI } from './systems/enemy-ai.js';
import { updateVoice } from './systems/voices.js';
import { CombatController } from './systems/combat.js';
import { ObjectDragController } from './systems/object-drag.js';
import { LifeCycleController } from './systems/life-cycle.js';
import { PlayerControl } from './systems/player-control.js';
import { InventoryController } from './systems/inventory.js';
import { InteractionController } from './systems/interactions.js';
import { NpcController } from './systems/npcs.js';
import { SpellController } from './systems/spells.js';
import { ConditionController } from './systems/conditions.js';
import { CreaturePowers } from './systems/creature-powers.js';
import { SocialController } from './systems/social.js';
import { HouseController } from './systems/houses.js';
import { objectIdType, doorState } from '../shared/assets.js';

export { TICK_MS };

// O jogo inteiro, sem navegador: mapa, jogadores, inimigos e cadáveres, num
// relógio próprio que avança de TICK_MS em TICK_MS (tick). Jogadores só agem
// por comandos (enqueue → systems/player-control.js), aplicados no começo do
// tick seguinte. O que a tela precisa mostrar e não é estado (dano, XP,
// mensagens) sai como eventos (drainEvents). Roda igual no navegador e no Node.

export class Simulation {

  // ================================================================================================================================================================================================================================================
  // constructor

  // options.lootTable: o que cada criatura deixa cair (systems/inventory.js).
  // options.npcs: NPCs além dos do mapa (definições de shared/npcs.js).
  // options.houses: dono, convidados e itens guardados das casas (houses.js).
  // options.bots: players de teste [{ name, x, y, z, lvl }] (spawnBots).

  constructor(mapData, options = {}) {
    this.mapData = mapData;
    this.world = new World();
    this.objects = generateObjects(mapData);
    this.enemies = generateEnemies(mapData);
    this.players = [];
    this.loggedOut = [];
    this.startedAt = Date.now();
    this.deadBodies = [];

    this.world.load(this.objects);
    this.world.loadSafeZones(mapData.safeZoneData);
    this.world.loadHouses(mapData.houseData);
    for (const enemy of this.enemies) this.world.addCreature(enemy);
    this.objectsById = new Map(this.objects.map(obj => [obj.id, obj]));
    this.doors = this.objects.filter(obj => doorState(objectIdType(obj.id)));

    this.time = 0;
    this.commands = [];
    this.events = [];
    this.scheduled = [];

    this.movement = new MovementController(this.world);
    this.enemyAI = new EnemyAI(this.movement);
    this.combat = new CombatController(this);
    this.objectDrag = new ObjectDragController(this);
    this.lifeCycle = new LifeCycleController(this);
    this.control = new PlayerControl(this);
    this.inventory = new InventoryController(this, options.lootTable || {});
    this.interactions = new InteractionController(this);
    this.spells = new SpellController(this);
    this.conditions = new ConditionController(this);
    this.powers = new CreaturePowers(this);
    this.social = new SocialController(this);
    this.houses = new HouseController(this, options.houses || {});
    this.npcs = [];
    this.talk = new NpcController(this, options.npcs || []);
    this.spawnBots(options.bots || []);
  }

  // ================================================================================================================================================================================================================================================
  // addPlayer
  // Entra no spawn do mapa. Com data.saved (personagem guardado), volta com o
  // nível, XP e vida dele, no lugar onde saiu — se esse lugar ainda existir e
  // tiver um sqm livre por perto; senão, no spawn.

  addPlayer(id, data = {}) {
    const { saved, ...info } = data;
    const spawn = getMapSpawn(this.mapData, { x: 132, y: 145, z: 0 });
    const player = new Player({ id, x: spawn.x, y: spawn.y, z: spawn.z, lvl: CONFIG.playerStartLevel, ...info });
    const position = player.loadSave(saved);
    this.inventory.setupPlayer(player, saved);
    const savedSpot = position && this.findSpotNear(position.x, position.y, position.z);
    const spot = savedSpot || this.findFreeSpot(player.spawnX, player.spawnY, player.spawnZ);

    player.x = spot.x;
    player.y = spot.y;
    player.z = savedSpot ? position.z : player.spawnZ;
    player.step = spot.step;
    player.renderX = spot.x;
    player.renderY = spot.y;
    player.renderZ = player.z;
    player.renderStep = spot.step;
    this.players.push(player);
    this.world.addCreature(player);
    this.social.onLogin(player);
    return player;
  }

  // ================================================================================================================================================================================================================================================
  // spawnBots
  // Players de teste: parados, sem revidar e que renascem no mesmo lugar ao
  // morrer (life-cycle.js), pra testar PvP e caveira. Sem piso no sqm, o bot
  // não entra.

  spawnBots(bots) {
    bots.forEach((bot, index) => {
      if (!this.world.hasFloorAt(bot.x, bot.y, bot.z || 0)) return;
      const player = this.addPlayer(`bot${index + 1}`, { name: bot.name, gender: 'male' });
      player.isBot = true;
      player.lvl = bot.lvl || 20;
      player.applyLevelStats();
      player.currentHp = player.hp;
      player.mana = player.maxMana;
      player.food = Number.MAX_SAFE_INTEGER;
      player.attackMode = false;
      player.autoFollow = false;
      this.teleportPlayer(player, bot.x, bot.y, bot.z || 0, { home: true });
    });
  }

  // ================================================================================================================================================================================================================================================
  // teleportPlayer
  // Leva o player pro sqm livre mais perto de (x, y, z), largando alvo e
  // caminho. home: o lugar vira a casa dele (onde nasce ao morrer).

  teleportPlayer(player, x, y, z, { home = false } = {}) {
    const spot = this.findFreeSpot(x, y, z);
    this.world.moveEntityTile(player, player.x, player.y, player.z || 0, spot.x, spot.y, z);
    Object.assign(player, { x: spot.x, y: spot.y, z, step: spot.step, renderX: spot.x, renderY: spot.y, renderZ: z, renderStep: spot.step, isMoving: false, target: null });
    this.control.clearWalk(player);
    if (home) Object.assign(player, { spawnX: spot.x, spawnY: spot.y, spawnZ: z });
  }

  // ================================================================================================================================================================================================================================================
  // findFreeSpot
  // O sqm livre mais perto de (x, y, z) (findSpotNear). Sem nenhum até o
  // raio 10, devolve o próprio (x, y).

  findFreeSpot(x, y, z, options = {}) {
    return this.findSpotNear(x, y, z, options) || { x, y, step: 0 };
  }

  // ================================================================================================================================================================================================================================================
  // findSpotNear
  // O sqm livre (pisável e sem ninguém) mais perto de (x, y, z), em anéis
  // cada vez maiores, com a altura em que se fica nele. null se não há
  // nenhum até o raio 10. avoidSafe: pula sqms de zona segura (inimigos).

  findSpotNear(x, y, z, { avoidSafe = false } = {}) {
    for (let radius = 0; radius <= 10; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const px = x + dx;
          const py = y + dy;
          if (!this.world.isInside(px, py) || this.world.isBlocked(px, py, z) || this.world.getTransitionAt(px, py, z)) continue;
          if (avoidSafe && this.world.isSafe(px, py, z)) continue;
          const step = this.world.getPassableStep(px, py, z);
          if (step !== null) return { x: px, y: py, step };
        }
      }
    }
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // removePlayer

  removePlayer(id) {
    const player = this.getPlayer(id);
    if (!player) return;
    this.social.onLogout(player);
    this.world.removeCreature(player);
    this.players = this.players.filter(p => p !== player);
  }

// ================================================================================================================================================================================================================================================
  // wallTime
  // A hora real (ms desde 1970) de um instante da simulação: o que fica
  // guardado no personagem (kills de player) sobrevive a reiniciar o servidor.

  wallTime(now = this.time) {
    return this.startedAt + now;
  }

  // ================================================================================================================================================================================================================================================
  // inCombat
  // Deu ou levou golpe nos últimos CONFIG.logoutCombatMs, fora de zona segura.

  inCombat(player, now = this.time) {
    if (this.world.isInSafeZone(player)) return false;
    return now - player.lastCombatTime < CONFIG.logoutCombatMs;
  }

  // ================================================================================================================================================================================================================================================
  // leaveGame
  // A conexão do player caiu. Fora de combate ele sai na hora; em combate o
  // corpo fica parado no mapa (offline), atacando e apanhando, até passar
  // logoutCombatMs sem golpe (releaseOffline). Devolve true se ele saiu.

  leaveGame(id) {
    const player = this.getPlayer(id);
    if (!player) return true;
    if (!this.inCombat(player)) {
      this.removePlayer(id);
      return true;
    }
    player.offline = true;
    this.control.clearWalk(player);
    return false;
  }

  // ================================================================================================================================================================================================================================================
  // findOffline
  // O corpo que ficou no mapa com esse nome (sem diferenciar maiúsculas), ou null.

  findOffline(name) {
    const wanted = String(name).toLowerCase();
    return this.players.find(p => p.offline && p.name.toLowerCase() === wanted) || null;
  }

  // ================================================================================================================================================================================================================================================
  // releaseOffline
  // Tira do mapa os corpos offline que já não estão em combate (ou que foram
  // pra zona segura); eles ficam em loggedOut pro servidor guardar.

  releaseOffline(now) {
    for (const player of [...this.players]) {
      if (!player.offline || this.inCombat(player, now)) continue;
      this.removePlayer(player.id);
      this.loggedOut.push(player);
    }
  }

  // ================================================================================================================================================================================================================================================
  // drainLoggedOut
  // Os players que saíram do mapa depois de ficar offline em combate.

  drainLoggedOut() {
    const left = this.loggedOut;
    this.loggedOut = [];
    return left;
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
    this.talk.update(now);
    this.lifeCycle.processCorpseDecay(now);

    this.inventory.burnLights(TICK_MS);
    for (const player of this.players) {
      this.control.update(player, now);
      this.inventory.update(player);
      this.inventory.digest(player, now);
    }

    for (const enemy of [...this.enemies]) {
      const player = this.closestPlayer(enemy);
      const bounds = player ? this.searchBoundsAround(player) : null;
      this.enemyAI.update(enemy, player, this.enemies, now, bounds);
      updateVoice(this, enemy, player, now);
      this.powers.update(enemy, player, now);
    }

    for (const player of this.players) {
      this.combat.updateAutoAttack(player);
      this.combat.processPlayer(player, now);
      this.combat.processEnemies(player, now);
      this.combat.processFloorDamage(player, now);
    }
    this.conditions.update(now);
    this.social.update(now);
    this.houses.update();
    this.releaseOffline(now);
    for (const player of this.players) player.inCombat = this.inCombat(player, now);

    this.movement.checkFloorTransitions([...this.players, ...this.enemies]);
    this.lifeCycle.processDeaths(now);
  }
}
