// js/net/remote-session.js

import { World } from '../core/world.js';
import { generateObjects } from '../models/game-object.js';
import { applyState } from './protocol.js';

const CONNECT_TIMEOUT_MS = 2000;

// Jogo pelo servidor: a simulação roda lá; aqui fica um espelho (mapa gerado
// do mesmo data/map.json + jogadores, inimigos, cadáveres e itens recebidos a
// cada tick) só pra desenhar. Comandos vão pelo WebSocket.

export class JoinError extends Error {}

export class RemoteSession {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(mapData, socket, playerId) {
    this.socket = socket;
    this.playerId = playerId;
    this.isOnline = true;
    this.world = new World();
    this.objects = generateObjects(mapData);
    this.world.load(this.objects);
    this.world.loadSafeZones(mapData.safeZoneData);
    this.objectsById = new Map(this.objects.map(obj => [obj.id, obj]));
    this.players = [];
    this.enemies = [];
    this.deadBodies = [];
    this.inbox = [];
    this.onDisconnect = null;

    socket.addEventListener('message', (e) => this.inbox.push({ message: JSON.parse(e.data), receivedAt: performance.now() }));
    socket.addEventListener('close', () => {
      this.isOnline = false;
      if (this.onDisconnect) this.onDisconnect();
    });
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
  // join
  // Entra no jogo com o nome e o gênero do personagem. Resolve com a sessão ('welcome')
  // ou rejeita com JoinError se o servidor recusar o nome — o socket continua
  // aberto pra tentar outro. Outro erro: a conexão caiu.

  static join(socket, mapData, name, gender) {
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
          resolve(new RemoteSession(mapData, socket, message.playerId));
        }
      };
      const onClose = () => {
        cleanup();
        reject(new Error('Conexão com o servidor fechada'));
      };

      socket.addEventListener('message', onMessage);
      socket.addEventListener('close', onClose);
      socket.send(JSON.stringify({ type: 'join', name, gender }));
    });
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

  update(timestamp) {
    const events = [];
    const received = this.inbox;
    this.inbox = [];

    for (const { message, receivedAt } of received) {
      if (message.type !== 'state') continue;
      applyState(this, message, this.playerId, Math.min(receivedAt, timestamp));
      for (const event of message.events) {
        events.push(event);
        if (event.type === 'damage') this.flash(event.targetId, timestamp);
      }
    }
    return events;
  }

  // ================================================================================================================================================================================================================================================
  // flash
  // Pisca a criatura que tomou dano (no jogo local isso vem da simulação).

  flash(entityId, timestamp) {
    const entity = this.players.find(p => p.id === entityId) || this.enemies.find(e => e.id === entityId);
    if (entity) entity.flashUntil = timestamp + 150;
  }
}
