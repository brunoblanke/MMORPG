import { CONFIG } from '../config.js';
import { shadeColor, isInRadius } from '../utils/helpers.js';
import { SpriteRegistry, isSheetReady } from './sprite-registry.js';
import { drawEntityOverlay } from './entity-overlay.js';
import { drawTileTooltip } from './tile-tooltip.js';
import { prepareDrawables } from './draw-order.js';
import { getEntityLevel } from '../core/geometry.js';

const TINT_HIT = { color: '#ff2a2a', alpha: 0.55 };
const TINT_ENEMY_HOVER = { color: '#ff2a2a', alpha: 0.35 };
const TINT_TARGET = { color: '#ff2a2a', alpha: 0.2 };
const TINT_HOVER = { color: '#3b82f6', alpha: 0.35 };
const FLOOR_DARKEN = 0.2;

export class Renderer {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camera = camera;
    this.devMode = true;
    this.selectedTarget = null;

    this.sprites = new SpriteRegistry();

    this.frameTimestamp = 0;
    this.pendingOverlays = [];

    this.showTooltip = true;
    this.showPaths = true;
    this.showDetectionAreas = true;
    this.showPatrolAreas = true;
    this.showYellowOutline = true;
  }

  // ================================================================================================================================================================================
  // setDevMode

  setDevMode(enabled) {
    this.devMode = enabled;
    this.showTooltip = enabled;
    this.showPaths = enabled;
    this.showDetectionAreas = enabled;
    this.showPatrolAreas = enabled;
    this.showYellowOutline = enabled;
  }

  // ================================================================================================================================================================================
  // gridToScreenWithOffset

  gridToScreenWithOffset(x, y) {
    return this.camera.gridToScreenWithOffset(x, y);
  }

  // ================================================================================================================================================================================
  // screenToGrid

  screenToGrid(screenX, screenY) {
    return this.camera.screenToGrid(screenX, screenY);
  }

  // ================================================================================================================================================================================
  // drawTile

  drawTile(x, y) {
    const pos = this.gridToScreenWithOffset(x, y);
    const size = CONFIG.tileSize;
    this.ctx.fillStyle = "#444";
    this.ctx.fillRect(pos.x, pos.y, size, size);
    this.ctx.strokeStyle = "#333";
    this.ctx.strokeRect(pos.x, pos.y, size, size);
  }

  // ================================================================================================================================================================================
  // drawTileHighlights
  // Marcações de dev (patrulha, detecção, zona segura, caminho, alvo, hover, spawn). Desenhadas
  // depois dos pisos e objetos, translúcidas, pra ficarem visíveis sobre eles.
  // Cada andar desenha só as suas: zonas dos inimigos daquele andar, zona
  // segura daquele andar e, no andar do player, caminho, alvo, hover e spawn.

  drawTileHighlights(x, y, enemies, player, inputController, world, level, isPlayerLevel) {
    const walk = player.walk || { target: null, path: [] };
    const pos = this.gridToScreenWithOffset(x, y);
    const size = CONFIG.tileSize;

    let inPatrolZone = false;
    let inDetectionZone = false;

    if (this.devMode) {
      if (this.showPatrolAreas || this.showDetectionAreas) {
        for (const enemy of enemies) {
          if (enemy.isInPatrolZone && enemy.isInPatrolZone(x, y)) {
            inPatrolZone = true;
          }
          if (isInRadius(x, y, enemy.x, enemy.y, CONFIG.detectionRadius)) {
            inDetectionZone = true;
          }
        }
      }
    }

    const isTarget = this.devMode && isPlayerLevel && walk.target && walk.target.x === x && walk.target.y === y;
    const isInPath = this.devMode && isPlayerLevel && this.showPaths && walk.path.some(p => p.x === x && p.y === y);
    const isHover = this.devMode && isPlayerLevel && inputController.hoverTile && inputController.hoverTile.x === x && inputController.hoverTile.y === y;
    const isSpawn = this.devMode && isPlayerLevel && player && player.spawnX === x && player.spawnY === y;

    if (inPatrolZone && this.devMode && this.showPatrolAreas) {
      this.ctx.fillStyle = "rgba(255, 220, 90, 0.14)";
      this.ctx.fillRect(pos.x, pos.y, size, size);
    } else if (inDetectionZone && this.devMode && this.showDetectionAreas) {
      this.ctx.fillStyle = "rgba(90, 210, 230, 0.14)";
      this.ctx.fillRect(pos.x, pos.y, size, size);
    }

    if (this.devMode && isPlayerLevel) this.drawAutoAttackArea(x, y, pos, size, player);

    if (this.devMode && world && world.isSafe(x, y, level)) {
      this.ctx.fillStyle = "rgba(46, 204, 113, 0.22)";
      this.ctx.fillRect(pos.x, pos.y, size, size);
      this.ctx.strokeStyle = "rgba(46, 204, 113, 0.7)";
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(pos.x + 1.5, pos.y + 1.5, size - 3, size - 3);
    }

    if (isSpawn) {
      this.ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
      this.ctx.fillRect(pos.x, pos.y, size, size);
      this.ctx.strokeStyle = "#00FF00";
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(pos.x, pos.y, size, size);
    } else if (isTarget) {
      this.ctx.fillStyle = "rgba(255, 215, 0, 0.2)";
      this.ctx.fillRect(pos.x, pos.y, size, size);
      this.ctx.strokeStyle = "#FFD700";
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(pos.x, pos.y, size, size);
    } else if (isInPath) {
      this.ctx.fillStyle = "rgba(255, 165, 0, 0.15)";
      this.ctx.fillRect(pos.x, pos.y, size, size);
    } else if (isHover) {
      this.ctx.fillStyle = "rgba(0, 255, 255, 0.15)";
      this.ctx.fillRect(pos.x, pos.y, size, size);
    }
    this.ctx.lineWidth = 1;
  }

  // ================================================================================================================================================================================
  // drawAutoAttackArea
  // Modo dev: o raio em volta do player onde um inimigo que chega entra na
  // fila do auto ataque (o mesmo raio em que ele percebe o player). Vermelho
  // forte com o auto ataque ligado; fraco na defesa. Borda só no contorno.

  drawAutoAttackArea(x, y, pos, size, player) {
    const radius = CONFIG.detectionRadius;
    const inside = (tx, ty) => isInRadius(tx, ty, player.x, player.y, radius);
    if (!inside(x, y)) return;
    const on = !!player.attackMode;
    this.ctx.fillStyle = on ? "rgba(239, 68, 68, 0.12)" : "rgba(239, 68, 68, 0.05)";
    this.ctx.fillRect(pos.x, pos.y, size, size);
    this.ctx.strokeStyle = on ? "rgba(239, 68, 68, 0.8)" : "rgba(239, 68, 68, 0.35)";
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    if (!inside(x, y - 1)) { this.ctx.moveTo(pos.x, pos.y); this.ctx.lineTo(pos.x + size, pos.y); }
    if (!inside(x, y + 1)) { this.ctx.moveTo(pos.x, pos.y + size); this.ctx.lineTo(pos.x + size, pos.y + size); }
    if (!inside(x - 1, y)) { this.ctx.moveTo(pos.x, pos.y); this.ctx.lineTo(pos.x, pos.y + size); }
    if (!inside(x + 1, y)) { this.ctx.moveTo(pos.x + size, pos.y); this.ctx.lineTo(pos.x + size, pos.y + size); }
    this.ctx.stroke();
  }

  // ================================================================================================================================================================================
  // getObjectSpriteSheet

  getObjectSpriteSheet(objId) {
    return this.sprites.getObjectSheet(objId);
  }

  // ================================================================================================================================================================================
  // getStackLevel

  getStackLevel(z, isVolumePiece) {
    const maxFloors = CONFIG.maxStackHeight || 4;
    const capLevel = maxFloors - 1;
    const zVal = z || 0;

    if (isVolumePiece) {
      return Math.min(zVal, capLevel);
    }

    return zVal > capLevel ? capLevel + 1 : zVal;
  }

  // ================================================================================================================================================================================
  // getStackOffset

  getStackOffset(step, isVolumePiece) {
    const level = this.getStackLevel(step, isVolumePiece);
    return {
      x: level * (CONFIG.stackOffsetX || 7),
      y: level * (CONFIG.stackOffsetY || 7)
    };
  }

  // ================================================================================================================================================================================
  // drawAnchoredSprite
  // Desenha o frame alinhado ao canto inferior direito do tile (sprites maiores que o tile crescem pra cima/esquerda).

  drawAnchoredSprite(image, frameRect, base, size, stackOffsetX, stackOffsetY, tint = null) {
    const drawX = base.x + size - frameRect.sw - stackOffsetX;
    const drawY = base.y + size - frameRect.sh - stackOffsetY;
    this.ctx.drawImage(
      image,
      frameRect.sx, frameRect.sy, frameRect.sw, frameRect.sh,
      drawX, drawY, frameRect.sw, frameRect.sh
    );
    if (tint) this.drawTint(image, frameRect, drawX, drawY, tint);
  }

  // ================================================================================================================================================================================
  // drawTint
  // Pinta a silhueta do sprite com a cor por cima (só onde o sprite tem pixel).

  drawTint(image, frameRect, drawX, drawY, tint) {
    if (!this.tintCanvas) this.tintCanvas = document.createElement('canvas');
    const canvas = this.tintCanvas;
    canvas.width = frameRect.sw;
    canvas.height = frameRect.sh;
    const tctx = canvas.getContext('2d');
    tctx.imageSmoothingEnabled = false;
    tctx.globalCompositeOperation = 'source-over';
    tctx.drawImage(image, frameRect.sx, frameRect.sy, frameRect.sw, frameRect.sh, 0, 0, frameRect.sw, frameRect.sh);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = tint.color;
    tctx.fillRect(0, 0, frameRect.sw, frameRect.sh);
    this.ctx.save();
    this.ctx.globalAlpha = tint.alpha;
    this.ctx.drawImage(canvas, drawX, drawY);
    this.ctx.restore();
  }

  // ================================================================================================================================================================================
  // getTint
  // Vermelho: dano recebido (player ou inimigo), inimigo sob o mouse e o alvo
  // do player. Azul: item, parede ou cadáver sob o mouse. Nada fica transparente.

  getTint(entity, isHovered, isPlayer, isEnemy) {
    if (entity && entity.hitFlash) return TINT_HIT;
    if (isEnemy && isHovered) return TINT_ENEMY_HOVER;
    if (entity && entity === this.selectedTarget) return TINT_TARGET;
    if (isHovered && !isPlayer && !isEnemy) return TINT_HOVER;
    return null;
  }

  // ================================================================================================================================================================================
  // drawFallbackSquare

  drawFallbackSquare(base, size, stackOffsetX, stackOffsetY, color, tint = null) {
    const fallbackX = base.x + size * 0.1 - stackOffsetX;
    const fallbackY = base.y + size * 0.1 - stackOffsetY;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(fallbackX, fallbackY, size * 0.8, size * 0.8);
    this.ctx.strokeStyle = shadeColor(color, -30);
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(fallbackX, fallbackY, size * 0.8, size * 0.8);
    if (!tint) return;
    this.ctx.save();
    this.ctx.globalAlpha = tint.alpha;
    this.ctx.fillStyle = tint.color;
    this.ctx.fillRect(fallbackX, fallbackY, size * 0.8, size * 0.8);
    this.ctx.restore();
  }

  // ================================================================================================================================================================================
  // drawFloor

  drawFloor(base, size, entity, isHovered) {
    const sheet = this.getObjectSpriteSheet(entity ? entity.id : null);
    if (isSheetReady(sheet)) {
      const duration = sheet._frameDuration || 1000 / sheet.totalFrames || 50;
      const frameRect = sheet.getFrameRect('idle', this.frameTimestamp, duration);
      this.ctx.drawImage(
        sheet.image,
        frameRect.sx, frameRect.sy, frameRect.sw, frameRect.sh,
        base.x, base.y, size, size
      );
    } else {
      this.ctx.fillStyle = "#444";
      this.ctx.fillRect(base.x, base.y, size, size);
    }
    if (!isHovered) return;
    this.ctx.save();
    this.ctx.globalAlpha = TINT_HOVER.alpha;
    this.ctx.fillStyle = TINT_HOVER.color;
    this.ctx.fillRect(base.x, base.y, size, size);
    this.ctx.restore();
  }

  // ================================================================================================================================================================================
  // getOutlineSize

  getOutlineSize(entity, isPlayer, isEnemy, isCorpse, corpseData, size) {
    if (isPlayer) {
      const sheet = this.sprites.getPlayerSheet(entity && entity.gender);
      const playerSize = sheet ? sheet.frameWidth : 32;
      return { w: playerSize, h: playerSize };
    }

    if (isEnemy) {
      const enemySpriteSize = this.sprites.getCreatureSize(entity.creature);
      return { w: enemySpriteSize, h: enemySpriteSize };
    }

    if (isCorpse) {
      const corpseSheet = this.sprites.getCorpseSheet(corpseData);
      const corpseSize = corpseSheet ? corpseSheet.frameWidth : 32;
      return { w: corpseSize, h: corpseSize };
    }

    const objSheet = entity ? this.getObjectSpriteSheet(entity.id) : null;
    return {
      w: objSheet ? objSheet.frameWidth : (CONFIG.objectSpriteFrameWidth || 32),
      h: objSheet ? objSheet.frameHeight : (CONFIG.objectSpriteFrameHeight || 32)
    };
  }

  // ================================================================================================================================================================================
  // drawYellowOutline

  drawYellowOutline(base, size, outline, stackOffsetX, stackOffsetY) {
    this.ctx.save();
    this.ctx.strokeStyle = "#FFD700";
    this.ctx.lineWidth = 1.5;

    const drawX = base.x + size - outline.w - stackOffsetX;
    const drawY = base.y + size - outline.h - stackOffsetY;

    this.ctx.strokeRect(drawX, drawY, outline.w, outline.h);
    this.ctx.restore();
  }

  // ================================================================================================================================================================================
  // getEntityFrame
  // Retorna { image, frameRect } do player, inimigo ou objeto; null se não houver sprite.

  getEntityFrame(entity, isPlayer, isEnemy) {
    if (isPlayer || isEnemy) {
      const sheet = isPlayer ? this.sprites.getPlayerSheet(entity && entity.gender) : (entity ? this.sprites.getEnemySheet(entity.creature) : null);
      if (!isSheetReady(sheet)) return null;

      const isMoving = entity && entity.isMoving;
      const direction = (entity && entity.direction) || 'sul';
      const frameDuration = entity && entity.getFrameDuration ? entity.getFrameDuration() : CONFIG.playerFrameDuration;
      const frameRect = isMoving
        ? sheet.getFrameRect(direction, this.frameTimestamp, frameDuration)
        : sheet.getIdleRect(direction);
      return { image: sheet.image, frameRect };
    }

    if (entity && entity.id) {
      const sheet = this.getObjectSpriteSheet(entity.id);
      if (isSheetReady(sheet)) {
        const duration = sheet._frameDuration || 1000 / sheet.totalFrames || 50;
        return { image: sheet.image, frameRect: sheet.getFrameRect('idle', this.frameTimestamp, duration) };
      }
    }

    return null;
  }

  // ================================================================================================================================================================================
  // drawEntitySprite

  // ================================================================================================================================================================================
  // getSpriteStackOffset
  // Deslocamento visual pela altura (step) — o mesmo pro sprite e pro contorno amarelo.

  getSpriteStackOffset(step, entity, hasVolume, movable, blocksMovement, isCorpse) {
    const isPlayer = entity && entity.isPlayer === true;
    const isEnemy = entity && entity.type === 'enemy';
    const isVolumePiece = !isPlayer && !isEnemy && !isCorpse && hasVolume === true;
    const appliesStackOffset = isPlayer || isEnemy || isCorpse || hasVolume || blocksMovement || movable === true;

    if (!appliesStackOffset || step === undefined || step === null) return { x: 0, y: 0 };
    return this.getStackOffset(step, isVolumePiece);
  }

  // ================================================================================================================================================================================
  // drawDrawableOutline
  // Contorno amarelo do modo inspecionar, desenhado numa passada própria (render).

  drawDrawableOutline(obj) {
    if (obj.isFloor || !(obj.entity || obj.isCorpse)) return;
    const entity = obj.entity || null;
    const base = this.gridToScreenWithOffset(obj.x, obj.y);
    const size = CONFIG.tileSize;
    const offset = this.getSpriteStackOffset(obj.step || 0, entity, obj.hasVolume, obj.movable, obj.blocksMovement, obj.isCorpse);
    const isPlayer = entity && entity.isPlayer === true;
    const isEnemy = entity && entity.type === 'enemy';
    const outline = this.getOutlineSize(entity, isPlayer, isEnemy, obj.isCorpse, this.getCorpseData(obj), size);
    this.drawYellowOutline(base, size, outline, offset.x, offset.y);
  }

  // ================================================================================================================================================================================
  // getCorpseData

  getCorpseData(obj) {
    return obj.isCorpse ? { isPlayer: obj.corpseIsPlayer, creature: obj.corpseCreature, deathTime: obj.deathTime } : null;
  }

  // ================================================================================================================================================================================
  // drawEntitySprite

  drawEntitySprite(x, y, z, step, entity, isHovered, hasVolume, movable, blocksMovement, isCorpse, corpseData, isFloor) {
    const base = this.gridToScreenWithOffset(x, y);
    const size = CONFIG.tileSize;

    if (isFloor) {
      this.drawFloor(base, size, entity, isHovered);
      return;
    }

    const isPlayer = entity && entity.isPlayer === true;
    const isEnemy = entity && entity.type === 'enemy';
    const stackOffset = this.getSpriteStackOffset(step, entity, hasVolume, movable, blocksMovement, isCorpse);
    const stackOffsetX = stackOffset.x;
    const stackOffsetY = stackOffset.y;

    const tint = this.getTint(entity, isHovered, isPlayer, isEnemy);

    if (isCorpse) {
      const sheet = this.sprites.getCorpseSheet(corpseData);
      if (isSheetReady(sheet)) {
        const elapsed = Math.max(0, this.frameTimestamp - (corpseData.deathTime || 0));
        const frameRect = sheet.getFrameRect('idle', elapsed, CONFIG.corpseFrameDuration);
        this.drawAnchoredSprite(sheet.image, frameRect, base, size, stackOffsetX, stackOffsetY, tint);
      } else {
        this.drawFallbackSquare(base, size, stackOffsetX, stackOffsetY, "#888888", tint);
      }
    } else {
      const frame = this.getEntityFrame(entity, isPlayer, isEnemy);
      if (frame) {
        this.drawAnchoredSprite(frame.image, frame.frameRect, base, size, stackOffsetX, stackOffsetY, tint);
      } else {
        const color = entity && entity.color ? entity.color : "#888888";
        this.drawFallbackSquare(base, size, stackOffsetX, stackOffsetY, color, tint);
      }
    }

    // Nome/vida/stats vão numa passada final (render), por cima de qualquer piso.
    this.pendingOverlays.push({ entity, base, stackOffsetX, stackOffsetY, size });
  }

  // ================================================================================================================================================================================
  // drawStatusMessage

  drawStatusMessage(statusMessage) {
    if (!statusMessage) return;

    this.ctx.save();
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.font = "bold 10px Arial";
    this.ctx.fillStyle = "#FFD700";
    this.ctx.fillText(statusMessage.text, this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.restore();
  }

  // ================================================================================================================================================================================
  // isPointInCube

  isPointInCube(mouseX, mouseY, x, y, offset, z, step, isVolumePiece = false) {
    const base = this.gridToScreenWithOffset(x, y);
    const size = CONFIG.tileSize;
    const stackOffset = this.getStackOffset(step, isVolumePiece);

    return mouseX >= base.x - stackOffset.x && mouseX <= base.x + size - stackOffset.x &&
           mouseY >= base.y - stackOffset.y && mouseY <= base.y + size - stackOffset.y;
  }

  // ================================================================================================================================================================================================================================================
  // flushOverlays

  flushOverlays() {
    for (const o of this.pendingOverlays) {
      drawEntityOverlay(this.ctx, o.entity, o.base, o.stackOffsetX, o.stackOffsetY, o.size, this.devMode);
    }
    this.pendingOverlays = [];
  }

  // ================================================================================================================================================================================================================================================
  // darkenBelow

  darkenBelow(floors) {
    if (floors <= 0) return;
    this.ctx.save();
    this.ctx.globalAlpha = 1 - Math.pow(1 - FLOOR_DARKEN, floors);
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  // ================================================================================================================================================================================
  // render

  render(gameState, ui) {
    this.frameTimestamp = performance.now();
    this.selectedTarget = gameState.player.target || null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.camera.update(gameState.player);
    const offset = this.camera.getOffset();

    const visible = this.camera.getVisibleTiles();

    for (let y = visible.startY; y < visible.endY; y++) {
      for (let x = visible.startX; x < visible.endX; x++) {
        this.drawTile(x, y);
      }
    }

    const drawables = prepareDrawables(gameState);
    this.pendingOverlays = [];
    const hoverEnemy = gameState.inputController.hoverEnemy;
    const hoverObject = gameState.inputController.hoverObject;
    const hoverCorpse = gameState.inputController.hoverCorpse;

    const drawDrawable = (obj) => {
      let isHovered = false;
      if (hoverEnemy) {
        isHovered = obj.entity === hoverEnemy;
      } else if (obj.isCorpse) {
        isHovered = !!hoverCorpse && !hoverObject && obj.id === hoverCorpse.id;
      } else if (hoverObject) {
        isHovered = obj.id === hoverObject.id;
      }

      this.drawEntitySprite(
        obj.x,
        obj.y,
        obj.z || 0,
        obj.step || 0,
        obj.entity || null,
        isHovered,
        obj.hasVolume,
        obj.movable,
        obj.blocksMovement,
        obj.isCorpse || false,
        this.getCorpseData(obj),
        obj.isFloor || false
      );
    };

    // Andar por andar (drawables já vêm ordenados por nível): primeiro o chão
    // do andar, depois o que o modo inspecionar desenha naquele andar
    // (áreas, zona segura, caminho/alvo no andar do player, contornos amarelos) e por fim objetos, cadáveres,
    // inimigos e players na ordem normal: sqm a sqm (mais ao sul e a leste por
    // cima) e, dentro do sqm, na ordem da pilha. Nome, barra de vida e o que
    // o modo dev desenha sobre a criatura saem junto do andar dela: o piso do
    // andar de cima os cobre.
    // Cada andar abaixo do do player fica 20% mais escuro por andar de
    // distância (o escurecimento acumula a cada andar desenhado por cima).
    const playerLevel = getEntityLevel(gameState.player);
    const playerFloor = Math.floor(gameState.player.z || 0);
    let lastLevel = null;
    const drawHighlights = (level) => {
      if (!this.devMode) return;
      const enemiesHere = gameState.enemies.filter(enemy => getEntityLevel(enemy) === level);
      const isPlayerLevel = level === playerLevel;
      for (let y = visible.startY; y < visible.endY; y++) {
        for (let x = visible.startX; x < visible.endX; x++) {
          this.drawTileHighlights(x, y, enemiesHere, gameState.player, gameState.inputController, gameState.world, level, isPlayerLevel);
        }
      }
    };

    let start = 0;
    while (start < drawables.length) {
      const level = drawables[start].level;
      let end = start;
      while (end < drawables.length && drawables[end].level === level) end++;
      const group = drawables.slice(start, end);

      if (lastLevel !== null && level <= playerFloor) this.darkenBelow(level - lastLevel);
      lastLevel = level;
      for (const obj of group) if (obj.isFloor) drawDrawable(obj);
      drawHighlights(level);
      if (this.showYellowOutline) {
        for (const obj of group) this.drawDrawableOutline(obj);
      }
      for (const obj of group) if (!obj.isFloor) drawDrawable(obj);
      this.flushOverlays();

      start = end;
    }

    ui.draw(this.ctx, gameState.player, this.devMode, gameState.world.isInSafeZone(gameState.player));

    if (this.showTooltip) {
      drawTileTooltip(this.ctx, this.camera, gameState, gameState.inputController);
    }

    this.drawStatusMessage(gameState.statusMessage);
  }
}
