// moba/engine/shop.js

import { ITEMS, MAX_ITEMS, POTION_COOLDOWN } from './config.js';
import { applyLevel } from './units.js';
import { inFountain, heal } from './combat.js';

const SELL_RATE = 0.7;

// ================================================================================================================================================================================================================================================
// buy
// Compra o item (só na fonte da base, com ouro e espaço; equipamento não repete). Devolve se comprou.

export function buy(sim, hero, itemId) {
  const item = ITEMS[itemId];
  if (!item || !hero.alive || !inFountain(hero) || hero.items.length >= MAX_ITEMS || hero.gold < item.cost) return false;
  if (!item.consumable && hero.items.includes(itemId)) return false;
  hero.gold -= item.cost;
  hero.items.push(itemId);
  applyLevel(hero);
  sim.emit({ type: 'bought', heroId: hero.id, item: itemId });
  return true;
}

// ================================================================================================================================================================================================================================================
// sell
// Vende o item do espaço slot por 70% do preço (só na fonte).

export function sell(sim, hero, slot) {
  const itemId = hero.items[slot];
  if (!itemId || !hero.alive || !inFountain(hero)) return false;
  hero.gold += Math.floor(ITEMS[itemId].cost * SELL_RATE);
  hero.items.splice(slot, 1);
  applyLevel(hero);
  hero.hp = Math.min(hero.hp, hero.maxHp);
  hero.mana = Math.min(hero.mana, hero.maxMana);
  return true;
}

// ================================================================================================================================================================================================================================================
// usePotion
// Bebe a poção do espaço slot (vida e/ou mana), com espera entre poções.

export function usePotion(sim, hero, slot) {
  const itemId = hero.items[slot];
  const item = itemId ? ITEMS[itemId] : null;
  if (!item || !item.consumable || !hero.alive || sim.time < hero.potionReadyAt) return false;
  if (item.consumable.hp) heal(sim, hero, item.consumable.hp);
  if (item.consumable.mana) hero.mana = Math.min(hero.maxMana, hero.mana + item.consumable.mana);
  hero.items.splice(slot, 1);
  hero.potionReadyAt = sim.time + POTION_COOLDOWN;
  sim.emit({ type: 'effect', name: 'poff', x: hero.x, y: hero.y, radius: 1 });
  return true;
}
