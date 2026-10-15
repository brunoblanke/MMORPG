// js/systems/inventory/corpses.js

import { getAsset, splitType, creatureLoot } from '../../../shared/assets.js';
import { LOOT_EFFECT } from '../../../shared/effects.js';
import { EQUIP_SLOTS, DEATH_DROP_CHANCE, newItem } from '../../../shared/items.js';
import { PLAYER_SPRITES, DEFAULT_GENDER } from '../../../shared/catalog.js';

// Métodos do InventoryController (js/systems/inventory.js) sobre os
// cadáveres: o loot da criatura (solto no chão) e o que o player deixa ao morrer.

const CORPSE_SIZE = 8;
const LOOT_RADIUS = 2;

export const corpseMethods = {

  // ================================================================================================================================================================================================================================================
  // rollLoot
  // Sorteia o loot da criatura (lootTable): os itens que caem agora, na hora da morte.

  rollLoot(enemy) {
    const items = [];
    for (const entry of this.lootTable[enemy.creature] || creatureLoot(enemy.creature)) {
      if (!entry || !getAsset(splitType(entry.tipo).asset) || Math.random() >= (entry.chance ?? 1)) continue;
      const min = Math.max(1, entry.min || 1);
      const max = Math.max(min, entry.max || min);
      items.push(newItem(this.nextUid(), entry.tipo, min + Math.floor(Math.random() * (max - min + 1))));
    }
    return items;
  },

  // ================================================================================================================================================================================================================================================
  // lootSpots
  // Os sqms livres e firmes até LOOT_RADIUS (2) sqm em volta da criatura, no andar dela.

  lootSpots(enemy) {
    const { world, movement } = this.sim;
    const z = enemy.z || 0;
    const spots = [];
    for (let x = enemy.x - LOOT_RADIUS; x <= enemy.x + LOOT_RADIUS; x++) {
      for (let y = enemy.y - LOOT_RADIUS; y <= enemy.y + LOOT_RADIUS; y++) {
        if (movement.isInsideMap(x, y) && world.hasFloorAt(x, y, z) && !world.isFloorBlocked(x, y, z) && !movement.isBlocked(x, y, z)) spots.push({ x, y });
      }
    }
    return spots;
  },

  // ================================================================================================================================================================================================================================================
  // scatterLoot
  // O loot não fica no cadáver (vazio): cada item cai num sqm sorteado a até 2 sqm em volta da criatura, com o brilho LOOT_EFFECT; sem sqm livre, cai onde ela morreu.

  scatterLoot(corpse, enemy) {
    const z = enemy.z || 0;
    const spots = this.lootSpots(enemy);
    for (const item of this.rollLoot(enemy)) {
      const spot = spots.length ? spots[Math.floor(Math.random() * spots.length)] : { x: enemy.x, y: enemy.y };
      this.mergeGroundStack(this.spawnGroundItem(item, spot.x, spot.y, z));
      this.sim.spells.showEffect(spot.x, spot.y, LOOT_EFFECT, undefined, z);
    }
    corpse.itemData = { uid: this.nextUid(), type: enemy.creature, items: new Array(CORPSE_SIZE).fill(null) };
  },

  // ================================================================================================================================================================================================================================================
  // fillPlayerCorpse
  // Morte do player: a mochila vai sempre pro corpo; cada outro item do
  // inventário, com DEATH_DROP_CHANCE (com caveira, tudo). O que cai sai do
  // inventário.

  fillPlayerCorpse(corpse, player) {
    const box = { uid: this.nextUid(), type: PLAYER_SPRITES[player.gender] || PLAYER_SPRITES[DEFAULT_GENDER], items: new Array(EQUIP_SLOTS.length).fill(null) };
    let slot = 0;
    const skulled = this.sim.social.hasSkull(player);
    for (const key of EQUIP_SLOTS) {
      const item = player.equip[key];
      if (!item) continue;
      if (key !== 'mochila' && !skulled && Math.random() >= DEATH_DROP_CHANCE) continue;
      box.items[slot++] = item;
      player.equip[key] = null;
    }
    player.openGround.clear();
    player.pendingInv = null;
    corpse.itemData = box;
    return box;
  },
};
