// js/systems/trade.js

import { getAsset, splitType } from '../../shared/assets.js';
import { itemInfo, newItem, weightOf, EQUIP_SLOTS } from '../../shared/items.js';

// Compra com NPC: o dinheiro é o que o player carrega em moedas (gold vale
// 1, platinum vale 100), em qualquer lugar do inventário. Ao pagar, todas
// as moedas saem e o troco volta nos mesmos lugares, nas moedas maiores
// primeiro. O item comprado vai pra mochila.

export const COINS = [
  { type: 'itens/valiosos/platinum-coin', value: 100 },
  { type: 'itens/valiosos/gold-coin', value: 1 }
];

// ================================================================================================================================================================================================================================================
// coinSlots
// Onde há moedas: [{ list, key, value }] — list[key] é a pilha.

function coinSlots(player) {
  const slots = [];
  const visit = (list, key) => {
    const item = list[key];
    if (!item) return;
    const coin = COINS.find(c => c.type === item.type);
    if (coin) slots.push({ list, key, value: coin.value });
    if (Array.isArray(item.items)) item.items.forEach((_, i) => visit(item.items, i));
  };
  for (const key of EQUIP_SLOTS) visit(player.equip, key);
  return slots;
}

// ================================================================================================================================================================================================================================================
// moneyOf
// Quanto o player tem em moedas.

export function moneyOf(player) {
  return coinSlots(player).reduce((sum, slot) => sum + slot.value * (slot.list[slot.key].count || 1), 0);
}

// ================================================================================================================================================================================================================================================
// pay
// Tira price em moedas e devolve o troco (false se não tem o bastante).

export function pay(player, price, nextUid) {
  const slots = coinSlots(player);
  const total = slots.reduce((sum, slot) => sum + slot.value * (slot.list[slot.key].count || 1), 0);
  if (total < price) return false;
  for (const slot of slots) slot.list[slot.key] = null;
  let change = total - price;
  const stacks = [];
  for (const coin of COINS) {
    if (!getAsset(splitType(coin.type).asset)) continue;
    let count = Math.floor(change / coin.value);
    change -= count * coin.value;
    while (count > 0) {
      const item = newItem(nextUid(), coin.type, count);
      stacks.push(item);
      count -= item.count || 1;
    }
  }
  stacks.forEach((item, i) => {
    const slot = slots[i];
    if (slot) slot.list[slot.key] = item;
  });
  return true;
}

// ================================================================================================================================================================================================================================================
// buy
// O player compra o item (type) por price: precisa de dinheiro, de espaço na
// mochila e de cap. Devolve 'ok', 'money', 'bag', 'space' ou 'cap'.

export function buy(sim, player, type, price) {
  const inventory = sim.inventory;
  const item = newItem(inventory.nextUid(), type);
  if (moneyOf(player) < price) return 'money';
  const bag = player.equip && player.equip.mochila;
  if (!bag || !bag.items) return 'bag';
  if (inventory.capUsed(player) + weightOf(item) > inventory.capMax(player)) return 'cap';
  if (!bag.items.includes(null)) return 'space';
  pay(player, price, () => inventory.nextUid());
  const free = bag.items.indexOf(null);
  if (free < 0) return 'space';
  bag.items[free] = item;
  return 'ok';
}

// ================================================================================================================================================================================================================================================
// itemName

export function itemName(type) {
  return itemInfo(type).name;
}
