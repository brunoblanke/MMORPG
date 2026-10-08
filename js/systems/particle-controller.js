// js/systems/particle-controller.js

import { ParticleSystem } from '../services/particle-system.js';

export class ParticleController {
  constructor() {
    this.particleSystem = new ParticleSystem();
  }

  // ================================================================================================================================================================================================================================================
  // spawnDamage

  spawnDamage(x, y, damage, renderer, color = null) {
    this.particleSystem.spawnDamageNumber(x, y, damage, false, renderer, color);
  }

  // ================================================================================================================================================================================================================================================
  // spawnXP

  spawnXP(x, y, xp, renderer) {
    this.particleSystem.spawnDamageNumber(x, y, xp, true, renderer);
  }

  // ================================================================================================================================================================================================================================================
  // spawnHeal
  // Vida (verde) e mana (azul) recuperadas; a mana sai um pouco acima.

  spawnHeal(event, renderer) {
    if (event.hp > 0) this.particleSystem.spawnText(event.x, event.y, `+${event.hp}`, '#4ade80', renderer, 0);
    if (event.mana > 0) this.particleSystem.spawnText(event.x, event.y, `+${event.mana}`, '#60a5fa', renderer, event.hp > 0 ? -14 : 0);
  }

  // ================================================================================================================================================================================================================================================
  // spawnMissile

  spawnMissile(event, renderer) {
    this.particleSystem.spawnMissile(event.fromX, event.fromY, event.toX, event.toY, renderer, event.kind, event.z ?? null);
  }

  // ================================================================================================================================================================================================================================================
  // spawnEffect

  spawnEffect(event, renderer) {
    this.particleSystem.spawnEffect(event.tiles || [[event.x, event.y]], event.effect, renderer, event.z ?? null);
  }

  // ================================================================================================================================================================================================================================================
  // renderEffects
  // Os efeitos e projéteis do andar level, desenhados junto dele.

  renderEffects(ctx, level) {
    this.particleSystem.renderEffects(ctx, level);
  }

  // ================================================================================================================================================================================================================================================
  // update

  update(timestamp) {
    this.particleSystem.update(timestamp);
  }

  // ================================================================================================================================================================================================================================================
  // render

  render(ctx) {
    this.particleSystem.render(ctx);
  }

  // ================================================================================================================================================================================================================================================
  // clear

  clear() {
    this.particleSystem.clear();
  }
}