// js/views/lighting-layer.js

import { CONFIG } from '../config.js';
import { objectIdType } from '../../shared/assets.js';
import { itemInfo } from '../../shared/items.js';
import { ambientLight, lightAt, PLAYER_LIGHT, VISIBLE_LIGHT } from '../../shared/lighting.js';

// Escuridão por cima do mapa como no Tibia tradicional: em blocos, um nível
// de luz por sqm (shared/lighting.js → lightAt), a partir da luz geral e das
// fontes de luz do andar do player (players, NPCs, criaturas e objetos com
// Luz no gerador), cada uma no sqm em que está. Luz de item (tocha) dá um tom
// quente. Nome e barra de vida só aparecem onde está claro o bastante
// (VISIBLE_LIGHT).

const DARK_RGB = '4, 6, 16';
const WARM_RGB = '255, 160, 70';
const WARM_ALPHA = 0.14;

export class LightingLayer {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor() {
    this.ambient = 1;
    this.sources = [];
  }

  // ================================================================================================================================================================================================================================================
  // prepare
  // Luz geral e fontes de luz do andar level neste quadro. Devolve true se há
  // escuridão a desenhar.

  prepare(gameState, drawables, level, now) {
    this.ambient = ambientLight(now, level);
    this.sources = [];
    if (this.ambient >= 0.999) return false;
    const atLevel = (entity) => Math.floor(entity.renderZ ?? entity.z ?? 0) === level;
    for (const player of gameState.players || []) {
      if (!atLevel(player)) continue;
      const radius = player.light || PLAYER_LIGHT;
      this.sources.push({ x: Math.round(player.renderX), y: Math.round(player.renderY), radius, warm: radius > PLAYER_LIGHT });
    }
    for (const creature of [...(gameState.npcs || []), ...(gameState.enemies || [])]) {
      const radius = creature.creature ? itemInfo(creature.creature).light : 0;
      if (radius > 0 && atLevel(creature)) this.sources.push({ x: Math.round(creature.renderX), y: Math.round(creature.renderY), radius, warm: true });
    }
    for (const obj of drawables) {
      if (obj.level !== level || obj.isCreature || !obj.entity || !obj.entity.id) continue;
      const radius = itemInfo(objectIdType(obj.entity.id)).light;
      if (radius > 0 && (obj.entity.movable !== true || obj.entity.lit)) this.sources.push({ x: obj.x, y: obj.y, radius, warm: true });
    }
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // isLit
  // A criatura está num sqm claro o bastante pra mostrar nome e vida.

  isLit(entity) {
    if (!entity) return false;
    return lightAt(Math.round(entity.renderX ?? entity.x), Math.round(entity.renderY ?? entity.y), this.ambient, this.sources) >= VISIBLE_LIGHT;
  }

  // ================================================================================================================================================================================================================================================
  // warmthAt
  // Quanto da luz do sqm vem de fonte quente (tocha), de 0 a 1.

  warmthAt(x, y) {
    let warmth = 0;
    for (const source of this.sources) {
      if (!source.warm) continue;
      const reach = source.radius + 0.5;
      const d = Math.hypot(x - source.x, y - source.y);
      if (d < reach) warmth = Math.max(warmth, 1 - d / reach);
    }
    return warmth;
  }

  // ================================================================================================================================================================================================================================================
  // draw
  // Um bloco de escuridão por sqm visível (mais escuro onde há menos luz) e,
  // onde a tocha alcança, um tom quente.

  draw(ctx, renderer) {
    const size = CONFIG.tileSize;
    const visible = renderer.camera.getVisibleTiles();
    ctx.save();
    for (let y = visible.startY - 1; y <= visible.endY; y++) {
      for (let x = visible.startX - 1; x <= visible.endX; x++) {
        const light = lightAt(x, y, this.ambient, this.sources);
        const base = renderer.gridToScreenWithOffset(x, y);
        if (light < 1) {
          ctx.fillStyle = `rgba(${DARK_RGB}, ${(1 - light).toFixed(3)})`;
          ctx.fillRect(base.x, base.y, size, size);
        }
        const warmth = this.warmthAt(x, y);
        if (warmth > 0) {
          ctx.fillStyle = `rgba(${WARM_RGB}, ${(warmth * WARM_ALPHA).toFixed(3)})`;
          ctx.fillRect(base.x, base.y, size, size);
        }
      }
    }
    ctx.restore();
  }
}
