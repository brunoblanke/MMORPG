// js/systems/inventory/ground.js

import { GameObject } from '../../models/game-object.js';
import { getAdjacentPositions } from '../../utils/helpers.js';
import { objectIdType, objectProps, getAsset, splitType, objectUse } from '../../../shared/assets.js';
import { itemInfo, newItem } from '../../../shared/items.js';

// Métodos do InventoryController (js/systems/inventory.js) sobre o chão:
// pegar, jogar e juntar pilhas no chão, abrir e fechar caixas e cadáveres e
// andar até o objeto pra usar.

export const groundMethods = {

  // ================================================================================================================================================================================================================================================
  // isPickable
  // Objeto do chão que dá pra pôr no inventário: móvel e de uma folha conhecida.

  isPickable(obj) {
    return !!obj && obj.movable === true && !obj.floorType && !obj.isBorder && !obj.stairDirection && !obj.isCorpse &&
      this.sim.world.objects.has(obj) && !!getAsset(splitType(objectIdType(obj.id)).asset);
  },

  // ================================================================================================================================================================================================================================================
  // groundItem
  // O item de um objeto do chão (criado na primeira vez que alguém mexe nele).

  groundItem(obj) {
    if (!obj.itemData) {
      obj.itemData = newItem(this.nextUid(), objectIdType(obj.id), obj.count || 1);
      if (obj.data && obj.data.texto) obj.itemData.texto = obj.data.texto;
      const inside = obj.itemData.items && obj.data && objectUse(objectIdType(obj.id)) !== 'bau-quest' ? obj.data.itens : null;
      if (Array.isArray(inside)) {
        inside.filter(e => e && getAsset(splitType(e.tipo).asset)).slice(0, obj.itemData.items.length)
          .forEach((e, i) => { obj.itemData.items[i] = newItem(this.nextUid(), e.tipo, e.count || 1); });
      }
    }
    return obj.itemData;
  },

  // ================================================================================================================================================================================================================================================
  // isOpenable
  // Dá pra abrir: caixa do chão (solta ou fixa no mapa, sem Uso) ou cadáver
  // com loot (ainda no mapa).

  isOpenable(obj) {
    if (!obj) return false;
    if (obj.isCorpse) return !!obj.itemData && this.sim.deadBodies.includes(obj);
    const fixed = !obj.floorType && !obj.isBorder && !obj.stairDirection && this.sim.world.objects.has(obj) &&
      !!getAsset(splitType(objectIdType(obj.id)).asset) && !objectUse(objectIdType(obj.id)) && itemInfo(objectIdType(obj.id)).size > 0;
    return (this.isPickable(obj) || fixed) && !!this.groundItem(obj).items;
  },

  // ================================================================================================================================================================================================================================================
  // openGroundObjects
  // Caixas do chão que o player abriu e ainda alcança.

  openGroundObjects(player) {
    return [...player.openGround].map(id => this.sim.getItem(id)).filter(obj => this.isOpenable(obj) && this.isNear(player, obj));
  },

  // ================================================================================================================================================================================================================================================
  // canThrow
  // Nada intransponível entre o player e o sqm (mesma linha do arremesso do chão).

  canThrow(player, dest) {
    const probe = { blocksMovement: false, x: player.x, y: player.y, z: player.z || 0 };
    return this.sim.objectDrag.isThrowPathClear(player, probe, dest.x, dest.y, dest.z);
  },

  // ================================================================================================================================================================================================================================================
  // dropOnGround
  // Joga o item no sqm: nasce aos pés do player e voa até lá (object-drag.js:
  // cai por buraco, precisa de apoio; sem apoio, fica aos pés do player).

  dropOnGround(player, item, x, y, z) {
    const obj = this.spawnGroundItem(item, player.x, player.y, player.z || 0);
    this.sim.objectDrag.moveObject(player, obj, x, y, z);
  },

  // ================================================================================================================================================================================================================================================
  // spawnGroundItem
  // Objeto novo no chão com o item (e o que estiver dentro dele).

  spawnGroundItem(item, x, y, z) {
    const { world, objects, objectsById } = this.sim;
    const props = objectProps(item.type);
    this.objectCounter++;
    const obj = new GameObject({
      id: `${item.type}_${this.objectCounter}`,
      x, y, z,
      step: this.sim.movement.getStepHeight(x, y, z),
      movable: true,
      hasVolume: props.hasVolume,
      blocksMovement: props.blocksMovement
    });
    obj.itemData = item;
    objects.push(obj);
    objectsById.set(obj.id, obj);
    world.addObject(obj);
    return obj;
  },

  // ================================================================================================================================================================================================================================================
  // mergeGroundStack
  // Item de pilha que chega num sqm com uma pilha igual (a de cima) junta
  // nela até o máximo, como no Tibia; o que sobra fica como estava. Assim o
  // desenho da pilha muda com a quantidade.

  mergeGroundStack(obj) {
    if (!this.isPickable(obj)) return;
    const type = objectIdType(obj.id);
    const stack = itemInfo(type).stack;
    if (!stack) return;
    const z = obj.z || 0;
    const target = this.sim.world.getObjectsAt(obj.x, obj.y)
      .filter(other => other !== obj && (other.z || 0) === z && objectIdType(other.id) === type && this.isPickable(other))
      .sort((a, b) => (b.order || 0) - (a.order || 0))
      .find(other => (this.groundItem(other).count || 1) < stack);
    if (!target) return;

    const item = this.groundItem(obj);
    const into = this.groundItem(target);
    const taken = Math.min(item.count || 1, stack - (into.count || 1));
    into.count = (into.count || 1) + taken;
    item.count = (item.count || 1) - taken;
    if (item.count <= 0) this.removeGroundObject(obj);
  },

  // ================================================================================================================================================================================================================================================
  // removeGroundObject
  // Tira o objeto do chão (item pego); o que estava em cima dele desce.

  removeGroundObject(obj) {
    const { world, objectsById, objectDrag } = this.sim;
    world.removeObject(obj);
    objectsById.delete(obj.id);
    const index = this.sim.objects.indexOf(obj);
    if (index > -1) this.sim.objects.splice(index, 1);
    objectDrag.dropUnsupportedEntities(obj.x, obj.y, obj.z || 0);
    for (const player of this.sim.players) player.openGround.delete(obj.id);
  },

  // ================================================================================================================================================================================================================================================
  // walkNextTo
  // Leva o player até um sqm colado no objeto e guarda o comando pra quando chegar.

  walkNextTo(player, obj, command) {
    const { movement, control } = this.sim;
    const floor = obj.z || 0;
    let best = null;
    let bestDist = Infinity;
    for (const pos of getAdjacentPositions(obj.x, obj.y)) {
      if (!movement.isInsideMap(pos.x, pos.y) || movement.isBlocked(pos.x, pos.y, floor)) continue;
      if (movement.getPassableStep(pos.x, pos.y, floor) === null) continue;
      const d = Math.max(Math.abs(player.x - pos.x), Math.abs(player.y - pos.y));
      if (d < bestDist) { bestDist = d; best = pos; }
    }
    if (!best) return this.message(player, 'Não dá pra chegar até lá.');
    player.pendingInv = { command, objId: obj.id };
    control.setWalkTarget(player, best.x, best.y, floor);
  },

  // ================================================================================================================================================================================================================================================
  // open
  // Comando openContainer (duplo clique na caixa ou no cadáver): colado ou em
  // cima, abre; longe, o player anda até um sqm colado e abre ao chegar. Se
  // ela sumir no caminho, ele só termina de andar.

  open(player, itemId) {
    const obj = this.sim.getItem(itemId);
    if (!this.isOpenable(obj)) return;
    if (this.isNear(player, obj)) {
      player.openGround.add(obj.id);
      return;
    }
    this.walkNextTo(player, obj, { type: 'openContainer', itemId });
  },

  // ================================================================================================================================================================================================================================================
  // close
  // Comando closeContainer: fecha a caixa do chão ou o depósito (a janela
  // sumiu na tela).

  close(player, itemId) {
    player.openGround.delete(itemId);
    if (player.openDepot === itemId) player.openDepot = null;
  },
};
