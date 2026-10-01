// js/input/input.js

import { CONFIG } from '../config.js';
import { getRoofLevel } from '../views/draw-order.js';
import { getEntityLevel, getLevel } from '../core/geometry.js';
import { objectUse, objectIdType } from '../../shared/assets.js';
import { itemInfo } from '../../shared/items.js';

const KEY_DIRECTIONS = {
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
  q: [-1, -1], e: [1, -1], z: [-1, 1], c: [1, 1]
};

export class InputController {
  constructor(canvas, renderer, camera, eventManager, game) {
    this.game = game;
    this.canvas = canvas;
    this.renderer = renderer;
    this.camera = camera;
    this.eventManager = eventManager;
    this.keysPressed = {};
    this.walkDir = null;
    this.hoverTile = null;
    this.hoverEnemy = null;
    this.hoverObject = null;
    this.hoverCorpse = null;
    this.hoverMovable = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.draggingCandidate = null;
    this.dragStartMouse = null;
    this.dragOccurred = false;
    this.suppressNextClick = false;

    const self = this;

    window.addEventListener("keydown", function(e) {
      self.handleKeyDown(e);
    });

    window.addEventListener("keyup", function(e) {
      self.handleKeyUp(e);
    });

    window.addEventListener("blur", function() {
      self.keysPressed = {};
      self.sendWalkDir(false);
    });

    this.eventManager.on('mousemove', function(data) {
      self.mouseX = data.mouseX;
      self.mouseY = data.mouseY;
    });
  }

  // ================================================================================================================================================================================================================================================
  // getKeyDirection
  // Direção da primeira tecla apertada (w/a/s/d e diagonais q/e/z/c), ou null.

  getKeyDirection() {
    for (const key in this.keysPressed) {
      if (this.keysPressed[key] && KEY_DIRECTIONS[key]) {
        const [dx, dy] = KEY_DIRECTIONS[key];
        return { dx, dy };
      }
    }
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // sendWalkDir
  // Manda a direção das teclas quando ela muda (ou quando uma tecla nova é apertada).

  sendWalkDir(force) {
    const dir = this.getKeyDirection();
    const same = (dir === null && this.walkDir === null) ||
      (dir && this.walkDir && dir.dx === this.walkDir.dx && dir.dy === this.walkDir.dy);
    if (same && !force) return;
    this.walkDir = dir;
    this.game.send({ type: 'walkDir', dx: dir ? dir.dx : 0, dy: dir ? dir.dy : 0 });
  }

  // ================================================================================================================================================================================================================================================
  // handleKeyDown

  handleKeyDown(e) {
    const key = e.key.toLowerCase();
    if (!KEY_DIRECTIONS[key]) return;
    e.preventDefault();
    if (this.keysPressed[key]) return;
    this.keysPressed[key] = true;
    this.sendWalkDir(true);
  }

  // ================================================================================================================================================================================================================================================
  // handleKeyUp

  handleKeyUp(e) {
    const key = e.key.toLowerCase();
    if (!KEY_DIRECTIONS[key]) return;
    this.keysPressed[key] = false;
    this.sendWalkDir(false);
  }

  // ================================================================================================================================================================================================================================================
  // handleClick

  handleClick(e) {
    if (this.suppressNextClick) {
      return { type: 'none' };
    }

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const gridPos = this.camera.screenToGrid(mouseX, mouseY);
    return { type: 'click', gridPos: gridPos, mouseX: mouseX, mouseY: mouseY };
  }

  // ================================================================================================================================================================================================================================================
  // updateHoverEnemy

updateHoverEnemy(enemies, world, offset, player, deadBodies) {
  if (!this.hoverTile) {
    this.hoverEnemy = null;
    this.hoverObject = null;
    this.hoverCorpse = null;
    this.hoverMovable = null;
    return;
  }

  this.hoverEnemy = null;
  this.hoverObject = null;
  this.hoverCorpse = null;
  this.hoverMovable = null;

  // O que está acima do teto do player não aparece na tela, então não pode ser apontado.
  const roofLevel = getRoofLevel(player, world);
  const isVisible = (e) => getEntityLevel(e) <= roofLevel;
  const byTopmost = (a, b) => (getEntityLevel(b) - getEntityLevel(a)) || ((b.order || 0) - (a.order || 0));

  // Pilha do sqm (itens e cadáveres juntos, na ordem em que foram parar ali):
  // o de cima é o apontado; o de cima que dá pra mover pode ser arrastado
  // mesmo com um player ou inimigo em cima dele.
  const tileX = this.hoverTile.x;
  const tileY = this.hoverTile.y;
  const corpsesOnTile = (deadBodies || []).filter(c => c.x === tileX && c.y === tileY && isVisible(c));
  const objectsOnTile = world.getObjectsAt(tileX, tileY).filter(o =>
    isVisible(o) && !o.isBorder &&
    (o.hasVolume || o.blocksMovement || o.movable === true || o.floorType || objectUse(objectIdType(o.id)) || itemInfo(objectIdType(o.id)).size > 0)
  );
  const stack = [...corpsesOnTile, ...objectsOnTile].sort(byTopmost);
  this.hoverMovable = stack.find(o => (o.isCorpse ? o.movable !== false : o.movable === true)) || null;

  const playerLevel = getLevel(player);
  const enemiesSorted = enemies.filter(e => getLevel(e) === playerLevel).sort(byTopmost);
  for (const enemy of enemiesSorted) {
    if (this.renderer.isPointInCube(
      this.mouseX, this.mouseY,
      enemy.renderX, enemy.renderY,
      offset, enemy.z || 0, enemy.step || 0
    )) {
      this.hoverEnemy = enemy;
      return;
    }
  }

  const top = stack[0];
  if (!top) return;
  if (top.isCorpse) this.hoverCorpse = top;
  else this.hoverObject = top;
}

  // ================================================================================================================================================================================================================================================
  // handleMouseDown

  handleMouseDown(e) {
    if (e.button !== 0) return;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.dragStartMouse = { x: mouseX, y: mouseY };
    this.dragOccurred = false;

    this.draggingCandidate = this.hoverMovable;
  }

  // ================================================================================================================================================================================================================================================
  // handleMouseUp

  handleMouseUp(e) {
    if (this.draggingCandidate && this.dragOccurred) {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const gridPos = this.camera.screenToGrid(mouseX, mouseY);

      if (gridPos.x >= 0 && gridPos.x < CONFIG.mapWidth &&
          gridPos.y >= 0 && gridPos.y < CONFIG.mapHeight) {
        // Solta no andar do piso que aparece sob o mouse; sem piso visível, cancela.
        const targetZ = this.game.getVisibleFloorAt(gridPos.x, gridPos.y);
        if (targetZ !== null) {
          this.game.send({ type: 'moveItem', itemId: this.draggingCandidate.id, x: gridPos.x, y: gridPos.y, z: targetZ });
        }
      }

      this.suppressNextClick = true;
      setTimeout(() => { this.suppressNextClick = false; }, 0);
    }

    this.draggingCandidate = null;
    this.dragOccurred = false;
    this.dragStartMouse = null;
  }

  // ================================================================================================================================================================================================================================================
  // handleMouseMove

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;

    if (this.draggingCandidate && this.dragStartMouse) {
      const dx = this.mouseX - this.dragStartMouse.x;
      const dy = this.mouseY - this.dragStartMouse.y;
      if (Math.sqrt(dx * dx + dy * dy) > 6) {
        this.dragOccurred = true;
      }
    }

    const gridPos = this.camera.screenToGrid(this.mouseX, this.mouseY);

    if (gridPos.x >= 0 && gridPos.x < CONFIG.mapWidth &&
        gridPos.y >= 0 && gridPos.y < CONFIG.mapHeight) {
      this.hoverTile = { x: gridPos.x, y: gridPos.y };
    } else {
      this.hoverTile = null;
      this.hoverEnemy = null;
      this.hoverObject = null;
      this.hoverCorpse = null;
      this.hoverMovable = null;
    }
  }
}
