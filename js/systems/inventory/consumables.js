// js/systems/inventory/consumables.js

import { GameObject } from '../../models/game-object.js';
import { objectUse } from '../../../shared/assets.js';
import { CONFIG } from '../../config.js';
import { CONDITIONS } from '../../../shared/conditions.js';
import { RUNES } from '../../../shared/spells.js';
import {
  EQUIP_SLOTS, USE_COOLDOWN_MS, FOOD_MAX_SECONDS, POTION_RANGE, EMPTY_VIAL, SPLASH_HP, SPLASH_MANA, SPLASH_STAGES, SPLASH_STAGE_MS, REGEN_MS, REGEN_HP, REGEN_MANA, itemInfo, newItem
} from '../../../shared/items.js';

const STARVE_TICK_MS = CONDITIONS.poison.interval;

// Métodos do InventoryController (js/systems/inventory.js) sobre o que se usa
// e se gasta: comida e regeneração, poções e respingos, fonte de luz que
// queima e anel que regenera.

export const consumableMethods = {

  // ================================================================================================================================================================================================================================================
  // burnLights
  // Item com Duração gasta como no Tibia enquanto está em uso: item.fuel (ms
  // que ainda resta) começa em burn (gerador → Duração) e só desce com a
  // fonte de luz acesa (equipada, num container ou no chão) ou com o anel de
  // cura no espaço dele. Acabou, o item some.

  burnLights(ms) {
    const burn = (item, worn = false) => {
      if (!item) return false;
      if (item.items) item.items.forEach((child, i) => { if (burn(child)) item.items[i] = null; });
      const info = itemInfo(item.type);
      const total = item.lit || (worn && (info.regen.hp || info.regen.mana)) ? info.burn * 1000 : 0;
      if (!total) return false;
      item.fuel = Math.max(0, (item.fuel ?? total) - ms);
      return item.fuel === 0;
    };
    for (const player of this.sim.players) {
      for (const key of EQUIP_SLOTS) {
        const item = player.equip[key];
        if (burn(item, !!item && itemInfo(item.type).slot === key)) player.equip[key] = null;
      }
    }
    for (const obj of [...this.sim.objects]) {
      if (obj.itemData && burn(obj.itemData)) this.removeGroundObject(obj);
    }
    for (const corpse of this.sim.deadBodies) burn(corpse.itemData);
  },

  // ================================================================================================================================================================================================================================================
  // use
  // Comando useItem: usa um item do inventário, de uma caixa aberta ou do
  // chão (longe, o player anda até o lado e usa ao chegar). Comida soma tempo
  // de regeneração (até FOOD_MAX_SECONDS; passou disso, "Você está cheio.").
  // Fonte de luz (tocha) acende ou apaga.
  // Potion vai no sqm target (a mira; sem target, no próprio player): em
  // player, cura; no chão, o líquido vaza. Nos dois casos a potion vira um
  // vial vazio. Runa também vai com a mira (spells.js → useRune).

  use(player, from, target = null) {
    if (!from || !['e', 'c', 'g'].includes(from.t)) return;
    const src = this.source(player, from);
    if (src.error) return;
    const info = itemInfo(src.item.type);
    const use = objectUse(src.item.type);
    const rune = RUNES[src.item.type];
    if (!info.food && !info.heal && !use && !info.light && !rune) return;
    if (src.obj && !this.isNear(player, src.obj)) {
      this.walkNextTo(player, src.obj, { type: 'useItem', from, target });
      return;
    }
    if (info.light && !use && !info.food && !info.heal) {
      src.item.lit = !src.item.lit;
      if (src.obj) src.obj.active = src.item.lit;
      return;
    }
    if (rune) {
      this.sim.spells.useRune(player, src, rune, target || { x: player.x, y: player.y, z: player.z || 0 });
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
  },

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
      this.sim.emit({ type: 'heal', playerId: patient.id, x: patient.x, y: patient.y, z: patient.z || 0, hp, mana });
    } else {
      this.spill(target.x, target.y, z, heal.hp[1] > 0 ? SPLASH_HP : SPLASH_MANA);
    }
    this.emptyPotion(player, src);
  },

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
  },

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
  },

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
  },

  // ================================================================================================================================================================================================================================================
  // digest
  // Com comida no estômago, o player recupera REGEN_HP de vida e REGEN_MANA
  // de mana a cada REGEN_MS (como no Tibia sem vocação); a comida vai
  // acabando com o tempo.

  digest(player, now) {
    const last = player.digestAt ?? now;
    player.digestAt = now;
    this.wornRegen(player, now - last);
    if (!player.food || !player.isAlive()) {
      player.regenElapsed = 0;
      this.starve(player, now, now - last);
      return;
    }
    player.starveElapsed = 0;
    const elapsed = Math.min(now - last, player.food);
    player.food = Math.max(0, player.food - elapsed);
    if (!player.food) this.message(player, 'Você está com fome.');
    player.regenElapsed = (player.regenElapsed || 0) + elapsed;
    while (player.regenElapsed >= REGEN_MS) {
      player.regenElapsed -= REGEN_MS;
      player.currentHp = Math.min(player.hp, player.currentHp + REGEN_HP);
      player.mana = Math.min(player.maxMana, player.mana + REGEN_MANA);
    }
  },

  // ================================================================================================================================================================================================================================================
  // starve
  // Sem comida, o player perde CONFIG.starveHpPercent % da vida máxima (pelo
  // menos 1) no mesmo intervalo do veneno, até comer algo.

  starve(player, now, elapsed) {
    if (!player.isAlive() || !CONFIG.starveHpPercent) {
      player.starveElapsed = 0;
      return;
    }
    player.starveElapsed = (player.starveElapsed || 0) + elapsed;
    while (player.starveElapsed >= STARVE_TICK_MS) {
      player.starveElapsed -= STARVE_TICK_MS;
      const amount = Math.max(1, Math.round(player.hp * CONFIG.starveHpPercent / 100));
      player.takeDamage(amount, now);
      this.sim.emit({ type: 'damage', targetId: player.id, x: player.x, y: player.y, z: player.z || 0, amount });
    }
  },

  // ================================================================================================================================================================================================================================================
  // wornRegen
  // Item equipado no espaço dele que regenera (anel de cura): a cada REGEN_MS
  // recupera a vida e a mana dele, com ou sem comida.

  wornRegen(player, elapsed) {
    let hp = 0;
    let mana = 0;
    for (const key of EQUIP_SLOTS) {
      const item = player.equip[key];
      if (!item || itemInfo(item.type).slot !== key) continue;
      hp += itemInfo(item.type).regen.hp;
      mana += itemInfo(item.type).regen.mana;
    }
    if ((!hp && !mana) || !player.isAlive()) {
      player.wornRegenElapsed = 0;
      return;
    }
    player.wornRegenElapsed = (player.wornRegenElapsed || 0) + elapsed;
    while (player.wornRegenElapsed >= REGEN_MS) {
      player.wornRegenElapsed -= REGEN_MS;
      player.currentHp = Math.min(player.hp, player.currentHp + hp);
      player.mana = Math.min(player.maxMana, player.mana + mana);
    }
  },
};
