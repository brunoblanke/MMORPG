// js/systems/spells.js

import { getLevel } from '../core/geometry.js';
import { isPositionAdjacentTo } from '../utils/helpers.js';
import { getAsset, splitType } from '../../shared/assets.js';
import { EQUIP_SLOTS, newItem, equipBonus } from '../../shared/items.js';
import { addSkillTry } from '../../shared/skills.js';
import { RUNES, BLANK_RUNE, SPELL_COOLDOWN_MS, SPELL_RANGE, RUNE_RANGE, LIGHT_SPELL, findSpell, spellRange } from '../../shared/spells.js';

// Magias e runas (shared/spells.js). A magia é dita no chat: se as palavras
// são de uma magia, ela sai (ou o motivo de não sair) e ninguém mais ouve.
// Precisa da vocação, do nível e da mana; depois espera SPELL_COOLDOWN_MS.
// A mana gasta treina o magic level. As palavras aparecem em laranja em
// cima do player, como no Tibia. A runa é usada com a mira: cura o player
// ou fere a criatura no sqm, gastando uma carga.

export class SpellController {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
  }

  // ================================================================================================================================================================================================================================================
  // message

  message(player, text, kind = 'warn') {
    this.sim.emit({ type: 'message', playerId: player.id, text, kind });
  }

  // ================================================================================================================================================================================================================================================
  // magicLevel
  // Magic level com o bônus dos itens equipados.

  magicLevel(player) {
    return ((player.skills && player.skills.magic && player.skills.magic.lvl) || 0) + equipBonus(player.equip).ml;
  }

  // ================================================================================================================================================================================================================================================
  // roll

  roll(formula, player) {
    const [min, max] = spellRange(formula, player.lvl, this.magicLevel(player));
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  // ================================================================================================================================================================================================================================================
  // cast
  // O player disse text: se é uma magia, tenta lançar e devolve true.

  cast(player, text) {
    const spell = findSpell(text);
    if (!spell) return false;
    if (!player.isAlive()) return true;
    const now = this.sim.time || 0;
    let problem = null;
    if (!spell.vocations.includes(player.vocation)) problem = 'Sua vocação não pode usar essa magia.';
    else if (player.lvl < spell.lvl) problem = `Você precisa do nível ${spell.lvl} pra usar essa magia.`;
    else if (player.mana < spell.mana) problem = 'Você não tem mana suficiente.';
    else if (now < (player.spellReadyAt || 0)) problem = 'Você está exausto.';
    else problem = this.effect(player, spell, now);
    if (problem) {
      this.message(player, problem);
      return true;
    }
    player.spellReadyAt = now + SPELL_COOLDOWN_MS;
    player.mana -= spell.mana;
    this.sim.emit({ type: 'speech', speakerId: player.id, name: null, text: spell.words, x: player.x, y: player.y, z: player.z || 0, orange: true });
    if (addSkillTry(player.skills, 'magic', player.vocation, spell.mana)) {
      this.message(player, `Você avançou para magic level ${player.skills.magic.lvl}.`, 'info');
    }
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // effect
  // O que a magia faz; devolve o motivo se não deu pra lançar (sem gastar mana).

  effect(player, spell, now) {
    if (spell.kind === 'light') {
      player.spellLight = { light: LIGHT_SPELL.light, until: now + LIGHT_SPELL.ms };
      return null;
    }
    if (spell.kind === 'heal') {
      this.heal(player, this.roll(spell.formula, player));
      return null;
    }
    if (spell.kind === 'conjure') return this.conjure(player, spell);
    if (this.sim.world.isInSafeZone(player)) return 'Você não pode atacar na zona segura.';
    if (spell.kind === 'strike') {
      const target = player.target;
      if (!target || !target.isAlive() || getLevel(target) !== getLevel(player)) return 'Você precisa de um alvo.';
      if (Math.max(Math.abs(target.x - player.x), Math.abs(target.y - player.y)) > SPELL_RANGE) return 'Longe demais.';
      if (!this.sim.movement.hasLineOfSight(player, target)) return 'Tem algo no caminho.';
      this.sim.emit({ type: 'missile', fromX: player.x, fromY: player.y, toX: target.x, toY: target.y });
      this.hurt(player, target, this.roll(spell.formula, player), now);
      return null;
    }
    const level = getLevel(player);
    for (const enemy of this.sim.enemies) {
      if (enemy.isAlive() && getLevel(enemy) === level && isPositionAdjacentTo(player.x, player.y, enemy.x, enemy.y)) {
        this.hurt(player, enemy, this.roll(spell.formula, player), now);
      }
    }
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // heal

  heal(patient, amount) {
    const hp = Math.min(amount, patient.hp - patient.currentHp);
    patient.currentHp += hp;
    this.sim.emit({ type: 'heal', playerId: patient.id, x: patient.x, y: patient.y, hp, mana: 0 });
  }

  // ================================================================================================================================================================================================================================================
  // hurt
  // Dano de magia na criatura (sem defesa nem armadura); conta pra XP.

  hurt(player, enemy, amount, now) {
    if (amount <= 0) return;
    this.sim.combat.recordDamage(enemy, player, Math.min(amount, enemy.currentHp));
    enemy.takeDamage(amount, now);
    this.sim.emit({ type: 'damage', targetId: enemy.id, x: enemy.x, y: enemy.y, amount });
  }

  // ================================================================================================================================================================================================================================================
  // conjure
  // A primeira blank rune que o player carrega vira a runa, com as cargas dela.

  conjure(player, spell) {
    if (!getAsset(splitType(spell.rune).asset)) return 'Essa runa ainda não existe no gerador.';
    const found = this.findCarried(player, BLANK_RUNE);
    if (!found) return 'Você precisa de uma blank rune.';
    const rune = newItem(this.sim.inventory.nextUid(), spell.rune);
    rune.charges = RUNES[spell.rune].charges;
    found.list[found.key] = rune;
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // findCarried
  // Onde está o primeiro item do tipo com o player: { list, key } (list[key]).

  findCarried(player, type) {
    const visit = (list, key) => {
      const item = list[key];
      if (!item) return null;
      if (item.type === type) return { list, key };
      if (!item.items) return null;
      for (let i = 0; i < item.items.length; i++) {
        const found = visit(item.items, i);
        if (found) return found;
      }
      return null;
    };
    for (const key of EQUIP_SLOTS) {
      const found = visit(player.equip, key);
      if (found) return found;
    }
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // useRune
  // Runa usada com a mira no sqm target (até RUNE_RANGE, com linha de
  // visão): a de cura no player de lá, a de ataque na criatura. Gasta uma
  // carga; sem cargas, a runa some.

  useRune(player, src, rune, target) {
    const z = player.z || 0;
    if (!target || !Number.isInteger(target.x) || !Number.isInteger(target.y) || (target.z ?? z) !== z) return;
    if (this.magicLevel(player) < rune.ml) return this.message(player, `Você precisa de magic level ${rune.ml} pra usar essa runa.`);
    if (Math.max(Math.abs(target.x - player.x), Math.abs(target.y - player.y)) > RUNE_RANGE) return this.message(player, 'Longe demais.');
    if (!this.sim.movement.hasLineOfSight(player, target)) return this.message(player, 'Tem algo no caminho.');
    const at = (e) => e.x === target.x && e.y === target.y && (e.z || 0) === z && e.isAlive();
    const who = rune.kind === 'heal' ? this.sim.players.find(at) : this.sim.enemies.find(at);
    if (!who) return this.message(player, rune.kind === 'heal' ? 'Só dá pra usar em players.' : 'Só dá pra usar em criaturas.');
    if (rune.kind === 'attack' && this.sim.world.isInSafeZone(player)) return this.message(player, 'Você não pode atacar na zona segura.');
    const now = this.sim.time || 0;
    if (now < (player.useReadyAt || 0)) return this.message(player, 'Você está exausto.');
    player.useReadyAt = now + SPELL_COOLDOWN_MS;
    if (rune.kind === 'heal') this.heal(who, this.roll(rune.formula, player));
    else {
      this.sim.emit({ type: 'missile', fromX: player.x, fromY: player.y, toX: who.x, toY: who.y });
      this.hurt(player, who, this.roll(rune.formula, player), now);
    }
    src.item.charges = (src.item.charges ?? rune.charges) - 1;
    if (src.item.charges <= 0) src.remove();
  }
}
