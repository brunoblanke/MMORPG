// js/models/player.js

import { Entity } from './entity.js';
import { playerStats } from '../utils/helpers.js';
import { PLAYER_GENDERS, DEFAULT_GENDER } from '../../shared/catalog.js';
import { isValidFloor } from '../../shared/constants.js';
import { EQUIP_SLOTS, FOOD_MAX_SECONDS, toPlain, equipBonus } from '../../shared/items.js';
import { newSkills, loadSkills, loseSkills } from '../../shared/skills.js';
import { vocationOf } from '../../shared/vocations.js';

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
    this.vocation = vocationOf(data.vocation);
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
    this.missions = {};
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
  // (bota de haste…) e os estados (lento, rápido: speedMod). No cliente o player não tem equip: vale o que o
  // servidor mandou.

  get spd() {
    return Math.max(1, this.baseSpd + (this.equip ? equipBonus(this.equip).speed : 0) + (this.speedMod || 0));
  }

  set spd(value) {
    this.baseSpd = value;
  }

  // ================================================================================================================================================================================================================================================
  // applyLevelStats
  // Vida e mana máximas, velocidade e XP do próximo nível pelo lvl atual e
  // pela vocação.

  applyLevelStats() {
    const stats = playerStats(this.lvl, this.vocation);
    this.hp = stats.hp;
    this.maxHp = stats.hp;
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
      vocation: this.vocation,
      home: { x: this.spawnX, y: this.spawnY, z: this.spawnZ },
      currentHp: this.currentHp,
      x: this.x,
      y: this.y,
      z: this.z || 0,
      skills: this.skills,
      mana: this.mana,
      equip: this.equip ? Object.fromEntries(EQUIP_SLOTS.map(key => [key, toPlain(this.equip[key])])) : null,
      depot: this.depot ? this.depot.items.map(toPlain) : null,
      layout: this.uiLayout || null,
      followMode: this.followMode,
      attackMode: this.attackMode,
      food: this.food || 0,
      quests: this.quests || [],
      missions: this.missions || {}
    };
  }

  // ================================================================================================================================================================================================================================================
  // loadSave
  // Volta nível, XP e vida guardados (valores fora do lugar são corrigidos).
  // Devolve a posição guardada, ou null se ela não serve (o player fica no spawn).

  loadSave(saved) {
    if (!saved || typeof saved !== 'object') return null;

    if (Number.isInteger(saved.lvl) && saved.lvl >= 1) this.lvl = saved.lvl;
    this.vocation = vocationOf(saved.vocation);
    const home = saved.home;
    if (home && Number.isInteger(home.x) && Number.isInteger(home.y) && isValidFloor(home.z)) Object.assign(this, { spawnX: home.x, spawnY: home.y, spawnZ: home.z });
    this.applyLevelStats();
    this.xp = Number.isInteger(saved.xp) ? Math.min(Math.max(saved.xp, 0), this.nextLevelXp - 1) : 0;
    this.currentHp = Number.isInteger(saved.currentHp) && saved.currentHp > 0 ? Math.min(saved.currentHp, this.hp) : this.hp;
    this.skills = loadSkills(saved.skills, this.vocation);
    this.mana = Number.isInteger(saved.mana) && saved.mana >= 0 ? Math.min(saved.mana, this.maxMana) : this.maxMana;
    if (typeof saved.followMode === 'boolean') this.followMode = this.autoFollow = saved.followMode;
    if (typeof saved.attackMode === 'boolean') this.attackMode = saved.attackMode;
    if (Array.isArray(saved.quests)) this.quests = saved.quests.filter(q => typeof q === 'string').slice(0, 1000);
    if (saved.missions && typeof saved.missions === 'object') this.missions = savedMissions(saved.missions);
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
  // Mana máxima pelo nível e pela vocação, como no Tibia.

  calculateMaxMana() {
    return playerStats(this.lvl, this.vocation).mana;
  }

  // ================================================================================================================================================================================================================================================
  // setVocation
  // Passa a ter a vocação: vida, mana e cap do nível nela e o ritmo dos skills.

  setVocation(vocation) {
    this.vocation = vocationOf(vocation);
    this.applyLevelStats();
    this.skills = loadSkills(this.skills, this.vocation);
  }

  // ================================================================================================================================================================================================================================================
  // totalXp
  // Toda a XP do player: a que leva até o nível atual mais a que já tem nele.

  totalXp() {
    return xpForLevel(this.lvl) + this.xp;
  }

  // ================================================================================================================================================================================================================================================
  // applyDeathPenalty
  // Morte como no Tibia atual (sem blessing nem promotion): abaixo do nível
  // 24 perde 10% da XP total; dali pra cima, (L + 50) / 100 × 50 ×
  // (L² − 5L + 8). Pode cair de nível. Os skills perdem a mesma fração.

  applyDeathPenalty() {
    const total = this.totalXp();
    const L = this.lvl;
    const loss = Math.min(total, L < 24 ? Math.floor(total * 0.1) : Math.floor((L + 50) / 100 * 50 * (L * L - 5 * L + 8)));
    const left = total - loss;
    let lvl = 1;
    while (xpForLevel(lvl + 1) <= left) lvl++;
    this.lvl = lvl;
    this.applyLevelStats();
    this.xp = left - xpForLevel(lvl);
    if (total > 0) loseSkills(this.skills, loss / total, this.vocation);
  }

  // ================================================================================================================================================================================================================================================
  // respawn
  // Depois da morte: perde XP e skills e volta no spot com vida e mana cheias.

  respawn(spot = { x: this.spawnX, y: this.spawnY }) {
    this.applyDeathPenalty();
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
    this.conditions = {};
    this.speedMod = 0;
  }
}

// ================================================================================================================================================================================================================================================
// xpForLevel
// XP total pra chegar no nível L, como no Tibia: 50/3 × (L³ − 6L² + 17L − 12).

export function xpForLevel(L) {
  return Math.round(50 / 3 * (L * L * L - 6 * L * L + 17 * L - 12));
}

// ================================================================================================================================================================================================================================================
// savedMissions
// As missões guardadas, só as entradas no formato certo.

function savedMissions(saved) {
  const missions = {};
  for (const [id, m] of Object.entries(saved).slice(0, 500)) {
    if (!m || !['active', 'done'].includes(m.state) || !['item', 'kill'].includes(m.kind) || typeof m.target !== 'string') continue;
    missions[id] = { state: m.state, name: String(m.name || id).slice(0, 60), kind: m.kind, target: m.target, need: Math.max(1, Math.floor(Number(m.need)) || 1), count: Math.max(0, Math.floor(Number(m.count)) || 0) };
  }
  return missions;
}
