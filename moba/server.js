// moba/server.js

import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { MobaSim } from './engine/sim.js';
import { TICK_MS } from './engine/config.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const PORTA = Number(process.env.MOBA_PORT) || 8300;
const RESTART_MS = 12000;

// ================================================================================================================================================================================================================================================
// O servidor do MOBA (porta MOBA_PORT, padrão 8300): serve a tela (client/), o motor (engine/, que a tela lê pra saber
// os poderes dos heróis) e, do jogo, só os efeitos e as sprites (shared/effects.js e gerador/saida). A partida roda aqui;
// cada jogador conectado toma o lugar de um herói (o resto é bot) e recebe o estado a cada tick.

const app = express();
app.use('/shared', express.static(path.join(RAIZ, 'shared')));
app.use('/gerador/saida', express.static(path.join(RAIZ, 'gerador', 'saida')));
app.use('/engine', express.static(path.join(AQUI, 'engine')));
app.use(express.static(path.join(AQUI, 'client')));
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

let sim = new MobaSim();
const clients = new Map();

// ================================================================================================================================================================================================================================================
// send
// Manda a mensagem (objeto) pro cliente.

function send(socket, message) {
  if (socket.readyState === 1) socket.send(JSON.stringify(message));
}

// ================================================================================================================================================================================================================================================
// join
// O jogador toma o herói da vocação e do time (se não é de outro jogador); devolve o id do herói ou null.

function join(socket, vocation, team) {
  const hero = sim.heroes.find(item => item.vocation === vocation && item.team === team && !item.human);
  if (!hero) return null;
  hero.human = true;
  hero.moveTarget = null;
  hero.attackTargetId = null;
  clients.set(socket, hero.id);
  return hero.id;
}

// ================================================================================================================================================================================================================================================
// release
// O jogador saiu: o herói volta a ser bot.

function release(socket) {
  const heroId = clients.get(socket);
  const hero = heroId ? sim.heroes.find(item => item.id === heroId) : null;
  if (hero) hero.human = false;
  clients.delete(socket);
}

// ================================================================================================================================================================================================================================================
// restartLater
// Depois do fim da partida, começa outra e devolve os heróis aos jogadores que estavam conectados.

function restartLater() {
  setTimeout(() => {
    const previous = [...clients.entries()];
    sim = new MobaSim();
    for (const [socket, heroId] of previous) {
      const hero = sim.heroes.find(item => item.id === heroId);
      if (hero) hero.human = true;
      send(socket, { type: 'joined', heroId });
    }
  }, RESTART_MS);
}

wss.on('connection', (socket) => {
  send(socket, { type: 'hello', free: sim.heroes.filter(hero => !hero.human).map(hero => hero.id) });
  socket.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (message.type === 'join' && !clients.has(socket)) {
      const heroId = join(socket, message.vocation, message.team);
      send(socket, heroId ? { type: 'joined', heroId } : { type: 'refused' });
    } else if (message.type === 'command' && clients.has(socket)) {
      sim.command(clients.get(socket), message.command);
    }
  });
  socket.on('close', () => release(socket));
});

let wasOver = false;
setInterval(() => {
  sim.tick();
  const state = { type: 'state', ...sim.snapshot(), events: sim.drainEvents() };
  const text = JSON.stringify(state);
  for (const socket of wss.clients) if (socket.readyState === 1) socket.send(text);
  if (sim.over && !wasOver) restartLater();
  wasOver = sim.over;
}, TICK_MS);

server.listen(PORTA, () => {
  console.log(`⚔️  MOBA rodando em http://localhost:${PORTA}`);
});
