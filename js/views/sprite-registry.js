// js/views/sprite-registry.js

import { CONFIG } from '../config.js';
import { SpriteSheet } from '../../shared/sprite-sheet.js';
import { FLOOR1_FILES, FLOOR2_FILES, OBJECT_DEFS, ITEM_CATALOG, CREATURE_TYPES, PLAYER_SPRITE as PLAYER_DEF } from '../../shared/catalog.js';
import { ANIMATION_CYCLE_MS } from '../../shared/constants.js';

const PLAYER_SPRITE = `img/${PLAYER_DEF.file}`;
const PLAYER_CORPSE_SPRITE = 'img/Dead-Human.png';
const FLOOR_SPRITE = 'img/Piso.png';
const COLLISION_SPRITE = 'img/Parede-X.png';

// ================================================================================================================================================================================================================================================
// getSpritePaths

export function getSpritePaths() {
  return [
    PLAYER_SPRITE,
    PLAYER_CORPSE_SPRITE,
    FLOOR_SPRITE,
    COLLISION_SPRITE,
    ...Object.values(CREATURE_TYPES).flatMap(type => [`img/${type.file}`, `img/${type.corpse}`]),
    ...Object.values(FLOOR1_FILES).map(file => `img/${file}`),
    ...Object.values(FLOOR2_FILES).map(file => `img/${file}`),
    ...Object.values(OBJECT_DEFS).map(def => `img/${def.file}`),
    ...Object.values(ITEM_CATALOG).map(def => `img/${def.file}`)
  ];
}

export class SpriteRegistry {
  constructor() {
    const walkFrames = CONFIG.playerSpriteWalkFrames + 1;
    const directions = CONFIG.playerSpriteDirections;
    const corpseFrames = CONFIG.corpseFrameCount || 3;

    this.playerSprite = new SpriteSheet(
      PLAYER_SPRITE,
      CONFIG.playerSpriteFrameWidth,
      CONFIG.playerSpriteFrameHeight,
      walkFrames,
      directions
    );

    // Sprites de criatura indexados pelo TIPO (nome); o lvl não influencia o visual.
    this.enemySpritesByType = {};
    this.playerCorpseSprite = new SpriteSheet(PLAYER_CORPSE_SPRITE, 32, 32, corpseFrames, ['idle']);
    this.corpseSpritesByType = {};
    for (const [name, type] of Object.entries(CREATURE_TYPES)) {
      this.enemySpritesByType[name] = new SpriteSheet(`img/${type.file}`, type.spriteSize, type.spriteSize, walkFrames, directions);
      this.corpseSpritesByType[name] = new SpriteSheet(`img/${type.corpse}`, type.corpseSize, type.corpseSize, corpseFrames, ['idle']);
    }

    const objW = CONFIG.objectSpriteFrameWidth || 32;
    const objH = CONFIG.objectSpriteFrameHeight || 32;
    this.objectSpriteSheets = {};

    this.objectSpriteSheets['Floor'] = new SpriteSheet(FLOOR_SPRITE, objW, objH, 1, ['idle']);

    for (const [variant, filename] of Object.entries(FLOOR1_FILES)) {
      this.objectSpriteSheets[`Floor_${variant}`] = new SpriteSheet(`img/${filename}`, objW, objH, 1, ['idle']);
    }

    for (const [variant, filename] of Object.entries(FLOOR2_FILES)) {
      this.objectSpriteSheets[`Floor2_${variant}`] = new SpriteSheet(`img/${filename}`, objW, objH, 1, ['idle']);
    }

    this.objectSpriteSheets['collision'] = new SpriteSheet(COLLISION_SPRITE, 64, 64, 1, ['idle']);

    for (const [id, def] of Object.entries(OBJECT_DEFS)) {
      this.objectSpriteSheets[id] = this.createAnimatedSheet(`img/${def.file}`, def.frameW, def.frameH, def.frames);
    }

    for (const [id, def] of Object.entries(ITEM_CATALOG)) {
      this.objectSpriteSheets[id] = this.createAnimatedSheet(`img/${def.file}`, objW, objH, def.frames);
    }
  }

  // ================================================================================================================================================================================================================================================
  // createAnimatedSheet

  createAnimatedSheet(src, frameW, frameH, frames) {
    const sheet = new SpriteSheet(src, frameW, frameH, frames, ['idle']);
    if (frames > 1) sheet._frameDuration = ANIMATION_CYCLE_MS / frames;
    return sheet;
  }

  // ================================================================================================================================================================================================================================================
  // getObjectSheet

  getObjectSheet(objId) {
    if (!objId) return null;

    if (this.objectSpriteSheets[objId]) return this.objectSpriteSheets[objId];

    let baseId = objId;
    const parts = baseId.split('_');
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      if (!isNaN(lastPart)) {
        baseId = parts.slice(0, -1).join('_');
      }
    }

    if (this.objectSpriteSheets[baseId]) return this.objectSpriteSheets[baseId];
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // getEnemySheet

  getEnemySheet(creature) {
    return this.enemySpritesByType[creature] || null;
  }

  // ================================================================================================================================================================================================================================================
  // getCorpseSheet

  getCorpseSheet(corpseData) {
    if (!corpseData) return null;
    if (corpseData.isPlayer) return this.playerCorpseSprite;
    return this.corpseSpritesByType[corpseData.creature] || null;
  }
}
