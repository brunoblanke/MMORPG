// js/controllers/game.js

import { CONFIG } from '../config.js';
import { World } from '../core/world.js';
import { Camera } from '../services/camera.js';
import { EventManager } from '../services/event-manager.js';
import { LevelLoader } from '../services/level-loader.js';
import { SpriteLoader } from '../services/sprite-loader.js';
import { Renderer } from '../views/renderer.js';
import { getSpritePaths } from '../views/sprite-registry.js';
import { UI } from '../views/ui.js';
import { getAdjacentPositions } from '../utils/helpers.js';
import { getRoofLevel } from '../views/draw-order.js';
import { Player } from '../models/player.js';
import { MovementController } from './movement.js';
import { EnemyAI } from './enemy-ai.js';
import { CombatController } from './combat.js';
import { ParticleController } from './particle-controller.js';
import { InputController } from './input.js';
import { ObjectDragController } from './object-drag.js';
import { LifeCycleController } from './life-cycle.js';

export class GameController {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.camera = new Camera(this.canvas);
    this.eventManager = new EventManager();
    this.world = new World();
    this.levelLoader = new LevelLoader();
    this.spriteLoader = new SpriteLoader();
    this.renderer = new Renderer(this.canvas, this.camera);
    this.ui = new UI();
    this.particleController = new ParticleController();

    this.devMode = CONFIG.devMode !== undefined ? CONFIG.devMode : false;
    this.renderer.setDevMode(this.devMode);
    this.statusMessage = null;

    this.boot();
  }

  // ================================================================================================================================================================================================================================================
  // boot

  boot() {
    const spritesReady = this.loadSprites();
    const mapReady = this.levelLoader.loadFromURL(CONFIG.mapDataUrl).catch((error) => {
      console.error('❌ Erro ao carregar mapa:', error);
    });

    Promise.all([spritesReady, mapReady]).then(() => {
      this.initializeGame();
      this.setupEventListeners();
      this.start();
    });
  }

  // ================================================================================================================================================================================================================================================
  // loadSprites

  loadSprites() {
    return this.spriteLoader.loadAll(getSpritePaths()).catch((error) => {
      console.error('❌ Erro ao carregar sprites:', error);
    });
  }

  // ================================================================================================================================================================================================================================================
  // initializeGame

  initializeGame() {
    this.objects = this.levelLoader.getObjects();
    this.enemies = this.levelLoader.getEnemies();

    const spawn = this.levelLoader.getSpawn({ x: 132, y: 145, z: 0 });
    this.player = new Player({ x: spawn.x, y: spawn.y, z: spawn.z, lvl: 10 });

    this.world.load(this.objects);
    for (const enemy of this.enemies) this.world.addCreature(enemy);
    this.world.addCreature(this.player);

    this.movementController = new MovementController(this.world);
    this.movementController.onNoPath = (timestamp) => this.showMessage("Não há caminho", timestamp);
    this.enemyAI = new EnemyAI(this.movementController);
    this.combatController = new CombatController();
    this.inputController = new InputController(this.canvas, this.renderer, this.camera, this.eventManager, this);
    this.objectDrag = new ObjectDragController(this);
    this.lifeCycle = new LifeCycleController(this);

    this.selectedEnemy = null;
    this.deadBodies = [];
  }

  // ================================================================================================================================================================================================================================================
  // setupEventListeners

  setupEventListeners() {
    const self = this;

    this.eventManager.setupCanvasEvents(this.canvas, this.camera);

    this.eventManager.on('click', function(data) {
      const mouseX = data.mouseX;
      const mouseY = data.mouseY;

      if (self.ui.isDevButtonClicked(mouseX, mouseY)) {
        self.toggleDevMode();
        return;
      }

      const clickData = self.inputController.handleClick(data.event);

      if (clickData.type === 'toggle_follow') {
        self.movementController.toggleAutoFollow();
        return;
      }

      if (clickData.type === 'click') {
        self.handleGameClick(clickData.gridPos);
      }
    });

    this.eventManager.on('mousemove', function(data) {
      self.inputController.handleMouseMove(data.event);
    });

    this.eventManager.on('mousedown', function(data) {
      self.inputController.handleMouseDown(data.event);
    });

    this.eventManager.on('mouseup', function(data) {
      self.inputController.handleMouseUp(data.event);
    });

    window.addEventListener('resize', function() {
      self.camera.resize();
    });
  }

  // ================================================================================================================================================================================================================================================
  // showMessage

  showMessage(text, timestamp, duration = 2000) {
    this.statusMessage = { text, expiresAt: timestamp + duration };
  }

  // ================================================================================================================================================================================================================================================
  // toggleDevMode

  toggleDevMode() {
    this.devMode = !this.devMode;
    this.renderer.setDevMode(this.devMode);
    console.log(`🛠️ Modo Dev: ${this.devMode ? 'ATIVADO' : 'DESATIVADO'}`);
  }

  // ================================================================================================================================================================================================================================================
  // handleGameClick

  handleGameClick(gridPos) {
    if (this.trySelectEnemyAtMouse()) return;
    if (!this.movementController.isInsideMap(gridPos.x, gridPos.y)) return;

    const playerFloor = this.player.z || 0;
    const floor = this.getVisibleFloorAt(gridPos.x, gridPos.y) ?? playerFloor;

    if (gridPos.x === this.player.x && gridPos.y === this.player.y && floor === playerFloor) {
      this.stepDownFromCurrentTile();
      return;
    }

    this.inputController.setTarget(gridPos.x, gridPos.y, floor, this.movementController, this.player);
  }

  // ================================================================================================================================================================================================================================================
  // getVisibleFloorAt
  // Andar do piso que aparece no sqm (x, y) — todos os andares são desenhados
  // na mesma posição de tela, então vale o mais alto que não está escondido
  // sob o teto do player. Escada/buraco contam como piso. null se não há nada.

  getVisibleFloorAt(x, y) {
    const roofLevel = getRoofLevel(this.player, this.world);
    let best = null;
    for (const obj of this.world.getObjectsAt(x, y)) {
      if (obj.isBorder) continue;
      const z = obj.z ?? 0;
      const isGround = obj.floorType || this.world.getTransitionAt(x, y, z) === obj;
      if (isGround && z <= roofLevel && (best === null || z > best)) best = z;
    }
    return best;
  }

  // ================================================================================================================================================================================================================================================
  // trySelectEnemyAtMouse
  // Clique em inimigo alterna a seleção de alvo. Retorna true se o clique acertou um inimigo.

  trySelectEnemyAtMouse() {
    const offset = this.camera.getOffset();

    for (const enemy of this.enemies) {
      if (!enemy.isAlive()) continue;
      const hit = this.renderer.isPointInCube(
        this.inputController.mouseX,
        this.inputController.mouseY,
        enemy.renderX,
        enemy.renderY,
        offset,
        enemy.z || 0,
        enemy.step || 0
      );
      if (!hit) continue;

      if (this.selectedEnemy === enemy) {
        this.selectedEnemy = null;
        enemy.isTarget = false;
        console.log(`🎯 Alvo desmarcado: ${enemy.id}`);
      } else {
        if (this.selectedEnemy) {
          this.selectedEnemy.isTarget = false;
        }
        this.selectedEnemy = enemy;
        enemy.isTarget = true;
        this.movementController.autoFollow = true;
        console.log(`🎯 Alvo selecionado: ${enemy.id}`);
      }
      return true;
    }

    return false;
  }

  // ================================================================================================================================================================================================================================================
  // stepDownFromCurrentTile
  // Clique no próprio tile com o player em cima de algo: desce pro vizinho mais baixo.

  stepDownFromCurrentTile() {
    const playerStep = this.player.step || 0;
    if (playerStep <= 0) return;

    const floor = this.player.z || 0;
    let bestAdjacentTile = null;
    let bestStep = playerStep;

    for (const pos of getAdjacentPositions(this.player.x, this.player.y)) {
      if (!this.movementController.isInsideMap(pos.x, pos.y)) continue;
      const adjStep = this.movementController.getPassableStep(pos.x, pos.y, floor, playerStep);
      if (adjStep !== null && adjStep < bestStep) {
        bestStep = adjStep;
        bestAdjacentTile = { x: pos.x, y: pos.y, step: adjStep };
      }
    }

    if (bestAdjacentTile) {
      this.inputController.setTarget(bestAdjacentTile.x, bestAdjacentTile.y, floor, this.movementController, this.player);
    }
  }

  // ================================================================================================================================================================================================================================================
  // startDragMoveToObject

  startDragMoveToObject(obj, targetX, targetY, targetZ) {
    this.objectDrag.startDragMoveToObject(obj, targetX, targetY, targetZ);
  }

  // ================================================================================================================================================================================================================================================
  // moveObject

  moveObject(obj, targetX, targetY, targetZ) {
    this.objectDrag.moveObject(obj, targetX, targetY, targetZ);
  }

  // ================================================================================================================================================================================================================================================
  // updateAnimations

  updateAnimations(timestamp) {
    this.player.updateAnimation(timestamp);
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].updateAnimation(timestamp);
    }
  }

  // ================================================================================================================================================================================================================================================
  // update

  update(timestamp) {
    this.updateAnimations(timestamp);
    this.particleController.update(timestamp);
    this.lifeCycle.processCorpseDecay(timestamp);

    if (this.statusMessage && timestamp >= this.statusMessage.expiresAt) {
      this.statusMessage = null;
    }

    const offset = this.camera.getOffset();
    this.inputController.updateHoverEnemy(
      this.enemies,
      this.world,
      offset,
      this.player,
      this.deadBodies
    );
    this.inputController.handlePlayerMovement(this.player, this.movementController, timestamp);
    this.objectDrag.checkPendingDrag();

    const searchBounds = this.camera.getPathfindingBounds();
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemyAI.update(this.enemies[i], this.player, this.enemies, timestamp, searchBounds);
    }

    this.combatController.processCombat(
      this.player,
      this.selectedEnemy,
      this.enemies,
      timestamp,
      this.renderer,
      this.movementController,
      offset,
      this.particleController,
      this.camera
    );

    this.movementController.checkFloorTransitions([this.player, ...this.enemies]);

    this.lifeCycle.processDeaths();
  }

  // ================================================================================================================================================================================================================================================
  // render

  render() {
    const gameState = {
      player: this.player,
      enemies: this.enemies,
      objects: this.objects,
      world: this.world,
      deadBodies: this.deadBodies,
      selectedEnemy: this.selectedEnemy,
      inputController: this.inputController,
      combatController: this.combatController,
      movementController: this.movementController,
      statusMessage: this.statusMessage
    };
    this.renderer.render(gameState, this.ui);
    this.particleController.render(this.ctx);
  }

  // ================================================================================================================================================================================================================================================
  // gameLoop

  gameLoop(timestamp) {
    const self = this;
    this.update(timestamp);
    this.render();
    requestAnimationFrame(function(ts) {
      self.gameLoop(ts);
    });
  }

  // ================================================================================================================================================================================================================================================
  // start

  start() {
    const self = this;
    this.camera.resize();
    requestAnimationFrame(function(ts) {
      self.gameLoop(ts);
    });
  }
}
