// js/models/player.js

import { Entity } from './entity.js';
import { calculateStats } from '../utils/helpers.js';
import { PLAYER_GENDERS, DEFAULT_GENDER } from '../../shared/catalog.js';

export class Player extends Entity {
  constructor(data) {
    super(data);
    this.isPlayer = true;
    this.name = data.name || 'Player';
    this.gender = PLAYER_GENDERS.includes(data.gender) ? data.gender : DEFAULT_GENDER;
    this.spawnX = data.x;
    this.spawnY = data.y;
    this.spawnZ = data.z || 0;
    this.xp = data.xp || 0;
    this.lvl = data.lvl || 1;
    this.nextLevelXp = this.calculateNextLevelXp();
    this.target = null;
    this.autoFollow = true;
    this.walk = { target: null, path: [] };
    this.walkDir = null;
    this.pendingDrag = null;
  }

  // ================================================================================================================================================================================================================================================
  // gainXp
  // Soma o XP e sobe quantos níveis ele pagar; o que sobra continua contando.
  // Cada nível novo recalcula vida, ataque, defesa e velocidade (vida cheia).
  // Devolve quantos níveis subiu.

  gainXp(amount) {
    this.xp += amount;
    let levels = 0;

    while (this.xp >= this.nextLevelXp) {
      this.xp -= this.nextLevelXp;
      this.lvl++;
      levels++;

      const stats = calculateStats(this.lvl);
      this.hp = stats.hp;
      this.maxHp = stats.hp;
      this.currentHp = stats.hp;
      this.atk = stats.atk;
      this.def = stats.def;
      this.spd = stats.spd;
      this.nextLevelXp = this.calculateNextLevelXp();
    }
    return levels;
  }

  calculateNextLevelXp() {
    return 100 + this.lvl * 20;
  }

  respawn(spot = { x: this.spawnX, y: this.spawnY }) {
    const xpLoss = Math.floor(this.xp * 0.2);
    this.xp = Math.max(0, this.xp - xpLoss);

    this.x = spot.x;
    this.y = spot.y;
    this.renderX = spot.x;
    this.renderY = spot.y;
    this.z = this.spawnZ;
    this.step = 0;
    this.renderZ = this.spawnZ;
    this.currentHp = this.hp;
    this.isTarget = false;
  }
}