// js/models/enemy.js

import { Entity } from './entity.js';
import { distance } from '../utils/helpers.js';
import { CONFIG } from '../config.js';

export const AI_STATE = { PATROL: 'patrol', CHASE: 'chase' };

export class Enemy extends Entity {
  constructor(data) {
    super(data);
    this.patrolRadius = data.patrolRadius || CONFIG.patrolRadius || 3;
    this.detectionRadius = data.detectionRadius || CONFIG.detectionRadius || 6;
    this.avoidsSafeZones = true;   // não entra em zona segura (regra de passo e busca de caminho)
    this.ai = {
      state: AI_STATE.PATROL,
      slot: null,
      resumeAt: null,
      retryAt: 0,
      rerouteAt: 0,
      sidestepAt: null
    };
    this.spawnX = data.spawnX ?? data.x;
    this.spawnY = data.spawnY ?? data.y;
    this.spawnZ = data.spawnZ ?? (data.z || 0);
    this.patrolCenterX = this.spawnX;
    this.patrolCenterY = this.spawnY;
    // Tipo da criatura (a folha do gerador, ex.: 'criaturas/mamiferos/rat'):
    // define nome, sprite e cadáver.
    this.creature = data.creature || '';
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
}