// js/views/minimap.js

import { getAsset, splitType, objectIdType } from '../../shared/assets.js';
import { getImage } from '../../shared/image-loader.js';

// Mini mapa (o item com Uso "mapa" abre): o andar do player, MINIMAP_COLS × MINIMAP_ROWS sqm (16:9) em volta do centro
// (o player, deslocado pelo arrasto), um ponto por sqm na cor do que está lá (o que bloqueia, senão o piso; a cor média
// do desenho da folha) e o player em branco. Só informativo.

export const MINIMAP_COLS = 161;
export const MINIMAP_ROWS = 91;
export const MINIMAP_CELL = 2;
export const MINIMAP_WIDTH = MINIMAP_COLS * MINIMAP_CELL;
export const MINIMAP_HEIGHT = MINIMAP_ROWS * MINIMAP_CELL;
const EMPTY = '#000000';
const PLAYER = '#ffffff';
const colors = new Map();

// ================================================================================================================================================================================================================================================
// minimapCells
// As cores da grade (cols × rows, linha por linha) centrada em center ({x, y}), no andar do player, com colorOf(tipo)
// dando a cor de cada folha.

export function minimapCells(world, player, colorOf, center = player, cols = MINIMAP_COLS, rows = MINIMAP_ROWS) {
  const z = player.z || 0;
  const left = center.x - Math.floor(cols / 2);
  const top = center.y - Math.floor(rows / 2);
  const cells = [];
  for (let y = top; y < top + rows; y++) {
    for (let x = left; x < left + cols; x++) {
      if (x === player.x && y === player.y) {
        cells.push(PLAYER);
        continue;
      }
      const blocker = world.hasBlockerAt(x, y, z) ? world.getObjectsAt(x, y).find(obj => (obj.z || 0) === z && obj.blocksMovement && !obj.floorType) : null;
      const floor = world.topFloors.get(world.getTileKey(x, y, z));
      const type = blocker ? objectIdType(blocker.id) : floor ? floor.floorType : null;
      cells.push(type ? colorOf(type) : EMPTY);
    }
  }
  return cells;
}

// ================================================================================================================================================================================================================================================
// sheetColor
// A cor média dos pixels visíveis da folha do tipo (guardada); enquanto a imagem não carregou, cinza.

export function sheetColor(type) {
  const asset = getAsset(splitType(type).asset);
  if (!asset) return EMPTY;
  if (colors.has(asset.id)) return colors.get(asset.id);
  const image = getImage(asset.url);
  if (!image.complete || !image.naturalWidth) return '#555555';
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, 16, 16);
  const data = ctx.getImageData(0, 0, 16, 16).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  const color = n ? `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})` : EMPTY;
  colors.set(asset.id, color);
  return color;
}

// ================================================================================================================================================================================================================================================
// drawMinimap
// Desenha o mini mapa no canvas, com o centro deslocado offset ({x, y} em sqm) do player.

export function drawMinimap(canvas, world, player, offset = { x: 0, y: 0 }) {
  const ctx = canvas.getContext('2d');
  const cells = minimapCells(world, player, sheetColor, { x: player.x + offset.x, y: player.y + offset.y });
  for (let i = 0; i < cells.length; i++) {
    ctx.fillStyle = cells[i];
    ctx.fillRect((i % MINIMAP_COLS) * MINIMAP_CELL, Math.floor(i / MINIMAP_COLS) * MINIMAP_CELL, MINIMAP_CELL, MINIMAP_CELL);
  }
}
