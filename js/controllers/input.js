import { calculateMoveDelay } from '../utils/helpers.js';
import { CONFIG } from '../config.js';
import { getEntityLevel, getRoofLevel } from '../views/draw-order.js';

export class InputController {
  constructor(canvas, renderer, camera, eventManager, game) {
    this.game = game;
    this.canvas = canvas;
    this.renderer = renderer;
    this.camera = camera;
    this.eventManager = eventManager;
    this.keysPressed = {};
    this.targetTile = null;
    this.pathToTarget = [];
    this.isMovingToTarget = false;
    this.hoverTile = null;
    this.hoverEnemy = null;
    this.hoverObject = null;
    this.hoverCorpse = null;
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

    this.eventManager.on('mousemove', function(data) {
      self.mouseX = data.mouseX;
      self.mouseY = data.mouseY;
    });
  }

  // ================================================================================================================================================================================================================================================
  // clearTarget

  clearTarget() {
    this.targetTile = null;
    this.pathToTarget = [];
    this.isMovingToTarget = false;
  }

  // ================================================================================================================================================================================================================================================
// handleKeyDown

handleKeyDown(e) {
  const key = e.key.toLowerCase();
  if ("wasdqezc".indexOf(key) !== -1) {
    e.preventDefault();
    this.keysPressed[key] = true;
    this.clearTarget();
    if (this.game.movementController && this.game.selectedEnemy) {
      this.game.movementController.autoFollow = false;
      console.log('⌨️ Auto-follow desligado por TECLA:', key);
    }
  }
}

  // ================================================================================================================================================================================================================================================
  // handleKeyUp

  handleKeyUp(e) {
    const key = e.key.toLowerCase();
    if ("wasdqezc".indexOf(key) !== -1) {
      this.keysPressed[key] = false;
    }
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

    const btnSize = 40;
    const btnPadding = 20;
    const btnX = this.canvas.width - btnSize - btnPadding;
    const btnY = btnPadding;

    if (mouseX >= btnX && mouseX <= btnX + btnSize &&
        mouseY >= btnY && mouseY <= btnY + btnSize) {
      return { type: 'toggle_follow' };
    }

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
    return;
  }

  this.hoverEnemy = null;
  this.hoverObject = null;
  this.hoverCorpse = null;

  // O que está acima do teto do player não aparece na tela, então não pode ser apontado.
  const roofLevel = getRoofLevel(player, world);
  const isVisible = (e) => getEntityLevel(e) <= roofLevel;
  const byTopmost = (a, b) => (getEntityLevel(b) - getEntityLevel(a)) || ((b.order || 0) - (a.order || 0));

  const enemiesSorted = enemies.filter(isVisible).sort(byTopmost);
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

  const tileX = this.hoverTile.x;
  const tileY = this.hoverTile.y;

  if (deadBodies && deadBodies.length) {
    const corpsesOnTile = deadBodies.filter(c => c.x === tileX && c.y === tileY && isVisible(c));
    if (corpsesOnTile.length > 0) {
      corpsesOnTile.sort(byTopmost);
      this.hoverCorpse = corpsesOnTile[0];
      return;
    }
  }

  const objectsOnTile = world.getObjectsAt(tileX, tileY).filter(o =>
    isVisible(o) && !o.isBorder &&
    (o.hasVolume || o.blocksMovement || o.movable === true || o.floorType)
  );

  if (objectsOnTile.length > 0) {
    objectsOnTile.sort(byTopmost);
    this.hoverObject = objectsOnTile[0];
  }
}

  // ================================================================================================================================================================================================================================================
  // handleMouseDown

  handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    this.dragStartMouse = { x: mouseX, y: mouseY };
    this.dragOccurred = false;

    console.log('Hover - Object:', this.hoverObject?.id, 'Corpse:', this.hoverCorpse?.type);

    if (this.hoverObject && this.hoverObject.movable !== false) {
      this.draggingCandidate = this.hoverObject;
    } else if (this.hoverCorpse && this.hoverCorpse.movable !== false) {
      this.draggingCandidate = this.hoverCorpse;
      console.log('Dragging corpse:', this.hoverCorpse.type);
    } else {
      this.draggingCandidate = null;
    }
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
        const gc = this.game;
        // Solta no andar do piso que aparece sob o mouse; sem piso visível, cancela.
        const targetZ = gc.getVisibleFloorAt(gridPos.x, gridPos.y);
        if (targetZ !== null) {
          if (gc.objectDrag.isPlayerNear(this.draggingCandidate)) {
            gc.moveObject(this.draggingCandidate, gridPos.x, gridPos.y, targetZ);
          } else {
            gc.startDragMoveToObject(this.draggingCandidate, gridPos.x, gridPos.y, targetZ);
          }
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
    }
  }

  // ================================================================================================================================================================================================================================================
  // setTarget
  // Leva o player até o sqm (x, y) do andar z — o caminho pode trocar de andar
  // por pilha, escada e buraco. Sem caminho, o player fica onde está.

  setTarget(x, y, z, movementController, player) {
    if (player.x === x && player.y === y && (player.z || 0) === z) return;

    if (movementController.isBlocked(x, y, z)) {
      console.log("❌ Tile bloqueado");
      return;
    }

    if (this.game.selectedEnemy) {
      movementController.autoFollow = false;
    }

    this.targetTile = { x, y, z };

    const start = { x: player.x, y: player.y, z: player.z || 0, step: player.step || 0 };
    this.pathToTarget = movementController.findPath(start, this.targetTile);

    if (this.pathToTarget.length === 0) {
      console.log("❌ Nenhum caminho encontrado para este destino");
      this.clearTarget();
      return;
    }

    this.isMovingToTarget = true;
    console.log(`✅ Caminho criado com ${this.pathToTarget.length} passos até (${x},${y}) andar ${z}`);
  }

  // ================================================================================================================================================================================================================================================
  // moveTowardsTarget

  moveTowardsTarget(player, movementController, timestamp) {
    if (!this.pathToTarget || this.pathToTarget.length === 0) {
      this.isMovingToTarget = false;
      return;
    }

    const moveDelay = calculateMoveDelay(player.spd);
    const timeSinceLastMove = timestamp - player.lastMoveTime;

    if (timeSinceLastMove < moveDelay) return;

    // Se o mapa mudou (volume arrastado, inimigo no caminho…) e o passo não
    // termina mais onde o caminho previa, recalcula até o mesmo destino.
    const nextStep = this.pathToTarget[0];
    const current = { x: player.x, y: player.y, z: player.z || 0, step: player.step || 0 };
    const predicted = movementController.simulateMove(current, nextStep.dx, nextStep.dy);
    if (!predicted || predicted.x !== nextStep.x || predicted.y !== nextStep.y || predicted.z !== nextStep.z) {
      const { x, y, z } = this.targetTile;
      this.setTarget(x, y, z, movementController, player);
      return;
    }

    const success = movementController.moveEntity(player, nextStep.dx, nextStep.dy, timestamp);

    if (success) {
      this.pathToTarget.shift();
      if (this.pathToTarget.length === 0) {
        this.isMovingToTarget = false;
      }
    } else {
      this.clearTarget();
    }
  }

  // ================================================================================================================================================================================================================================================
  // handlePlayerMovement

  handlePlayerMovement(player, movementController, timestamp) {
    if (this.isMovingToTarget) {
      this.moveTowardsTarget(player, movementController, timestamp);
    } else {
      const moves = {
        w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
        q: [-1, -1], e: [1, -1], z: [-1, 1], c: [1, 1]
      };

      for (const key in this.keysPressed) {
        if (this.keysPressed[key] && moves[key]) {
          movementController.moveEntity(player, moves[key][0], moves[key][1], timestamp);
          break;
        }
      }
    }
  }
}