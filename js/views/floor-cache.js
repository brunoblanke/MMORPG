// js/views/floor-cache.js

import { CONFIG } from '../config.js';
import { isSheetReady } from './sprite-registry.js';

// Chão pronto em blocos: pisos e bordas não mudam, então cada bloco de
// CHUNK×CHUNK sqm de um andar é desenhado uma vez num canvas e, a cada
// quadro, só copiado pra tela. Sqm com piso animado (água…) fica de fora do
// bloco e continua sendo desenhado peça a peça.

const CHUNK = 16;

export class FloorCache {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sprites) {
    this.sprites = sprites;
    this.objects = null;
    this.pieces = new Map();
    this.chunks = new Map();
  }

  // ================================================================================================================================================================================================================================================
  // index
  // Agrupa as peças de chão por bloco (refaz se a lista de objetos mudou).

  index(objects) {
    if (this.objects === objects) return;
    this.objects = objects;
    this.pieces.clear();
    this.chunks.clear();
    for (const obj of objects) {
      if (!obj.floorType || obj.hidden) continue;
      const key = this.keyOf(Math.floor(obj.z || 0), Math.floor(obj.x / CHUNK), Math.floor(obj.y / CHUNK));
      if (!this.pieces.has(key)) this.pieces.set(key, []);
      this.pieces.get(key).push(obj);
    }
  }

  // ================================================================================================================================================================================================================================================
  // keyOf

  keyOf(level, cx, cy) {
    return `${level}:${cx}:${cy}`;
  }

  // ================================================================================================================================================================================================================================================
  // build
  // Desenha o bloco: as peças de cada sqm na ordem da pilha, menos os sqms
  // com peça animada. null se alguma folha ainda não carregou (tenta de novo
  // no próximo quadro).

  build(key, cx, cy) {
    const size = CONFIG.tileSize;
    const pieces = this.pieces.get(key) || [];
    const sheets = new Map();
    const dynamic = new Set();
    for (const obj of pieces) {
      const sheet = this.sprites.getObjectSheet(obj.id);
      if (!isSheetReady(sheet)) return null;
      sheets.set(obj, sheet);
      if (sheet.totalFrames > 1) dynamic.add(`${obj.x},${obj.y}`);
    }
    const canvas = document.createElement('canvas');
    canvas.width = CHUNK * size;
    canvas.height = CHUNK * size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const sorted = pieces.filter(obj => !dynamic.has(`${obj.x},${obj.y}`))
      .sort((a, b) => (a.y - b.y) || (a.x - b.x) || ((a.order || 0) - (b.order || 0)));
    for (const obj of sorted) {
      const sheet = sheets.get(obj);
      const rect = sheet.getFrameRect('idle', 0, 1000);
      ctx.drawImage(sheet.image, rect.sx, rect.sy, rect.sw, rect.sh, (obj.x - cx * CHUNK) * size, (obj.y - cy * CHUNK) * size, size, size);
    }
    return { canvas, dynamic };
  }

  // ================================================================================================================================================================================================================================================
  // draw
  // Copia pra tela os blocos do andar level na área visível. Devolve os
  // blocos copiados (pra quem desenha saber quais pisos já estão na tela).

  draw(ctx, renderer, level, visible) {
    const drawn = new Map();
    const size = CONFIG.tileSize;
    for (let cy = Math.floor(visible.startY / CHUNK); cy <= Math.floor((visible.endY - 1) / CHUNK); cy++) {
      for (let cx = Math.floor(visible.startX / CHUNK); cx <= Math.floor((visible.endX - 1) / CHUNK); cx++) {
        const key = this.keyOf(level, cx, cy);
        if (!this.pieces.has(key)) continue;
        let chunk = this.chunks.get(key);
        if (!chunk) {
          chunk = this.build(key, cx, cy);
          if (!chunk) continue;
          this.chunks.set(key, chunk);
        }
        const base = renderer.gridToScreenWithOffset(cx * CHUNK, cy * CHUNK);
        ctx.drawImage(chunk.canvas, base.x, base.y, CHUNK * size, CHUNK * size);
        drawn.set(key, chunk);
      }
    }
    return drawn;
  }

  // ================================================================================================================================================================================================================================================
  // covers
  // A peça de chão já saiu num bloco copiado (drawn, de draw).

  covers(drawn, level, obj) {
    const chunk = drawn.get(this.keyOf(level, Math.floor(obj.x / CHUNK), Math.floor(obj.y / CHUNK)));
    return !!chunk && !chunk.dynamic.has(`${obj.x},${obj.y}`);
  }
}
