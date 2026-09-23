// js/models/enemy.js

import { Entity } from './entity.js';
import { distance } from '../utils/helpers.js';
import { CONFIG } from '../config.js';
import { CREATURE_TYPES, DEFAULT_CREATURE } from '../../shared/catalog.js';

export class Enemy extends Entity {
  constructor(data) {
    super(data);
    this.patrolRadius = data.patrolRadius || CONFIG.patrolRadius || 3;
    this.detectionRadius = data.detectionRadius || CONFIG.detectionRadius || 6;
    this.xpValue = data.xpValue || 20;
    this.isChasing = false;
    this.patrolCenterX = data.x;
    this.patrolCenterY = data.y;
    this.spawnZ = data.z || 0;
    // Tipo da criatura (nome em CREATURE_TYPES): define nome, sprite e cadáver.
    this.creature = CREATURE_TYPES[data.creature] ? data.creature : DEFAULT_CREATURE;
  }

  isInPatrolZone(x, y) {
    return distance(x, y, this.patrolCenterX, this.patrolCenterY) <= this.patrolRadius;
  }

  isInDetectionRange(px, py) {
    return distance(this.x, this.y, px, py) <= this.detectionRadius;
  }

  updatePatrolCenter() {
    this.patrolCenterX = this.x;
    this.patrolCenterY = this.y;
  }

  getXpValue() {
    return this.xpValue;
  }

  getFrameDuration() {
    const base = CONFIG.playerFrameDuration || 150;
    const speedFactor = Math.max(0.3, 1 - (this.spd / 500));
    return Math.max(50, base * speedFactor) / CONFIG.speedScale;
  }
}