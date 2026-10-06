// js/systems/conditions.js

import { GameObject } from '../models/game-object.js';
import { objectIdType, objectProps } from '../../shared/assets.js';
import { CONDITIONS, FIELDS } from '../../shared/conditions.js';

// Estados de player e criatura (shared/conditions.js): veneno, fogo e
// energia tiram vida de tempos em tempos; lento e rápido mudam a velocidade
// do player por um tempo (lento tira o rápido e vice-versa). O mais forte
// fica: um estado mais fraco do mesmo tipo não substitui o atual. Dano de
// estado que um player causou numa criatura conta pra XP dele. Pisar num
// campo do chão dá o dano dele e o estado.

export class ConditionController {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
  }

  // ================================================================================================================================================================================================================================================
  // add
  // Põe o estado kind: de dano ({ damage, ticks, source }) ou de velocidade
  // ({ speed, ms }).

  add(entity, kind, { damage = 0, ticks = 0, source = null, speed = 0, ms = 0 } = {}) {
    const info = CONDITIONS[kind];
    if (!info || !entity.isAlive()) return;
    const now = this.sim.time || 0;
    const conditions = entity.conditions || (entity.conditions = {});
    if (info.interval) {
      if (damage <= 0 || ticks <= 0) return;
      const current = conditions[kind];
      if (current && current.damage * current.ticks > damage * ticks) return;
      conditions[kind] = { damage, ticks, next: now + info.interval, source: source ? source.id : null };
      return;
    }
    delete conditions[kind === 'slow' ? 'haste' : 'slow'];
    conditions[kind] = { speed, until: now + ms };
    this.applySpeed(entity);
  }

  // ================================================================================================================================================================================================================================================
  // applySpeed
  // O que os estados somam na velocidade do player (player.speedMod).

  applySpeed(entity) {
    const conditions = entity.conditions || {};
    entity.speedMod = ['slow', 'haste'].reduce((sum, kind) => sum + (conditions[kind] ? conditions[kind].speed : 0), 0);
  }

  // ================================================================================================================================================================================================================================================
  // kinds
  // Os estados que a entidade tem agora (pra janela de vida).

  kinds(entity) {
    return Object.keys(entity.conditions || {});
  }

  // ================================================================================================================================================================================================================================================
  // update
  // A cada tick: os campos pisados e os estados de todo mundo vivo.

  update(now) {
    for (const entity of [...this.sim.players, ...this.sim.enemies]) {
      if (!entity.isAlive()) {
        if (entity.conditions) entity.conditions = {};
        continue;
      }
      this.stepOnField(entity);
      this.tick(entity, now);
    }
  }

  // ================================================================================================================================================================================================================================================
  // tick

  tick(entity, now) {
    const conditions = entity.conditions;
    if (!conditions) return;
    let speedChanged = false;
    for (const kind of Object.keys(conditions)) {
      const state = conditions[kind];
      const info = CONDITIONS[kind];
      if (!info.interval) {
        if (now >= state.until) {
          delete conditions[kind];
          speedChanged = true;
        }
        continue;
      }
      if (now < state.next) continue;
      state.next += info.interval;
      state.ticks--;
      if (state.ticks <= 0) delete conditions[kind];
      this.hurt(entity, state.damage, kind, state.source);
    }
    if (speedChanged) this.applySpeed(entity);
  }

  // ================================================================================================================================================================================================================================================
  // hurt
  // Dano de estado ou de campo (sem defesa nem armadura), com a cor do tipo.

  hurt(entity, amount, kind, sourceId = null) {
    if (amount <= 0 || !entity.isAlive()) return;
    const source = sourceId ? this.sim.getPlayer(sourceId) : null;
    if (source && !entity.isPlayer) this.sim.combat.recordDamage(entity, source, Math.min(amount, entity.currentHp));
    entity.takeDamage(amount, this.sim.time || 0);
    this.sim.emit({ type: 'damage', targetId: entity.id, x: entity.x, y: entity.y, z: entity.z || 0, amount, element: kind });
  }

  // ================================================================================================================================================================================================================================================
  // fieldAt
  // O campo do sqm (o objeto e o que ele faz), ou null.

  fieldAt(x, y, z) {
    for (const obj of this.sim.world.getObjectsAt(x, y)) {
      if ((obj.z || 0) !== z) continue;
      const field = FIELDS[objectIdType(obj.id)];
      if (field) return { obj, field };
    }
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // stepOnField
  // Entrou num sqm com campo: o dano na hora e o estado. Parado no mesmo
  // campo, nada mais (o estado já está correndo).

  stepOnField(entity) {
    const z = entity.z || 0;
    const found = this.fieldAt(entity.x, entity.y, z);
    const key = found ? `${found.obj.id}@${entity.x},${entity.y},${z}` : null;
    if (key === entity.fieldKey) return;
    entity.fieldKey = key;
    if (!found || !found.field.kind) return;
    const { field, obj } = found;
    this.hurt(entity, field.hit, field.kind, obj.ownerId || null);
    this.add(entity, field.kind, { damage: field.damage, ticks: field.ticks, source: obj.ownerId ? { id: obj.ownerId } : null });
  }

  // ================================================================================================================================================================================================================================================
  // placeField
  // Cria o campo type no sqm (runa ou criatura); some sozinho no tempo dele.
  // owner: o player que criou (o dano conta pra XP dele). Os inimigos do
  // andar refazem o caminho (pra contornar o campo novo).

  placeField(type, x, y, z, owner = null) {
    const field = FIELDS[type];
    const world = this.sim.world;
    if (!field || world.hasBlockerAt(x, y, z) || world.isFloorBlocked(x, y, z) || world.getPassableStep(x, y, z) === null) return null;
    if (field.blocks && (world.getCreatureAt(x, y, z) || world.getTransitionAt(x, y, z))) return null;
    const inventory = this.sim.inventory;
    const old = this.fieldAt(x, y, z);
    if (old && old.obj.temporary) inventory.removeGroundObject(old.obj);
    else if (old) return null;
    const props = objectProps(type);
    inventory.objectCounter++;
    const obj = new GameObject({ id: `${type}_${inventory.objectCounter}`, x, y, z, step: this.sim.movement.getStepHeight(x, y, z), movable: false, hasVolume: props.hasVolume, blocksMovement: !!field.blocks, temporary: true, ownerId: owner ? owner.id : null });
    this.sim.objects.push(obj);
    this.sim.objectsById.set(obj.id, obj);
    this.sim.world.addObject(obj);
    for (const enemy of this.sim.enemies) {
      if ((enemy.z || 0) === z && enemy.route) enemy.route.path = null;
    }
    this.sim.schedule((this.sim.time || 0) + field.ms, () => {
      if (this.sim.objectsById.get(obj.id) === obj) inventory.removeGroundObject(obj);
    });
    return obj;
  }
}
