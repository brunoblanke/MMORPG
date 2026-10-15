// js/systems/dropped-items.js

export const DROPPED_LIFETIME_MS = 24 * 60 * 60 * 1000;
const SWEEP_MS = 60 * 1000;

// Itens jogados no chão pelos players (obj.droppedAt, hora de verdade): somem 24h
// depois de jogados. Não ficam guardados: reiniciar o servidor limpa o chão. Itens do
// mapa e do chão das casas com dono (guardado em houses.js) não entram.

export class DroppedItems {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
    this.nextSweep = 0;
  }

  // ================================================================================================================================================================================================================================================
  // expired

  expired(droppedAt) {
    return this.sim.wallClock() - droppedAt >= DROPPED_LIFETIME_MS;
  }

  // ================================================================================================================================================================================================================================================
  // ownedTiles
  // Os sqms das casas com dono (o chão delas fica por conta de houses.js).

  ownedTiles() {
    const keys = new Set();
    for (const house of this.sim.world.houses.values()) {
      if (house.owner) for (const t of house.tiles) keys.add(`${t.x},${t.y},${t.z}`);
    }
    return keys;
  }

  // ================================================================================================================================================================================================================================================
  // dropped
  // Os objetos jogados que contam (fora das casas com dono).

  dropped() {
    const owned = this.ownedTiles();
    return this.sim.objects.filter(obj => obj.droppedAt && !owned.has(`${obj.x},${obj.y},${obj.z || 0}`));
  }

  // ================================================================================================================================================================================================================================================
  // update
  // A cada minuto tira do chão o que passou de 24h.

  update() {
    const now = this.sim.wallClock();
    if (now < this.nextSweep) return;
    this.nextSweep = now + SWEEP_MS;
    for (const obj of this.dropped()) {
      if (this.expired(obj.droppedAt)) this.sim.inventory.removeGroundObject(obj);
    }
  }
}
