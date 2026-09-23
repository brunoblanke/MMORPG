// js/core/world.js

import { CONFIG } from '../config.js';

export class World {

  // ================================================================================================================================================================================================================================================
  // constructor
  // Estado do mapa indexado por sqm, sem depender do navegador:
  //   - tiles: a pilha de cada sqm (x, y, z) — itens, criaturas e cadáveres;
  //   - floorTiles: andares com piso em cada coluna (x, y);
  //   - transitions: escada, topo de escada e buraco por sqm;
  //   - columns: objetos do mapa em cada coluna (x, y), de todos os andares;
  //   - blockers: quantos objetos intransponíveis há em cada sqm.

  constructor(width = CONFIG.mapWidth, height = CONFIG.mapHeight) {
    this.width = width;
    this.height = height;
    this.tiles = new Map();
    this.floorTiles = new Map();
    this.transitions = new Map();
    this.columns = new Map();
    this.blockers = new Map();
    this.objects = new Set();
  }

  // ================================================================================================================================================================================================================================================
  // load
  // Registra os objetos do mapa (generateObjects), na ordem em que foram criados.

  load(objects) {
    for (const obj of objects) {
      this.addObject(obj);
    }
  }

  // ================================================================================================================================================================================================================================================
  // getTileKey

  getTileKey(x, y, z) {
    return `${x},${y},${z}`;
  }

  // ================================================================================================================================================================================================================================================
  // getColumnKey

  getColumnKey(x, y) {
    return `${x},${y}`;
  }

  // ================================================================================================================================================================================================================================================
  // isInside

  isInside(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  // ================================================================================================================================================================================================================================================
  // addObject
  // Objeto do mapa: entra na coluna, conta como bloqueio se for intransponível,
  // vira transição se for escada/buraco, vira piso se for piso (bordas não) e
  // entra na pilha do sqm se não for chão.

  addObject(obj) {
    this.objects.add(obj);
    this.addToColumn(obj);
    if (obj.blocksMovement) this.changeBlockers(obj.x, obj.y, obj.z || 0, 1);
    if (obj.stairDirection) this.registerTransition(obj);
    if (obj.floorType && !obj.isBorder) this.registerFloor(obj.x, obj.y, obj.z || 0);
    if (obj.inStack) this.addToTile(obj, obj.x, obj.y, obj.z || 0);
  }

  // ================================================================================================================================================================================================================================================
  // moveObject
  // Leva um objeto do mapa ou um cadáver pro sqm (x, y, z) — sempre pro topo da pilha.

  moveObject(obj, x, y, z) {
    const fromZ = obj.z || 0;
    const isMapObject = this.objects.has(obj);

    if (isMapObject) {
      this.removeFromColumn(obj);
      if (obj.blocksMovement) this.changeBlockers(obj.x, obj.y, fromZ, -1);
    }

    this.moveEntityTile(obj, obj.x, obj.y, fromZ, x, y, z);
    obj.x = x;
    obj.y = y;
    obj.z = z;

    if (isMapObject) {
      this.addToColumn(obj);
      if (obj.blocksMovement) this.changeBlockers(x, y, z, 1);
    }
  }

  // ================================================================================================================================================================================================================================================
  // addToColumn

  addToColumn(obj) {
    const key = this.getColumnKey(obj.x, obj.y);
    let list = this.columns.get(key);
    if (!list) {
      list = [];
      this.columns.set(key, list);
    }
    list.push(obj);
  }

  // ================================================================================================================================================================================================================================================
  // removeFromColumn

  removeFromColumn(obj) {
    const key = this.getColumnKey(obj.x, obj.y);
    const list = this.columns.get(key);
    if (!list) return;
    const index = list.indexOf(obj);
    if (index !== -1) list.splice(index, 1);
    if (list.length === 0) this.columns.delete(key);
  }

  // ================================================================================================================================================================================================================================================
  // getObjectsAt
  // Objetos do mapa na coluna (x, y), de todos os andares.

  getObjectsAt(x, y) {
    return this.columns.get(this.getColumnKey(x, y)) || [];
  }

  // ================================================================================================================================================================================================================================================
  // changeBlockers

  changeBlockers(x, y, z, delta) {
    const key = this.getTileKey(x, y, z);
    const count = (this.blockers.get(key) || 0) + delta;
    if (count > 0) {
      this.blockers.set(key, count);
    } else {
      this.blockers.delete(key);
    }
  }

  // ================================================================================================================================================================================================================================================
  // countBlockersAt
  // Objetos intransponíveis (parede etc.) no sqm; criaturas não contam.

  countBlockersAt(x, y, z) {
    return this.blockers.get(this.getTileKey(x, y, z)) || 0;
  }

  // ================================================================================================================================================================================================================================================
  // hasBlockerAt

  hasBlockerAt(x, y, z) {
    return this.countBlockersAt(x, y, z) > 0;
  }

  // ================================================================================================================================================================================================================================================
  // isCreature

  isCreature(entity) {
    return !entity.isCorpse && (entity.isPlayer === true || entity.type === 'enemy');
  }

  // ================================================================================================================================================================================================================================================
  // addCreature

  addCreature(creature) {
    this.addToTile(creature, creature.x, creature.y, creature.z || 0);
  }

  // ================================================================================================================================================================================================================================================
  // removeCreature

  removeCreature(creature) {
    this.removeFromTile(creature, creature.x, creature.y, creature.z || 0);
  }

  // ================================================================================================================================================================================================================================================
  // getCreatureAt
  // Criatura viva no sqm (x, y, z), fora ignore. Com enemiesPassable, só o player conta.

  getCreatureAt(x, y, z, ignore = null, enemiesPassable = false) {
    for (const entity of this.getTileEntities(x, y, z)) {
      if (entity === ignore || !this.isCreature(entity)) continue;
      if (entity.isAlive && !entity.isAlive()) continue;
      if (enemiesPassable && entity.type === 'enemy') continue;
      return entity;
    }
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // isBlocked
  // Sqm intransponível: objeto que bloqueia ou criatura viva (menos ignore).

  isBlocked(x, y, z, ignore = null, enemiesPassable = false) {
    return this.hasBlockerAt(x, y, z) || this.getCreatureAt(x, y, z, ignore, enemiesPassable) !== null;
  }

  // ================================================================================================================================================================================================================================================
  // registerTransition / getTransitionAt
  // Escada, topo de escada e buraco: pisar no sqm leva a entidade pra
  // (targetX, targetY, targetZ). Um sqm com transição conta como pisável.

  registerTransition(obj) {
    this.transitions.set(this.getTileKey(obj.x, obj.y, obj.z), obj);
  }

  getTransitionAt(x, y, z) {
    return this.transitions.get(this.getTileKey(x, y, z)) || null;
  }

  // ================================================================================================================================================================================================================================================
  // getTileEntities

  getTileEntities(x, y, z) {
    return this.tiles.get(this.getTileKey(x, y, z)) || [];
  }

  // ================================================================================================================================================================================================================================================
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

  // ================================================================================================================================================================================================================================================
  // renumber
  // Uma pilha só por sqm: o chão (pisos/bordas) fica com order <= 0 — o de cima
  // é 0 — e o que está sobre ele (itens, criaturas, cadáveres) começa em 1.

  renumber(list, fromIndex) {
    for (let i = fromIndex; i < list.length; i++) {
      list[i].order = i + 1;
    }
  }

  // ================================================================================================================================================================================================================================================
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

  // ================================================================================================================================================================================================================================================
  // moveEntityTile

  moveEntityTile(entity, oldX, oldY, oldZ, newX, newY, newZ) {
    this.removeFromTile(entity, oldX, oldY, oldZ);
    this.addToTile(entity, newX, newY, newZ);
  }

  // ================================================================================================================================================================================================================================================
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

  // ================================================================================================================================================================================================================================================
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

  // ================================================================================================================================================================================================================================================
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

  // ================================================================================================================================================================================================================================================
  // hasFloorAt

  hasFloorAt(x, y, z) {
    const floors = this.floorTiles.get(this.getColumnKey(x, y));
    return floors ? floors.has(z) : false;
  }

  // ================================================================================================================================================================================================================================================
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
