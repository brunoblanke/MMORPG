// js/views/minimap.js

import { getAsset, splitType, objectIdType } from '../../shared/assets.js';
import { getImage } from '../../shared/image-loader.js';

// Mini mapa (o item com Uso "mapa" abre): o andar do player em volta dele, MINIMAP_RADIUS sqm pra cada lado, um
// ponto por sqm na cor do que está lá (o que bloqueia, senão o piso; a cor média do desenho da folha) e o player em
// branco no meio. Só informativo.

export const MINIMAP_RADIUS = 50;
export const MINIMAP_CELL = 2;
export const MINIMAP_SIZE = (MINIMAP_RADIUS * 2 + 1) * MINIMAP_CELL;
const EMPTY = '#000000';
const PLAYER = '#ffffff';
const colors = new Map();

// ================================================================================================================================================================================================================================================
// minimapCells
// As cores da grade (2 × radius + 1 de lado, linha por linha), com colorOf(tipo) dando a cor de cada folha.

export function minimapCells(world, player, colorOf, radius = MINIMAP_RADIUS) {
  const z = player.z || 0;
  const cells = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = player.x + dx;
      const y = player.y + dy;
      if (!dx && !dy) {
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
// Desenha o mini mapa no canvas.

export function drawMinimap(canvas, world, player) {
  const ctx = canvas.getContext('2d');
  const side = MINIMAP_RADIUS * 2 + 1;
  const cells = minimapCells(world, player, sheetColor);
  for (let i = 0; i < cells.length; i++) {
    ctx.fillStyle = cells[i];
    ctx.fillRect((i % side) * MINIMAP_CELL, Math.floor(i / side) * MINIMAP_CELL, MINIMAP_CELL, MINIMAP_CELL);
  }
}
