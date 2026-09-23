// js/models/player.js

import { Entity } from './entity.js';
import { calculateStats } from '../utils/helpers.js';
import { PLAYER_GENDERS, DEFAULT_GENDER } from '../../shared/catalog.js';
import { isValidFloor } from '../../shared/constants.js';

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
      this.applyLevelStats();
      this.currentHp = this.hp;
    }
    return levels;
  }

  // ================================================================================================================================================================================================================================================
  // applyLevelStats
  // Vida máxima, ataque, defesa, velocidade e XP do próximo nível pelo lvl atual.

  applyLevelStats() {
    const stats = calculateStats(this.lvl);
    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.atk = stats.atk;
    this.def = stats.def;
    this.spd = stats.spd;
    this.nextLevelXp = this.calculateNextLevelXp();
  }

  // ================================================================================================================================================================================================================================================
  // toSave
  // O que fica guardado do personagem entre uma sessão e outra.

  toSave() {
    return {
      name: this.name,
      gender: this.gender,
      lvl: this.lvl,
      xp: this.xp,
      currentHp: this.currentHp,
      x: this.x,
      y: this.y,
      z: this.z || 0
    };
  }

  // ================================================================================================================================================================================================================================================
  // loadSave
  // Volta nível, XP e vida guardados (valores fora do lugar são corrigidos).
  // Devolve a posição guardada, ou null se ela não serve (o player fica no spawn).

  loadSave(saved) {
    if (!saved || typeof saved !== 'object') return null;

    if (Number.isInteger(saved.lvl) && saved.lvl >= 1) this.lvl = saved.lvl;
    this.applyLevelStats();
    this.xp = Number.isInteger(saved.xp) ? Math.min(Math.max(saved.xp, 0), this.nextLevelXp - 1) : 0;
    this.currentHp = Number.isInteger(saved.currentHp) && saved.currentHp > 0 ? Math.min(saved.currentHp, this.hp) : this.hp;

    const hasPosition = Number.isInteger(saved.x) && Number.isInteger(saved.y) && isValidFloor(saved.z);
    return hasPosition ? { x: saved.x, y: saved.y, z: saved.z } : null;
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