// js/views/lighting-layer.js

import { CONFIG } from '../config.js';
import { objectIdType, togglesOnUse } from '../../shared/assets.js';
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
  // Luz geral e fontes de luz do andar level neste quadro (e as de objetos
  // em andares acima do chão que aparecem na tela, como uma fogueira no
  // andar 1 vista da rua). Devolve true se há escuridão a desenhar.

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
      if ((obj.level !== level && !(obj.level > level && obj.level > 0)) || obj.isCreature || !obj.entity || !obj.entity.id) continue;
      const radius = itemInfo(objectIdType(obj.entity.id)).light;
      const switches = obj.entity.movable === true || togglesOnUse(objectIdType(obj.entity.id));
      if (radius > 0 && (!switches || obj.entity.active)) this.sources.push({ x: obj.x, y: obj.y, radius, warm: true });
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
  // onde a tocha alcança, um tom quente: montado numa imagem pequena (1 pixel
  // por sqm) e esticada na tela sem suavizar, de uma vez só.

  draw(ctx, renderer) {
    const size = CONFIG.tileSize;
    const visible = renderer.camera.getVisibleTiles();
    const startX = visible.startX - 1;
    const startY = visible.startY - 1;
    const cols = visible.endX - startX + 1;
    const rows = visible.endY - startY + 1;
    if (cols <= 0 || rows <= 0) return;
    const key = `${startX},${startY},${cols},${rows},${this.ambient},${this.sources.map(s => `${s.x}:${s.y}:${s.radius}:${s.warm ? 1 : 0}`).join('|')}`;
    if (key !== this.key) {
      this.key = key;
      this.paint(startX, startY, cols, rows);
    }
    const base = renderer.gridToScreenWithOffset(startX, startY);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.canvas, 0, 0, cols, rows, base.x, base.y, cols * size, rows * size);
    ctx.restore();
  }

  // ================================================================================================================================================================================================================================================
  // paint
  // Cor de cada sqm já com a escuridão e o tom quente juntos (como se um
  // fosse desenhado por cima do outro).

  paint(startX, startY, cols, rows) {
    if (!this.canvas) this.canvas = document.createElement('canvas');
    if (this.canvas.width < cols || this.canvas.height < rows) {
      this.canvas.width = Math.max(this.canvas.width, cols);
      this.canvas.height = Math.max(this.canvas.height, rows);
      this.image = null;
    }
    if (!this.image || this.image.width !== cols || this.image.height !== rows) this.image = new ImageData(cols, rows);
    const dark = DARK_RGB.split(',').map(Number);
    const warm = WARM_RGB.split(',').map(Number);
    const data = this.image.data;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = startX + col;
        const y = startY + row;
        const a1 = Math.round((1 - Math.min(1, lightAt(x, y, this.ambient, this.sources))) * 1000) / 1000;
        const a2 = Math.round(this.warmthAt(x, y) * WARM_ALPHA * 1000) / 1000;
        const alpha = 1 - (1 - a1) * (1 - a2);
        const i = (row * cols + col) * 4;
        if (alpha <= 0) {
          data[i + 3] = 0;
          continue;
        }
        for (let c = 0; c < 3; c++) data[i + c] = Math.round((dark[c] * a1 * (1 - a2) + warm[c] * a2) / alpha);
        data[i + 3] = Math.round(alpha * 255);
      }
    }
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.putImageData(this.image, 0, 0);
  }
}
