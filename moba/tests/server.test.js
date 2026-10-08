// moba/tests/server.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PORTA = 8310 + Math.floor(Math.random() * 80);

// ================================================================================================================================================================================================================================================
// open
// Sobe o servidor do MOBA numa porta de teste e espera ele avisar que está de pé.

function open() {
  const child = spawn(process.execPath, [path.join(AQUI, '..', 'server.js')], { env: { ...process.env, MOBA_PORT: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
  return new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => { if (String(chunk).includes('MOBA rodando')) resolve(child); });
    child.on('error', reject);
    setTimeout(() => reject(new Error('o servidor do MOBA não subiu')), 8000);
  });
}

// ================================================================================================================================================================================================================================================
// waitFor
// Espera uma mensagem do servidor que passe no teste.

function waitFor(socket, test, ms = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('mensagem não chegou')), ms);
    socket.on('message', function handler(raw) {
      const message = JSON.parse(raw);
      if (!test(message)) return;
      clearTimeout(timer);
      socket.off('message', handler);
      resolve(message);
    });
  });
}

test('moba servidor: o jogador toma o herói, anda com a ordem de mover e o herói vira bot ao sair', async () => {
  const server = await open();
  try {
    const socket = new WebSocket(`ws://localhost:${PORTA}/ws`);
    await new Promise(resolve => socket.on('open', resolve));
    const joined = waitFor(socket, message => message.type === 'joined');
    socket.send(JSON.stringify({ type: 'join', team: 'blue', vocation: 'knight' }));
    assert.equal((await joined).heroId, 'blue-knight');
    const first = await waitFor(socket, message => message.type === 'state');
    const before = first.heroes.find(hero => hero.id === 'blue-knight');
    assert.equal(before.human, true);
    socket.send(JSON.stringify({ type: 'command', command: { type: 'move', x: before.x + 6, y: before.y } }));
    const moved = await waitFor(socket, message => message.type === 'state' && message.heroes.find(hero => hero.id === 'blue-knight').x > before.x + 2);
    assert.ok(moved.heroes.find(hero => hero.id === 'blue-knight').x > before.x + 2);
    const other = new WebSocket(`ws://localhost:${PORTA}/ws`);
    await new Promise(resolve => other.on('open', resolve));
    const refused = waitFor(other, message => message.type === 'refused');
    other.send(JSON.stringify({ type: 'join', team: 'blue', vocation: 'knight' }));
    await refused;
    other.close();
    socket.close();
    const released = new WebSocket(`ws://localhost:${PORTA}/ws`);
    await new Promise(resolve => released.on('open', resolve));
    const state = await waitFor(released, message => message.type === 'state' && message.heroes.find(hero => hero.id === 'blue-knight').human === false);
    assert.equal(state.heroes.find(hero => hero.id === 'blue-knight').human, false);
    released.close();
  } finally {
    server.kill();
  }
});
