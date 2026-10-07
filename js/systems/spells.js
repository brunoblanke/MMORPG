// js/systems/spells.js

import { getLevel } from '../core/geometry.js';
import { isPositionAdjacentTo } from '../utils/helpers.js';
import { getAsset, splitType, displayName } from '../../shared/assets.js';
import { giveItem } from './trade.js';
import { EQUIP_SLOTS, newItem, equipBonus } from '../../shared/items.js';
import { addSkillTry } from '../../shared/skills.js';
import { EFFECTS } from '../../shared/effects.js';
import { RUNES, AREAS, BLANK_RUNE, SPELL_COOLDOWN_MS, SPELL_RANGE, RUNE_RANGE, LIGHT_SPELL, findSpell, spellRange } from '../../shared/spells.js';

// Magias e runas (shared/spells.js). A magia é dita no chat: se as palavras
// são de uma magia, ela sai (ou o motivo de não sair) e ninguém mais ouve.
// Precisa da vocação, do nível e da mana; depois espera SPELL_COOLDOWN_MS.
// A mana gasta treina o magic level. As palavras aparecem em laranja em
// cima do player, como no Tibia. A runa é usada com a mira no sqm, gastando
// uma carga: cura o player, fere a criatura (ou as da área) ou cria campos.

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
      this.showEffect(player.x, player.y, 'heal', undefined, player.z || 0);
      return null;
    }
    if (spell.kind === 'cure') {
      if (player.conditions) delete player.conditions.poison;
      this.showEffect(player.x, player.y, 'heal', undefined, player.z || 0);
      return null;
    }
    if (spell.kind === 'haste') {
      const [factor, base] = spell.speed;
      this.sim.conditions.add(player, 'haste', { speed: Math.max(1, Math.floor(player.baseSpd * factor + base)), ms: spell.ms });
      return null;
    }
    if (spell.kind === 'conjure') return this.conjure(player, spell);
    if (spell.kind === 'ammo') return this.conjureAmmo(player, spell);
    if (this.sim.world.isInSafeZone(player)) return 'Você não pode atacar na zona segura.';
    if (spell.kind === 'strike') {
      const target = player.target;
      if (!target || !target.isAlive() || getLevel(target) !== getLevel(player)) return 'Você precisa de um alvo.';
      if (Math.max(Math.abs(target.x - player.x), Math.abs(target.y - player.y)) > SPELL_RANGE) return 'Longe demais.';
      if (!this.sim.movement.hasLineOfSight(player, target)) return 'Tem algo no caminho.';
      this.sim.emit({ type: 'missile', fromX: player.x, fromY: player.y, toX: target.x, toY: target.y, z: player.z || 0, kind: spell.element });
      this.hurt(player, target, this.roll(spell.formula, player), now, spell.element);
      this.showEffect(target.x, target.y, spell.element, undefined, target.z || 0);
      return null;
    }
    if (spell.kind === 'blast') return this.blast(player, spell, now);
    const level = getLevel(player);
    for (const enemy of this.sim.enemies) {
      if (enemy.isAlive() && getLevel(enemy) === level && isPositionAdjacentTo(player.x, player.y, enemy.x, enemy.y)) {
        this.hurt(player, enemy, this.roll(spell.formula, player), now);
      }
    }
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // blast
  // Magia de área em volta do player (exevo gran mas flam): a animação em
  // cada sqm com chão da área e o dano em cada criatura nela.

  blast(player, spell, now) {
    const z = player.z || 0;
    const world = this.sim.world;
    const tiles = AREAS[spell.area].map(([dx, dy]) => [player.x + dx, player.y + dy])
      .filter(([x, y]) => (x !== player.x || y !== player.y) && world.hasFloorAt(x, y, z) && !world.hasBlockerAt(x, y, z));
    const inArea = new Set(tiles.map(([x, y]) => `${x},${y}`));
    this.showEffect(player.x, player.y, spell.effect, tiles, z);
    for (const enemy of this.sim.enemies) {
      if (enemy.isAlive() && (enemy.z || 0) === z && inArea.has(`${enemy.x},${enemy.y}`)) this.hurt(player, enemy, this.roll(spell.formula, player), now, spell.element);
    }
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // showEffect
  // A animação do Tibia (shared/effects.js) no sqm, ou em cada sqm de tiles.

  showEffect(x, y, name, tiles = [[x, y]], z = 0) {
    if (EFFECTS[name]) this.sim.emit({ type: 'effect', x, y, z, tiles, effect: name });
  }

  // ================================================================================================================================================================================================================================================
  // heal

  heal(patient, amount) {
    const hp = Math.min(amount, patient.hp - patient.currentHp);
    patient.currentHp += hp;
    this.sim.emit({ type: 'heal', playerId: patient.id, x: patient.x, y: patient.y, z: patient.z || 0, hp, mana: 0 });
  }

  // ================================================================================================================================================================================================================================================
  // hurt
  // Dano de magia na criatura (sem defesa nem armadura); conta pra XP.

  hurt(player, enemy, amount, now, element = null) {
    if (amount <= 0) return;
    this.sim.combat.markCombat(player, enemy, now);
    if (enemy.isPlayer) this.sim.social.onPlayerAttack(player, enemy, now);
    else this.sim.combat.recordDamage(enemy, player, Math.min(amount, enemy.currentHp));
    enemy.takeDamage(amount, now);
    this.sim.emit({ type: 'damage', targetId: enemy.id, x: enemy.x, y: enemy.y, z: enemy.z || 0, amount, element });
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
  // conjureAmmo
  // Troca uma unidade da reagent (a flecha carregada, onde estiver) por count
  // da munição, que vai pra mochila (sem espaço, pro chão).

  conjureAmmo(player, spell) {
    if (!getAsset(splitType(spell.ammo).asset)) return 'Essa munição ainda não existe no gerador.';
    const found = this.findCarried(player, spell.reagent);
    if (!found) return `Você precisa de ${displayName(spell.reagent)}.`;
    const stack = found.list[found.key];
    if ((stack.count || 1) > 1) stack.count--;
    else found.list[found.key] = null;
    giveItem(this.sim, player, spell.ammo, spell.count);
    this.sim.inventory.compactAll(player);
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
  // visão). Gasta uma carga; sem cargas, a runa some. Se não dá pra usar
  // ali, avisa e não gasta.

  useRune(player, src, rune, target) {
    const z = player.z || 0;
    if (!target || !Number.isInteger(target.x) || !Number.isInteger(target.y) || (target.z ?? z) !== z) return;
    if (this.magicLevel(player) < rune.ml) return this.message(player, `Você precisa de magic level ${rune.ml} pra usar essa runa.`);
    if (Math.max(Math.abs(target.x - player.x), Math.abs(target.y - player.y)) > RUNE_RANGE) return this.message(player, 'Longe demais.');
    if (!this.sim.movement.hasLineOfSight(player, target)) return this.message(player, 'Tem algo no caminho.');
    const hostile = !['heal', 'cure'].includes(rune.kind);
    if (hostile && this.sim.world.isInSafeZone(player)) return this.message(player, 'Você não pode atacar na zona segura.');
    const now = this.sim.time || 0;
    if (now < (player.useReadyAt || 0)) return this.message(player, 'Você está exausto.');
    const problem = this.runeEffect(player, rune, { x: target.x, y: target.y, z }, now);
    if (problem) return this.message(player, problem);
    player.useReadyAt = now + SPELL_COOLDOWN_MS;
    src.item.charges = (src.item.charges ?? rune.charges) - 1;
    if (src.item.charges <= 0) src.remove();
  }

  // ================================================================================================================================================================================================================================================
  // runeEffect
  // O que a runa faz no sqm; devolve o motivo se não deu (sem gastar carga).

  runeEffect(player, rune, target, now) {
    const at = (x, y) => (e) => e.x === x && e.y === y && (e.z || 0) === target.z && e.isAlive();
    if (rune.kind === 'heal' || rune.kind === 'cure') {
      const who = this.sim.players.find(at(target.x, target.y));
      if (!who) return 'Só dá pra usar em players.';
      if (rune.kind === 'heal') this.heal(who, this.roll(rune.formula, player));
      else if (who.conditions) delete who.conditions.poison;
      this.showEffect(who.x, who.y, rune.effect || 'heal', undefined, who.z || 0);
      return null;
    }
    const tiles = AREAS[rune.area || 'single'].map(([dx, dy]) => [target.x + dx, target.y + dy]);
    if (rune.kind === 'attack') {
      const who = this.sim.enemies.find(at(target.x, target.y));
      if (!who) return 'Só dá pra usar em criaturas.';
      this.sim.emit({ type: 'missile', fromX: player.x, fromY: player.y, toX: who.x, toY: who.y, z: player.z || 0, kind: rune.missile || rune.element });
      this.showEffect(who.x, who.y, rune.effect, undefined, who.z || 0);
      this.hurt(player, who, this.roll(rune.formula, player), now, rune.element);
      return null;
    }
    if (rune.kind === 'area') {
      this.sim.emit({ type: 'missile', fromX: player.x, fromY: player.y, toX: target.x, toY: target.y, z: player.z || 0, kind: rune.missile || rune.element });
      this.showEffect(target.x, target.y, rune.effect, tiles, target.z);
      for (const [x, y] of tiles) {
        for (const enemy of this.sim.enemies.filter(at(x, y))) this.hurt(player, enemy, this.roll(rune.formula, player), now, rune.element);
      }
      return null;
    }
    const placed = tiles.filter(([x, y]) => this.sim.conditions.placeField(rune.field, x, y, target.z, player));
    return placed.length ? null : 'Não dá pra usar aí.';
  }
}
