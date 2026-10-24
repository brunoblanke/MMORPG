// js/systems/interaction-effects.js

import { getAsset, splitType, objectIdType } from '../../shared/assets.js';
import { newItem } from '../../shared/items.js';
import { isValidFloor } from '../../shared/constants.js';
import { countInBag, giveItem } from './trade.js';
import { interacoesDe } from '../../shared/ficha.js';
import { normalizeSpeech } from '../../shared/npcs.js';

const TEMPO_MS = 1000;

// Os efeitos das interações escritas na ficha (gerador → Interações): o jogo só sabe o vocabulário (shared/ficha.js →
// ESQUEMA_EFEITOS) e age em quem a interação manda. Contexto de cada execução:
//   actor  o player que usou a ferramenta, pisou ou clicou
//   target onde a interação está: um objeto do mapa ou uma criatura (NPC ou inimigo)
//   tile   { x, y, z } do alvo
//   id     identifica a interação (pra "uma vez por player")

export class InteractionEffects {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
  }

  // ================================================================================================================================================================================================================================================
  // meets
  // As condições da interação valem pra esse ator (todas: "e").

  meets(conditions, ctx) {
    const { actor, tile } = ctx;
    if (conditions.alcance !== undefined && actor && Math.max(Math.abs(actor.x - tile.x), Math.abs(actor.y - tile.y)) > conditions.alcance) return false;
    if (conditions.nivel && (!actor || actor.lvl < conditions.nivel)) return false;
    if (conditions.quest && (!actor || !(actor.quests || []).includes(conditions.quest))) return false;
    if (conditions['tem-item'] && (!actor || countInBag(actor, conditions['tem-item']) < 1)) return false;
    if (conditions.palavra && !` ${ctx.heard || ''} `.includes(` ${normalizeSpeech(conditions.palavra)} `)) return false;
    if (conditions.item && !(ctx.item && ctx.item.type.includes(conditions.item))) return false;
    if (conditions.chance && Math.random() * 100 >= conditions.chance) return false;
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // run
  // Faz os efeitos da interação se as condições valem. Devolve true se rodou.

  run(interaction, ctx) {
    if (!this.meets(interaction.condicoes || {}, ctx)) return false;
    for (const effect of interaction.efeitos) this.apply(effect, ctx);
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // whoIs
  // Em quem o efeito age: o alvo da interação ou o ator.

  whoIs(effect, ctx) {
    return effect.alvo === 'ator' ? ctx.actor : ctx.target;
  }

  // ================================================================================================================================================================================================================================================
  // apply

  apply(effect, ctx) {
    const sim = this.sim;
    const { actor, target, tile } = ctx;
    if (effect.tipo === 'falar') {
      sim.emit({ type: 'speech', speakerId: target && target.id, name: (target && target.name) || null, text: effect.texto, x: tile.x, y: tile.y, z: tile.z, npc: !!(target && target.isNpc), orange: !(target && target.isNpc) });
    } else if (effect.tipo === 'mostrar-texto' && actor) {
      sim.emit({ type: 'message', playerId: actor.id, text: effect.texto, kind: 'info' });
    } else if (effect.tipo === 'dano') {
      const who = this.whoIs(effect, ctx);
      if (who && who.isAlive && who.isAlive() && !who.isNpc && effect.valor > 0) sim.conditions.hurt(who, effect.valor, effect.elemento);
    } else if (effect.tipo === 'curar') {
      const who = this.whoIs(effect, ctx);
      if (who && who.isPlayer && who.isAlive()) {
        if (effect.hp) sim.spells.heal(who, effect.hp);
        if (effect.mana) who.mana = Math.min(who.maxMana, who.mana + effect.mana);
      }
    } else if (effect.tipo === 'estado-de-dano') {
      const who = this.whoIs(effect, ctx);
      if (who && !who.isNpc && effect.dano > 0 && effect.ticks > 0) sim.conditions.add(who, effect.estado, { damage: effect.dano, ticks: effect.ticks });
    } else if (effect.tipo === 'soltar-item') {
      if (getAsset(splitType(effect.item).asset)) {
        const { inventory } = sim;
        inventory.mergeGroundStack(inventory.spawnGroundItem(newItem(inventory.nextUid(), effect.item, Math.max(1, effect.quantidade || 1)), tile.x, tile.y, tile.z));
      }
    } else if (effect.tipo === 'dar-itens' && actor && getAsset(splitType(effect.item).asset)) {
      const key = `interacao:${ctx.id}`;
      actor.quests = actor.quests || [];
      if (effect.umaVez === 'sim' && actor.quests.includes(key)) return;
      giveItem(sim, actor, effect.item, Math.max(1, effect.quantidade || 1));
      if (effect.umaVez === 'sim') actor.quests.push(key);
    } else if (effect.tipo === 'efeito-visual') {
      sim.spells.showEffect(tile.x, tile.y, effect.nome, undefined, tile.z);
    } else if (effect.tipo === 'teletransportar' && actor && effect.destino && isValidFloor(effect.destino.z) && sim.world.hasFloorAt(effect.destino.x, effect.destino.y, effect.destino.z)) {
      sim.spells.showEffect(actor.x, actor.y, 'teleport', undefined, actor.z || 0);
      sim.teleportPlayer(actor, effect.destino.x, effect.destino.y, effect.destino.z);
      actor.teleportArrival = `${actor.x},${actor.y},${actor.z || 0}`;
      sim.spells.showEffect(actor.x, actor.y, 'teleport', undefined, actor.z || 0);
    } else if (effect.tipo === 'alternar-estado' && target && !target.isNpc && target.id && sim.objectsById.has(target.id)) {
      sim.interactions.setActive(target, !target.active);
    } else if (effect.tipo === 'definir-estado' && target && sim.objectsById.has(target.id)) {
      const active = effect.valor === 'ativo';
      sim.interactions.setActive(target, active);
      if (effect.voltaEmMs > 0) sim.schedule((sim.time || 0) + effect.voltaEmMs, () => sim.interactions.setActive(target, !active));
    } else if (effect.tipo === 'consumir-item') {
      ctx.consumed = true;
    } else if (effect.tipo === 'remover' && target && sim.objectsById.has(target.id)) {
      sim.interactions.cut(target, effect.rebroteMs);
    }
  }

  // ================================================================================================================================================================================================================================================
  // trigger
  // Roda as interações da criatura com o gatilho (ser-atingido, morrer, tempo). actor = quem bateu ou matou.

  trigger(creature, gatilho, actor = null) {
    if (!creature || !creature.creature || creature.pet) return;
    const tile = { x: creature.x, y: creature.y, z: creature.z || 0 };
    for (const interaction of interacoesDe(creature.creature, gatilho)) {
      if (interaction.propria) this.run(interaction, { actor, target: creature, tile, id: creature.id });
    }
  }

  // ================================================================================================================================================================================================================================================
  // dropOn
  // O gatilho item-em-cima: o player pôs o item no objeto. Devolve true se alguma interação consumiu o item.

  dropOn(player, obj, item) {
    const ctx = { actor: player, target: obj, tile: { x: obj.x, y: obj.y, z: obj.z || 0 }, id: obj.id, item, consumed: false };
    for (const interaction of interacoesDe(this.typeOf(obj), 'item-em-cima')) {
      if (interaction.propria) this.run(interaction, ctx);
    }
    return ctx.consumed;
  }

  // ================================================================================================================================================================================================================================================
  // hear
  // O gatilho falar: o player disse `heard` (já normalizado) perto de criaturas e objetos que têm interação de falar.
  // A condição palavra pede que a fala contenha aquelas palavras; alcance vale como em qualquer interação.

  hear(player, heard, range) {
    const sim = this.sim;
    const z = player.z || 0;
    const near = (e) => (e.z || 0) === z && Math.max(Math.abs(e.x - player.x), Math.abs(e.y - player.y)) <= range;
    const listeners = [...sim.npcs, ...sim.enemies.filter(e => !e.pet), ...sim.objects].filter(near);
    for (const target of listeners) {
      const type = this.typeOf(target);
      if (!type) continue;
      const tile = { x: target.x, y: target.y, z };
      for (const interaction of interacoesDe(type, 'falar')) {
        if (interaction.propria) this.run(interaction, { actor: player, target, tile, id: target.id, heard });
      }
    }
  }

  // ================================================================================================================================================================================================================================================
  // tickCreature
  // O gatilho tempo: uma vez por segundo por criatura viva.

  tickCreature(creature, now) {
    if (now - (creature.lastTimeTrigger || 0) < TEMPO_MS) return;
    creature.lastTimeTrigger = now;
    this.trigger(creature, 'tempo');
  }

  // ================================================================================================================================================================================================================================================
  // tickObjects
  // O gatilho tempo nos objetos do mapa: uma vez por segundo.

  tickObjects(now) {
    if (now - (this.lastObjectTick || 0) < TEMPO_MS) return;
    this.lastObjectTick = now;
    for (const obj of [...this.sim.objects]) {
      const type = this.typeOf(obj);
      if (!type) continue;
      const tile = { x: obj.x, y: obj.y, z: obj.z || 0 };
      for (const interaction of interacoesDe(type, 'tempo')) {
        if (interaction.propria) this.run(interaction, { actor: null, target: obj, tile, id: obj.id });
      }
    }
  }

  // ================================================================================================================================================================================================================================================
  // typeOf
  // O tipo da folha de um objeto do mapa ou criatura.

  typeOf(target) {
    return target.creature || objectIdType(target.id);
  }
}
