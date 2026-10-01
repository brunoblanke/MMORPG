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
  // handlePlayerDeath
  // O corpo fica com a mochila e, por sorteio, outros itens do inventário
  // (inventory.fillPlayerCorpse); o player volta no spawn sem eles.

  handlePlayerDeath(player, now) {
    const { world, control } = this.sim;
    const corpse = this.createCorpse(player, 'player_corpse', now);
    this.sim.inventory.fillPlayerCorpse(corpse, player);
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
  // A XP do inimigo é dividida entre os players que bateram nele, cada um
  // com a parte do dano que causou (shareXp). Renasce no lugar dele depois
  // de enemyRespawnTime.

  handleEnemyDeath(enemy, now) {
    const sim = this.sim;
    const corpse = this.createCorpse(enemy, 'enemy_corpse', now);
    sim.inventory.fillCorpse(corpse, enemy);
    this.shareXp(enemy);

    sim.world.removeCreature(enemy);
    const index = sim.enemies.indexOf(enemy);
    if (index > -1) sim.enemies.splice(index, 1);

    for (const player of sim.players) {
      if (player.target === enemy) player.target = null;
    }

    sim.schedule(now + CONFIG.enemyRespawnTime, () => this.respawnEnemy(enemy));
  }

  // ================================================================================================================================================================================================================================================
  // shareXp
  // Como no Tibia: cada player ganha a XP da criatura vezes a fração do dano
  // total que ele causou. Quem já saiu do jogo perde a parte dele.

  shareXp(enemy) {
    const sim = this.sim;
    const damageBy = enemy.damageBy || new Map();
    const total = [...damageBy.values()].reduce((sum, amount) => sum + amount, 0);
    if (!total || !(enemy.xp > 0)) return;
    for (const [playerId, amount] of damageBy) {
      const player = sim.getPlayer(playerId);
      if (!player || !player.isAlive()) continue;
      const xpGain = Math.round(enemy.xp * amount / total);
      if (xpGain <= 0) continue;
      const levels = player.gainXp(xpGain);
      sim.emit({ type: 'xp', playerId: player.id, x: enemy.x, y: enemy.y, amount: xpGain });
      if (levels > 0) {
        sim.emit({ type: 'levelUp', playerId: player.id, lvl: player.lvl });
        console.log(`⭐ ${player.name} subiu para o nível ${player.lvl}`);
      }
    }
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
  // No último estágio (ossos), o corpo não é mais container: o que tinha
  // dentro some, como no Tibia. No fim da decomposição, ele some.

  processCorpseDecay(now) {
    const lastStage = CONFIG.corpseFrameDuration * (CONFIG.corpseFrameCount - 1);
    for (const corpse of this.sim.deadBodies) {
      if (corpse.itemData && now >= corpse.deathTime + lastStage) corpse.itemData = null;
    }
    for (const corpse of this.sim.deadBodies.filter(c => now >= c.decayTime)) {
      this.removeCorpse(corpse);
    }
  }
}
