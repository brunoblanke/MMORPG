// js/models/entity.js

import { calculateStats, calculateMoveDelay, roundUpToTick, rand } from '../utils/helpers.js';
import { CONFIG } from '../config.js';

export class Entity {
  constructor(data) {
    const stats = calculateStats(data.lvl || 1);
    
    this.id = data.id || "entity" + rand(1000, 9999);
    this.type = data.type || "entity";
    this.x = data.x || 0;
    this.y = data.y || 0;
    this.z = data.z || 0;
    this.step = data.step || 0;
    this.color = data.color || "#888888";
    this.height = data.height || 1;
    
    this.renderX = this.x;
    this.renderY = this.y;
    this.renderZ = this.z;
    this.renderStep = this.step;
    this.direction = data.direction || 'sul';
    
    this.lvl = data.lvl || 1;
    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.currentHp = stats.hp;
    this.xp = stats.xp;
    this.spd = stats.spd;
    this.atk = stats.atk;
    this.def = stats.def;
    
    this.route = { path: null, x: null, y: null };

    this.lastMoveTime = 0;
    this.lastAttackTime = 0;
    
    this.isTarget = false;
    this.hitFlash = false;
    this.flashUntil = 0;
    
    this.isMoving = false;
    this.moveStartX = 0;
    this.moveStartY = 0;
    this.moveStartZ = 0;
    this.moveStartStep = 0;
    this.moveStartTime = 0;
    this.stepDuration = 0;
    this.renderTime = null;

    this.order = data.order !== undefined ? data.order : 0;
  }

  takeDamage(amount, now) {
    this.currentHp = Math.max(0, this.currentHp - amount);
    this.flashUntil = now + 150;
    return this.currentHp;
  }

  isAlive() {
    return this.currentHp > 0;
  }

  getMoveDuration() {
    const base = CONFIG.baseMoveDuration || 300;
    const minDuration = CONFIG.minMoveDuration || 80;
    const speedFactor = Math.max(0.3, 1 - (this.spd / 500));
    return Math.max(minDuration, base * speedFactor) / CONFIG.speedScale;
  }

  // ================================================================================================================================================================================================================================================
  // getStepInterval
  // Tempo real entre um passo e o seguinte andando sem parar: o intervalo do
  // spd arredondado pro tick (o passo só acontece num tick).

  getStepInterval() {
    return roundUpToTick(calculateMoveDelay(this.spd));
  }

  // ================================================================================================================================================================================================================================================
  // getFrameDuration

  getFrameDuration() {
    const base = CONFIG.playerFrameDuration || 150;
    const speedFactor = Math.max(0.3, 1 - (this.spd / 500));
    return Math.max(50, base * speedFactor) / CONFIG.speedScale;
  }

  // ================================================================================================================================================================================================================================================
  // updateAnimation
  // Desliza em velocidade constante do ponto de partida até o sqm, em
  // stepDuration (o intervalo até o próximo passo): andando sem parar, um
  // passo emenda no outro sem frear. renderTime: quando a posição desenhada
  // foi calculada (um passo novo continua dali).

  updateAnimation(timestamp) {
    this.renderTime = timestamp;
    if (this.isMoving) {
      const elapsed = timestamp - this.moveStartTime;
      const duration = this.stepDuration || this.getStepInterval();
      const progress = Math.min(Math.max(elapsed / duration, 0), 1);

      this.renderX = this.moveStartX + (this.x - this.moveStartX) * progress;
      this.renderY = this.moveStartY + (this.y - this.moveStartY) * progress;
      this.renderZ = this.moveStartZ + (this.z - this.moveStartZ) * progress;
      this.renderStep = this.moveStartStep + ((this.step || 0) - this.moveStartStep) * progress;

      if (progress >= 1) {
        this.renderX = this.x;
        this.renderY = this.y;
        this.renderZ = this.z;
        this.renderStep = this.step || 0;
        this.isMoving = false;
      }
    } else {
      this.renderX = this.x;
      this.renderY = this.y;
      this.renderZ = this.z;
      this.renderStep = this.step || 0;
    }

    this.hitFlash = timestamp < this.flashUntil;
  }
}