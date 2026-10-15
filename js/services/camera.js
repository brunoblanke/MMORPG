// js/services/camera.js

import { CONFIG } from '../config.js';

// ================================================================================================================================================================================================================================================
// viewSize
// O tamanho da tela do jogo em pixels de CSS (o canvas tem mais pixels que isso quando o zoom ou a tela pedem, devicePixelRatio): é nele que o jogo desenha e calcula.

export function viewSize(canvas) {
  const scale = canvas.pixelScale || 1;
  return { width: canvas.width / scale, height: canvas.height / scale };
}

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.tileSize = CONFIG.tileSize;
    this.offset = { x: 0, y: 0 };
    this.target = { x: 0, y: 0 };
  }

  // ================================================================================================================================================================================================================================================
  // update
  // Centra no player. O deslocamento é em pixel inteiro (em meio pixel os
  // sprites borravam as bordas e apareciam frestas entre os sqms) e segue o
  // pixel em que o player é desenhado, pra ele não tremer em relação ao mapa.

  update(player) {
    const px = (player && player.renderX !== undefined) ? player.renderX : 0;
    const py = (player && player.renderY !== undefined) ? player.renderY : 0;
    const pos = this.gridToScreen(px, py);
    const view = viewSize(this.canvas);
    this.target = { x: px, y: py };
    this.offset = {
      x: Math.round(view.width / 2 - this.tileSize / 2) - Math.round(pos.x),
      y: Math.round(view.height / 2 - this.tileSize / 2) - Math.round(pos.y)
    };
  }

  // ================================================================================================================================================================================================================================================
  // gridToScreen

  gridToScreen(x, y) {
    return {
      x: x * this.tileSize,
      y: y * this.tileSize
    };
  }

  // ================================================================================================================================================================================================================================================
  // gridToScreenWithOffset

  gridToScreenWithOffset(x, y) {
    const base = this.gridToScreen(x, y);
    return {
      x: base.x + this.offset.x,
      y: base.y + this.offset.y
    };
  }

  // ================================================================================================================================================================================================================================================
  // screenToGrid

  screenToGrid(screenX, screenY) {
    const gridX = (screenX - this.offset.x) / this.tileSize;
    const gridY = (screenY - this.offset.y) / this.tileSize;
    return { x: Math.floor(gridX), y: Math.floor(gridY) };
  }

  // ================================================================================================================================================================================================================================================
  // getOffset

  getOffset() {
    return this.offset;
  }

  // ================================================================================================================================================================================================================================================
  // getTarget

  getTarget() {
    return this.target;
  }

  // ================================================================================================================================================================================================================================================
  // getVisibleTiles

  getVisibleTiles() {
    const size = this.tileSize;
    const view = viewSize(this.canvas);
    const startX = Math.max(0, Math.floor(-this.offset.x / size) - 1);
    const endX = Math.min(CONFIG.mapWidth, Math.ceil((view.width - this.offset.x) / size) + 1);
    const startY = Math.max(0, Math.floor(-this.offset.y / size) - 1);
    const endY = Math.min(CONFIG.mapHeight, Math.ceil((view.height - this.offset.y) / size) + 1);
    return { startX, endX, startY, endY };
  }

  // ================================================================================================================================================================================================================================================
  // getPathfindingBounds

  getPathfindingBounds(margin = 10) {
    const visible = this.getVisibleTiles();
    return {
      minX: Math.max(0, visible.startX - margin),
      maxX: Math.min(CONFIG.mapWidth, visible.endX + margin),
      minY: Math.max(0, visible.startY - margin),
      maxY: Math.min(CONFIG.mapHeight, visible.endY + margin)
    };
  }

  // ================================================================================================================================================================================================================================================
  // resize

  // A tela do jogo ocupa a janela toda; as colunas de janelas ficam por cima
  // dela (css/inventory.css). O canvas ganha pixels de verdade (devicePixelRatio), pra não
  // borrar com zoom ou tela de alta densidade.

  resize() {
    const scale = window.devicePixelRatio || 1;
    this.canvas.pixelScale = scale;
    this.canvas.width = Math.round((this.canvas.clientWidth || window.innerWidth) * scale);
    this.canvas.height = Math.round((this.canvas.clientHeight || window.innerHeight) * scale);
  }
}
