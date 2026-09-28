// js/model/brush.js

import { state } from './state.js';
import { GRID } from '../config.js';

// Pincel: ferramentas de pintar área usam um quadrado de brushSize × brushSize
// sqm (setas ↑/↓, de 1 a MAX_BRUSH); as de pôr uma coisa só, 1 sqm.
export const MAX_BRUSH = 6;
const BRUSH_TOOLS = new Set(['floor', 'eraser', 'hole', 'border-eraser', 'safe']);

// ================================================================================================================================================================================================================================================
// brushSize
// Tamanho do pincel da ferramenta atual.

export function brushSize() {
  return BRUSH_TOOLS.has(state.tool) ? state.brushSize : 1;
}

// ================================================================================================================================================================================================================================================
// brushCells
// Os sqm que o pincel cobre com o mouse em (x, y): o quadrado centrado nele
// (tamanho par: ele fica no quadrado de cima à esquerda do centro).

export function brushCells(x, y) {
  const size = brushSize();
  const start = Math.floor((size - 1) / 2);
  const cells = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const cx = x - start + dx;
      const cy = y - start + dy;
      if (cx >= 0 && cy >= 0 && cx < GRID && cy < GRID) cells.push({ x: cx, y: cy });
    }
  }
  return cells;
}
