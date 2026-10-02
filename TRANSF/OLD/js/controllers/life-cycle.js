// js/controllers/life-cycle.js

import { CONFIG } from '../config.js';
import { Enemy } from '../models/enemy.js';

export class LifeCycleController {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(game) {
    this.game = game;
  }

  // ================================================================================================================================================================================================================================================
  // createCorpse

  createCorpse(entity, type) {
    const deathTime = performance.now();
    const corpse = {
      x: entity.x,
      y: entity.y,
      z: entity.z || 0,
      step: 0,
      color: entity.color,
      type: type,
      lvl: entity.lvl,
      creature: entity.creature,
      isPlayer: type === 'player_corpse',
      deathTime: deathTime,
      decayTime: deathTime + CONFIG.corpseFrameDuration * CONFIG.corpseFrameCount,
      hasVolume: false,
      blocksMovement: false,
      movable: true,
      isCorpse: true,
      corpseCreature: entity.creature,
      corpseIsPlayer: type === 'player_corpse'
    };
    this.game.stackManager.addToTile(corpse, corpse.x, corpse.y, corpse.z);
    return corpse;
  }

  // ================================================================================================================================================================================================================================================
  // clearPlayerCorpse

  clearPlayerCorpse() {
    const game = this.game;
    const playerCorpses = game.deadBodies.filter(corpse => corpse.type === 'player_corpse');
    for (const corpse of playerCorpses) {
      game.stackManager.removeFromTile(corpse, corpse.x, corpse.y, corpse.z || 0);
    }
    game.deadBodies = game.deadBodies.filter(corpse => corpse.type !== 'player_corpse');
  }

  // ================================================================================================================================================================================================================================================
  // handlePlayerDeath

  handlePlayerDeath() {
    const game = this.game;
    this.clearPlayerCorpse();
    const corpse = this.createCorpse(game.player, 'player_corpse');
    game.deadBodies.push(corpse);
    game.player.respawn();
    game.inputController.clearTarget();
    if (game.selectedEnemy) {
      game.selectedEnemy.isTarget = false;
      game.selectedEnemy = null;
    }
  }

  // ================================================================================================================================================================================================================================================
  // handleEnemyDeath

  handleEnemyDeath(enemy) {
    const game = this.game;
    const corpse = this.createCorpse(enemy, 'enemy_corpse');
    game.deadBodies.push(corpse);

    const xpGain = Math.floor(enemy.xp * 0.2);
    game.player.gainXp(xpGain);

    game.particleController.spawnXP(enemy.x, enemy.y, xpGain, game.renderer);

    game.stackManager.removeFromTile(enemy, enemy.x, enemy.y, enemy.z || 0);

    const index = game.enemies.indexOf(enemy);
    if (index > -1) {
      game.enemies.splice(index, 1);
    }
    const objIndex = game.objects.indexOf(enemy);
    if (objIndex > -1) {
      game.objects.splice(objIndex, 1);
    }

    if (game.selectedEnemy === enemy) {
      game.selectedEnemy = null;
    }

    setTimeout(() => {
      this.respawnEnemy(enemy);
    }, CONFIG.enemyRespawnTime);
  }

  // ================================================================================================================================================================================================================================================
  // respawnEnemy

  respawnEnemy(enemy) {
    const respawnedEnemy = new Enemy({
      id: enemy.id,
      color: enemy.color,
      lvl: enemy.lvl,
      creature: enemy.creature,
      type: "enemy",
      x: enemy.patrolCenterX,
      y: enemy.patrolCenterY,
      z: enemy.spawnZ,
      height: 1
    });
    this.game.enemies.push(respawnedEnemy);
    this.game.objects.push(respawnedEnemy);
    console.log(`♻️ ${enemy.creature} LV${enemy.lvl} respawnou em (${enemy.patrolCenterX}, ${enemy.patrolCenterY}, ${enemy.spawnZ})`);
  }

  // ================================================================================================================================================================================================================================================
  // processDeaths

  processDeaths() {
    const game = this.game;

    if (!game.player.isAlive()) {
      this.handlePlayerDeath();
    }

    const deadEnemies = game.enemies.filter(enemy => !enemy.isAlive());
    for (const enemy of deadEnemies) {
      this.handleEnemyDeath(enemy);
    }
  }

  // ================================================================================================================================================================================================================================================
  // processCorpseDecay

  processCorpseDecay(timestamp) {
    const game = this.game;
    game.deadBodies = game.deadBodies.filter((corpse) => {
      if (timestamp >= corpse.decayTime) {
        game.stackManager.removeFromTile(corpse, corpse.x, corpse.y, corpse.z || 0);
        return false;
      }
      return true;
    });
  }
}
