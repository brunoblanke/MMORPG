// js/game.js

import { CONFIG } from './config.js';
import { Simulation, TICK_MS } from './simulation.js';
import { loadMapDataFromURL } from '../shared/map-format.js';
import { Camera } from './services/camera.js';
import { EventManager } from './input/event-manager.js';
import { SpriteLoader } from './services/sprite-loader.js';
import { Renderer } from './views/renderer.js';
import { getSpritePaths } from './views/sprite-registry.js';
import { UI } from './views/ui.js';
import { getRoofLevel } from './views/draw-order.js';
import { ParticleController } from './systems/particle-controller.js';
import { InputController } from './input/input.js';

const MAX_TICKS_PER_FRAME = 10;

// Cliente: carrega o mapa, roda a simulação (simulation.js) no ritmo fixo de
// TICK_MS, transforma teclado/mouse em comandos (send) e desenha. Não mexe no
// estado do jogo: só lê o que a simulação expõe.

export class GameController {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.camera = new Camera(this.canvas);
    this.eventManager = new EventManager();
    this.spriteLoader = new SpriteLoader();
    this.renderer = new Renderer(this.canvas, this.camera);
    this.ui = new UI();
    this.particleController = new ParticleController();

    this.playerId = 'player1';
    this.sim = null;
    this.player = null;
    this.simTime = null;

    this.devMode = CONFIG.devMode !== undefined ? CONFIG.devMode : false;
    this.renderer.setDevMode(this.devMode);
    this.statusMessage = null;

    this.boot();
  }

  // ================================================================================================================================================================================================================================================
  // boot

  boot() {
    const spritesReady = this.loadSprites();
    const mapReady = loadMapDataFromURL(CONFIG.mapDataUrl).catch((error) => {
      console.error('❌ Erro ao carregar mapa:', error);
      return {};
    });

    Promise.all([spritesReady, mapReady]).then(([, mapData]) => {
      this.initializeGame(mapData);
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

  initializeGame(mapData) {
    this.sim = new Simulation(mapData);
    this.player = this.sim.addPlayer(this.playerId);
    this.inputController = new InputController(this.canvas, this.renderer, this.camera, this.eventManager, this);
  }

  // ================================================================================================================================================================================================================================================
  // send
  // Manda um comando do jogador pra simulação (no multiplayer, pro servidor).

  send(command) {
    this.sim.enqueue(this.playerId, command);
  }

  // ================================================================================================================================================================================================================================================
  // setupEventListeners

  setupEventListeners() {
    const self = this;

    this.eventManager.setupCanvasEvents(this.canvas, this.camera);

    this.eventManager.on('click', function(data) {
      if (self.ui.isDevButtonClicked(data.mouseX, data.mouseY)) {
        self.toggleDevMode();
        return;
      }

      const clickData = self.inputController.handleClick(data.event);

      if (clickData.type === 'toggle_follow') {
        self.send({ type: 'toggleFollow' });
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
  // Clique em inimigo escolhe/tira o alvo; no chão, anda até o piso que aparece ali.

  handleGameClick(gridPos) {
    if (this.trySelectEnemyAtMouse()) return;

    const floor = this.getVisibleFloorAt(gridPos.x, gridPos.y) ?? (this.player.z || 0);
    this.send({ type: 'walkTo', x: gridPos.x, y: gridPos.y, z: floor });
  }

  // ================================================================================================================================================================================================================================================
  // getVisibleFloorAt
  // Andar do piso que aparece no sqm (x, y) — todos os andares são desenhados
  // na mesma posição de tela, então vale o mais alto que não está escondido
  // sob o teto do player. Escada/buraco contam como piso. null se não há nada.

  getVisibleFloorAt(x, y) {
    const world = this.sim.world;
    const roofLevel = getRoofLevel(this.player, world);
    let best = null;
    for (const obj of world.getObjectsAt(x, y)) {
      if (obj.isBorder) continue;
      const z = obj.z ?? 0;
      const isGround = obj.floorType || world.getTransitionAt(x, y, z) === obj;
      if (isGround && z <= roofLevel && (best === null || z > best)) best = z;
    }
    return best;
  }

  // ================================================================================================================================================================================================================================================
  // trySelectEnemyAtMouse
  // Clique em inimigo alterna a seleção de alvo. Retorna true se o clique acertou um inimigo.

  trySelectEnemyAtMouse() {
    const offset = this.camera.getOffset();

    for (const enemy of this.sim.enemies) {
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

      const isSelected = this.player.target === enemy;
      this.send({ type: 'attack', targetId: isSelected ? null : enemy.id });
      return true;
    }

    return false;
  }

  // ================================================================================================================================================================================================================================================
  // handleSimEvents
  // O que a simulação avisou no tick: números de dano/XP e mensagens.

  handleSimEvents(timestamp) {
    for (const event of this.sim.drainEvents()) {
      if (event.type === 'damage') {
        this.particleController.spawnDamage(event.x, event.y, event.amount, this.renderer);
      } else if (event.type === 'xp' && event.playerId === this.playerId) {
        this.particleController.spawnXP(event.x, event.y, event.amount, this.renderer);
      } else if (event.type === 'message' && event.playerId === this.playerId) {
        this.showMessage(event.text, timestamp);
      }
    }
  }

  // ================================================================================================================================================================================================================================================
  // runTicks
  // Avança a simulação em passos fixos de TICK_MS até alcançar o relógio da
  // tela. Se a aba ficou parada (muitos ticks atrasados), pula o atraso.

  runTicks(timestamp) {
    if (this.simTime === null) this.simTime = timestamp - TICK_MS;

    let ticks = 0;
    while (this.simTime + TICK_MS <= timestamp && ticks < MAX_TICKS_PER_FRAME) {
      this.simTime += TICK_MS;
      this.sim.tick(this.simTime);
      ticks++;
    }
    if (ticks === MAX_TICKS_PER_FRAME) this.simTime = timestamp;
  }

  // ================================================================================================================================================================================================================================================
  // updateAnimations

  updateAnimations(timestamp) {
    for (const player of this.sim.players) player.updateAnimation(timestamp);
    for (const enemy of this.sim.enemies) enemy.updateAnimation(timestamp);
  }

  // ================================================================================================================================================================================================================================================
  // update

  update(timestamp) {
    this.runTicks(timestamp);
    this.handleSimEvents(timestamp);

    this.updateAnimations(timestamp);
    this.particleController.update(timestamp);

    if (this.statusMessage && timestamp >= this.statusMessage.expiresAt) {
      this.statusMessage = null;
    }

    this.inputController.updateHoverEnemy(
      this.sim.enemies,
      this.sim.world,
      this.camera.getOffset(),
      this.player,
      this.sim.deadBodies
    );
  }

  // ================================================================================================================================================================================================================================================
  // render

  render() {
    const gameState = {
      player: this.player,
      players: this.sim.players,
      enemies: this.sim.enemies,
      objects: this.sim.objects,
      world: this.sim.world,
      deadBodies: this.sim.deadBodies,
      inputController: this.inputController,
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
