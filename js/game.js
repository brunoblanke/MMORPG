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
import { loadAssets } from '../shared/assets.js';
import { UI } from './views/ui.js';
import { getRoofLevel } from './views/draw-order.js';
import { ParticleController } from './systems/particle-controller.js';
import { InputController } from './input/input.js';
import { NameModal } from './views/name-modal.js';
import { InventoryUI } from './views/inventory-ui.js';
import { describeEntity, describeGroundObject } from './views/look.js';

// Tempo pra saber se o clique em caixa/cadáver é o começo de um duplo clique.
const DOUBLE_CLICK_MS = 250;

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
        this.inventoryUI = new InventoryUI(this);
        this.setupEventListeners();
        this.start();
      });
  }

  // ================================================================================================================================================================================================================================================
  // loadSprites
  // Primeiro a lista das folhas do gerador (/api/sprites), depois as imagens.

  loadSprites() {
    return loadAssets()
      .catch((error) => console.error('❌ Erro ao listar os sprites:', error))
      .then(() => this.spriteLoader.loadAll(getSpritePaths()))
      .catch((error) => console.error('❌ Erro ao carregar sprites:', error));
  }

  // ================================================================================================================================================================================================================================================
  // openSession
  // Pede o nome e o gênero na janela e entra no servidor de jogo. Nome recusado (em uso,
  // inválido): mostra o motivo e pede de novo. Sem servidor (ou se ele cair
  // antes de entrar): joga sozinho no navegador com esse nome.

  async openSession(modal, mapData, socket) {
    for (;;) {
      const { name, gender } = await modal.ask();
      if (!socket) {
        modal.close(name);
        return new LocalSession(mapData, name, gender);
      }
      try {
        const session = await RemoteSession.join(socket, mapData, name, gender);
        console.log(`🌐 Conectado ao servidor como ${name} (${session.playerId})`);
        session.onDisconnect = () => this.showMessage('Conexão com o servidor perdida — recarregue a página', performance.now(), 600000, 'danger');
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
        return new LocalSession(mapData, name, gender);
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

      if (data.event && data.event.shiftKey) {
        self.lookAtMouse();
        return;
      }

      const clickData = self.inputController.handleClick(data.event);

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

    this.canvas.addEventListener('dblclick', function() {
      self.useStairsAtMouse();
    });

    this.canvas.addEventListener('contextmenu', function(evt) {
      evt.preventDefault();
      self.useStairsAtMouse();
    });

    window.addEventListener('resize', function() {
      self.camera.resize();
    });
  }

  // ================================================================================================================================================================================================================================================
  // showMessage

  // kind: 'info' (verde: positiva ou neutra), 'warn' (amarelo: alerta) ou
  // 'danger' (vermelho: perigo).

  showMessage(text, timestamp, duration = 2000, kind = 'info') {
    this.statusMessage = { text, kind, expiresAt: timestamp + duration };
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
  // Clique em inimigo escolhe/tira o alvo; na porta, abre ou fecha (o player
  // anda até ela se precisar); no chão, anda até o sqm no andar em que o
  // player está. Em cima de caixa ou cadáver, espera um instante: se for
  // duplo clique (abrir), o player não sai do lugar.

  handleGameClick(gridPos) {
    if (!this.player) return;
    if (this.trySelectEnemyAtMouse()) return;

    const z = this.player.z || 0;
    if (this.session.world.getDoorAt(gridPos.x, gridPos.y, z)) {
      this.cancelPendingWalk();
      this.send({ type: 'useDoor', x: gridPos.x, y: gridPos.y, z });
      return;
    }

    const command = { type: 'walkTo', x: gridPos.x, y: gridPos.y, z };
    this.cancelPendingWalk();
    if (!this.inventoryUI || !this.inventoryUI.openableUnderMouse()) {
      this.send(command);
      return;
    }
    this.pendingWalk = setTimeout(() => {
      this.pendingWalk = null;
      this.send(command);
    }, DOUBLE_CLICK_MS);
  }

  // ================================================================================================================================================================================================================================================
  // useStairsAtMouse
  // Duplo clique ou botão direito no sqm de uma escada sem altura (no andar
  // do player): sobe por ela (o servidor leva o player até lá, se precisar).

  useStairsAtMouse() {
    const tile = this.inputController && this.inputController.hoverTile;
    if (!this.player || !tile) return;
    const z = this.player.z || 0;
    const stairs = this.session.world.getTransitionAt(tile.x, tile.y, z);
    if (!stairs || !stairs.manualStairs) return;
    this.send({ type: 'useStairs', x: tile.x, y: tile.y, z });
  }

  // ================================================================================================================================================================================================================================================
  // cancelPendingWalk
  // Desiste do andar que o clique em caixa/cadáver deixou esperando.

  cancelPendingWalk() {
    if (!this.pendingWalk) return;
    clearTimeout(this.pendingWalk);
    this.pendingWalk = null;
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
  // lookAtMouse
  // Shift + clique na tela: mostra o que é o player, a criatura ou o item sob
  // o mouse (mensagem verde no centro).

  lookAtMouse() {
    if (!this.player || !this.inputController) return;
    const offset = this.camera.getOffset();
    const { mouseX, mouseY } = this.inputController;
    const entities = [...this.session.players, ...this.session.enemies.filter(e => e.isAlive())];
    const hit = entities.find(e => this.renderer.isPointInCube(mouseX, mouseY, e.renderX, e.renderY, offset, e.z || 0, e.step || 0));
    if (hit) {
      this.look(describeEntity(hit, this.player));
      return;
    }
    const obj = this.inputController.hoverCorpse || this.inputController.hoverObject;
    const text = obj ? describeGroundObject(obj) : null;
    if (text) this.look(text);
  }

  // ================================================================================================================================================================================================================================================
  // look

  look(text) {
    this.showMessage(text, performance.now(), 3000 + text.length * 30, 'info');
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
      if (event.type === 'missile') {
        this.particleController.spawnMissile(event, this.renderer);
      } else if (event.type === 'damage') {
        this.particleController.spawnDamage(event.x, event.y, event.amount, this.renderer);
      } else if (event.type === 'heal') {
        this.particleController.spawnHeal(event, this.renderer);
      } else if (event.type === 'xp' && event.playerId === playerId) {
        this.particleController.spawnXP(event.x, event.y, event.amount, this.renderer);
      } else if (event.type === 'levelUp' && event.playerId === playerId) {
        this.showMessage(`⭐ Você subiu para o nível ${event.lvl}!`, timestamp, 3000);
      } else if (event.type === 'book' && event.playerId === playerId) {
        this.showBook(event.title, event.text);
      } else if (event.type === 'message' && event.playerId === playerId) {
        this.showMessage(event.text, timestamp, 2000 + Math.min(4000, event.text.length * 40), event.kind || 'warn');
      }
    }
  }

  // ================================================================================================================================================================================================================================================
  // showBook
  // Janela do livro: título e o texto (escrito no editor). Fecha no X, no
  // Esc ou clicando fora.

  showBook(title, text) {
    let modal = document.getElementById('bookModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'bookModal';
      modal.className = 'book-modal';
      modal.innerHTML = '<div class="book-page" role="dialog"><header><span class="book-title"></span><button type="button" class="book-close" aria-label="Fechar">×</button></header><div class="book-text"></div></div>';
      document.body.appendChild(modal);
      const close = () => modal.classList.remove('show');
      modal.addEventListener('pointerdown', (evt) => { if (evt.target === modal) close(); });
      modal.querySelector('.book-close').onclick = close;
      document.addEventListener('keydown', (evt) => { if (evt.key === 'Escape') close(); });
    }
    modal.querySelector('.book-title').textContent = title;
    modal.querySelector('.book-text').textContent = text || 'O livro está em branco.';
    modal.classList.add('show');
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
    this.inventoryUI.update();

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
