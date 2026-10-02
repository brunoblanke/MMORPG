// js/services/camera.js

import { CONFIG } from '../config.js';

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.tileSize = CONFIG.tileSize;
    this.offset = { x: 0, y: 0 };
    this.target = { x: 0, y: 0 };
  }

  // ================================================================================================================================================================================================================================================
  // update

  update(player) {
    const px = (player && player.renderX !== undefined) ? player.renderX : 0;
    const py = (player && player.renderY !== undefined) ? player.renderY : 0;
    const pos = this.gridToScreen(px, py);
    this.target = { x: px, y: py };
    this.offset = {
      x: this.canvas.width / 2 - pos.x - this.tileSize / 2,
      y: this.canvas.height / 2 - pos.y - this.tileSize / 2
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
    const startX = Math.max(0, Math.floor(-this.offset.x / size) - 1);
    const endX = Math.min(CONFIG.mapWidth, Math.ceil((this.canvas.width - this.offset.x) / size) + 1);
    const startY = Math.max(0, Math.floor(-this.offset.y / size) - 1);
    const endY = Math.min(CONFIG.mapHeight, Math.ceil((this.canvas.height - this.offset.y) / size) + 1);
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

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
}
