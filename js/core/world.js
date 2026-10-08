// js/core/world.js

import { CONFIG } from '../config.js';
import { isCreature } from './geometry.js';
import { floorBehavior, objectIdType, doorState, doorType } from '../../shared/assets.js';

export class World {

  // ================================================================================================================================================================================================================================================
  // constructor
  // Estado do mapa indexado por sqm, sem depender do navegador:
  //   - tiles: a pilha de cada sqm (x, y, z) — itens, criaturas e cadáveres;
  //   - floorTiles: andares com piso em cada coluna (x, y);
  //   - transitions: escada, topo de escada e buraco por sqm;
  //   - columns: objetos do mapa em cada coluna (x, y), de todos os andares;
  //   - blockers: quantos objetos intransponíveis há em cada sqm;
//   - topFloors: o piso de cima de cada sqm (o que diz se bloqueia ou machuca).

  constructor(width = CONFIG.mapWidth, height = CONFIG.mapHeight) {
    this.width = width;
    this.height = height;
    this.tiles = new Map();
    this.floorTiles = new Map();
    this.transitions = new Map();
    this.columns = new Map();
    this.blockers = new Map();
    this.topFloors = new Map();
    this.blockingEdges = new Map();
    this.throwBlockingEdges = new Set();
    this.objects = new Set();
    this.safeTiles = new Set();
    this.houses = new Map();
    this.houseTiles = new Map();
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
  // loadSafeZones
  // Zona segura: [[x, y, z], ...] (safeZoneData do map.json, pintada no editor).

  loadSafeZones(safeZoneData = []) {
    for (const [x, y, z] of safeZoneData) this.safeTiles.add(this.getTileKey(x, y, z));
  }

  // ================================================================================================================================================================================================================================================
  // loadHouses
  // Casas: [[x, y, z, nome, preço], ...] (houseData do map.json, pintada no
  // editor). Cada uma: { name, price, owner, guests, tiles }; dono e
  // convidados vêm do que o servidor guardou (systems/houses.js).

  loadHouses(houseData = []) {
    for (const [x, y, z, name, price] of houseData) {
      if (typeof name !== 'string' || !name) continue;
      let house = this.houses.get(name);
      if (!house) {
        house = { name, price: Math.max(0, Math.floor(Number(price)) || 0), owner: null, guests: [], tiles: [] };
        this.houses.set(name, house);
      }
      house.tiles.push({ x, y, z });
      this.houseTiles.set(this.getTileKey(x, y, z), house);
    }
  }

  // ================================================================================================================================================================================================================================================
  // houseAt

  houseAt(x, y, z) {
    return this.houseTiles.get(this.getTileKey(x, y, z)) || null;
  }

  // ================================================================================================================================================================================================================================================
  // mayEnter
  // Casa com dono: só ele e os convidados dele entram (pelo nome).

  mayEnter(entity, x, y, z) {
    const house = this.houseAt(x, y, z);
    if (!house || !house.owner) return true;
    const name = String(entity.name || '').toLowerCase();
    return !!entity.isPlayer && (house.owner.toLowerCase() === name || house.guests.some(g => g.toLowerCase() === name));
  }

  // ================================================================================================================================================================================================================================================
  // isSafe
  // Zona segura pintada ou sqm de casa.

  isSafe(x, y, z) {
    const key = this.getTileKey(x, y, z);
    return this.safeTiles.has(key) || this.houseTiles.has(key);
  }

  // ================================================================================================================================================================================================================================================
  // isInSafeZone
  // A criatura está num sqm de zona segura (pelo andar do sqm onde pisa).

  isInSafeZone(entity) {
    return this.isSafe(entity.x, entity.y, entity.z || 0);
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
    if (obj.floorType && !obj.isBorder) {
      this.registerFloor(obj.x, obj.y, obj.z || 0);
      this.topFloors.set(this.getTileKey(obj.x, obj.y, obj.z || 0), obj);
    }
    if (obj.isBorder && obj.floorType && floorBehavior(obj.floorType).edgeBlocks) {
      const key = this.getTileKey(obj.x, obj.y, obj.z || 0);
      this.blockingEdges.set(key, (this.blockingEdges.get(key) || 0) + 1);
    }
    if (obj.isBorder && obj.floorType && floorBehavior(obj.floorType).edgeBlocksThrow) this.throwBlockingEdges.add(this.getTileKey(obj.x, obj.y, obj.z || 0));
    if (obj.inStack) this.addToTile(obj, obj.x, obj.y, obj.z || 0);
  }

  // ================================================================================================================================================================================================================================================
  // removeObject
  // Tira o objeto do mapa (item pego do chão): o contrário de addObject.

  removeObject(obj) {
    if (!this.objects.has(obj)) return;
    this.objects.delete(obj);
    this.removeFromColumn(obj);
    if (obj.blocksMovement) this.changeBlockers(obj.x, obj.y, obj.z || 0, -1);
    if (obj.inStack) this.removeFromTile(obj, obj.x, obj.y, obj.z || 0);
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
  // getDoorAt / setDoorOpen
  // Porta de parede no sqm (x, y, z), ou null. setDoorOpen troca a peça pela
  // porta aberta/fechada (id, bloqueio e altura) e devolve o id antigo, ou
  // null se ela já estava assim.

  getDoorAt(x, y, z) {
    return this.getObjectsAt(x, y).find(obj => (obj.z ?? 0) === z && doorState(objectIdType(obj.id))) || null;
  }

  setDoorOpen(obj, open) {
    const type = objectIdType(obj.id);
    const state = doorState(type);
    if (!state || state.open === open) return null;
    const newType = doorType(type, open);
    const next = doorState(newType);
    const z = obj.z || 0;
    if (obj.blocksMovement && !next.blocksMovement) this.changeBlockers(obj.x, obj.y, z, -1);
    if (!obj.blocksMovement && next.blocksMovement) this.changeBlockers(obj.x, obj.y, z, 1);
    const oldId = obj.id;
    obj.id = newType + oldId.slice(type.length);
    obj.blocksMovement = next.blocksMovement;
    obj.hasVolume = next.hasVolume;
    return oldId;
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
      if (entity === ignore || !isCreature(entity)) continue;
      if (entity.isAlive && !entity.isAlive()) continue;
      if (enemiesPassable && entity.type === 'enemy') continue;
      return entity;
    }
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // isBlocked
  // Sqm intransponível: objeto que bloqueia, piso que bloqueia (água…) ou
  // criatura viva (menos ignore).

  isBlocked(x, y, z, ignore = null, enemiesPassable = false) {
    return this.hasBlockerAt(x, y, z) || this.isFloorBlocked(x, y, z) || this.getCreatureAt(x, y, z, ignore, enemiesPassable) !== null;
  }

  // ================================================================================================================================================================================================================================================
  // isBlockedExceptPlayers
  // Como isBlocked, mas player vivo não conta: quem nasce no sqm de outro
  // player fica no mesmo sqm até o primeiro passo.

  isBlockedExceptPlayers(x, y, z) {
    return this.hasBlockerAt(x, y, z) || this.isFloorBlocked(x, y, z) ||
      this.getTileEntities(x, y, z).some(entity => isCreature(entity) && !entity.isPlayer && (!entity.isAlive || entity.isAlive()));
  }

  // ================================================================================================================================================================================================================================================
  // isFloorBlocked / floorDamageAt
  // Pelo piso de cima do sqm (gerador → Pisos → Comportamento) ou por uma
  // borda de piso marcado com "Borda bloqueia" (a da água por cima da grama).
  // Piso que bloqueia não segura item nem impede arremesso por cima dele.

  isFloorBlocked(x, y, z) {
    const key = this.getTileKey(x, y, z);
    const top = this.topFloors.get(key);
    return (!!top && floorBehavior(top.floorType).blocks) || this.blockingEdges.has(key);
  }

  floorDamageAt(x, y, z) {
    const top = this.topFloors.get(this.getTileKey(x, y, z));
    return top ? floorBehavior(top.floorType).damage : 0;
  }

  // ================================================================================================================================================================================================================================================
  // hasThrowBlockingEdge
  // O sqm tem borda de piso marcada com "Borda barra arremesso" (a da caverna): item jogado e ataque de longe não passam.

  hasThrowBlockingEdge(x, y, z) {
    return this.throwBlockingEdges.has(this.getTileKey(x, y, z));
  }

// ================================================================================================================================================================================================================================================
  // registerTransition / getTransitionAt
  // Escada, topo de escada e buraco: pisar no sqm leva a entidade pra
  // (targetX, targetY, targetZ). Um sqm com transição conta como pisável.

  registerTransition(obj) {
    this.transitions.set(this.getTileKey(obj.x, obj.y, obj.z), obj);
  }

  // ================================================================================================================================================================================================================================================
  // unregisterTransition
  // Tira a transição do sqm (buraco de pá que fechou), se ainda for ela.

  unregisterTransition(obj) {
    const key = this.getTileKey(obj.x, obj.y, obj.z);
    if (this.transitions.get(key) === obj) this.transitions.delete(key);
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
