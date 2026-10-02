// tests/e2e-network.test.js

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { decodeDelta } from '../js/net/delta.js';

// De ponta a ponta: sobe o server.js de verdade (mapa e gerador do projeto)
// numa porta de teste, com os personagens numa pasta temporária, e conversa
// com ele por WebSocket como o navegador: remonta o estado com decodeDelta e
// confere que o que muda no servidor chega na tela.

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 18000 + Math.floor(Math.random() * 1000);
const WAIT_MS = 4000;

let server = null;
let tempDir = null;

before(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'jogo-e2e-'));
  server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), JOGO_PERSONAGENS: path.join(tempDir, 'characters.json') },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('servidor não subiu')), 20000);
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('Servidor rodando')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on('exit', (code) => reject(new Error(`servidor saiu (${code})`)));
  });
});

after(() => {
  if (server) server.kill('SIGTERM');
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

// ================================================================================================================================================================================================================================================
// connect
// Um "navegador": entra com o nome e guarda o estado remontado e os eventos.

function connect(name) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://localhost:${PORT}/ws`);
    const client = { socket, state: null, events: [], playerId: null };
    socket.on('error', reject);
    socket.on('open', () => socket.send(JSON.stringify({ type: 'join', name, gender: 'male' })));
    socket.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'welcome') {
        client.playerId = message.playerId;
        resolve(client);
      } else if (message.type === 'state') {
        client.state = decodeDelta(client.state, message.delta);
        client.events.push(...(message.events || []));
      } else if (message.type === 'joinError') {
        reject(new Error(message.error));
      }
    });
  });
}

// ================================================================================================================================================================================================================================================
// until
// Espera a condição sobre o cliente ficar verdadeira (ou falha em WAIT_MS).

async function until(client, check, what) {
  const end = Date.now() + WAIT_MS;
  while (Date.now() < end) {
    if (client.state && check(client)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail(`não chegou na tela: ${what}`);
}

function send(client, command) {
  client.socket.send(JSON.stringify({ type: 'command', command }));
}

const equip = (client) => client.state.you.inventory.equip;

test('o inventário que muda no servidor chega na tela (acender a tocha e mover pro slot da flecha)', async () => {
  const client = await connect('Redeum');
  try {
    await until(client, c => equip(c).escudo, 'tocha no slot do escudo');
    send(client, { type: 'useItem', from: { t: 'e', key: 'escudo' } });
    await until(client, c => equip(c).escudo && equip(c).escudo.lit, 'tocha acesa');
    send(client, { type: 'moveInv', from: { t: 'e', key: 'escudo' }, to: { t: 'e', key: 'municao' }, amount: 1 });
    await until(client, c => !equip(c).escudo && equip(c).municao && equip(c).municao.lit, 'tocha no slot da flecha');
  } finally {
    client.socket.close();
  }
});

test('um player vê o outro chegar e ouve o que ele fala', async () => {
  const ana = await connect('Redeana');
  const beto = await connect('Redebeto');
  try {
    await until(ana, c => c.state.players.some(p => p.name === 'Redebeto'), 'Beto na lista de players da Ana');
    send(beto, { type: 'say', text: 'olá Ana' });
    await until(ana, c => c.events.some(e => e.type === 'speech' && e.text === 'olá Ana'), 'fala do Beto');
  } finally {
    ana.socket.close();
    beto.socket.close();
  }
});
