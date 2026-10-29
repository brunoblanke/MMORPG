// js/systems/interactions.js

import { GameObject } from '../models/game-object.js';
import { fichaDe, reacoesA, capacidadesDe, interacoesDe, clicavel, efeitosAoPisar } from '../../shared/ficha.js';
import { objectIdType, objectProps, objectUse, activeAs, togglesOnUse, displayName, getAsset, splitType, isEntranceType, floorBehavior, WORM_TYPE } from '../../shared/assets.js';
import { itemInfo, newItem, weightOf, FISH_RANGE, USE_COOLDOWN_MS, SLEEP_REGEN_FACTOR, REGEN_HP, REGEN_MANA } from '../../shared/items.js';
import { VOCATIONS, vocationOf } from '../../shared/vocations.js';
import { takeFromBag } from './trade.js';
import { WATER_EFFECT } from '../../shared/effects.js';
import { isValidFloor } from '../../shared/constants.js';
import { getHoleTarget, toLowerLevel, toUpperLevel } from '../../shared/stairs.js';
import { isSyncedItem } from '../net/protocol.js';

// Efeito que brilha no sqm onde o item pescado ou a minhoca cai no chão.
const DROP_EFFECT = 'rings-yellow';

// Efeito no sqm onde algo é plantado.
const PLANT_EFFECT = 'rings-green';

// Fogueira: quantas madeiras (item com Uso fogueira) no chão acendem, quanto tempo até o player sair e quanto o fogo
// fica aceso no chão.
export const CAMPFIRE_WOOD = 3;
export const CAMPFIRE_MS = 3000;
export const CAMPFIRE_BURN_MS = 60000;

// Objetos do mapa que se usam (gerador → Objetos → Uso):
//   placa     → o texto (editor) aparece em cima dela, na cor escolhida no editor;
//   livro     → abre o texto numa janela (no chão ou carregado);
//   bau-quest → dá os itens (editor) uma vez por player;
//   corda     → marca de corda: com a corda, sobe pro andar de cima;
//   pa        → monte que a pá abre em buraco (fica aberto até o servidor reiniciar);
//   pa-cai    → a pá abre e quem cavou já cai no buraco (o desenho não muda);
//   descer    → bueiro: usar leva pro andar de baixo (pisar não);
//   deposito  → abre o depósito do player (inventory/depot.js);
//   picareta  → monte que a picareta abre em buraco, como a pá;
//   machete / foice → mato e plantação: a ferramenta corta e rebrota depois de REGROW_MS;
//   cama      → o player deita e sai do jogo, e acorda com vida e mana recuperadas mais rápido (SLEEP_REGEN_FACTOR);
//   fogueira  → item (a madeira): CAMPFIRE_WOOD ou mais no chão, usar queima a pilha inteira, que vira o fogo (Ativo
//               como; todos veem, apaga em CAMPFIRE_BURN_MS), o player aparece deitado (Descansa como, só ele vê) e
//               sai do jogo CAMPFIRE_MS depois (campfire / checkCampfires);
//   alavanca  → usar liga ou desliga os alvos dela (portas e objetos que alternam, escolhidos no editor).
// Longe, o player anda até o lado e usa ao chegar.

const MAP_USES = ['placa', 'livro', 'bau-quest', 'corda', 'pa', 'pa-cai', 'descer', 'deposito', 'alavanca', 'cama'];
const TOOL_TARGETS = { 'ferramenta-corda': ['corda'], 'ferramenta-pa': ['pa', 'pa-cai'], 'ferramenta-picareta': ['picareta'], 'ferramenta-machete': ['machete'], 'ferramenta-foice': ['foice'] };
const SHOVEL_USES = ['pa', 'pa-cai', 'picareta'];
const REGROW_MS = 120000;
const PULL_FROM_BELOW = { gatilho: { tipo: 'capacidade', capacidade: 'puxar' }, condicoes: {}, efeitos: [{ tipo: 'puxar-de-baixo' }] };
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
    return clicavel(objectIdType(obj.id));
  }

  // ================================================================================================================================================================================================================================================
  // isReactive
  // O objeto do mapa reage a alguma ferramenta (tem uma interação por capacidade).

  isReactive(obj) {
    if (!obj || !this.sim.world.objects.has(obj)) return false;
    const ficha = fichaDe(objectIdType(obj.id));
    return !!ficha && ficha.interacoes.some(i => i.gatilho.tipo === 'capacidade');
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
    const type = objectIdType(obj.id);
    const tile = { x: obj.x, y: obj.y, z: obj.z || 0 };
    for (const click of interacoesDe(type, 'clicar')) {
      if (click.propria) this.sim.effects.run(click, { actor: player, target: obj, tile, id: obj.id });
      else for (const effect of click.efeitos) this.applyClick(player, obj, effect, type);
    }
  }

  // ================================================================================================================================================================================================================================================
  // applyClick
  // Um efeito de uma interação de clicar no objeto do mapa.

  applyClick(player, obj, effect, type) {
    if (effect.tipo === 'mostrar-texto') {
      if (effect.como === 'livro') this.readBook(player, obj.itemData || { type, texto: obj.data && obj.data.texto });
      else if (obj.data && obj.data.texto) this.signText(player, obj);
    } else if (effect.tipo === 'dar-itens') this.openQuestChest(player, obj);
    else if (effect.tipo === 'trocar-andar') this.goDown(player, obj);
    else if (effect.tipo === 'abrir-deposito') this.sim.inventory.openDepotAt(player, obj);
    else if (effect.tipo === 'alternar-estado') this.setActive(obj, !obj.active);
    else if (effect.tipo === 'acionar-alvos') this.driveTargets(obj);
    else if (effect.tipo === 'deitar') this.sleep(player, obj);
  }

  // ================================================================================================================================================================================================================================================
  // sleep
  // Cama: o player deita e sai do jogo na hora (o servidor avisa o navegador). A cama fica ocupada (desenho
  // ativo) até ele voltar; fora de combate, em cama livre e, em casa com dono, só o dono e os convidados.

  sleep(player, bed) {
    const z = bed.z || 0;
    if (bed.active) return this.message(player, 'A cama está ocupada.');
    if (!this.sim.world.mayEnter(player, bed.x, bed.y, z)) return this.message(player, 'Essa cama não é sua.');
    if (this.sim.inCombat(player)) return this.message(player, 'Você não pode dormir em combate.');
    this.setActive(bed, true);
    player.sleep = { at: this.sim.wallClock(), bed: { x: bed.x, y: bed.y, z } };
    this.sim.removePlayer(player.id);
    this.sim.loggedOut.push(player);
  }

  // ================================================================================================================================================================================================================================================
  // campfire
  // A pilha de madeira no chão (src, do useItem), com CAMPFIRE_WOOD ou mais, queima inteira e vira o fogo (Ativo como
  // da madeira), que todos veem e apaga em CAMPFIRE_BURN_MS; quem acendeu aparece deitado (Descansa como; evento
  // campfire, só ele vê) e sai do jogo em CAMPFIRE_MS (checkCampfires).

  campfire(player, src) {
    const count = src.item.count || 1;
    if (!src.obj || count < CAMPFIRE_WOOD) return this.message(player, `Junte ${CAMPFIRE_WOOD} madeiras no chão pra acender a fogueira.`);
    if (this.sim.inCombat(player)) return this.message(player, 'Você não pode descansar em combate.');
    if (player.restingUntil) return;
    const { x, y } = src.obj;
    const z = src.obj.z || 0;
    const fire = activeAs(src.item.type);
    const rest = itemInfo(src.item.type).restsAs;
    src.remove();
    if (fire) this.placeTemporary(fire, x, y, z, CAMPFIRE_BURN_MS);
    player.restingUntil = this.sim.time + CAMPFIRE_MS;
    this.sim.emit({ type: 'campfire', playerId: player.id, x: player.x, y: player.y, z: player.z || 0, look: rest || null, ms: CAMPFIRE_MS });
  }

  // ================================================================================================================================================================================================================================================
  // placeTemporary
  // Objeto que aparece no sqm pra todos e some sozinho depois de ms (o fogo da fogueira).

  placeTemporary(type, x, y, z, ms) {
    const { sim } = this;
    const props = objectProps(type);
    sim.inventory.objectCounter++;
    const obj = new GameObject({ id: `${type}_${sim.inventory.objectCounter}`, x, y, z, step: sim.movement.getStepHeight(x, y, z), movable: false, hasVolume: props.hasVolume, blocksMovement: false, temporary: true });
    sim.objects.push(obj);
    sim.objectsById.set(obj.id, obj);
    sim.world.addObject(obj);
    sim.schedule((sim.time || 0) + ms, () => {
      if (sim.objectsById.get(obj.id) === obj) sim.inventory.removeGroundObject(obj);
    });
    return obj;
  }

  // ================================================================================================================================================================================================================================================
  // checkCampfires
  // Quem acendeu a fogueira sai do jogo quando o fogo termina (rested: o servidor manda o navegador pra tela de entrada);
  // entrar em combate antes apaga.

  checkCampfires(now) {
    for (const player of [...this.sim.players]) {
      if (!player.restingUntil) continue;
      if (this.sim.inCombat(player, now) || player.dead) {
        player.restingUntil = null;
        continue;
      }
      if (now < player.restingUntil) continue;
      player.restingUntil = null;
      player.rested = true;
      this.sim.removePlayer(player.id);
      this.sim.loggedOut.push(player);
    }
  }

  // ================================================================================================================================================================================================================================================
  // wake
  // O player que dormia entra de novo: a vida e a mana sobem pelo tempo que ficou fora e a cama fica livre.

  wake(player) {
    const sleep = player.sleep;
    player.sleep = null;
    if (!sleep) return;
    const regen = VOCATIONS[vocationOf(player.vocation)].regen;
    const ms = Math.max(0, this.sim.wallClock() - sleep.at) * SLEEP_REGEN_FACTOR;
    player.currentHp = Math.min(player.hp, player.currentHp + Math.floor(ms / regen.hp) * REGEN_HP);
    player.mana = Math.min(player.maxMana, player.mana + Math.floor(ms / regen.mana) * REGEN_MANA);
    const { x, y, z } = sleep.bed;
    const bed = this.sim.world.getObjectsAt(x, y).find(o => (o.z || 0) === z && objectUse(objectIdType(o.id)) === 'cama');
    if (bed) this.setActive(bed, false);
  }

  // ================================================================================================================================================================================================================================================
  // driveTargets
  // Alavanca já virada: põe todos os alvos (sqms escolhidos no editor) no mesmo: ligada, a porta
  // abre e o objeto que alterna fica ativo; desligada, o contrário.

  driveTargets(lever) {
    const targets = (lever.data && Array.isArray(lever.data.alvos)) ? lever.data.alvos : [];
    const { world, control } = this.sim;
    for (const { x, y, z = 0 } of targets) {
      if (![x, y, z].every(Number.isInteger)) continue;
      const door = world.getDoorAt(x, y, z);
      if (door) {
        control.setDoor(door, !!lever.active);
        continue;
      }
      for (const obj of world.getObjectsAt(x, y)) {
        if ((obj.z || 0) !== z || obj === lever || obj.movable === true || !togglesOnUse(objectIdType(obj.id))) continue;
        this.setActive(obj, !!lever.active);
      }
    }
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
  // checkTeleports
  // Player que acaba de pisar num teletransporte (objeto com Uso teleporte e destino, escolhido no editor) vai pro sqm livre mais perto do destino, com o efeito teleport nos dois lugares. O sqm de chegada não dispara outro teletransporte até ele sair de lá.

  checkTeleports(players) {
    const { world } = this.sim;
    for (const player of players) {
      const z = player.z || 0;
      const key = `${player.x},${player.y},${z}`;
      if (player.teleportArrival === key) continue;
      player.teleportArrival = null;
      const pad = world.getObjectsAt(player.x, player.y).find(o => (o.z || 0) === z && efeitosAoPisar(objectIdType(o.id)).some(e => e.tipo === 'teletransportar'));
      const to = pad && pad.data && pad.data.destino;
      if (!to || !Number.isInteger(to.x) || !Number.isInteger(to.y) || !isValidFloor(to.z) || !world.hasFloorAt(to.x, to.y, to.z)) continue;
      this.sim.spells.showEffect(player.x, player.y, 'teleport', undefined, z);
      this.sim.teleportPlayer(player, to.x, to.y, to.z);
      player.teleportArrival = `${player.x},${player.y},${to.z}`;
      this.sim.spells.showEffect(player.x, player.y, 'teleport', undefined, to.z);
    }
  }

  // ================================================================================================================================================================================================================================================
  // checkStepTriggers
  // Player que acaba de pisar num sqm: as interações de pisar escritas na ficha do objeto ou do piso dele rodam.

  checkStepTriggers(players) {
    const { world, effects } = this.sim;
    for (const player of players) {
      const z = player.z || 0;
      const key = `${player.x},${player.y},${z}`;
      if (player.stepTriggerKey === key) continue;
      player.stepTriggerKey = key;
      const tile = { x: player.x, y: player.y, z };
      const floor = world.topFloors.get(world.getTileKey(player.x, player.y, z));
      const here = world.getObjectsAt(player.x, player.y).filter(o => (o.z || 0) === z && !o.floorType);
      for (const source of [...(floor ? [floor] : []), ...here]) {
        for (const step of interacoesDe(source.floorType || objectIdType(source.id), 'pisar')) {
          if (step.propria) effects.run(step, { actor: player, target: source, tile, id: source.id });
        }
      }
    }
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
    const itemFicha = item ? fichaDe(item.type) : null;
    const capacities = itemFicha && itemFicha.tracos.capacidade ? itemFicha.tracos.capacidade : capacidadesDe(item ? objectUse(item.type) : tool);
    for (const capacity of capacities) {
      const hit = this.findReaction(capacity, target, z);
      if (hit) return this.react(player, hit, item, from, target);
    }
    return false;
  }

// ================================================================================================================================================================================================================================================
  // findReaction
  // Quem reage à capacidade no sqm: um objeto do sqm com a reação na ficha dele (a marca de corda antes da abertura
  // por onde se puxa) ou, sem ele, o piso. Reação com estado ativo só vale para objeto ativo.

  findReaction(capacity, target, z) {
    const { world } = this.sim;
    const rank = (hit) => (hit.reaction.efeitos.some(e => e.tipo === 'puxar-de-baixo') ? 1 : 0);
    const hits = [];
    for (const obj of world.getObjectsAt(target.x, target.y)) {
      if ((obj.z || 0) !== z || obj.floorType) continue;
      const ficha = fichaDe(objectIdType(obj.id));
      const reactions = ficha ? reacoesA(ficha, capacity).filter(r => r.condicoes.estado !== 'ativo' || obj.active) : [];
      const reaction = reactions[0] || (capacity === 'puxar' && this.isOpening(obj) ? PULL_FROM_BELOW : null);
      if (reaction) hits.push({ obj, reaction, reactions });
    }
    hits.sort((a, b) => rank(a) - rank(b));
    if (hits.length) return hits[0];
    const creature = world.getCreatureAt(target.x, target.y, z);
    const cficha = creature && !creature.isPlayer && creature.creature && fichaDe(creature.creature);
    const creatureReactions = cficha ? reacoesA(cficha, capacity) : [];
    if (creatureReactions.length) return { obj: creature, reaction: creatureReactions[0], reactions: creatureReactions, creature: true };
    const floor = world.topFloors.get(world.getTileKey(target.x, target.y, z));
    const ficha = floor && fichaDe(floor.floorType);
    const reactions = ficha ? reacoesA(ficha, capacity) : [];
    return reactions.length ? { obj: null, reaction: reactions[0], reactions } : null;
  }

// ================================================================================================================================================================================================================================================
  // react
  // Faz os efeitos da reação: do objeto (longe, o player anda até o lado e faz ao chegar; from: de onde veio a
  // ferramenta) ou do piso do sqm (pescar, cavar minhoca).

  react(player, hit, item, from, target) {
    const { obj, reaction } = hit;
    if (reaction.propria) return this.reactOwn(player, hit, from, target);
    const kinds = reaction.efeitos.map(e => e.tipo);
    if (kinds.includes('trancar')) return this.useKey(player, item, target, from);
    if (!obj) return kinds.includes('gastar-item') ? this.fish(player, item, target) : this.digWorm(player, target);
    if (!this.sim.inventory.isNear(player, obj)) {
      if (from) this.sim.inventory.walkNextTo(player, obj, { type: 'useItem', from, target });
      return false;
    }
    if (kinds.includes('puxar-de-baixo')) return this.pullUp(obj);
    if (kinds.includes('trocar-andar')) return this.climb(player, obj);
    if (kinds.includes('remover')) return this.cut(obj);
    return this.dig(player, obj);
  }

// ================================================================================================================================================================================================================================================
  // reactOwn
  // Reações escritas na ficha (gerador → Interações), todas as do alvo pra essa capacidade, em ordem: longe do objeto,
  // o player anda até o lado e usa ao chegar; espera USE_COOLDOWN_MS entre um uso e outro; perto, mas sem resultado
  // (a chance falhou, faltou item…), sobe a fumacinha.

  reactOwn(player, hit, from, target) {
    const { obj, reaction, creature } = hit;
    const z = player.z || 0;
    const reach = reaction.condicoes.alcance;
    const dist = Math.max(Math.abs(target.x - player.x), Math.abs(target.y - player.y));
    if (obj && !creature && reach >= 1 && dist > reach) {
      if (from) this.sim.inventory.walkNextTo(player, obj, { type: 'useItem', from, target });
      return false;
    }
    const now = this.sim.time || 0;
    if (now < (player.useReadyAt || 0)) return false;
    player.useReadyAt = now + USE_COOLDOWN_MS;
    const ctx = { actor: player, target: obj, tile: { x: target.x, y: target.y, z }, id: `${obj ? obj.id : 'piso'}:${target.x},${target.y}` };
    let done = false;
    for (const own of (hit.reactions || [reaction]).filter(r => r.propria)) done = this.sim.effects.run(own, ctx) || done;
    if (!done && (reach === undefined || dist <= reach)) this.sim.spells.showEffect(target.x, target.y, 'poff', undefined, z);
    return done;
  }

// ================================================================================================================================================================================================================================================
  // replaceObject
  // O objeto do mapa vira outro tipo no mesmo lugar. Um objeto que bloqueia não nasce onde há criatura ou outro
  // bloqueio (devolve null; a interação tenta de novo depois).

  replaceObject(obj, type) {
    const { world, inventory } = this.sim;
    const z = obj.z || 0;
    if (objectProps(type).blocksMovement && !obj.blocksMovement && (world.hasBlockerAt(obj.x, obj.y, z) || world.getCreatureAt(obj.x, obj.y, z) !== null)) return null;
    inventory.removeGroundObject(obj);
    if (!isSyncedItem(obj)) this.sim.liveMap.hidden(obj);
    return this.placeObject(type, obj.x, obj.y, z, obj.step || 0);
  }

  // ================================================================================================================================================================================================================================================
  // plant
  // Item que se planta (semente, gerador → Objetos → Planta como) usado com a mira no chão colado ao player (ou no
  // dele): vira o objeto na hora (a muda) e gasta 1; onde não dá, sobe a fumacinha.

  plant(player, src, type, target) {
    const z = player.z || 0;
    if (!target || !Number.isInteger(target.x) || !Number.isInteger(target.y) || (target.z ?? z) !== z || !getAsset(splitType(type).asset)) return false;
    if (Math.max(Math.abs(target.x - player.x), Math.abs(target.y - player.y)) > 1) {
      this.message(player, 'Longe demais.');
      return false;
    }
    const now = this.sim.time || 0;
    if (now < (player.useReadyAt || 0)) return false;
    player.useReadyAt = now + USE_COOLDOWN_MS;
    if (!this.canPlantAt(player, target.x, target.y, z)) {
      this.sim.spells.showEffect(target.x, target.y, 'poff', undefined, z);
      return false;
    }
    if ((src.item.count || 1) > 1) src.item.count--;
    else src.remove();
    this.placeObject(type, target.x, target.y, z);
    this.sim.spells.showEffect(target.x, target.y, PLANT_EFFECT, undefined, z);
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // canPlantAt
  // Dá pra plantar no sqm: o piso de cima é de plantar (gerador → Pisos → Dá pra plantar: grama, terra), nada
  // bloqueia, não há outro objeto fixo (outra muda, móvel…) e não é casa de outro.

  canPlantAt(player, x, y, z) {
    const { world } = this.sim;
    const floor = world.topFloors.get(world.getTileKey(x, y, z));
    if (!floor || !floorBehavior(floor.floorType).plantable) return false;
    if (world.isFloorBlocked(x, y, z) || world.hasBlockerAt(x, y, z) || !world.mayEnter(player, x, y, z)) return false;
    return !world.getObjectsAt(x, y).some(obj => (obj.z || 0) === z && !obj.floorType && !obj.isBorder && !obj.hidden && !isSyncedItem(obj));
  }

// ================================================================================================================================================================================================================================================
  // placeObject
  // Um objeto novo no mapa (muda plantada, árvore que nasce); o fixo vai pro mundo vivo (mapa e navegadores).

  placeObject(type, x, y, z, step = 0) {
    const { world, inventory, objects, objectsById } = this.sim;
    const props = objectProps(type);
    inventory.objectCounter++;
    const obj = new GameObject({ id: `${type}_${inventory.objectCounter}`, x, y, z, step, movable: props.movable, hasVolume: props.hasVolume, blocksMovement: props.blocksMovement });
    obj.bornAt = this.sim.time || 0;
    if (!props.movable) this.sim.liveMap.add(obj);
    objects.push(obj);
    objectsById.set(obj.id, obj);
    world.addObject(obj);
    return obj;
  }

// ================================================================================================================================================================================================================================================
  // cut
  // Mato ou plantação cortado: some do mapa e rebrota no mesmo lugar depois de REGROW_MS (espera enquanto
  // alguém estiver em cima).

  cut(plant, regrowMs = REGROW_MS) {
    const z = plant.z || 0;
    this.sim.inventory.removeGroundObject(plant);
    if (!isSyncedItem(plant)) this.sim.liveMap.hidden(plant);
    this.sim.spells.showEffect(plant.x, plant.y, 'poff', undefined, z);
    const regrow = () => {
      if (this.sim.world.getCreatureAt(plant.x, plant.y, z) !== null) {
        this.sim.schedule((this.sim.time || 0) + 5000, regrow);
        return;
      }
      plant.regrowing = false;
      if (!isSyncedItem(plant)) this.sim.liveMap.shown(plant);
      this.sim.objects.push(plant);
      this.sim.objectsById.set(plant.id, plant);
      this.sim.world.addObject(plant);
    };
    plant.regrowing = regrowMs > 0;
    if (regrowMs > 0) this.sim.schedule((this.sim.time || 0) + regrowMs, regrow);
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // useKey
  // Chave usada com a mira numa porta com chave (editor): se o número bate, trava a porta fechada ou destrava
  // a trancada. Longe, o player anda até o lado e usa ao chegar.

  useKey(player, item, target, from) {
    const door = this.sim.world.getDoorAt(target.x, target.y, player.z || 0);
    if (!door || !door.data || !door.data.chave) return false;
    if (!this.sim.inventory.isNear(player, door)) {
      if (from) this.sim.inventory.walkNextTo(player, door, { type: 'useItem', from, target });
      return false;
    }
    if (!item || item.chave !== door.data.chave) {
      this.message(player, 'A chave não serve.');
      return false;
    }
    if (!door.blocksMovement) {
      this.message(player, 'Feche a porta primeiro.');
      return false;
    }
    door.unlocked = !door.unlocked;
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // fish
  // Vara de pescar no sqm de água (piso com peixes, gerador → Pisos → Pescável) até FISH_RANGE (6 sqm) e com linha de visão: gasta a isca da vara (a minhoca), mostra o efeito da água (WATER_EFFECT), treina o fishing e, com chance que sobe com o skill (10% + 0,597% por nível acima de 10, de 10% a 50%, como no Tibia), dá um dos peixes do piso que o skill alcança (fishLevel), que cai no chão ao lado do player, do lado da água (dropBeside); quanto mais o skill passa do nível de um peixe, mais comum ele fica (peso de 1 até 20), então os melhores aparecem mais com o skill. Sem a isca, avisa "Você não tem isca.". Espera USE_COOLDOWN_MS até a próxima. Devolve true se pescou (gastou isca).

  fish(player, rod, target) {
    const { world, movement } = this.sim;
    const z = player.z || 0;
    const floor = world.topFloors.get(world.getTileKey(target.x, target.y, z));
    const fish = floor ? floorBehavior(floor.floorType).fish : [];
    if (!rod || !fish.length || !movement.isInsideMap(target.x, target.y)) return false;
    if (Math.max(Math.abs(target.x - player.x), Math.abs(target.y - player.y)) > FISH_RANGE || !movement.hasLineOfSight(player, target)) return false;
    const now = this.sim.time || 0;
    if (now < (player.useReadyAt || 0)) return false;
    const bait = itemInfo(rod.type).bait;
    if (bait && !takeFromBag(player, bait, 1)) {
      this.sim.emit({ type: 'message', playerId: player.id, text: 'Você não tem isca.', kind: 'warn' });
      return false;
    }
    player.useReadyAt = now + USE_COOLDOWN_MS;
    this.sim.spells.showEffect(target.x, target.y, WATER_EFFECT, undefined, z);
    this.sim.combat.trainSkill(player, 'fishing');
    const level = player.skills && player.skills.fishing ? player.skills.fishing.lvl : 10;
    const chance = Math.min(50, Math.max(10, 10 + (level - 10) * 0.597));
    if (Math.random() * 100 >= chance) return true;
    const weights = fish.map(type => (level >= itemInfo(type).fishLevel ? Math.min(20, 1 + level - itemInfo(type).fishLevel) : 0));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) return true;
    let roll = Math.random() * total;
    const index = weights.findIndex(weight => (roll -= weight) < 0);
    this.dropBeside(player, fish[index < 0 ? fish.length - 1 : index], target);
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // dropBeside
  // O item cai no chão ao lado do player: o sqm em volta dele (ou o dele, se não houver) livre e firme mais perto de towards (pra onde ele pescou ou cortou), com o brilho DROP_EFFECT.

  dropBeside(player, type, towards, count = 1) {
    const { world, movement, inventory } = this.sim;
    const z = player.z || 0;
    const around = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const x = player.x + dx;
        const y = player.y + dy;
        if ((dx || dy) && movement.isInsideMap(x, y) && world.hasFloorAt(x, y, z) && !world.isFloorBlocked(x, y, z) && !movement.isBlocked(x, y, z)) around.push({ x, y });
      }
    }
    around.sort((a, b) => Math.hypot(a.x - towards.x, a.y - towards.y) - Math.hypot(b.x - towards.x, b.y - towards.y));
    const spot = around[0] || { x: player.x, y: player.y };
    inventory.mergeGroundStack(inventory.spawnGroundItem(newItem(inventory.nextUid(), type, count), spot.x, spot.y, z));
    this.sim.spells.showEffect(spot.x, spot.y, DROP_EFFECT, undefined, z);
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
    this.sim.spells.showEffect(target.x, target.y, DROP_EFFECT, undefined, z);
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
    return isEntranceType(type);
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
    const rewards = entries.map(e => {
      const item = newItem(inventory.nextUid(), e.tipo, e.count || 1);
      if (e.chave) item.chave = e.chave;
      return item;
    });
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
