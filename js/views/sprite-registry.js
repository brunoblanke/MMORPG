// js/views/sprite-registry.js

import { CONFIG } from '../config.js';
import { SpriteSheet } from '../../shared/sprite-sheet.js';
import { PLAYER_SPRITES, DEFAULT_GENDER } from '../../shared/catalog.js';
import { ANIMATION_CYCLE_MS } from '../../shared/constants.js';
import { getAsset, objectIdType, spriteFrame, listAssets } from '../../shared/assets.js';

// Sprites do jogo: as folhas do gerador (shared/assets.js), recortadas peça a
// peça conforme aparecem. O player usa a folha de criatura do gênero dele
// (PLAYER_SPRITES).

const CORPSE_ROW = 4;

// ================================================================================================================================================================================================================================================
// getSpritePaths
// Tudo que precisa estar carregado antes do jogo começar (chamar depois de loadAssets).

export function getSpritePaths() {
  return ['pisos', 'paredes', 'objetos', 'criaturas'].flatMap(tool => listAssets(tool).map(asset => asset.url));
}

// ================================================================================================================================================================================================================================================
// isSheetReady
// A imagem da folha carregou (imagem quebrada não pode ir pro canvas).

export function isSheetReady(sheet) {
  return !!sheet && sheet.image.complete && sheet.image.naturalWidth > 0;
}

export class SpriteRegistry {
  constructor() {
    this.objectSpriteSheets = new Map();
    this.enemySpritesByType = new Map();
    this.corpseSpritesByType = new Map();
  }

  // ================================================================================================================================================================================================================================================
  // getObjectSheet
  // Peça de piso, borda, parede ou objeto pelo id do objeto ('<tipo>_<n>').

  getObjectSheet(objId) {
    if (!objId) return null;
    const type = objectIdType(objId);
    if (this.objectSpriteSheets.has(type)) return this.objectSpriteSheets.get(type);

    const frame = spriteFrame(type);
    let sheet = null;
    if (frame) {
      sheet = new SpriteSheet(frame.url, frame.size, frame.size, frame.frames, ['idle'], { x: frame.x, y: frame.y });
      if (frame.frames > 1) sheet._frameDuration = ANIMATION_CYCLE_MS / frame.frames;
    }
    this.objectSpriteSheets.set(type, sheet);
    return sheet;
  }

  // ================================================================================================================================================================================================================================================
  // getPlayerSheet
  // Folha do gênero do player; sem ela, a do gênero padrão (ou null).

  getPlayerSheet(gender) {
    const sheet = this.getEnemySheet(PLAYER_SPRITES[gender] || PLAYER_SPRITES[DEFAULT_GENDER]);
    return isSheetReady(sheet) ? sheet : this.getEnemySheet(PLAYER_SPRITES[DEFAULT_GENDER]);
  }

  // ================================================================================================================================================================================================================================================
  // getEnemySheet
  // Folha da criatura: uma linha por direção (sul, norte, leste, oeste).

  getEnemySheet(creature) {
    if (this.enemySpritesByType.has(creature)) return this.enemySpritesByType.get(creature);
    const asset = getAsset(creature);
    const sheet = asset ? new SpriteSheet(asset.url, asset.quadro, asset.quadro, asset.quadros, CONFIG.playerSpriteDirections) : null;
    this.enemySpritesByType.set(creature, sheet);
    return sheet;
  }

  // ================================================================================================================================================================================================================================================
  // getCorpseSheet
  // Cadáver: a 5ª linha da folha da criatura (fresco, apodrecendo, ossos).

  getCorpseSheet(corpseData) {
    if (!corpseData) return null;
    const creature = corpseData.isPlayer ? PLAYER_SPRITES[DEFAULT_GENDER] : corpseData.creature;
    if (this.corpseSpritesByType.has(creature)) return this.corpseSpritesByType.get(creature);
    const asset = getAsset(creature);
    const frames = CONFIG.corpseFrameCount || 3;
    const sheet = asset && asset.cadaver
      ? new SpriteSheet(asset.url, asset.quadro, asset.quadro, frames, ['idle'], { x: 0, y: CORPSE_ROW * asset.quadro })
      : null;
    this.corpseSpritesByType.set(creature, sheet);
    return sheet;
  }

  // ================================================================================================================================================================================================================================================
  // getCreatureSize
  // Tamanho do quadro da criatura (32 ou 64).

  getCreatureSize(creature) {
    const asset = getAsset(creature);
    return asset ? asset.quadro : 32;
  }
}
