// js/systems/inventory.js

import { PLAYER_LIGHT } from '../../shared/lighting.js';
import { isPositionAdjacentTo } from '../utils/helpers.js';
import { getAsset, splitType } from '../../shared/assets.js';
import {
  EQUIP_SLOTS, THROW_RANGE, STARTER_KIT, itemInfo, itemLight, fitsSlot, capacityFor, newItem, weightOf, contains, findInTree, fromPlain, equipBonus
} from '../../shared/items.js';
import { SKILL_KEYS } from '../../shared/skills.js';
import { consumableMethods } from './inventory/consumables.js';
import { groundMethods } from './inventory/ground.js';
import { corpseMethods } from './inventory/corpses.js';

// Inventário e containers dos jogadores. Lugares (from/to nos comandos):
//   { t: 'e', key }        espaço do inventário (EQUIP_SLOTS)
//   { t: 'c', uid, i }     espaço i do container uid (com o player, ou numa
//                          caixa no chão colada nele e aberta)
//   { t: 'g', id }         item no chão (id do objeto do mapa) — só origem
//   { t: 'w', x, y, z }    sqm do chão — só destino (jogar, até THROW_RANGE)
// Regras: o inventário troca (o item de antes volta pra onde o novo estava);
// o container não troca (vai pro primeiro espaço vazio; cheio, "Sem espaço.");
// soltar em cima de uma caixa põe dentro dela; pilhas iguais se juntam até
// o máximo; pegar do chão só colado (o player anda até o item); o peso do
// que o player carrega não passa da cap. Item no chão guarda o conteúdo em
// obj.itemData (uid, count, items). Cadáver é container (não dá pra pegar,
// só abrir e tirar ou pôr coisas): o da criatura com o loot dela, o do player
// com a mochila e o que mais caiu na morte. Some com tudo dentro.

const DYNAMIC_ID_START = 1000000;

export class InventoryController {

  // ================================================================================================================================================================================================================================================
  // constructor
  // lootTable: { '<criatura>': [{ tipo, chance, min, max }] } — troca o loot
  // da criatura (o normal vem do gerador: creatureLoot).

  constructor(sim, lootTable = {}) {
    this.sim = sim;
    this.lootTable = lootTable;
    this.uidCounter = 0;
    this.objectCounter = DYNAMIC_ID_START;
  }

  // ================================================================================================================================================================================================================================================
  // nextUid

  nextUid() {
    this.uidCounter++;
    return `i${this.uidCounter}`;
  }

  // ================================================================================================================================================================================================================================================
  // setupPlayer
  // O inventário guardado (saved.equip); quem é novo começa com o kit do
  // Tibia antigo (STARTER_KIT: bag com uma maçã, tocha e club nas mãos e
  // jacket no corpo). O layout das janelas volta junto.

  setupPlayer(player, saved) {
    player.equip = Object.fromEntries(EQUIP_SLOTS.map(key => [key, null]));
    player.openGround = new Set();
    player.pendingInv = null;
    player.uiLayout = saved && saved.layout && typeof saved.layout === 'object' ? saved.layout : null;

    if (saved && saved.equip && typeof saved.equip === 'object') {
      for (const key of EQUIP_SLOTS) {
        const item = fromPlain(saved.equip[key], () => this.nextUid());
        if (item && fitsSlot(item.type, key)) player.equip[key] = item;
      }
    } else {
      const kit = STARTER_KIT;
      const starter = (type, count = 1) => (getAsset(splitType(type).asset) ? newItem(this.nextUid(), type, count) : null);
      for (const key of EQUIP_SLOTS) player.equip[key] = kit.equip[key] ? starter(kit.equip[key]) : null;
      const bag = player.equip.mochila;
      const inside = kit.mochila.map(e => starter(e.tipo, e.count)).filter(Boolean);
      if (bag && bag.items) inside.slice(0, bag.items.length).forEach((item, i) => { bag.items[i] = item; });
    }
  }

  // ================================================================================================================================================================================================================================================
  // capUsed / capMax

  capUsed(player) {
    return Math.round(EQUIP_SLOTS.reduce((sum, key) => sum + weightOf(player.equip[key]), 0) * 100) / 100;
  }

  capMax(player) {
    return capacityFor(player.lvl, player.vocation);
  }

  // ================================================================================================================================================================================================================================================
  // roots
  // Os itens do inventário (a raiz de tudo que o player carrega).

  roots(player) {
    return EQUIP_SLOTS.map(key => player.equip[key]);
  }

  // ================================================================================================================================================================================================================================================
  // message
  // kind: 'info' (verde), 'warn' (amarelo) ou 'danger' (vermelho).

  message(player, text, kind = 'warn') {
    this.sim.emit({ type: 'message', playerId: player.id, text, kind });
  }

  // ================================================================================================================================================================================================================================================
  // isNear
  // O player alcança o objeto do chão: mesmo sqm ou vizinho, mesmo andar.

  isNear(player, obj) {
    if ((player.z || 0) !== (obj.z || 0)) return false;
    return (player.x === obj.x && player.y === obj.y) || isPositionAdjacentTo(player.x, player.y, obj.x, obj.y);
  }

  // ================================================================================================================================================================================================================================================
  // findContainer
  // O container uid ao alcance: { container, carried } ou null.

  findContainer(player, uid) {
    const carried = findInTree(this.roots(player), uid);
    if (carried) return carried.item.items ? { container: carried.item, carried: true } : null;
    for (const obj of this.openGroundObjects(player)) {
      const found = findInTree([this.groundItem(obj)], uid);
      if (found && found.item.items) return { container: found.item, carried: false };
    }
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // source
  // De onde o item sai: { item, carried, obj?, remove() } ou { error }.

  source(player, from) {
    if (!from || typeof from !== 'object') return { error: 'Item não encontrado.' };
    if (from.t === 'e') {
      const item = EQUIP_SLOTS.includes(from.key) ? player.equip[from.key] : null;
      if (!item) return { error: 'Item não encontrado.' };
      return { item, carried: true, place: from, remove: () => { player.equip[from.key] = null; } };
    }
    if (from.t === 'c') {
      const found = this.findContainer(player, from.uid);
      const item = found && found.container.items[from.i];
      if (!item) return { error: 'Item não encontrado.' };
      return { item, carried: found.carried, place: from, container: found.container, remove: () => { found.container.items[from.i] = null; } };
    }
    if (from.t === 'g') {
      const obj = this.sim.getItem(from.id);
      if (!this.isPickable(obj)) return { error: 'Não dá pra pegar isso.' };
      return { item: this.groundItem(obj), carried: false, obj, place: from, remove: () => this.removeGroundObject(obj) };
    }
    return { error: 'Item não encontrado.' };
  }

  // ================================================================================================================================================================================================================================================
  // destination
  // Pra onde o item vai: { kind: 'equip'|'slot'|'merge'|'ground', ... } ou { error }.

  destination(player, item, from, to) {
    if (!to || typeof to !== 'object') return { error: 'Destino inválido.' };
    if (to.t === 'w') {
      if (!this.sim.movement.isInsideMap(to.x, to.y)) return { error: 'Destino inválido.' };
      const reach = Math.max(Math.abs(player.x - to.x), Math.abs(player.y - to.y));
      if (reach > THROW_RANGE) return { error: `Longe demais: dá pra jogar até ${THROW_RANGE} sqm.` };
      return { kind: 'ground', x: to.x, y: to.y, z: Number.isInteger(to.z) ? to.z : (player.z || 0) };
    }
    if (to.t === 'e') {
      if (!EQUIP_SLOTS.includes(to.key)) return { error: 'Destino inválido.' };
      if (from.t === 'e' && from.key === to.key) return { error: null };
      const bag = to.key === 'mochila' ? player.equip.mochila : null;
      if (bag && bag.items && bag.uid !== item.uid) {
        if (contains(item, bag)) return { error: 'Não dá pra pôr uma caixa dentro dela mesma.' };
        const free = bag.items.indexOf(null);
        if (free < 0) return { error: `Sem espaço em ${itemInfo(bag.type).name}.` };
        return { kind: 'slot', container: bag, index: free, carried: true };
      }
      if (!fitsSlot(item.type, to.key)) return { error: 'Esse item não vai nesse espaço.' };
      return { kind: 'equip', key: to.key, carried: true };
    }
    if (to.t === 'c') {
      const found = this.findContainer(player, to.uid);
      if (!found || !Number.isInteger(to.i) || to.i < 0 || to.i >= found.container.items.length) return { error: 'Destino inválido.' };
      const box = found.container;
      if (from.t === 'c' && from.uid === to.uid && from.i === to.i) return { error: null };
      if (item.uid === box.uid || contains(item, box)) return { error: 'Não dá pra pôr uma caixa dentro dela mesma.' };
      const there = box.items[to.i];
      if (!there) return { kind: 'slot', container: box, index: to.i, carried: found.carried };
      if (there.items && there.uid !== item.uid && found.carried) {
        if (contains(item, there)) return { error: 'Não dá pra pôr uma caixa dentro dela mesma.' };
        const free = there.items.indexOf(null);
        if (free < 0) return { error: `Sem espaço em ${itemInfo(there.type).name}.` };
        return { kind: 'slot', container: there, index: free, carried: found.carried };
      }
      const stack = itemInfo(item.type).stack;
      if (stack && there.type === item.type && there.uid !== item.uid) {
        if (there.count >= stack) return { error: 'Essa pilha já está cheia.' };
        return { kind: 'merge', target: there, carried: found.carried };
      }
      const free = box.items.indexOf(null);
      if (free < 0) return { error: 'Sem espaço.' };
      return { kind: 'slot', container: box, index: free, carried: found.carried };
    }
    return { error: 'Destino inválido.' };
  }

  // ================================================================================================================================================================================================================================================
  // move
  // Comando moveInv: tira `amount` do item em `from` e põe em `to`. Item no
  // chão longe do player: ele anda até ficar colado e o movimento acontece
  // ao chegar (checkPending).

  move(player, from, to, amount) {
    this.moveNow(player, from, to, amount);
    this.compactAll(player);
  }

  // ================================================================================================================================================================================================================================================
  // compactAll / compactTree
  // Containers sem buracos: os itens ficam juntos no começo, na ordem, e os
  // espaços vazios no fim (em tudo o que o player carrega e nas caixas do
  // chão abertas).

  compactAll(player) {
    const ground = this.openGroundObjects(player).map(obj => this.groundItem(obj));
    for (const root of [...this.roots(player), ...ground]) this.compactTree(root);
  }

  compactTree(item) {
    if (!item || !item.items) return;
    const filled = item.items.filter(Boolean);
    for (let i = 0; i < item.items.length; i++) item.items[i] = filled[i] || null;
    filled.forEach(child => this.compactTree(child));
  }

  // ================================================================================================================================================================================================================================================
  // moveNow

  moveNow(player, from, to, amount) {
    const src = this.source(player, from);
    if (src.error) return this.message(player, src.error);
    const dest = this.destination(player, src.item, from, to);
    if (dest.error !== undefined) {
      if (dest.error) this.message(player, dest.error);
      return;
    }
    if (src.obj && !this.isNear(player, src.obj)) {
      this.walkNextTo(player, src.obj, { type: 'moveInv', from, to, amount });
      return;
    }

    const stack = itemInfo(src.item.type).stack;
    const wanted = stack ? Math.max(1, Math.min(src.item.count, Math.floor(Number(amount) || src.item.count))) : 1;
    const whole = !stack || wanted >= src.item.count;
    const taken = dest.kind === 'merge' ? Math.min(wanted, stack - dest.target.count) : wanted;
    const replaced = dest.kind === 'equip' ? player.equip[dest.key] : null;

    if (dest.carried && !src.carried) {
      const unit = itemInfo(src.item.type).weight;
      const added = stack ? unit * taken : weightOf(src.item);
      const freed = replaced ? weightOf(replaced) : 0;
      if (this.capUsed(player) + added - freed > this.capMax(player)) {
        const free = Math.max(0, this.capMax(player) - this.capUsed(player));
        return this.message(player, `Pesado demais: faltam ${Math.ceil(added - freed - free)} oz de cap.`);
      }
    }

    if (dest.kind === 'ground' && !this.canThrow(player, dest)) {
      return this.message(player, 'Tem algo no caminho.');
    }

    if (dest.kind === 'merge') {
      dest.target.count += taken;
      src.item.count -= taken;
      if (src.item.count <= 0) src.remove();
      return;
    }

    let moving = src.item;
    if (whole) {
      src.remove();
    } else {
      src.item.count -= wanted;
      moving = newItem(this.nextUid(), src.item.type, wanted);
    }

    if (dest.kind === 'ground') {
      this.dropOnGround(player, moving, dest.x, dest.y, dest.z);
      return;
    }
    if (dest.kind === 'slot') {
      dest.container.items[dest.index] = moving;
      return;
    }

    player.equip[dest.key] = moving;
    if (replaced) this.putBack(player, replaced, src, whole);
  }

  // ================================================================================================================================================================================================================================================
  // putBack
  // O item trocado no inventário volta pra onde o novo estava; se não cabe lá
  // (outro tipo de espaço, a própria caixa de onde o novo saiu…), vai pra
  // mochila ou, cheia, pro chão aos pés do player.

  putBack(player, item, src, whole) {
    if (src.obj) {
      this.spawnGroundItem(item, src.obj.x, src.obj.y, src.obj.z || 0);
      return;
    }
    if (whole && src.place.t === 'e' && fitsSlot(item.type, src.place.key) && !player.equip[src.place.key]) {
      player.equip[src.place.key] = item;
      return;
    }
    if (whole && src.place.t === 'c' && src.container.items[src.place.i] === null &&
        item.uid !== src.container.uid && !contains(item, src.container)) {
      src.container.items[src.place.i] = item;
      return;
    }
    const bag = player.equip.mochila;
    const free = bag && bag.items ? bag.items.indexOf(null) : -1;
    if (free >= 0 && item.uid !== bag.uid && !contains(item, bag)) {
      bag.items[free] = item;
      return;
    }
    this.spawnGroundItem(item, player.x, player.y, player.z || 0);
    this.message(player, `${itemInfo(item.type).name} caiu no chão: mochila cheia.`);
  }

  // ================================================================================================================================================================================================================================================
  // saveLayout
  // Comando saveLayout: guarda o layout das janelas (vem da tela, pequeno).

  saveLayout(player, layout) {
    if (!layout || typeof layout !== 'object') return;
    if (JSON.stringify(layout).length > 4000) return;
    player.uiLayout = layout;
  }

  // ================================================================================================================================================================================================================================================
  // update
  // A cada tick: a luz do player (a própria ou a do item equipado que
  // ilumina mais), faz o que estava esperando o player chegar e fecha as
  // caixas do chão que ele não alcança mais.

  update(player) {
    player.light = Math.max(PLAYER_LIGHT, ...EQUIP_SLOTS.map(key => itemLight(player.equip[key])));
    const pending = player.pendingInv;
    if (pending) {
      const obj = this.sim.getItem(pending.objId);
      if (!obj || !(this.isPickable(obj) || this.isOpenable(obj) || this.sim.interactions.isUsable(obj) || this.sim.interactions.isOpening(obj))) {
        player.pendingInv = null;
      } else if (this.isNear(player, obj)) {
        player.pendingInv = null;
        this.sim.control.handle(player, pending.command);
      } else if (!this.sim.control.isWalking(player)) {
        player.pendingInv = null;
      }
    }
    for (const id of [...player.openGround]) {
      const obj = this.sim.getItem(id);
      if (!this.isOpenable(obj) || !this.isNear(player, obj)) player.openGround.delete(id);
    }
  }

  // ================================================================================================================================================================================================================================================
  // statsFor
  // O que a janela de skills e a de vida/mana mostram. bonus: o que os itens
  // do inventário somam no skill (atk no da arma, def no shielding, ml no
  // magic level).

  statsFor(player) {
    const bonus = equipBonus(player.equip);
    const extra = { magic: bonus.ml };
    const skills = {};
    for (const key of ['magic', ...SKILL_KEYS]) skills[key] = { ...player.skills[key], bonus: extra[key] || 0 };
    return {
      experience: player.xp,
      level: player.lvl,
      levelPct: Math.min(99, Math.floor(player.xp / player.nextLevelXp * 100)),
      hp: player.currentHp,
      maxHp: player.hp,
      mana: player.mana,
      maxMana: player.maxMana,
      speed: player.spd,
      food: Math.ceil((player.food || 0) / 1000),
      skills
    };
  }

  // ================================================================================================================================================================================================================================================
  // viewFor
  // O que a tela do jogador precisa: inventário, cap e caixas do chão abertas.

  viewFor(player) {
    return {
      equip: player.equip,
      cap: { used: this.capUsed(player), max: this.capMax(player) },
      opened: this.openGroundObjects(player).map(obj => ({ id: obj.id, item: this.groundItem(obj), corpse: !!obj.isCorpse, name: obj.isCorpse ? obj.name : null })),
      stats: this.statsFor(player),
      layout: player.uiLayout
    };
  }
}

Object.assign(InventoryController.prototype, groundMethods, consumableMethods, corpseMethods);
