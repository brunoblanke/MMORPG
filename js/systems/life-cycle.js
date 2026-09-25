// js/systems/life-cycle.js

import { CONFIG } from '../config.js';
import { Enemy } from '../models/enemy.js';
import { displayName } from '../../shared/assets.js';

export class LifeCycleController {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
    this.corpseCounter = 0;
  }

  // ================================================================================================================================================================================================================================================
  // createCorpse

  createCorpse(entity, type, now) {
    this.corpseCounter++;
    const corpse = {
      id: `Corpse_${this.corpseCounter}`,
      ownerId: entity.id,
      name: entity.name || displayName(entity.creature),
      x: entity.x,
      y: entity.y,
      z: entity.z || 0,
      step: 0,
      color: entity.color,
      type: type,
      lvl: entity.lvl,
      creature: entity.creature,
      isPlayer: type === 'player_corpse',
      deathTime: now,
      decayTime: now + CONFIG.corpseFrameDuration * CONFIG.corpseFrameCount,
      hasVolume: false,
      blocksMovement: false,
      movable: true,
      isCorpse: true,
      corpseCreature: entity.creature,
      corpseIsPlayer: type === 'player_corpse'
    };
    this.sim.world.addToTile(corpse, corpse.x, corpse.y, corpse.z);
    this.sim.deadBodies.push(corpse);
    return corpse;
  }

  // ================================================================================================================================================================================================================================================
  // removeCorpse

  removeCorpse(corpse) {
    this.sim.world.removeFromTile(corpse, corpse.x, corpse.y, corpse.z || 0);
    this.sim.deadBodies = this.sim.deadBodies.filter(c => c !== corpse);
  }

  // ================================================================================================================================================================================================================================================
  // clearPlayerCorpse
  // Cada jogador deixa só o último cadáver.

  clearPlayerCorpse(player) {
    const corpses = this.sim.deadBodies.filter(c => c.type === 'player_corpse' && c.ownerId === player.id);
    for (const corpse of corpses) this.removeCorpse(corpse);
  }

  // ================================================================================================================================================================================================================================================
  // handlePlayerDeath

  handlePlayerDeath(player, now) {
    const { world, control } = this.sim;
    this.clearPlayerCorpse(player);
    this.createCorpse(player, 'player_corpse', now);
    const spot = this.sim.findFreeSpot(player.spawnX, player.spawnY, player.spawnZ);
    world.moveEntityTile(player, player.x, player.y, player.z || 0, spot.x, spot.y, player.spawnZ);
    player.respawn(spot);
    player.step = spot.step;
    player.renderStep = spot.step;
    control.clearWalk(player);
    if (player.target) player.target = null;
    this.sim.emit({ type: 'death', playerId: player.id });
  }

  // ================================================================================================================================================================================================================================================
  // handleEnemyDeath
  // O XP do inimigo (enemy.xp, pelo lvl dele) vai inteiro pro player que o
  // tinha como alvo (ou, sem ninguém, pro mais perto). Renasce no centro da
  // patrulha depois de enemyRespawnTime.

  handleEnemyDeath(enemy, now) {
    const sim = this.sim;
    this.createCorpse(enemy, 'enemy_corpse', now);

    const killer = sim.players.find(p => p.target === enemy) || sim.closestPlayer(enemy);
    if (killer) {
      const xpGain = enemy.xp;
      const levels = killer.gainXp(xpGain);
      sim.emit({ type: 'xp', playerId: killer.id, x: enemy.x, y: enemy.y, amount: xpGain });
      if (levels > 0) {
        sim.emit({ type: 'levelUp', playerId: killer.id, lvl: killer.lvl });
        console.log(`⭐ ${killer.name} subiu para o nível ${killer.lvl}`);
      }
    }

    sim.world.removeCreature(enemy);
    const index = sim.enemies.indexOf(enemy);
    if (index > -1) sim.enemies.splice(index, 1);

    for (const player of sim.players) {
      if (player.target === enemy) player.target = null;
    }

    sim.schedule(now + CONFIG.enemyRespawnTime, () => this.respawnEnemy(enemy));
  }

  // ================================================================================================================================================================================================================================================
  // respawnEnemy
  // Renasce no lugar original do mapa (spawnX/Y/Z), não onde morreu nem onde
  // estava patrulhando. Se alguém estiver em cima, no sqm livre mais perto.

  respawnEnemy(enemy) {
    const spot = this.sim.findFreeSpot(enemy.spawnX, enemy.spawnY, enemy.spawnZ, { avoidSafe: true });
    const respawnedEnemy = new Enemy({
      id: enemy.id,
      color: enemy.color,
      lvl: enemy.lvl,
      creature: enemy.creature,
      type: "enemy",
      x: spot.x,
      y: spot.y,
      z: enemy.spawnZ,
      step: spot.step,
      spawnX: enemy.spawnX,
      spawnY: enemy.spawnY,
      spawnZ: enemy.spawnZ,
      height: 1
    });
    this.sim.enemies.push(respawnedEnemy);
    this.sim.world.addCreature(respawnedEnemy);
    console.log(`♻️ ${displayName(enemy.creature)} LV${enemy.lvl} respawnou em (${spot.x}, ${spot.y}, ${enemy.spawnZ})`);
  }

  // ================================================================================================================================================================================================================================================
  // processDeaths

  processDeaths(now) {
    for (const player of this.sim.players) {
      if (!player.isAlive()) this.handlePlayerDeath(player, now);
    }

    const deadEnemies = this.sim.enemies.filter(enemy => !enemy.isAlive());
    for (const enemy of deadEnemies) {
      this.handleEnemyDeath(enemy, now);
    }
  }

  // ================================================================================================================================================================================================================================================
  // processCorpseDecay

  processCorpseDecay(now) {
    for (const corpse of this.sim.deadBodies.filter(c => now >= c.decayTime)) {
      this.removeCorpse(corpse);
    }
  }
}
