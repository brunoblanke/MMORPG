// moba/engine/stats.js

import { HEROES, ITEMS, BUFFS } from './config.js';

const BONUS_KEYS = ['attack', 'power', 'hp', 'mana', 'armor', 'magicResist', 'speed', 'hpRegen', 'attackSpeed'];

// ================================================================================================================================================================================================================================================
// bonusOf
// A soma dos números dos itens do herói.

export function bonusOf(items) {
  const bonus = Object.fromEntries(BONUS_KEYS.map(key => [key, 0]));
  for (const id of items) for (const [key, value] of Object.entries(ITEMS[id].stats)) bonus[key] += value;
  return bonus;
}

// ================================================================================================================================================================================================================================================
// buffFactor
// O multiplicador do bônus (ataque, poder ou velocidade) dos buffs de objetivo que o herói tem agora.

export function buffFactor(sim, hero, key) {
  let factor = 1;
  for (const [id, until] of Object.entries(hero.buffs)) if (sim.time < until) factor *= BUFFS[id][key];
  return factor;
}

// ================================================================================================================================================================================================================================================
// attackOf
// O dano do ataque básico do herói (nível, itens e buffs).

export function attackOf(sim, hero) {
  const stats = HEROES[hero.vocation];
  return (stats.damage + stats.damagePerLevel * (hero.level - 1) + hero.bonus.attack) * buffFactor(sim, hero, 'attack');
}

// ================================================================================================================================================================================================================================================
// abilityScale
// O multiplicador do dano (ou cura) da habilidade: físico cresce com ataque, o resto com poder mágico.

export function abilityScale(sim, hero, ability) {
  if (ability.element === 'physical') return (1 + hero.bonus.attack / 80) * buffFactor(sim, hero, 'attack');
  return (1 + hero.bonus.power / 100) * buffFactor(sim, hero, 'power');
}

// ================================================================================================================================================================================================================================================
// cooldownOf
// A espera entre ataques básicos com a velocidade de ataque dos itens.

export function cooldownOf(hero, base) {
  return base / (1 + hero.bonus.attackSpeed / 100);
}

// ================================================================================================================================================================================================================================================
// hasBuff
// O buff id está ativo no herói.

export function hasBuff(sim, hero, id) {
  return sim.time < (hero.buffs[id] || 0);
}
