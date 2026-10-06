// tests/map-server.test.js

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// O mapa ao vivo fica fora do deploy (JOGO_MAPA): sem o arquivo, o servidor
// cria uma cópia do mapa do repositório; /api/map entrega o mapa; salvar
// grava lá (com backup do dia) e o deploy não mexe.

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 19000 + Math.floor(Math.random() * 1000);

let server = null;
let tempDir = null;
let mapFile = null;

before(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), 'jogo-mapa-'));
  mapFile = path.join(tempDir, 'dados', 'map.json');
  server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), JOGO_MAPA: mapFile, JOGO_PERSONAGENS: path.join(tempDir, 'dados', 'characters.json') },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("servidor não subiu")), 60000);
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('Servidor rodando')) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.on('exit', (code) => reject(new Error(`servidor saiu (${code})`)));
  });
});

after(async () => {
  if (server) await new Promise((resolve) => { server.once('exit', resolve); server.kill(); });
  if (tempDir) rmSync(tempDir, { recursive: true, force: true, maxRetries: 5 });
});

test('sem o mapa ao vivo, o servidor cria uma cópia do mapa do repositório', () => {
  assert.ok(existsSync(mapFile));
  assert.equal(readFileSync(mapFile, 'utf8'), readFileSync(path.join(ROOT, 'data', 'map.json'), 'utf8'));
});

test('/api/map entrega o mapa do servidor e, com ?baixar=1, como arquivo', async () => {
  const res = await fetch(`http://localhost:${PORT}/api/map`);
  assert.equal(res.status, 200);
  const map = await res.json();
  assert.ok(Array.isArray(map.objetosData));
  const download = await fetch(`http://localhost:${PORT}/api/map?baixar=1`);
  assert.match(download.headers.get('content-disposition') || '', /map\.json/);
});

test('salvar grava no mapa do servidor e o /api/map devolve o salvo; o backup do dia fica ao lado', async () => {
  const map = await (await fetch(`http://localhost:${PORT}/api/map`)).json();
  map.spawn = { x: 11, y: 22, z: 0 };
  const saved = await fetch(`http://localhost:${PORT}/api/save-map`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(map) });
  assert.equal(saved.status, 200);
  const again = await (await fetch(`http://localhost:${PORT}/api/map`)).json();
  assert.deepEqual(again.spawn, { x: 11, y: 22, z: 0 });
  assert.ok(readdirSync(path.join(path.dirname(mapFile), 'backups')).some(name => /^map-\d{4}-\d{2}-\d{2}\.json$/.test(name)));
});
