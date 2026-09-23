// js/models/player.js

import { Entity } from './entity.js';
import { calculateStats } from '../utils/helpers.js';

export class Player extends Entity {
  constructor(data) {
    super(data);
    this.isPlayer = true;
    this.spawnX = data.x;
    this.spawnY = data.y;
    this.xp = data.xp || 0;
    this.lvl = data.lvl || 1;
    this.nextLevelXp = this.calculateNextLevelXp();
    this.target = null;
    this.autoFollow = true;
    this.walk = { target: null, path: [] };
    this.walkDir = null;
    this.pendingDrag = null;
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
}