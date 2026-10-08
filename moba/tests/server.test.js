// moba/tests/server.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { mountMoba } from '../mount.js';

// ================================================================================================================================================================================================================================================
// open
// Sobe o MOBA montado num app qualquer (como o servidor do jogo faz) numa porta livre.

function open() {
  const app = express();
  const host = mountMoba(app);
  const server = http.createServer(app);
  return new Promise(resolve => server.listen(0, () => resolve({ host, server, base: `http://127.0.0.1:${server.address().port}/moba` })));
}

// ================================================================================================================================================================================================================================================
// stream
// Abre o fluxo de eventos e devolve { id, next(test) } pra esperar uma mensagem de estado que passe no teste.

async function stream(base) {
  const controller = new AbortController();
  const response = await fetch(`${base}/events`, { signal: controller.signal });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let hello = null;
  const read = async () => {
    for (;;) {
      const split = buffer.indexOf('\n\n');
      if (split >= 0) {
        const block = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const name = (block.match(/^event: (.+)$/m) || [])[1] || 'message';
        return { name, data: JSON.parse(block.match(/^data: (.+)$/m)[1]) };
      }
      const { value, done } = await reader.read();
      if (done) return null;
      buffer += decoder.decode(value, { stream: true });
    }
  };
  const first = await read();
  hello = first.data;
  return {
    id: hello.id,
    close: () => controller.abort(),
    next: async (test) => {
      for (let i = 0; i < 400; i++) {
        const message = await read();
        if (message && message.name === 'message' && test(message.data)) return message.data;
      }
      throw new Error('estado não chegou');
    }
  };
}

const post = (base, route, body) => fetch(`${base}/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(response => response.json());

test('moba em /moba: o jogador toma o herói, anda com a ordem de mover, outro não toma o mesmo e o herói vira bot ao sair', async () => {
  const { host, server, base } = await open();
  try {
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.equal((await fetch(`${base}/engine/config.js`)).status, 200);
    const player = await stream(base);
    assert.deepEqual(await post(base, 'join', { id: player.id, team: 'blue', vocation: 'knight' }), { ok: true, heroId: 'blue-knight' });
    const first = await player.next(state => state.heroes.some(hero => hero.id === 'blue-knight' && hero.human));
    const before = first.heroes.find(hero => hero.id === 'blue-knight');
    await post(base, 'command', { id: player.id, command: { type: 'move', x: before.x + 6, y: before.y } });
    const moved = await player.next(state => state.heroes.find(hero => hero.id === 'blue-knight').x > before.x + 2);
    assert.ok(moved.heroes.find(hero => hero.id === 'blue-knight').x > before.x + 2);
    const other = await stream(base);
    assert.equal((await post(base, 'join', { id: other.id, team: 'blue', vocation: 'knight' })).ok, false);
    other.close();
    player.close();
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(host.sim.heroes.find(hero => hero.id === 'blue-knight').human, false);
  } finally {
    for (const client of host.clients.values()) client.response.end();
    clearInterval(host.timer);
    clearTimeout(host.idleTimer);
    server.closeAllConnections();
    server.close();
  }
});
