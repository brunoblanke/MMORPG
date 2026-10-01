// js/views/lighting-layer.js

import { CONFIG } from '../config.js';
import { objectIdType } from '../../shared/assets.js';
import { itemInfo } from '../../shared/items.js';
import { ambientLight, lightAt, PLAYER_LIGHT, VISIBLE_LIGHT } from '../../shared/lighting.js';

// Escuridão por cima do mapa (shared/lighting.js): uma camada do tamanho da
// tela com a falta de luz geral, aberta em círculos suaves em cada fonte de
// luz do andar do player (players, NPCs, criaturas e objetos com Luz no
// gerador). Luz de item (tocha) ganha um tom quente. Nome e barra de vida só
// aparecem onde está claro o bastante (VISIBLE_LIGHT).

const DARK_RGB = '4, 6, 16';
const WARM_GLOW = 'rgba(255, 160, 70, 0.12)';

export class LightingLayer {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
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
      this.sources.push({ x: player.renderX, y: player.renderY, radius, warm: radius > PLAYER_LIGHT });
    }
    for (const creature of [...(gameState.npcs || []), ...(gameState.enemies || [])]) {
      const radius = creature.creature ? itemInfo(creature.creature).light : 0;
      if (radius > 0 && atLevel(creature)) this.sources.push({ x: creature.renderX, y: creature.renderY, radius, warm: true });
    }
    for (const obj of drawables) {
      if (obj.level !== level || obj.isCreature || !obj.entity || !obj.entity.id) continue;
      const radius = itemInfo(objectIdType(obj.entity.id)).light;
      if (radius > 0) this.sources.push({ x: obj.x, y: obj.y, radius, warm: true });
    }
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // isLit
  // A criatura está num sqm claro o bastante pra mostrar nome e vida.

  isLit(entity) {
    return lightAt(entity.renderX ?? entity.x, entity.renderY ?? entity.y, this.ambient, this.sources) >= VISIBLE_LIGHT;
  }

  // ================================================================================================================================================================================================================================================
  // draw
  // A escuridão, aberta nas fontes de luz, e o brilho quente das tochas.

  draw(ctx, renderer) {
    const { canvas } = ctx;
    if (this.canvas.width !== canvas.width || this.canvas.height !== canvas.height) {
      this.canvas.width = canvas.width;
      this.canvas.height = canvas.height;
    }
    const dark = this.ctx;
    const size = CONFIG.tileSize;
    dark.globalCompositeOperation = 'source-over';
    dark.clearRect(0, 0, canvas.width, canvas.height);
    dark.fillStyle = `rgba(${DARK_RGB}, ${1 - this.ambient})`;
    dark.fillRect(0, 0, canvas.width, canvas.height);
    dark.globalCompositeOperation = 'destination-out';
    const centers = this.sources.map(source => {
      const base = renderer.gridToScreenWithOffset(source.x, source.y);
      return { cx: base.x + size / 2, cy: base.y + size / 2, r: (source.radius + 0.5) * size, warm: source.warm };
    });
    for (const { cx, cy, r } of centers) {
      const gradient = dark.createRadialGradient(cx, cy, 0, cx, cy, r);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      dark.fillStyle = gradient;
      dark.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ctx.drawImage(this.canvas, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const { cx, cy, r, warm } of centers) {
      if (!warm) continue;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      glow.addColorStop(0, WARM_GLOW);
      glow.addColorStop(1, 'rgba(255, 160, 70, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ctx.restore();
  }
}
