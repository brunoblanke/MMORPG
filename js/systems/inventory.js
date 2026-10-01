// js/systems/inventory.js

import { GameObject } from '../models/game-object.js';
import { PLAYER_LIGHT } from '../../shared/lighting.js';
import { getAdjacentPositions, isPositionAdjacentTo } from '../utils/helpers.js';
import { objectIdType, objectProps, getAsset, splitType, creatureLoot, objectUse } from '../../shared/assets.js';
import {
  EQUIP_SLOTS, STARTER_BAG, STARTER_TORCH, THROW_RANGE, DEATH_DROP_CHANCE, USE_COOLDOWN_MS, FOOD_MAX_SECONDS, POTION_RANGE, EMPTY_VIAL, SPLASH_HP, SPLASH_MANA, SPLASH_STAGES, SPLASH_STAGE_MS, REGEN_MS, REGEN_HP, REGEN_MANA, itemInfo, itemLight, fitsSlot, capacityFor, newItem, weightOf, contains, findInTree, fromPlain, equipBonus
} from '../../shared/items.js';
import { PLAYER_SPRITES, DEFAULT_GENDER } from '../../shared/catalog.js';
import { SKILL_KEYS } from '../../shared/skills.js';

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

const CORPSE_SIZE = 8;

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
  // O inventário guardado (saved.equip); quem é novo começa com a bag
  // simples (STARTER_BAG) no espaço da mochila e a tocha (STARTER_TORCH) na mão. O layout das janelas volta junto.

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
      if (getAsset(splitType(STARTER_BAG).asset)) player.equip.mochila = newItem(this.nextUid(), STARTER_BAG);
      if (getAsset(splitType(STARTER_TORCH).asset)) player.equip.escudo = newItem(this.nextUid(), STARTER_TORCH);
    }
  }

  // ================================================================================================================================================================================================================================================
  // capUsed / capMax

  capUsed(player) {
    return Math.round(EQUIP_SLOTS.reduce((sum, key) => sum + weightOf(player.equip[key]), 0) * 100) / 100;
  }

  capMax(player) {
    return capacityFor(player.lvl);
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
  // isPickable
  // Objeto do chão que dá pra pôr no inventário: móvel e de uma folha conhecida.

  isPickable(obj) {
    return !!obj && obj.movable === true && !obj.floorType && !obj.isBorder && !obj.stairDirection && !obj.isCorpse &&
      this.sim.world.objects.has(obj) && !!getAsset(splitType(objectIdType(obj.id)).asset);
  }

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
  }

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
  }

  // ================================================================================================================================================================================================================================================
  // openGroundObjects
  // Caixas do chão que o player abriu e ainda alcança.

  openGroundObjects(player) {
    return [...player.openGround].map(id => this.sim.getItem(id)).filter(obj => this.isOpenable(obj) && this.isNear(player, obj));
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
  // canThrow
  // Nada intransponível entre o player e o sqm (mesma linha do arremesso do chão).

  canThrow(player, dest) {
    const probe = { blocksMovement: false, x: player.x, y: player.y, z: player.z || 0 };
    return this.sim.objectDrag.isThrowPathClear(player, probe, dest.x, dest.y, dest.z);
  }

  // ================================================================================================================================================================================================================================================
  // dropOnGround
  // Joga o item no sqm: nasce aos pés do player e voa até lá (object-drag.js:
  // cai por buraco, precisa de apoio; sem apoio, fica aos pés do player).

  dropOnGround(player, item, x, y, z) {
    const obj = this.spawnGroundItem(item, player.x, player.y, player.z || 0);
    this.sim.objectDrag.moveObject(player, obj, x, y, z);
  }

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
  }

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
  }

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
  }

  // ================================================================================================================================================================================================================================================
  // burnLights
  // Fonte de luz acesa gasta como no Tibia: item.fuel (ms que ainda queima)
  // começa em burn (gerador → Duração) e só desce acesa, onde quer que ela
  // esteja (equipada, num container ou no chão). Acabou, o item some.

  burnLights(ms) {
    const burn = (item) => {
      if (!item) return false;
      if (item.items) item.items.forEach((child, i) => { if (burn(child)) item.items[i] = null; });
      const total = item.lit ? itemInfo(item.type).burn * 1000 : 0;
      if (!total) return false;
      item.fuel = Math.max(0, (item.fuel ?? total) - ms);
      return item.fuel === 0;
    };
    for (const player of this.sim.players) {
      for (const key of EQUIP_SLOTS) if (burn(player.equip[key])) player.equip[key] = null;
    }
    for (const obj of [...this.sim.objects]) {
      if (obj.itemData && burn(obj.itemData)) this.removeGroundObject(obj);
    }
    for (const corpse of this.sim.deadBodies) burn(corpse.itemData);
  }

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
  }

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
  }

  // ================================================================================================================================================================================================================================================
  // use
  // Comando useItem: usa um item do inventário, de uma caixa aberta ou do
  // chão (longe, o player anda até o lado e usa ao chegar). Comida soma tempo
  // de regeneração (até FOOD_MAX_SECONDS; passou disso, "Você está cheio.").
  // Fonte de luz (tocha) acende ou apaga.
  // Potion vai no sqm target (a mira; sem target, no próprio player): em
  // player, cura; no chão, o líquido vaza. Nos dois casos a potion vira um
  // vial vazio.

  use(player, from, target = null) {
    if (!from || !['e', 'c', 'g'].includes(from.t)) return;
    const src = this.source(player, from);
    if (src.error) return;
    const info = itemInfo(src.item.type);
    const use = objectUse(src.item.type);
    if (!info.food && !info.heal && !use && !info.light) return;
    if (src.obj && !this.isNear(player, src.obj)) {
      this.walkNextTo(player, src.obj, { type: 'useItem', from, target });
      return;
    }
    if (info.light && !use && !info.food && !info.heal) {
      src.item.lit = !src.item.lit;
      if (src.obj) src.obj.lit = src.item.lit;
      return;
    }
    if (use === 'livro') {
      this.sim.interactions.readBook(player, src.item);
      return;
    }
    if (use === 'ferramenta-corda' || use === 'ferramenta-pa') {
      this.sim.interactions.useTool(player, use, target, from);
      return;
    }
    if (!info.food && !info.heal) return;
    if (info.food) {
      this.eat(player, src, info.food);
      return;
    }
    this.usePotion(player, src, info.heal, target || { x: player.x, y: player.y, z: player.z || 0 });
  }

  // ================================================================================================================================================================================================================================================
  // usePotion
  // Potion no sqm alvo (até POTION_RANGE, com linha de visão): player vivo
  // lá recupera vida e mana sorteadas na faixa (sem passar do máximo);
  // criatura não aceita; sqm vazio ganha o respingo. Espera USE_COOLDOWN_MS
  // até o próximo uso.

  usePotion(player, src, heal, target) {
    const z = player.z || 0;
    if (!Number.isInteger(target.x) || !Number.isInteger(target.y) || (target.z ?? z) !== z) return;
    if (!this.sim.movement.isInsideMap(target.x, target.y)) return;
    if (Math.max(Math.abs(target.x - player.x), Math.abs(target.y - player.y)) > POTION_RANGE) {
      this.message(player, 'Longe demais.');
      return;
    }
    if (!this.sim.movement.hasLineOfSight(player, target)) {
      this.message(player, 'Tem algo no caminho.');
      return;
    }
    const at = (e) => e.x === target.x && e.y === target.y && (e.z || 0) === z && e.isAlive();
    const patient = this.sim.players.find(at);
    if (!patient && this.sim.enemies.some(at)) {
      this.message(player, 'Só dá pra usar em players.');
      return;
    }

    const now = this.sim.time || 0;
    if (now < (player.useReadyAt || 0)) {
      this.message(player, 'Você está exausto.');
      return;
    }
    player.useReadyAt = now + USE_COOLDOWN_MS;

    if (patient) {
      const roll = ([min, max]) => min + Math.floor(Math.random() * (max - min + 1));
      const hp = Math.min(roll(heal.hp), patient.hp - patient.currentHp);
      const mana = Math.min(roll(heal.mana), patient.maxMana - patient.mana);
      patient.currentHp += hp;
      patient.mana += mana;
      this.sim.emit({ type: 'heal', playerId: patient.id, x: patient.x, y: patient.y, hp, mana });
    } else {
      this.spill(target.x, target.y, z, heal.hp[1] > 0 ? SPLASH_HP : SPLASH_MANA);
    }
    this.emptyPotion(player, src);
  }

  // ================================================================================================================================================================================================================================================
  // emptyPotion
  // A potion usada vira vial vazio onde estava (inventário, caixa ou chão).
  // Numa pilha, sai uma e o vial vai pra uma pilha de vials do mesmo lugar,
  // pro primeiro espaço livre dele ou, sem espaço, pro chão aos pés do player.

  emptyPotion(player, src) {
    const whole = (src.item.count || 1) <= 1;
    if (src.obj) {
      const { x, y } = src.obj;
      const z = src.obj.z || 0;
      if (whole) src.remove();
      else src.item.count--;
      const vial = this.spawnGroundItem(newItem(this.nextUid(), EMPTY_VIAL), x, y, z);
      this.mergeGroundStack(vial);
      return;
    }
    if (whole) {
      const vial = newItem(this.nextUid(), EMPTY_VIAL);
      if (src.place.t === 'e') player.equip[src.place.key] = vial;
      else src.container.items[src.place.i] = vial;
      return;
    }
    src.item.count--;
    const box = src.container || (player.equip.mochila && player.equip.mochila.items ? player.equip.mochila : null);
    if (box) {
      const stack = box.items.find(it => it && it.type === EMPTY_VIAL && (it.count || 1) < itemInfo(EMPTY_VIAL).stack);
      if (stack) {
        stack.count = (stack.count || 1) + 1;
        return;
      }
      const free = box.items.indexOf(null);
      if (free >= 0) {
        box.items[free] = newItem(this.nextUid(), EMPTY_VIAL);
        return;
      }
    }
    const vial = this.spawnGroundItem(newItem(this.nextUid(), EMPTY_VIAL), player.x, player.y, player.z || 0);
    this.mergeGroundStack(vial);
  }

  // ================================================================================================================================================================================================================================================
  // spill
  // Respingo do líquido no sqm: some aos poucos (um quadro a cada
  // SPLASH_STAGE_MS) e depois desaparece.

  spill(x, y, z, type) {
    const { world, objects, objectsById } = this.sim;
    this.objectCounter++;
    const obj = new GameObject({ id: `${type}_${this.objectCounter}`, x, y, z, step: this.sim.movement.getStepHeight(x, y, z), movable: false, hasVolume: false, blocksMovement: false });
    obj.isSplash = true;
    obj.stage = 0;
    obj.order = -1;
    objects.push(obj);
    objectsById.set(obj.id, obj);
    world.addObject(obj);
    const fade = () => {
      if (!world.objects.has(obj)) return;
      if (obj.stage < SPLASH_STAGES - 1) {
        obj.stage++;
        this.sim.schedule((this.sim.time || 0) + SPLASH_STAGE_MS, fade);
        return;
      }
      world.removeObject(obj);
      objectsById.delete(obj.id);
      const index = objects.indexOf(obj);
      if (index > -1) objects.splice(index, 1);
    };
    this.sim.schedule((this.sim.time || 0) + SPLASH_STAGE_MS, fade);
  }

  // ================================================================================================================================================================================================================================================
  // eat
  // Soma os segundos da comida no estômago do player (player.food, em ms).

  eat(player, src, seconds) {
    const food = player.food || 0;
    if (food + seconds * 1000 > FOOD_MAX_SECONDS * 1000) {
      this.message(player, 'Você está cheio.');
      return;
    }
    player.food = food + seconds * 1000;
    this.message(player, 'Smack.', 'info');
    if ((src.item.count || 1) > 1) src.item.count--;
    else src.remove();
  }

  // ================================================================================================================================================================================================================================================
  // digest
  // Com comida no estômago, o player recupera REGEN_HP de vida e REGEN_MANA
  // de mana a cada REGEN_MS (como no Tibia sem vocação); a comida vai
  // acabando com o tempo.

  digest(player, now) {
    const last = player.digestAt ?? now;
    player.digestAt = now;
    if (!player.food || !player.isAlive()) {
      player.regenElapsed = 0;
      return;
    }
    const elapsed = Math.min(now - last, player.food);
    player.food = Math.max(0, player.food - elapsed);
    player.regenElapsed = (player.regenElapsed || 0) + elapsed;
    while (player.regenElapsed >= REGEN_MS) {
      player.regenElapsed -= REGEN_MS;
      player.currentHp = Math.min(player.hp, player.currentHp + REGEN_HP);
      player.mana = Math.min(player.maxMana, player.mana + REGEN_MANA);
    }
  }

  // ================================================================================================================================================================================================================================================
  // close
  // Comando closeContainer: fecha a caixa do chão (a janela sumiu na tela).

  close(player, itemId) {
    player.openGround.delete(itemId);
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
  // fillCorpse
  // O cadáver da criatura vira container com o loot dela (lootTable), sorteado
  // na hora da morte.

  fillCorpse(corpse, enemy) {
    const box = { uid: this.nextUid(), type: enemy.creature, items: new Array(CORPSE_SIZE).fill(null) };
    let slot = 0;
    for (const entry of this.lootTable[enemy.creature] || creatureLoot(enemy.creature)) {
      if (slot >= CORPSE_SIZE) break;
      if (!entry || !getAsset(splitType(entry.tipo).asset) || Math.random() >= (entry.chance ?? 1)) continue;
      const min = Math.max(1, entry.min || 1);
      const max = Math.max(min, entry.max || min);
      box.items[slot++] = newItem(this.nextUid(), entry.tipo, min + Math.floor(Math.random() * (max - min + 1)));
    }
    corpse.itemData = box;
    return box;
  }

  // ================================================================================================================================================================================================================================================
  // fillPlayerCorpse
  // Morte do player: a mochila vai sempre pro corpo; cada outro item do
  // inventário, com DEATH_DROP_CHANCE. O que cai sai do inventário.

  fillPlayerCorpse(corpse, player) {
    const box = { uid: this.nextUid(), type: PLAYER_SPRITES[player.gender] || PLAYER_SPRITES[DEFAULT_GENDER], items: new Array(EQUIP_SLOTS.length).fill(null) };
    let slot = 0;
    for (const key of EQUIP_SLOTS) {
      const item = player.equip[key];
      if (!item) continue;
      if (key !== 'mochila' && Math.random() >= DEATH_DROP_CHANCE) continue;
      box.items[slot++] = item;
      player.equip[key] = null;
    }
    player.openGround.clear();
    player.pendingInv = null;
    corpse.itemData = box;
    return box;
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
