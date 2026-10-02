// js/systems/inventory/corpses.js

import { getAsset, splitType, creatureLoot } from '../../../shared/assets.js';
import { EQUIP_SLOTS, DEATH_DROP_CHANCE, newItem } from '../../../shared/items.js';
import { PLAYER_SPRITES, DEFAULT_GENDER } from '../../../shared/catalog.js';

// Métodos do InventoryController (js/systems/inventory.js) sobre os
// cadáveres: o loot da criatura e o que o player deixa ao morrer.

const CORPSE_SIZE = 8;

export const corpseMethods = {

  // ================================================================================================================================================================================================================================================
  // fillCorpse
  // O cadáver da criatura vira container com o loot dela (lootTable), sorteado
  // na hora da morte.

  fillCorpse(corpse, enemy) {
    const box = { uid: this.nextUid(), type: enemy.creature, items: new Array(CORPSE_SIZE).fill(null) };
    let slot = 0;
    for (const entry of this.lootTable[enemy.creature] || creatureLoot(enemy.creature)) {
      if (slot >= CORPSE_SIZE) break;
      if (!entry || !getAsset(splitType(entry.tipo).asset) || Math.random() >= (entry.chance ?? 1)) continue;
      const min = Math.max(1, entry.min || 1);
      const max = Math.max(min, entry.max || min);
      box.items[slot++] = newItem(this.nextUid(), entry.tipo, min + Math.floor(Math.random() * (max - min + 1)));
    }
    corpse.itemData = box;
    return box;
  },

  // ================================================================================================================================================================================================================================================
  // fillPlayerCorpse
  // Morte do player: a mochila vai sempre pro corpo; cada outro item do
  // inventário, com DEATH_DROP_CHANCE. O que cai sai do inventário.

  fillPlayerCorpse(corpse, player) {
    const box = { uid: this.nextUid(), type: PLAYER_SPRITES[player.gender] || PLAYER_SPRITES[DEFAULT_GENDER], items: new Array(EQUIP_SLOTS.length).fill(null) };
    let slot = 0;
    for (const key of EQUIP_SLOTS) {
      const item = player.equip[key];
      if (!item) continue;
      if (key !== 'mochila' && Math.random() >= DEATH_DROP_CHANCE) continue;
      box.items[slot++] = item;
      player.equip[key] = null;
    }
    player.openGround.clear();
    player.pendingInv = null;
    corpse.itemData = box;
    return box;
  },
};
