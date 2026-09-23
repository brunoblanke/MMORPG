// js/game.js

import { CONFIG } from './config.js';
import { LocalSession } from './net/local-session.js';
import { RemoteSession, JoinError } from './net/remote-session.js';
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
import { NameModal } from './views/name-modal.js';

// Cliente: pede o nome do personagem, carrega o mapa, entra no servidor de
// jogo (RemoteSession) ou, sem servidor, roda a simulação aqui mesmo
// (LocalSession). Transforma
// teclado/mouse em comandos (send) e desenha. Não mexe no estado do jogo:
// só lê o que a sessão expõe.

export class GameController {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.camera = new Camera(this.canvas);
    this.camera.resize();
    this.eventManager = new EventManager();
    this.spriteLoader = new SpriteLoader();
    this.renderer = new Renderer(this.canvas, this.camera);
    this.ui = new UI();
    this.particleController = new ParticleController();

    this.session = null;

    this.devMode = CONFIG.devMode !== undefined ? CONFIG.devMode : false;
    this.renderer.setDevMode(this.devMode);
    this.statusMessage = null;

    this.boot();
  }

  // ================================================================================================================================================================================================================================================
  // boot

  boot() {
    const modal = new NameModal();
    const spritesReady = this.loadSprites();
    const mapReady = loadMapDataFromURL(CONFIG.mapDataUrl).catch((error) => {
      console.error('❌ Erro ao carregar mapa:', error);
      return {};
    });
    const socketReady = RemoteSession.openSocket().catch((error) => {
      console.log(`🕹️ Sem servidor de jogo (${error.message}): jogando sozinho`);
      return null;
    });

    Promise.all([spritesReady, mapReady, socketReady])
      .then(([, mapData, socket]) => this.openSession(modal, mapData, socket))
      .then((session) => {
        this.session = session;
        this.inputController = new InputController(this.canvas, this.renderer, this.camera, this.eventManager, this);
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
  // openSession
  // Pede o nome na janela e entra no servidor de jogo. Nome recusado (em uso,
  // inválido): mostra o motivo e pede de novo. Sem servidor (ou se ele cair
  // antes de entrar): joga sozinho no navegador com esse nome.

  async openSession(modal, mapData, socket) {
    for (;;) {
      const name = await modal.ask();
      if (!socket) {
        modal.close(name);
        return new LocalSession(mapData, name);
      }
      try {
        const session = await RemoteSession.join(socket, mapData, name);
        console.log(`🌐 Conectado ao servidor como ${name} (${session.playerId})`);
        session.onDisconnect = () => this.showMessage('Conexão com o servidor perdida — recarregue a página', performance.now(), 600000);
        modal.close(name);
        return session;
      } catch (error) {
        if (error instanceof JoinError) {
          modal.showError(error.message);
          continue;
        }
        console.log(`🕹️ ${error.message}: jogando sozinho`);
        socket = null;
        modal.close(name);
        return new LocalSession(mapData, name);
      }
    }
  }

  // ================================================================================================================================================================================================================================================
  // player

  get player() {
    return this.session ? this.session.player : null;
  }

  // ================================================================================================================================================================================================================================================
  // send
  // Manda um comando do jogador pra sessão (servidor ou simulação local).

  send(command) {
    this.session.send(command);
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
    if (!this.player) return;
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
    const world = this.session.world;
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

    for (const enemy of this.session.enemies) {
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

  handleSimEvents(events, timestamp) {
    const playerId = this.session.playerId;
    for (const event of events) {
      if (event.type === 'damage') {
        this.particleController.spawnDamage(event.x, event.y, event.amount, this.renderer);
      } else if (event.type === 'xp' && event.playerId === playerId) {
        this.particleController.spawnXP(event.x, event.y, event.amount, this.renderer);
      } else if (event.type === 'levelUp' && event.playerId === playerId) {
        this.showMessage(`⭐ Você subiu para o nível ${event.lvl}!`, timestamp, 3000);
      } else if (event.type === 'message' && event.playerId === playerId) {
        this.showMessage(event.text, timestamp);
      }
    }
  }

  // ================================================================================================================================================================================================================================================
  // updateAnimations

  updateAnimations(timestamp) {
    for (const player of this.session.players) player.updateAnimation(timestamp);
    for (const enemy of this.session.enemies) enemy.updateAnimation(timestamp);
  }

  // ================================================================================================================================================================================================================================================
  // update

  update(timestamp) {
    this.handleSimEvents(this.session.update(timestamp), timestamp);
    if (!this.player) return;

    this.updateAnimations(timestamp);
    this.particleController.update(timestamp);

    if (this.statusMessage && timestamp >= this.statusMessage.expiresAt) {
      this.statusMessage = null;
    }

    this.inputController.updateHoverEnemy(
      this.session.enemies,
      this.session.world,
      this.camera.getOffset(),
      this.player,
      this.session.deadBodies
    );
  }

  // ================================================================================================================================================================================================================================================
  // render

  render() {
    if (!this.player) return;
    const gameState = {
      player: this.player,
      players: this.session.players,
      enemies: this.session.enemies,
      objects: this.session.objects,
      world: this.session.world,
      deadBodies: this.session.deadBodies,
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
