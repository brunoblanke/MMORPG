// js/models/npc.js

import { Entity } from './entity.js';
import { distance } from '../utils/helpers.js';
import { PLAYER_GENDERS, DEFAULT_GENDER, PLAYER_SPRITES } from '../../shared/catalog.js';

// Personagem do jogo que conversa (systems/npcs.js): usa a folha creature do
// gerador (sem ela, a roupa de player do gender), não ataca, não é atacado e
// não morre.

export class Npc extends Entity {
  constructor(data) {
    super({ ...data, type: 'npc' });
    this.isNpc = true;
    this.groundOnly = true;
    this.name = data.name || 'NPC';
    this.gender = PLAYER_GENDERS.includes(data.gender) ? data.gender : DEFAULT_GENDER;
    this.creature = data.creature || PLAYER_SPRITES[this.gender];
    this.defId = data.defId || null;
  }

  // ================================================================================================================================================================================================================================================
  // isInWanderArea
  // O sqm (x, y) está na área onde ele passeia: o círculo de raio radius em
  // volta de homeX, homeY (como a patrulha dos inimigos).

  isInWanderArea(x, y) {
    return this.homeX !== undefined && distance(x, y, this.homeX, this.homeY) <= (this.radius || 0);
  }

  // ================================================================================================================================================================================================================================================
  // isAlive

  isAlive() {
    return true;
  }
}
