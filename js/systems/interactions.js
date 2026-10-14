// js/systems/interactions.js

import { GameObject } from '../models/game-object.js';
import { objectIdType, objectUse, activeAs, togglesOnUse, displayName, getAsset, splitType, isEntranceFolder, floorBehavior, WORM_TYPE } from '../../shared/assets.js';
import { itemInfo, newItem, weightOf, POTION_RANGE, USE_COOLDOWN_MS } from '../../shared/items.js';
import { takeFromBag, giveItem } from './trade.js';
import { getHoleTarget, toLowerLevel, toUpperLevel } from '../../shared/stairs.js';

// Objetos do mapa que se usam (gerador → Objetos → Uso):
//   placa     → o texto (editor) aparece em cima dela, na cor escolhida no editor;
//   livro     → abre o texto numa janela (no chão ou carregado);
//   bau-quest → dá os itens (editor) uma vez por player;
//   corda     → marca de corda: com a corda, sobe pro andar de cima;
//   pa        → monte que a pá abre em buraco (fica aberto até o servidor reiniciar);
//   pa-cai    → a pá abre e quem cavou já cai no buraco (o desenho não muda);
//   descer    → bueiro: usar leva pro andar de baixo (pisar não);
//   deposito  → abre o depósito do player (inventory/depot.js).
// Longe, o player anda até o lado e usa ao chegar.

const MAP_USES = ['placa', 'livro', 'bau-quest', 'corda', 'pa', 'pa-cai', 'descer', 'deposito'];
const SHOVEL_USES = ['pa', 'pa-cai'];
const SIGN_KINDS = ['info', 'warn', 'danger', 'blue'];
const CLIMB_OFFSETS = [[0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0], [0, -1], [1, -1], [-1, -1]];

export class InteractionController {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
    this.dugHoles = new Map();
    this.activeIds = new Set(sim.objects.filter(obj => obj.active).map(obj => obj.id));
  }

  // ================================================================================================================================================================================================================================================
  // isUsable
  // Objeto do mapa (ainda nele) com um uso de mapa, ou que usar alterna entre
  // normal e ativo (poste…).

  isUsable(obj) {
    if (!obj || obj.isCorpse || !this.sim.world.objects.has(obj)) return false;
    const type = objectIdType(obj.id);
    return MAP_USES.includes(objectUse(type)) || (obj.movable !== true && togglesOnUse(type));
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
    if (!use) {
      this.setActive(obj, !obj.active);
      return;
    }
    if (use === 'placa') {
      if (obj.data && obj.data.texto) this.signText(player, obj);
    }
    else if (use === 'livro') this.readBook(player, obj.itemData || { type: objectIdType(obj.id), texto: obj.data && obj.data.texto });
    else if (use === 'bau-quest') this.openQuestChest(player, obj);
    else if (use === 'descer') this.goDown(player, obj);
    else if (use === 'deposito') inventory.openDepotAt(player, obj);
  }

  // ================================================================================================================================================================================================================================================
  // setActive
  // Põe o objeto do mapa no estado ativo (desenho "Ativo como": aceso,
  // aberto…) ou de volta no normal, pra todos (os ativos vão pro navegador em
  // activeIds).

  setActive(obj, active) {
    obj.active = active;
    if (active) this.activeIds.add(obj.id);
    else this.activeIds.delete(obj.id);
  }

  // ================================================================================================================================================================================================================================================
  // readBook
  // Abre o livro na tela do player (evento book: título e texto).

  readBook(player, item) {
    this.sim.emit({ type: 'book', playerId: player.id, title: displayName(item.type), text: item.texto || '' });
  }

  // ================================================================================================================================================================================================================================================
  // useTool
  // Corda, pá ou vara de pescar usada com a mira no sqm target (no mesmo andar): corda na
  // marca de corda sobe; corda num buraco ou bueiro puxa quem está embaixo
  // dele; pá no monte abre o buraco. Longe, o player anda até o lado e usa ao
  // chegar (from: de onde veio a ferramenta). Devolve true se a ferramenta
  // fez algo.

  useTool(player, tool, target, from = null, item = null) {
    const z = player.z || 0;
    if (!target || !Number.isInteger(target.x) || !Number.isInteger(target.y) || (target.z ?? z) !== z) return false;
    if (tool === 'ferramenta-pesca') return this.fish(player, item, target);
    const wanted = tool === 'ferramenta-corda' ? ['corda'] : SHOVEL_USES;
    const here = this.sim.world.getObjectsAt(target.x, target.y).filter(o => (o.z || 0) === z);
    const hole = tool === 'ferramenta-corda' ? here.find(o => this.isOpening(o)) : null;
    const obj = here.find(o => wanted.includes(objectUse(objectIdType(o.id)))) || hole;
    if (!obj && tool === 'ferramenta-pa') return this.digWorm(player, target);
    if (!obj) return false;
    if (!this.sim.inventory.isNear(player, obj)) {
      if (from) this.sim.inventory.walkNextTo(player, obj, { type: 'useItem', from, target });
      return false;
    }
    if (obj === hole) return this.pullUp(hole);
    return tool === 'ferramenta-corda' ? this.climb(player, obj) : this.dig(player, obj);
  }

  // ================================================================================================================================================================================================================================================
  // fish
  // Vara de pescar no sqm de água (piso com peixes, gerador → Pisos → Pescável) até POTION_RANGE e com linha de visão: gasta a isca da vara (a minhoca), mostra as ondas na água (efeito ripple), treina o fishing e, com chance que sobe com o skill (10% + 0,597% por nível acima de 10, de 10% a 50%, como no Tibia), dá um dos peixes do piso que o skill alcança (fishLevel); quanto mais o skill passa do nível de um peixe, mais comum ele fica (peso de 1 até 20), então os melhores aparecem mais com o skill. Sem a isca, nada acontece. Espera USE_COOLDOWN_MS até a próxima. Devolve true se pescou (gastou isca).

  fish(player, rod, target) {
    const { world, movement } = this.sim;
    const z = player.z || 0;
    const floor = world.topFloors.get(world.getTileKey(target.x, target.y, z));
    const fish = floor ? floorBehavior(floor.floorType).fish : [];
    if (!rod || !fish.length || !movement.isInsideMap(target.x, target.y)) return false;
    if (Math.max(Math.abs(target.x - player.x), Math.abs(target.y - player.y)) > POTION_RANGE || !movement.hasLineOfSight(player, target)) return false;
    const now = this.sim.time || 0;
    if (now < (player.useReadyAt || 0)) return false;
    const bait = itemInfo(rod.type).bait;
    if (bait && !takeFromBag(player, bait, 1)) return false;
    player.useReadyAt = now + USE_COOLDOWN_MS;
    this.sim.spells.showEffect(target.x, target.y, 'ripple', undefined, z);
    this.sim.combat.trainSkill(player, 'fishing');
    const level = player.skills && player.skills.fishing ? player.skills.fishing.lvl : 10;
    const chance = Math.min(50, Math.max(10, 10 + (level - 10) * 0.597));
    if (Math.random() * 100 >= chance) return true;
    const weights = fish.map(type => (level >= itemInfo(type).fishLevel ? Math.min(20, 1 + level - itemInfo(type).fishLevel) : 0));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) return true;
    let roll = Math.random() * total;
    const index = weights.findIndex(weight => (roll -= weight) < 0);
    giveItem(this.sim, player, fish[index < 0 ? fish.length - 1 : index], 1);
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // digWorm
  // Pá num sqm de piso sem nada pra cavar, ao lado do player (ou nele): se o piso tem minhocas (gerador → Pisos → Minhocas), a chance dele dá uma minhoca; a minhoca cai no chão, no sqm cavado; sem sorte, sobe a fumacinha (efeito poff). Espera USE_COOLDOWN_MS até o próximo uso. Devolve true se achou.

  digWorm(player, target) {
    const { world } = this.sim;
    const z = player.z || 0;
    const floor = world.topFloors.get(world.getTileKey(target.x, target.y, z));
    const chance = floor ? floorBehavior(floor.floorType).worms : 0;
    if (!chance || Math.max(Math.abs(target.x - player.x), Math.abs(target.y - player.y)) > 1) return false;
    const now = this.sim.time || 0;
    if (now < (player.useReadyAt || 0)) return false;
    player.useReadyAt = now + USE_COOLDOWN_MS;
    if (Math.random() * 100 >= chance) {
      this.sim.spells.showEffect(target.x, target.y, 'poff', undefined, z);
      return false;
    }
    const { inventory } = this.sim;
    inventory.mergeGroundStack(inventory.spawnGroundItem(newItem(inventory.nextUid(), WORM_TYPE, 1), target.x, target.y, z));
    return true;
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
    if (SHOVEL_USES.includes(objectUse(type))) return !!obj.active;
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
  // baixo e fica aberto até o servidor reiniciar. No 'pa-cai', quem cavou
  // desce na hora pelo buraco.

  dig(player, pile) {
    const type = objectIdType(pile.id);
    const falls = objectUse(type) === 'pa-cai';
    if (!pile.active) {
      if (!activeAs(type) && !falls) return false;
      const target = getHoleTarget(pile.x, pile.y, pile.z || 0);
      const hole = new GameObject({ id: `Dug_${pile.id}`, x: pile.x, y: pile.y, z: pile.z || 0, movable: false, hasVolume: false, blocksMovement: false,
        stairDirection: 'down', targetX: target.x, targetY: target.y, targetZ: target.z });
      hole.hidden = true;
      this.sim.world.registerTransition(hole);
      this.setActive(pile, true);
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
