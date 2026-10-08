// moba/mount.js

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MatchHost } from './host.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

// ================================================================================================================================================================================================================================================
// mountMoba
// Põe o MOBA num app Express em base (padrão /moba): a tela, o motor (que a tela lê) e as 3 rotas da partida:
// GET events (fluxo de estado, SSE), POST join e POST command. Usa só HTTP, então convive com o servidor do jogo
// (e com o WebSocket dele) sem mexer em nada. Devolve o anfitrião (pra testes).

export function mountMoba(app, base = '/moba') {
  const host = new MatchHost();
  const router = express.Router();
  router.use(express.json({ limit: '10kb' }));
  router.get('/events', (request, response) => {
    response.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    response.flushHeaders();
    const id = host.connect(response);
    response.write(`event: hello\ndata: ${JSON.stringify({ id, free: host.sim.heroes.filter(hero => !hero.human).map(hero => hero.id) })}\n\n`);
    request.on('close', () => host.disconnect(id));
  });
  router.post('/join', (request, response) => {
    const { id, team, vocation } = request.body || {};
    const heroId = host.join(id, team, vocation);
    response.json(heroId ? { ok: true, heroId } : { ok: false });
  });
  router.post('/command', (request, response) => {
    const { id, command } = request.body || {};
    host.command(id, command);
    response.json({ ok: true });
  });
  router.use('/engine', express.static(path.join(AQUI, 'engine')));
  router.use(express.static(path.join(AQUI, 'client')));
  app.get(base, (request, response, next) => (request.originalUrl.split('?')[0].endsWith('/') ? next() : response.redirect(`${base}/${request.originalUrl.slice(request.originalUrl.indexOf('?') >= 0 ? request.originalUrl.indexOf('?') : request.originalUrl.length)}`)));
  app.use(base, router);
  return host;
}
