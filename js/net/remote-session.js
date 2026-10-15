// js/net/remote-session.js

import { World } from '../core/world.js';
import { generateObjects } from '../models/game-object.js';
import { applyState } from './protocol.js';
import { decodeDelta } from './delta.js';

const CONNECT_TIMEOUT_MS = 2000;
const STALE_EVENT_MS = 1000;
const SILENT_MS = 3000;
const VISUAL_EVENTS = new Set(['damage', 'heal', 'xp', 'speech', 'signText', 'missile', 'effect']);

// Jogo pelo servidor: a simulação roda lá; aqui fica um espelho (mapa gerado
// do mesmo data/map.json + jogadores, inimigos, cadáveres e itens recebidos a
// cada tick) só pra desenhar. Comandos vão pelo WebSocket.

export class JoinError extends Error {}

export class RemoteSession {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(mapData, socket, playerId, version = '') {
    this.socket = socket;
    this.playerId = playerId;
    this.version = version;
    this.isOnline = true;
    this.world = new World();
    this.objects = generateObjects(mapData);
    this.world.load(this.objects);
    this.world.loadSafeZones(mapData.safeZoneData);
    this.world.loadHouses(mapData.houseData);
    this.objectsById = new Map(this.objects.map(obj => [obj.id, obj]));
    this.players = [];
    this.enemies = [];
    this.npcs = [];
    this.deadBodies = [];
    this.inventoryView = null;
    this.lastState = null;
    this.inbox = [];
    this.onDisconnect = null;
    this.onReload = null;
    this.reloading = false;
    this.disconnected = false;
    this.lastMessageAt = performance.now();
    this.listen(socket);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.isOnline && performance.now() - this.lastMessageAt > SILENT_MS) this.drop();
      });
    }
  }

  // ================================================================================================================================================================================================================================================
  // listen
  // Escuta o socket: estados e 'reload' do servidor; quando ele fecha, a sessão cai (drop).

  listen(socket) {
    socket.addEventListener('message', (e) => {
      if (socket !== this.socket) return;
      const message = JSON.parse(e.data);
      this.lastMessageAt = performance.now();
      if (message.type === 'reload') {
        this.reloading = true;
        if (this.onReload) this.onReload();
        return;
      }
      this.inbox.push({ message, receivedAt: performance.now() });
    });
    socket.addEventListener('close', () => {
      if (socket === this.socket) this.drop();
    });
  }

  // ================================================================================================================================================================================================================================================
  // drop
  // A conexão acabou (fechou ou ficou muda com o app em segundo plano): avisa uma vez só.

  drop() {
    if (this.disconnected) return;
    this.disconnected = true;
    this.isOnline = false;
    try { this.socket.close(); } catch {}
    if (this.onDisconnect && !this.reloading) this.onDisconnect();
  }

  // ================================================================================================================================================================================================================================================
  // reattach
  // Reentra pelo socket novo no mesmo personagem, sem recarregar a página: só vale se o servidor não reiniciou nem trocou de mapa e o corpo ainda é o mesmo; o servidor manda o estado inteiro de novo. Devolve false se não deu (aí a página recarrega).

  async reattach(socket, name, gender, password) {
    const welcome = await RemoteSession.handshake(socket, name, gender, password);
    if (welcome.playerId !== this.playerId || welcome.version !== this.version) {
      socket.close();
      return false;
    }
    this.socket = socket;
    this.lastState = null;
    this.inbox = [];
    this.lastMessageAt = performance.now();
    this.disconnected = false;
    this.isOnline = true;
    this.listen(socket);
    return true;
  }

  get player() {
    return this.players.find(p => p.id === this.playerId) || null;
  }

  // ================================================================================================================================================================================================================================================
  // openSocket
  // Abre o WebSocket em /ws. Rejeita se não houver servidor de jogo (ou se
  // ele não responder a tempo).

  static openSocket(url = RemoteSession.defaultUrl()) {
    return new Promise((resolve, reject) => {
      let socket;
      try {
        socket = new WebSocket(url);
      } catch (error) {
        reject(error);
        return;
      }

      const timer = setTimeout(() => {
        socket.close();
        reject(new Error('Servidor de jogo não respondeu'));
      }, CONNECT_TIMEOUT_MS);

      socket.addEventListener('open', () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('Sem servidor de jogo'));
      });
    });
  }

  // ================================================================================================================================================================================================================================================
  // handshake
  // Manda o nome, o gênero e a senha do personagem e resolve com o 'welcome' do servidor (playerId, version) ou rejeita com JoinError se ele recusar o nome ou a senha — o socket continua aberto pra tentar outro. Outro erro: a conexão caiu.

  static handshake(socket, name, gender, password) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        socket.removeEventListener('message', onMessage);
        socket.removeEventListener('close', onClose);
      };
      const onMessage = (e) => {
        const message = JSON.parse(e.data);
        if (message.type === 'joinError') {
          cleanup();
          reject(new JoinError(message.error));
        } else if (message.type === 'welcome') {
          cleanup();
          resolve(message);
        }
      };
      const onClose = () => {
        cleanup();
        reject(new Error('Conexão com o servidor fechada'));
      };

      socket.addEventListener('message', onMessage);
      socket.addEventListener('close', onClose);
      socket.send(JSON.stringify({ type: 'join', name, gender, password }));
    });
  }

  // ================================================================================================================================================================================================================================================
  // join
  // Entra no jogo: o handshake e a sessão nova.

  static async join(socket, mapData, name, gender, password) {
    const welcome = await RemoteSession.handshake(socket, name, gender, password);
    return new RemoteSession(mapData, socket, welcome.playerId, welcome.version);
  }

  // ================================================================================================================================================================================================================================================
  // defaultUrl

  static defaultUrl() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/ws`;
  }

  // ================================================================================================================================================================================================================================================
  // send

  send(command) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'command', command }));
    }
  }

  // ================================================================================================================================================================================================================================================
  // update
  // Aplica os estados que chegaram desde o último quadro. Devolve os eventos.
  // Cada estado vale a partir da hora em que chegou (não da hora do quadro):
  // o passo já começa andando neste quadro, sem repetir a posição do anterior.
  // Com a aba em segundo plano o navegador para os quadros e os estados se
  // acumulam; os efeitos visuais (dano, fala, projétil…) de estados com mais de
  // STALE_EVENT_MS são descartados, senão aparecem todos juntos na volta.

  update(timestamp) {
    const events = [];
    const received = this.inbox;
    this.inbox = [];

    for (const { message, receivedAt } of received) {
      if (message.type !== 'state') continue;
      if (message.delta) this.lastState = decodeDelta(this.lastState, message.delta);
      applyState(this, { time: message.time, state: message.delta ? this.lastState : message.state }, this.playerId, Math.min(receivedAt, timestamp));
      const stale = timestamp - receivedAt > STALE_EVENT_MS;
      for (const event of message.events) {
        if (stale && VISUAL_EVENTS.has(event.type)) continue;
        events.push(event);
      }
    }
    return events;
  }
}
