// js/models/player.js

import { Entity } from './entity.js';
import { playerStats } from '../utils/helpers.js';
import { PLAYER_GENDERS, DEFAULT_GENDER } from '../../shared/catalog.js';
import { isValidFloor } from '../../shared/constants.js';
import { EQUIP_SLOTS, FOOD_MAX_SECONDS, toPlain, equipBonus } from '../../shared/items.js';
import { newSkills, loadSkills } from '../../shared/skills.js';

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
    this.skills = newSkills();
    this.maxMana = this.calculateMaxMana();
    this.mana = this.maxMana;
    this.applyLevelStats();
    this.currentHp = this.hp;
    this.target = null;
    this.autoFollow = true;
    this.followMode = true;
    this.attackMode = false;
    this.aggro = [];
    this.walk = { target: null, path: [] };
    this.walkDir = null;
    this.pendingDrag = null;
  }

  // ================================================================================================================================================================================================================================================
  // gainXp
  // Soma o XP e sobe quantos níveis ele pagar; o que sobra continua contando.
  // Cada nível novo recalcula vida, ataque, defesa e velocidade e enche a
  // vida; a mana só ganha o que o máximo aumentou. Devolve quantos níveis subiu.

  gainXp(amount) {
    this.xp += amount;
    let levels = 0;

    while (this.xp >= this.nextLevelXp) {
      this.xp -= this.nextLevelXp;
      this.lvl++;
      levels++;
      const oldMana = this.maxMana;
      const mana = this.mana;
      this.applyLevelStats();
      this.currentHp = this.hp;
      this.mana = Math.min(this.maxMana, mana + Math.max(0, this.maxMana - oldMana));
    }
    return levels;
  }

  // ================================================================================================================================================================================================================================================
  // spd
  // Velocidade do nível (baseSpd) mais o que os itens do inventário somam
  // (bota de haste…). No cliente o player não tem equip: vale o que o
  // servidor mandou.

  get spd() {
    return this.baseSpd + (this.equip ? equipBonus(this.equip).speed : 0);
  }

  set spd(value) {
    this.baseSpd = value;
  }

  // ================================================================================================================================================================================================================================================
  // applyLevelStats
  // Vida máxima, ataque, defesa, velocidade e XP do próximo nível pelo lvl atual.

  applyLevelStats() {
    const stats = playerStats(this.lvl);
    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.atk = stats.atk;
    this.def = stats.def;
    this.spd = stats.spd;
    this.nextLevelXp = this.calculateNextLevelXp();
    this.maxMana = this.calculateMaxMana();
    this.mana = Math.min(this.mana ?? this.maxMana, this.maxMana);
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
      z: this.z || 0,
      skills: this.skills,
      mana: this.mana,
      equip: this.equip ? Object.fromEntries(EQUIP_SLOTS.map(key => [key, toPlain(this.equip[key])])) : null,
      layout: this.uiLayout || null,
      followMode: this.followMode,
      attackMode: this.attackMode,
      food: this.food || 0,
      quests: this.quests || []
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
    this.skills = loadSkills(saved.skills);
    this.mana = Number.isInteger(saved.mana) && saved.mana >= 0 ? Math.min(saved.mana, this.maxMana) : this.maxMana;
    if (typeof saved.followMode === 'boolean') this.followMode = this.autoFollow = saved.followMode;
    if (typeof saved.attackMode === 'boolean') this.attackMode = saved.attackMode;
    if (Array.isArray(saved.quests)) this.quests = saved.quests.filter(q => typeof q === 'string').slice(0, 1000);
    if (Number.isFinite(saved.food) && saved.food > 0) this.food = Math.min(saved.food, FOOD_MAX_SECONDS * 1000);

    const hasPosition = Number.isInteger(saved.x) && Number.isInteger(saved.y) && isValidFloor(saved.z);
    return hasPosition ? { x: saved.x, y: saved.y, z: saved.z } : null;
  }

  // ================================================================================================================================================================================================================================================
  // calculateNextLevelXp
  // XP do nível atual pro seguinte, igual ao Tibia: o total pra chegar no
  // nível L é 50/3 × (L³ − 6L² + 17L − 12), então de L pra L+1 são
  // 50 × (L² − 3L + 4) (100, 100, 200, 400, 700…).

  calculateNextLevelXp() {
    const L = this.lvl;
    return 50 * (L * L - 3 * L + 4);
  }

  // ================================================================================================================================================================================================================================================
  // calculateMaxMana
  // Mana máxima pelo nível, como no Tibia (55 no nível 1, +5 por nível).

  calculateMaxMana() {
    return playerStats(this.lvl).mana;
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
    this.mana = this.maxMana;
    this.isTarget = false;
  }
}