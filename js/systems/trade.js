// js/systems/trade.js

import { getAsset, splitType } from '../../shared/assets.js';
import { itemInfo, newItem, weightOf, EQUIP_SLOTS } from '../../shared/items.js';

// Compra e venda com NPC: o dinheiro é o que o player carrega em moedas
// (gold vale 1, platinum vale 100), em qualquer lugar do inventário. Ao
// pagar, todas as moedas saem e o troco volta nos mesmos lugares, nas
// moedas maiores primeiro. O item comprado vai pra mochila. Na venda, o
// item sai da mochila (o que está vestido não entra) e as moedas entram
// nela; o que não couber cai aos pés do player.

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
// Tira price em moedas e devolve o troco, nas moedas maiores, nos lugares
// das moedas e, se faltar, nos espaços vazios da mochila. false (sem mexer em
// nada) se não tem o bastante ou se o troco não cabe.

export function pay(player, price, nextUid) {
  const slots = coinSlots(player);
  const total = slots.reduce((sum, slot) => sum + slot.value * (slot.list[slot.key].count || 1), 0);
  if (total < price) return false;
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
  const room = [...slots, ...bagSlots(player).filter(({ list, key }) => !list[key])];
  if (stacks.length > room.length) return false;
  for (const slot of slots) slot.list[slot.key] = null;
  stacks.forEach((item, i) => { room[i].list[room[i].key] = item; });
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
  const free = bag.items.indexOf(null);
  if (free < 0) return 'space';
  bag.items[free] = item;
  if (!pay(player, price, () => inventory.nextUid())) {
    bag.items[free] = null;
    return 'space';
  }
  return 'ok';
}

// ================================================================================================================================================================================================================================================
// itemName

export function itemName(type) {
  return itemInfo(type).name;
}

// ================================================================================================================================================================================================================================================
// bagSlots
// Os espaços de dentro da mochila (e dos containers dentro dela): [{ list, key }].

function bagSlots(player) {
  const slots = [];
  const visit = (container) => {
    container.items.forEach((item, i) => {
      slots.push({ list: container.items, key: i });
      if (item && Array.isArray(item.items)) visit(item);
    });
  };
  const bag = player.equip && player.equip.mochila;
  if (bag && Array.isArray(bag.items)) visit(bag);
  return slots;
}

// ================================================================================================================================================================================================================================================
// countInBag
// Quantos do item o player tem na mochila (container com coisa dentro não
// conta: não dá pra vender).

export function countInBag(player, type) {
  return bagSlots(player).reduce((sum, { list, key }) => sum + (sellable(list[key], type) ? list[key].count || 1 : 0), 0);
}

// ================================================================================================================================================================================================================================================
// sellable

function sellable(item, type) {
  return !!item && item.type === type && !(Array.isArray(item.items) && item.items.some(Boolean));
}

// ================================================================================================================================================================================================================================================
// give
// Põe value em moedas na mochila: junta nas pilhas iguais, depois nos
// espaços vazios; o resto cai aos pés do player.

export function give(sim, player, value) {
  const inventory = sim.inventory;
  let left = value;
  for (const coin of COINS) {
    if (!getAsset(splitType(coin.type).asset)) continue;
    let count = Math.floor(left / coin.value);
    left -= count * coin.value;
    const stack = itemInfo(coin.type).stack || 1;
    for (const { list, key } of bagSlots(player)) {
      const item = list[key];
      if (count <= 0) break;
      if (!item || item.type !== coin.type || (item.count || 1) >= stack) continue;
      const add = Math.min(count, stack - (item.count || 1));
      item.count = (item.count || 1) + add;
      count -= add;
    }
    while (count > 0) {
      const item = newItem(inventory.nextUid(), coin.type, count);
      count -= item.count || 1;
      const free = bagSlots(player).find(({ list, key }) => !list[key]);
      if (free) free.list[free.key] = item;
      else inventory.mergeGroundStack(inventory.spawnGroundItem(item, player.x, player.y, player.z || 0));
    }
  }
}

// ================================================================================================================================================================================================================================================
// sell
// O player vende amount do item (type) por price cada: precisa ter na
// mochila. Devolve 'ok' ou 'item'.

export function sell(sim, player, type, price, amount) {
  if (countInBag(player, type) < amount) return 'item';
  let left = amount;
  for (const { list, key } of bagSlots(player).reverse()) {
    const item = list[key];
    if (left <= 0) break;
    if (!sellable(item, type)) continue;
    const taken = Math.min(left, item.count || 1);
    left -= taken;
    if (taken >= (item.count || 1)) list[key] = null;
    else item.count -= taken;
  }
  give(sim, player, price * amount);
  return 'ok';
}

// ================================================================================================================================================================================================================================================
// giveItem
// Põe count do item na mochila: junta nas pilhas iguais, depois nos espaços
// vazios; sem espaço, aos pés do player.

export function giveItem(sim, player, type, count = 1) {
  const inventory = sim.inventory;
  const stack = itemInfo(type).stack;
  let left = count;
  for (const { list, key } of stack ? bagSlots(player) : []) {
    const item = list[key];
    if (left <= 0) break;
    if (!item || item.type !== type || (item.count || 1) >= stack) continue;
    const add = Math.min(left, stack - (item.count || 1));
    item.count = (item.count || 1) + add;
    left -= add;
  }
  while (left > 0) {
    const item = newItem(inventory.nextUid(), type, left);
    left -= item.count || 1;
    const free = bagSlots(player).find(({ list, key }) => !list[key]);
    if (free) free.list[free.key] = item;
    else inventory.mergeGroundStack(inventory.spawnGroundItem(item, player.x, player.y, player.z || 0));
  }
}
