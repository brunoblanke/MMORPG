// js/systems/interactions.js

import { GameObject } from '../models/game-object.js';
import { objectIdType, objectUse, openedAs, displayName, getAsset, splitType, isEntranceFolder } from '../../shared/assets.js';
import { itemInfo, newItem, weightOf } from '../../shared/items.js';
import { getHoleTarget, toLowerLevel, toUpperLevel } from '../../shared/stairs.js';

// Objetos do mapa que se usam (gerador → Objetos → Uso):
//   placa     → o texto (editor) aparece em cima dela, na cor escolhida no editor;
//   livro     → abre o texto numa janela (no chão ou carregado);
//   bau-quest → dá os itens (editor) uma vez por player;
//   corda     → marca de corda: com a corda, sobe pro andar de cima;
//   pa        → monte que a pá abre em buraco (fica aberto até o servidor reiniciar;
//               com "Ao cavar, o player já cai", quem cavou desce na hora);
//   descer    → bueiro: usar leva pro andar de baixo (pisar não);
//   deposito  → abre o depósito do player (inventory/depot.js).
// Longe, o player anda até o lado e usa ao chegar.

const MAP_USES = ['placa', 'livro', 'bau-quest', 'corda', 'pa', 'descer', 'deposito'];
const SIGN_KINDS = ['info', 'warn', 'danger', 'blue'];
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
  // signText
  // Texto da placa pro player que a usou: aparece em cima da placa, parado no
  // lugar (como as falas), na cor escolhida no editor (verde se nenhuma).

  signText(player, obj) {
    const kind = SIGN_KINDS.includes(obj.data.cor) ? obj.data.cor : 'info';
    this.sim.emit({ type: 'signText', playerId: player.id, text: obj.data.texto, kind, x: obj.x, y: obj.y, z: obj.z || 0 });
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
      if (obj.data && obj.data.texto) this.signText(player, obj);
    }
    else if (use === 'livro') this.readBook(player, obj.itemData || { type: objectIdType(obj.id), texto: obj.data && obj.data.texto });
    else if (use === 'bau-quest') this.openQuestChest(player, obj);
    else if (use === 'descer') this.goDown(player, obj);
    else if (use === 'deposito') inventory.openDepotAt(player, obj);
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
  // marca de corda sobe; corda num buraco ou bueiro puxa quem está embaixo
  // dele; pá no monte abre o buraco. Longe, o player anda até o lado e usa ao
  // chegar (from: de onde veio a ferramenta). Devolve true se a ferramenta
  // fez algo.

  useTool(player, tool, target, from = null) {
    const z = player.z || 0;
    if (!target || !Number.isInteger(target.x) || !Number.isInteger(target.y) || (target.z ?? z) !== z) return false;
    const wanted = tool === 'ferramenta-corda' ? 'corda' : 'pa';
    const here = this.sim.world.getObjectsAt(target.x, target.y).filter(o => (o.z || 0) === z);
    const hole = wanted === 'corda' ? here.find(o => this.isOpening(o)) : null;
    const obj = here.find(o => objectUse(objectIdType(o.id)) === wanted) || hole;
    if (!obj) return false;
    if (!this.sim.inventory.isNear(player, obj)) {
      if (from) this.sim.inventory.walkNextTo(player, obj, { type: 'useItem', from, target });
      return false;
    }
    if (obj === hole) return this.pullUp(hole);
    return wanted === 'corda' ? this.climb(player, obj) : this.dig(player, obj);
  }

  // ================================================================================================================================================================================================================================================
  // climb
  // Da marca de corda pro andar de cima: em volta do sqm acima dela
  // (toUpperLevel: 1 ao norte e 1 a oeste, onde fica o buraco), o do sul
  // primeiro, como no Tibia; ocupado, outro em volta.

  climb(player, spot) {
    const above = toUpperLevel(spot.x, spot.y, spot.z || 0);
    const upper = above.z;
    const { movement, world } = this.sim;
    for (const [dx, dy] of CLIMB_OFFSETS) {
      const x = above.x + dx;
      const y = above.y + dy;
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
  // isOpening
  // Abertura pro andar de baixo: buraco ou bueiro (pasta Entradas) ou monte
  // que a pá abriu.

  isOpening(obj) {
    const type = objectIdType(obj.id);
    if (objectUse(type) === 'pa') return !!obj.dug;
    return isEntranceFolder(type);
  }

  // ================================================================================================================================================================================================================================================
  // pullUp
  // Corda na abertura: quem está no sqm embaixo dela (1 ao sul e 1 ao leste,
  // no andar de baixo: toLowerLevel), player ou criatura, sobe pro sqm livre
  // em volta da abertura (o do sul primeiro). É o único jeito de uma criatura
  // trocar de andar. Sem ninguém embaixo, sobe o item de cima do sqm (a
  // pilha inteira), como no Tibia.

  pullUp(hole) {
    const { movement, world } = this.sim;
    const z = hole.z || 0;
    const below = toLowerLevel(hole.x, hole.y, z);
    const pulled = world.getCreatureAt(below.x, below.y, below.z);
    if (pulled && pulled.isNpc) return false;
    if (!pulled) return this.pullItemUp(hole, below);
    for (const [dx, dy] of CLIMB_OFFSETS) {
      const x = hole.x + dx;
      const y = hole.y + dy;
      if (!movement.isInsideMap(x, y) || !world.hasFloorAt(x, y, z)) continue;
      if (movement.isBlocked(x, y, z) || world.getTransitionAt(x, y, z)) continue;
      if (!movement.useTransition(pulled, { id: 'corda', targetX: x, targetY: y, targetZ: z })) continue;
      if (pulled.isPlayer) this.sim.control.clearWalk(pulled);
      else if (pulled.updatePatrolCenter) pulled.updatePatrolCenter();
      return true;
    }
    return false;
  }

  // ================================================================================================================================================================================================================================================
  // pullItemUp
  // O item de cima do sqm embaixo da abertura (below) sobe pro primeiro sqm
  // livre em volta dela, com o que estiver dentro. Devolve true se subiu.

  pullItemUp(hole, below) {
    const { movement, world, inventory } = this.sim;
    const z = hole.z || 0;
    const item = world.getObjectsAt(below.x, below.y)
      .filter(obj => (obj.z || 0) === below.z && inventory.isPickable(obj))
      .sort((a, b) => (b.order || 0) - (a.order || 0))[0];
    if (!item) return false;
    for (const [dx, dy] of CLIMB_OFFSETS) {
      const x = hole.x + dx;
      const y = hole.y + dy;
      if (!movement.isInsideMap(x, y) || !world.hasFloorAt(x, y, z)) continue;
      if (movement.isBlocked(x, y, z) || world.getTransitionAt(x, y, z)) continue;
      const data = inventory.groundItem(item);
      inventory.removeGroundObject(item);
      inventory.mergeGroundStack(inventory.spawnGroundItem(data, x, y, z));
      return true;
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
  // baixo e fica aberto até o servidor reiniciar. Com "Ao cavar, o player
  // já cai" (gerador), quem cavou desce na hora pelo buraco.

  dig(player, pile) {
    const type = objectIdType(pile.id);
    const falls = !!(getAsset(splitType(type).asset)?.propriedades?.desceAoCavar);
    if (!pile.dug) {
      if (!openedAs(type) && !falls) return false;
      const target = getHoleTarget(pile.x, pile.y, pile.z || 0);
      const hole = new GameObject({ id: `Dug_${pile.id}`, x: pile.x, y: pile.y, z: pile.z || 0, movable: false, hasVolume: false, blocksMovement: false,
        stairDirection: 'down', targetX: target.x, targetY: target.y, targetZ: target.z });
      hole.hidden = true;
      this.sim.world.registerTransition(hole);
      pile.dug = true;
      this.dugHoles.set(pile.id, hole);
    } else if (!falls) {
      return false;
    }
    if (falls) this.fallInto(player, this.dugHoles.get(pile.id));
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // fallInto
  // O player cai pelo buraco aberto pro andar de baixo.

  fallInto(player, hole) {
    if (!hole) return false;
    if (!this.sim.movement.useTransition(player, { id: 'buraco', targetX: hole.targetX, targetY: hole.targetY, targetZ: hole.targetZ })) return false;
    this.sim.control.clearWalk(player);
    return true;
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
