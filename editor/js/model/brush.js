// js/model/brush.js

import { state } from './state.js';
import { GRID } from '../config.js';
import { isStairsAccess, isEntranceType } from '../../../shared/assets.js';

// Pincel: ferramentas de pintar área usam um quadrado de brushSize × brushSize
// sqm (setas ↑/↓, de 1 a MAX_BRUSH); as de pôr uma coisa só, 1 sqm.
export const MAX_BRUSH = 6;
const BRUSH_TOOLS = new Set(['floor', 'eraser', 'border-eraser', 'safe', 'house']);
// Preencher área: essas ferramentas, com o botão Área ligado (state.areaFill) ou Shift, marcam um retângulo ao arrastar e,
// ao soltar, rodam em cada sqm dele (um clique sem arrastar pinta como o pincel); sem área, arrastar pinta por onde passa.
// Acessos: a entrada (buraco) usa pincel e área; a escada vai uma por vez.
export const FILL_TOOLS = new Set([...BRUSH_TOOLS, 'border', 'item', 'deco', 'wall']);

// ================================================================================================================================================================================================================================================
// brushSize
// Tamanho do pincel da ferramenta atual.

export function brushSize() {
  const entrance = state.tool === 'access' && !!state.accessPaint && isEntranceType(state.accessPaint);
  return BRUSH_TOOLS.has(state.tool) || entrance ? state.brushSize : 1;
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

// ================================================================================================================================================================================================================================================
// fillActive
// A ferramenta atual sabe preencher área.

export function fillActive() {
  if (state.tool === 'access') return !!state.accessPaint && !isStairsAccess(state.accessPaint);
  return FILL_TOOLS.has(state.tool);
}

// ================================================================================================================================================================================================================================================
// areaCells
// Os sqm do retângulo entre os dois cantos { x0, y0, x1, y1 } (em qualquer ordem), dentro do mapa.

export function areaCells(area) {
  const cells = [];
  const minX = Math.max(0, Math.min(area.x0, area.x1));
  const maxX = Math.min(GRID - 1, Math.max(area.x0, area.x1));
  const minY = Math.max(0, Math.min(area.y0, area.y1));
  const maxY = Math.min(GRID - 1, Math.max(area.y0, area.y1));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) cells.push({ x, y });
  }
  return cells;
}

// ================================================================================================================================================================================================================================================
// areaDrag
// Arrastar marca área (botão Área ligado ou Shift, um inverte o outro) em vez de pintar por onde passa.

export function areaDrag(shift = false) {
  return !!state.areaFill !== !!shift && fillActive();
}
