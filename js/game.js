// js/game.js

import { CONFIG } from './config.js';
import { LocalSession } from './net/local-session.js';
import { RemoteSession, JoinError } from './net/remote-session.js';
import { loadMapDataFromURL } from '../shared/map-format.js';
import { Camera } from './services/camera.js';
import { EventManager } from './input/event-manager.js';
import { SpriteLoader } from './services/sprite-loader.js';
import { Renderer, MESSAGE_COLORS } from './views/renderer.js';
import { getSpritePaths } from './views/sprite-registry.js';
import { loadAssets } from '../shared/assets.js';
import { damageColor } from '../shared/conditions.js';
import { UI } from './views/ui.js';
import { getRoofLevel } from './views/draw-order.js';
import { getLevel } from './core/geometry.js';
import { ParticleController } from './systems/particle-controller.js';
import { InputController } from './input/input.js';
import { Joystick } from './input/joystick.js';
import { NameModal } from './views/name-modal.js';
import { InventoryUI } from './views/inventory-ui.js';
import { describeEntity, describeGroundObject } from './views/look.js';
import { SpeechLayer } from './views/speech.js';
import { ChatBox } from './views/chat-box.js';
import { PlayerMenu } from './views/player-menu.js';

// Tempo pra saber se o clique em caixa/cadáver é o começo de um duplo clique.
const DOUBLE_CLICK_MS = 250;

// Cliente: pede o nome do personagem, carrega o mapa, entra no servidor de
// jogo (RemoteSession) ou, sem servidor, roda a simulação aqui mesmo
// (LocalSession). Transforma
// teclado/mouse em comandos (send) e desenha. Não mexe no estado do jogo:
// só lê o que a sessão expõe.

// ================================================================================================================================================================================================================================================
// saveRejoin / takeRejoin
// Mapa ou gerador mudou no servidor: a página recarrega e entra de novo
// sozinha com o mesmo nome e gênero (guardados só pra essa recarga).

const REJOIN_KEY = 'jogo-reentrar';
const LONG_PRESS_MS = 500;
const PLAYER_DOUBLE_CLICK_MS = 400;

function saveRejoin(data) {
  try {
    sessionStorage.setItem(REJOIN_KEY, JSON.stringify(data));
  } catch {}
}

function takeRejoin() {
  try {
    const data = JSON.parse(sessionStorage.getItem(REJOIN_KEY) || 'null');
    sessionStorage.removeItem(REJOIN_KEY);
    return data && typeof data.name === 'string' ? data : null;
  } catch {
    return null;
  }
}

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
    this.speech = new SpeechLayer();
    this.chatBox = new ChatBox(this);
    this.playerMenu = new PlayerMenu(this);
    this.lastPlayerClick = null;

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
        this.joystick = new Joystick(this.inputController, this.canvas);
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
    let again = takeRejoin();
    for (;;) {
      const { name, gender } = again || await modal.ask();
      again = null;
      if (!socket) {
        modal.close(name);
        return new LocalSession(mapData, name, gender);
      }
      try {
        const session = await RemoteSession.join(socket, mapData, name, gender);
        console.log(`🌐 Conectado ao servidor como ${name} (${session.playerId})`);
        session.onDisconnect = () => this.showMessage('Conexão com o servidor perdida — recarregue a página', performance.now(), 600000, 'danger');
        session.onReload = () => {
          saveRejoin({ name, gender });
          location.reload();
        };
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

      if (self.ui.isFullscreenButtonClicked(data.mouseX, data.mouseY)) {
        self.toggleFullscreen();
        return;
      }

      if (data.event && data.event.shiftKey) {
        self.lookAtMouse();
        return;
      }

      if (self.trySelectPlayerAtMouse()) return;

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
      if (self.playerMenu.openAt(evt)) {
        evt.stopImmediatePropagation();
        return;
      }
      self.useStairsAtMouse();
    });

    window.addEventListener('resize', function() {
      self.camera.resize();
    });

    this.setupTouch();
  }

  // ================================================================================================================================================================================================================================================
  // setupTouch
  // Celular: o dedo na tela do jogo faz o que o mouse faz pra arrastar
  // (pegar o item do chão, levar pra outro sqm ou pra uma janela) e, segurado
  // parado por LONG_PRESS_MS, olha o que está embaixo (como Shift + clique).
  // O menu do navegador do toque longo fica desligado.

  setupTouch() {
    const input = this.inputController;
    let press = null;
    const cancel = () => {
      if (press) clearTimeout(press.timer);
      press = null;
    };
    this.canvas.addEventListener('pointerdown', (evt) => {
      if (evt.pointerType !== 'touch') return;
      input.handleMouseMove(evt);
      this.refreshHover();
      input.handleMouseDown(evt);
      press = { x: evt.clientX, y: evt.clientY, timer: setTimeout(() => {
        press = null;
        input.draggingCandidate = null;
        input.dragOccurred = false;
        this.lookAtMouse();
        input.suppressNextClick = true;
        setTimeout(() => { input.suppressNextClick = false; }, 600);
      }, LONG_PRESS_MS) };
    });
    this.canvas.addEventListener('pointermove', (evt) => {
      if (evt.pointerType !== 'touch') return;
      input.handleMouseMove(evt);
      if (press && Math.hypot(evt.clientX - press.x, evt.clientY - press.y) > 6) cancel();
    });
    this.canvas.addEventListener('pointerup', (evt) => {
      if (evt.pointerType !== 'touch') return;
      cancel();
      const under = document.elementFromPoint(evt.clientX, evt.clientY);
      const slot = under && under.closest('.inv-slot');
      if (slot && input.dragOccurred) this.inventoryUI.dropGroundOn(slot, evt);
      else input.handleMouseUp(evt);
    });
    this.canvas.addEventListener('pointercancel', cancel);
    window.addEventListener('pointerdown', (evt) => { this.lastPointerType = evt.pointerType; }, true);
    window.addEventListener('contextmenu', (evt) => {
      if (this.lastPointerType !== 'touch') return;
      evt.preventDefault();
      evt.stopImmediatePropagation();
    }, true);
  }

  // ================================================================================================================================================================================================================================================
  // refreshHover
  // O que está sob o mouse (ou o dedo) agora, sem esperar o próximo quadro.

  refreshHover() {
    if (!this.session || !this.player) return;
    this.inputController.updateHoverEnemy(this.session.enemies, this.session.world, this.camera.getOffset(), this.player, this.session.deadBodies);
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
  // toggleFullscreen

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
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
    const level = getLevel(this.player);
    const entities = [...this.session.players, ...(this.session.npcs || []), ...this.session.enemies.filter(e => e.isAlive())].filter(e => getLevel(e) === level);
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
  // trySelectPlayerAtMouse
  // Dois cliques seguidos (até PLAYER_DOUBLE_CLICK_MS) em outro player escolhem (ou
  // tiram) o alvo, como na Battle. O 1º clique no player não anda. Retorna true
  // se o clique era em um player.

  trySelectPlayerAtMouse() {
    const other = this.playerMenu.playerAtMouse();
    const last = this.lastPlayerClick;
    const now = performance.now();
    if (!other) {
      this.lastPlayerClick = null;
      return false;
    }
    if (!last || last.id !== other.id || now - last.at > PLAYER_DOUBLE_CLICK_MS) {
      this.lastPlayerClick = { id: other.id, at: now };
      return true;
    }
    this.lastPlayerClick = null;
    this.send({ type: 'attack', targetId: this.player.target === other ? null : other.id });
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // trySelectEnemyAtMouse
  // Clique em inimigo alterna a seleção de alvo. Retorna true se o clique acertou um inimigo.
  // Só conta inimigo no andar do player (os de outros andares ficam na mesma
  // posição de tela, mas não podem ser alvo).

  trySelectEnemyAtMouse() {
    const offset = this.camera.getOffset();
    const level = getLevel(this.player);

    for (const enemy of this.session.enemies) {
      if (!enemy.isAlive() || getLevel(enemy) !== level) continue;
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
      } else if (event.type === 'effect') {
        this.particleController.spawnEffect(event, this.renderer);
      } else if (event.type === 'damage') {
        this.particleController.spawnDamage(event.x, event.y, event.amount, this.renderer, damageColor(event.element));
      } else if (event.type === 'heal') {
        this.particleController.spawnHeal(event, this.renderer);
      } else if (event.type === 'xp' && event.playerId === playerId) {
        this.particleController.spawnXP(event.x, event.y, event.amount, this.renderer);
      } else if (event.type === 'levelUp' && event.playerId === playerId) {
        this.showMessage(`⭐ Você subiu para o nível ${event.lvl}!`, timestamp, 3000);
      } else if (event.type === 'book' && event.playerId === playerId) {
        this.showBook(event.title, event.text);
      } else if (event.type === 'speech') {
        this.speech.add(event, performance.now());
      } else if (event.type === 'signText' && event.playerId === playerId) {
        this.speech.add({ ...event, name: null, color: MESSAGE_COLORS[event.kind] || MESSAGE_COLORS.info }, performance.now());
      } else if (event.type === 'message' && event.playerId === playerId) {
        this.showMessage(event.text, timestamp, 2000 + Math.min(4000, event.text.length * 40), event.kind || 'warn');
      }
    }
  }

  // ================================================================================================================================================================================================================================================
  // showBook
  // Janela do livro: título e o texto (escrito no editor), solta na tela
  // como as outras (fecha no X ou no Esc).

  showBook(title, text) {
    if (this.inventoryUI) this.inventoryUI.openBook(title, text);
  }

  // ================================================================================================================================================================================================================================================
  // updateAnimations

  updateAnimations(timestamp) {
    for (const player of this.session.players) player.updateAnimation(timestamp);
    for (const enemy of this.session.enemies) enemy.updateAnimation(timestamp);
    for (const npc of this.session.npcs || []) npc.updateAnimation(timestamp);
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

    this.refreshHover();
  }

  // ================================================================================================================================================================================================================================================
  // render

  render() {
    if (!this.player) return;
    const gameState = {
      player: this.player,
      players: this.session.players,
      enemies: this.session.enemies,
      npcs: this.session.npcs || [],
      speech: this.speech,
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
