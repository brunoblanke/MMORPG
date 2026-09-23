// js/models/player.js

import { Entity } from './entity.js';
import { calculateStats } from '../utils/helpers.js';
import { CONFIG } from '../config.js';

export class Player extends Entity {
  constructor(data) {
    super(data);
    this.isPlayer = true;
    this.spawnX = data.x;
    this.spawnY = data.y;
    this.xp = data.xp || 0;
    this.lvl = data.lvl || 1;
    this.nextLevelXp = this.calculateNextLevelXp();
  }

  gainXp(amount) {
    this.xp += amount;

    while (this.xp >= this.nextLevelXp) {
      this.xp -= this.nextLevelXp;
      this.lvl++;

      const stats = calculateStats(this.lvl);
      Object.assign(this, stats);
      this.maxHp = stats.hp;
      this.currentHp = stats.hp;
      this.nextLevelXp = this.calculateNextLevelXp();
    }
  }

  calculateNextLevelXp() {
    return 100 + this.lvl * 20;
  }

  respawn() {
    const xpLoss = Math.floor(this.xp * 0.2);
    this.xp = Math.max(0, this.xp - xpLoss);

    this.x = this.spawnX;
    this.y = this.spawnY;
    this.renderX = this.spawnX;
    this.renderY = this.spawnY;
    this.z = 0;
    this.step = 0;
    this.renderZ = 0;
    this.currentHp = this.hp;
    this.isTarget = false;
  }

  getFrameDuration() {
    const base = CONFIG.playerFrameDuration || 150;
    const speedFactor = Math.max(0.3, 1 - (this.spd / 500));
    return Math.max(50, base * speedFactor) / CONFIG.speedScale;
  }
}