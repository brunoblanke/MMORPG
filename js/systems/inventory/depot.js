// js/systems/inventory/depot.js

import { objectIdType } from '../../../shared/assets.js';
import { fromPlain } from '../../../shared/items.js';

// Métodos do InventoryController (js/systems/inventory.js) sobre o depósito:
// cada player tem o seu (DEPOT_SIZE espaços, guardado no personagem). Usar
// um objeto com Uso Depósito (gerador) abre o dele, em qualquer depósito do
// mapa; fecha quando ele se afasta. O que está no depósito não pesa.

export const DEPOT_SIZE = 30;

export const depotMethods = {

  // ================================================================================================================================================================================================================================================
  // setupDepot
  // O depósito guardado (saved: lista de itens), ou vazio.

  setupDepot(player, saved) {
    player.depot = { uid: this.nextUid(), type: '', items: new Array(DEPOT_SIZE).fill(null) };
    player.openDepot = null;
    if (!Array.isArray(saved)) return;
    saved.slice(0, DEPOT_SIZE).forEach((plain, i) => { player.depot.items[i] = fromPlain(plain, () => this.nextUid()); });
  },

  // ================================================================================================================================================================================================================================================
  // openDepotAt
  // O player (já colado no objeto) abre o depósito dele ali.

  openDepotAt(player, obj) {
    player.depot.type = objectIdType(obj.id);
    player.openDepot = obj.id;
  },

  // ================================================================================================================================================================================================================================================
  // depotObject
  // O objeto do depósito aberto, se o player ainda o alcança; senão fecha.

  depotObject(player) {
    if (!player.openDepot) return null;
    const obj = this.sim.getItem(player.openDepot);
    if (obj && this.sim.world.objects.has(obj) && this.isNear(player, obj)) return obj;
    player.openDepot = null;
    return null;
  }
};
