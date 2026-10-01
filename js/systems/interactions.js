// js/systems/interactions.js

import { GameObject } from '../models/game-object.js';
import { objectIdType, objectUse, openedAs, displayName, getAsset, splitType } from '../../shared/assets.js';
import { itemInfo, newItem, weightOf } from '../../shared/items.js';
import { getHoleTarget, toLowerLevel } from '../../shared/stairs.js';

// Objetos do mapa que se usam (gerador → Objetos → Uso):
//   placa     → o texto (editor) aparece no centro da tela;
//   livro     → abre o texto numa janela (no chão ou carregado);
//   bau-quest → dá os itens (editor) uma vez por player;
//   corda     → marca de corda: com a corda, sobe pro andar de cima;
//   pa        → monte que a pá abre em buraco (fecha depois de DUG_HOLE_MS);
//   descer    → bueiro: usar leva pro andar de baixo (pisar não).
// Longe, o player anda até o lado e usa ao chegar.

export const DUG_HOLE_MS = 60000;
const MAP_USES = ['placa', 'livro', 'bau-quest', 'corda', 'pa', 'descer'];
const CLIMB_OFFSETS = [[0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0], [0, -1], [1, -1], [-1, -1]];

export class InteractionController {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
    this.dugHoles = new Map();
  }

  // ================================================================================================================================================================================================================================================
  // isUsable
  // Objeto do mapa (ainda nele) com um uso de mapa.

  isUsable(obj) {
    return !!obj && !obj.isCorpse && this.sim.world.objects.has(obj) && MAP_USES.includes(objectUse(objectIdType(obj.id)));
  }

  // ================================================================================================================================================================================================================================================
  // message

  message(player, text, kind = 'warn') {
    this.sim.emit({ type: 'message', playerId: player.id, text, kind });
  }

  // ================================================================================================================================================================================================================================================
  // useObject
  // Comando useObject (botão direito ou duplo clique no objeto do mapa).

  useObject(player, id) {
    const obj = this.sim.getItem(id);
    if (!this.isUsable(obj)) return;
    const inventory = this.sim.inventory;
    if (!inventory.isNear(player, obj)) {
      inventory.walkNextTo(player, obj, { type: 'useObject', id });
      return;
    }
    const use = objectUse(objectIdType(obj.id));
    if (use === 'placa') {
      if (obj.data && obj.data.texto) this.message(player, obj.data.texto, 'info');
    }
    else if (use === 'livro') this.readBook(player, obj.itemData || { type: objectIdType(obj.id), texto: obj.data && obj.data.texto });
    else if (use === 'bau-quest') this.openQuestChest(player, obj);
    else if (use === 'descer') this.goDown(player, obj);
  }

  // ================================================================================================================================================================================================================================================
  // readBook
  // Abre o livro na tela do player (evento book: título e texto).

  readBook(player, item) {
    this.sim.emit({ type: 'book', playerId: player.id, title: displayName(item.type), text: item.texto || '' });
  }

  // ================================================================================================================================================================================================================================================
  // useTool
  // Corda ou pá usada com a mira no sqm target (no mesmo andar): corda na
  // marca de corda sobe; pá no monte abre o buraco. Longe, o player anda até
  // o lado e usa ao chegar (from: de onde veio a ferramenta).
  // Devolve true se a ferramenta fez algo.

  useTool(player, tool, target, from = null) {
    const z = player.z || 0;
    if (!target || !Number.isInteger(target.x) || !Number.isInteger(target.y) || (target.z ?? z) !== z) return false;
    const wanted = tool === 'ferramenta-corda' ? 'corda' : 'pa';
    const obj = this.sim.world.getObjectsAt(target.x, target.y)
      .find(o => (o.z || 0) === z && objectUse(objectIdType(o.id)) === wanted);
    if (!obj) return false;
    if (!this.sim.inventory.isNear(player, obj)) {
      if (from) this.sim.inventory.walkNextTo(player, obj, { type: 'useItem', from, target });
      return false;
    }
    return wanted === 'corda' ? this.climb(player, obj) : this.dig(player, obj);
  }

  // ================================================================================================================================================================================================================================================
  // climb
  // Da marca de corda pro andar de cima: o sqm ao sul do buraco (como no
  // Tibia) ou, ocupado, outro em volta dele.

  climb(player, spot) {
    const upper = (spot.z || 0) + 1;
    const { movement, world } = this.sim;
    for (const [dx, dy] of CLIMB_OFFSETS) {
      const x = spot.x + dx;
      const y = spot.y + dy;
      if (!movement.isInsideMap(x, y) || !world.hasFloorAt(x, y, upper)) continue;
      if (movement.isBlocked(x, y, upper) || world.getTransitionAt(x, y, upper)) continue;
      if (movement.useTransition(player, { id: 'corda', targetX: x, targetY: y, targetZ: upper })) {
        this.sim.control.clearWalk(player);
        return true;
      }
    }
    return false;
  }

  // ================================================================================================================================================================================================================================================
  // goDown
  // Bueiro: leva o player pro andar de baixo, 1 sqm ao sul e 1 ao leste do
  // bueiro (onde fica o sqm embaixo dele na tela).

  goDown(player, grate) {
    const target = toLowerLevel(grate.x, grate.y, grate.z || 0);
    if (this.sim.movement.useTransition(player, { id: 'bueiro', targetX: target.x, targetY: target.y, targetZ: target.z })) {
      this.sim.control.clearWalk(player);
      return true;
    }
    return false;
  }

  // ================================================================================================================================================================================================================================================
  // dig
  // Abre o monte: vira buraco (desenho de "Abre como") que leva pro andar de
  // baixo e fecha sozinho depois de DUG_HOLE_MS.

  dig(player, pile) {
    if (pile.dug || !openedAs(objectIdType(pile.id))) return false;
    const target = getHoleTarget(pile.x, pile.y, pile.z || 0);
    const hole = new GameObject({ id: `Dug_${pile.id}`, x: pile.x, y: pile.y, z: pile.z || 0, movable: false, hasVolume: false, blocksMovement: false,
      stairDirection: 'down', targetX: target.x, targetY: target.y, targetZ: target.z });
    hole.hidden = true;
    this.sim.world.registerTransition(hole);
    pile.dug = true;
    this.dugHoles.set(pile.id, hole);
    this.sim.schedule((this.sim.time || 0) + DUG_HOLE_MS, () => this.closeHole(pile));
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // closeHole

  closeHole(pile) {
    const hole = this.dugHoles.get(pile.id);
    if (!hole) return;
    this.sim.world.unregisterTransition(hole);
    this.dugHoles.delete(pile.id);
    pile.dug = false;
  }

  // ================================================================================================================================================================================================================================================
  // openQuestChest
  // Baú de quest: na 1ª vez de cada player, os itens (editor) vão pra
  // mochila — se couberem (espaço e cap). Depois, "Está vazio.".

  openQuestChest(player, chest) {
    const questId = (chest.data && chest.data.quest) || `${chest.x},${chest.y},${chest.z || 0}`;
    const inventory = this.sim.inventory;
    const entries = ((chest.data && chest.data.itens) || []).filter(e => e && getAsset(splitType(e.tipo).asset));
    player.quests = player.quests || [];
    if (!entries.length || player.quests.includes(questId)) {
      this.message(player, 'Está vazio.', 'info');
      return;
    }
    const rewards = entries.map(e => newItem(inventory.nextUid(), e.tipo, e.count || 1));
    const weight = rewards.reduce((sum, item) => sum + weightOf(item), 0);
    if (inventory.capUsed(player) + weight > inventory.capMax(player)) {
      this.message(player, 'Você não tem capacidade pra carregar isso.');
      return;
    }
    const bag = player.equip && player.equip.mochila;
    if (!bag || !bag.items) {
      this.message(player, 'Você precisa de uma mochila pra pegar isso.');
      return;
    }
    const free = bag && bag.items ? bag.items.map((it, i) => (it ? -1 : i)).filter(i => i >= 0) : [];
    if (free.length < rewards.length) {
      this.message(player, 'Você não tem espaço na mochila pra isso.');
      return;
    }
    rewards.forEach((item, i) => { bag.items[free[i]] = item; });
    player.quests.push(questId);
    const names = rewards.map(item => (item.count > 1 ? `${item.count} ${itemInfo(item.type).name}` : itemInfo(item.type).name));
    this.message(player, `Você encontrou ${names.join(', ')}.`, 'info');
  }
}
