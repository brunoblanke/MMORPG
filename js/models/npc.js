// js/models/npc.js

import { Entity } from './entity.js';
import { PLAYER_GENDERS, DEFAULT_GENDER } from '../../shared/catalog.js';

// Personagem do jogo que conversa (systems/npcs.js): usa a roupa de player
// (gender), não ataca, não é atacado e não morre.

export class Npc extends Entity {
  constructor(data) {
    super({ ...data, type: 'npc' });
    this.isNpc = true;
    this.name = data.name || 'NPC';
    this.gender = PLAYER_GENDERS.includes(data.gender) ? data.gender : DEFAULT_GENDER;
    this.defId = data.defId || null;
  }

  // ================================================================================================================================================================================================================================================
  // isAlive

  isAlive() {
    return true;
  }
}
