// js/services/stack-manager.js

import { CONFIG } from '../config.js';

export class StackManager {
  constructor() {
    this.tiles = new Map();
    this.floorTiles = new Map();
    this.transitions = new Map();
  }

  // ================================================================================================================================================================================
  // registerTransition / getTransitionAt
  // Escada, topo de escada e buraco: pisar no sqm leva a entidade pra
  // (targetX, targetY, targetZ). Um sqm com transição conta como pisável.

  registerTransition(obj) {
    this.transitions.set(this.getTileKey(obj.x, obj.y, obj.z), obj);
  }

  getTransitionAt(x, y, z) {
    return this.transitions.get(this.getTileKey(x, y, z)) || null;
  }

  // ================================================================================================================================================================================
  // getTileKey

  getTileKey(x, y, z) {
    return `${x},${y},${z}`;
  }

  // ================================================================================================================================================================================
  // getColumnKey

  getColumnKey(x, y) {
    return `${x},${y}`;
  }

  // ================================================================================================================================================================================
  // getTileEntities

  getTileEntities(x, y, z) {
    return this.tiles.get(this.getTileKey(x, y, z)) || [];
  }

  // ================================================================================================================================================================================
  // addToTile

  addToTile(entity, x, y, z) {
    const key = this.getTileKey(x, y, z);
    let list = this.tiles.get(key);
    if (!list) {
      list = [];
      this.tiles.set(key, list);
    }

    const isCreature = entity.isPlayer === true || entity.type === "enemy";

    if (isCreature) {
      list.push(entity);
    } else {
      const firstCreatureIndex = list.findIndex(e => e.isPlayer === true || e.type === "enemy");
      if (firstCreatureIndex === -1) {
        list.push(entity);
      } else {
        list.splice(firstCreatureIndex, 0, entity);
      }
    }

    this.renumber(list, 0);
  }

  // ================================================================================================================================================================================
  // renumber
  // Uma pilha só por sqm: o chão (pisos/bordas) fica com order <= 0 — o de cima
  // é 0 — e o que está sobre ele (itens, criaturas, cadáveres) começa em 1.

  renumber(list, fromIndex) {
    for (let i = fromIndex; i < list.length; i++) {
      list[i].order = i + 1;
    }
  }

  // ================================================================================================================================================================================
  // removeFromTile

  removeFromTile(entity, x, y, z) {
    const key = this.getTileKey(x, y, z);
    const list = this.tiles.get(key);
    if (!list) return;

    const index = list.indexOf(entity);
    if (index === -1) return;

    list.splice(index, 1);
    this.renumber(list, index);

    if (list.length === 0) {
      this.tiles.delete(key);
    }
  }

  // ================================================================================================================================================================================
  // moveEntityTile

  moveEntityTile(entity, oldX, oldY, oldZ, newX, newY, newZ) {
    this.removeFromTile(entity, oldX, oldY, oldZ);
    this.addToTile(entity, newX, newY, newZ);
  }

  // ================================================================================================================================================================================
  // getStepHeight

  getStepHeight(x, y, z) {
    let maxStep = 0;
    for (const entity of this.getTileEntities(x, y, z)) {
      if (entity.hasVolume) {
        const entityTop = (entity.step || 0) + 1;
        maxStep = Math.max(maxStep, entityTop);
      }
    }
    return maxStep;
  }

  // ================================================================================================================================================================================
  // registerFloor

  registerFloor(x, y, z) {
    const key = this.getColumnKey(x, y);
    let floors = this.floorTiles.get(key);
    if (!floors) {
      floors = new Set();
      this.floorTiles.set(key, floors);
    }
    floors.add(z);
  }

  // ================================================================================================================================================================================
  // unregisterFloor

  unregisterFloor(x, y, z) {
    const key = this.getColumnKey(x, y);
    const floors = this.floorTiles.get(key);
    if (!floors) return;
    floors.delete(z);
    if (floors.size === 0) {
      this.floorTiles.delete(key);
    }
  }

  // ================================================================================================================================================================================
  // hasFloorAt

  hasFloorAt(x, y, z) {
    const floors = this.floorTiles.get(this.getColumnKey(x, y));
    return floors ? floors.has(z) : false;
  }

  // ================================================================================================================================================================================
  // getPassableStep

  getPassableStep(x, y, z, currentStep = null) {
    const stepHeight = this.getStepHeight(x, y, z);
    const hasFloor = this.hasFloorAt(x, y, z) || !!this.getTransitionAt(x, y, z);

    if (!hasFloor && stepHeight === 0) {
      return null;
    }

    const candidates = (hasFloor && stepHeight === 0) ? [0] : [stepHeight];

    if (currentStep === null) {
      return Math.max(...candidates);
    }

    let best = candidates[0];
    let bestDiff = Math.abs(best - currentStep);
    for (const step of candidates) {
      const diff = Math.abs(step - currentStep);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = step;
      }
    }
    return best;
  }
}
