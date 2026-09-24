// js/views/sprite-registry.js

import { CONFIG } from '../config.js';
import { SpriteSheet } from '../../shared/sprite-sheet.js';
import { FLOOR1_FILES, FLOOR2_FILES, OBJECT_DEFS, ITEM_CATALOG, CREATURE_TYPES, PLAYER_SPRITE as PLAYER_DEF, PLAYER_SPRITES, DEFAULT_GENDER } from '../../shared/catalog.js';
import { ANIMATION_CYCLE_MS } from '../../shared/constants.js';
import { getTibiaItem, getTibiaCreature, getTibiaRegistry, tibiaFrameRect } from '../../shared/tibia-registry.js';

const PLAYER_SPRITE = `img/${PLAYER_DEF.file}`;
const PLAYER_CORPSE_SPRITE = 'img/Dead-Human.png';
const FLOOR_SPRITE = 'img/Piso.png';
const COLLISION_SPRITE = 'img/Parede-X.png';

// ================================================================================================================================================================================================================================================
// getSpritePaths

export function getSpritePaths() {
  return [
    PLAYER_SPRITE,
    ...Object.values(PLAYER_SPRITES).map(file => `img/${file}`),
    PLAYER_CORPSE_SPRITE,
    FLOOR_SPRITE,
    COLLISION_SPRITE,
    ...Object.values(CREATURE_TYPES).flatMap(type => [`img/${type.file}`, `img/${type.corpse}`]),
    ...Object.values(FLOOR1_FILES).map(file => `img/${file}`),
    ...Object.values(FLOOR2_FILES).map(file => `img/${file}`),
    ...Object.values(OBJECT_DEFS).map(def => `img/${def.file}`),
    ...Object.values(ITEM_CATALOG).map(def => `img/${def.file}`),
    ...Object.values(getTibiaRegistry().items).map(def => `img/${def.file}`),
    ...Object.values(getTibiaRegistry().creatures).flatMap(def => [def.file, def.corpse].filter(Boolean).map(file => `img/${file}`))
  ];
}

// ================================================================================================================================================================================================================================================
// TibiaItemSheet
// Folha de um item do Tibia (server/tibia-assets.js): o quadro depende do
// sqm (variação) e do tempo (animação) — getFrameRectAt.

class TibiaItemSheet {
  constructor(def) {
    this.def = def;
    this.image = new Image();
    this.image.src = `img/${def.file}`;
    this.frameWidth = def.fw;
    this.frameHeight = def.fh;
    this.totalFrames = def.frames;
  }

  getFrameRect(direction, timestamp) {
    return tibiaFrameRect(this.def, 0, 0, 0, timestamp);
  }

  getFrameRectAt(x, y, z, timestamp) {
    return tibiaFrameRect(this.def, x, y, z, timestamp);
  }
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

    this.playerSpritesByGender = {};
    for (const [gender, file] of Object.entries(PLAYER_SPRITES)) {
      this.playerSpritesByGender[gender] = new SpriteSheet(
        `img/${file}`,
        CONFIG.playerSpriteFrameWidth,
        CONFIG.playerSpriteFrameHeight,
        walkFrames,
        directions
      );
    }

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

    const tibiaDef = getTibiaItem(baseId);
    if (!tibiaDef) return null;
    this.objectSpriteSheets[baseId] = new TibiaItemSheet(tibiaDef);
    return this.objectSpriteSheets[baseId];
  }

  // ================================================================================================================================================================================================================================================
  // getPlayerSheet
  // Sprite do gênero do player; se a imagem dele não carregou, o padrão.

  getPlayerSheet(gender) {
    const sheet = this.playerSpritesByGender[gender];
    if (sheet && sheet.image.complete && sheet.image.naturalWidth > 0) return sheet;
    return this.playerSpritesByGender[DEFAULT_GENDER] || this.playerSprite;
  }

  // ================================================================================================================================================================================================================================================
  // getEnemySheet

  getEnemySheet(creature) {
    if (this.enemySpritesByType[creature]) return this.enemySpritesByType[creature];
    const def = getTibiaCreature(creature);
    if (!def) return null;
    this.enemySpritesByType[creature] = new SpriteSheet(`img/${def.file}`, def.spriteSize, def.spriteSize, def.frames, CONFIG.playerSpriteDirections);
    return this.enemySpritesByType[creature];
  }

  // ================================================================================================================================================================================================================================================
  // getCorpseSheet

  getCorpseSheet(corpseData) {
    if (!corpseData) return null;
    if (corpseData.isPlayer) return this.playerCorpseSprite;
    if (this.corpseSpritesByType[corpseData.creature]) return this.corpseSpritesByType[corpseData.creature];
    const def = getTibiaCreature(corpseData.creature);
    if (!def || !def.corpse) return null;
    this.corpseSpritesByType[corpseData.creature] = new SpriteSheet(`img/${def.corpse}`, def.corpseSize, def.corpseSize, def.corpseFrames || 1, ['idle']);
    return this.corpseSpritesByType[corpseData.creature];
  }
}
