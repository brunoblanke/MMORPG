// moba/server.js

import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mountMoba } from './mount.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const PORTA = Number(process.env.MOBA_PORT) || 8300;

// ================================================================================================================================================================================================================================================
// O MOBA sozinho, na porta MOBA_PORT (padrão 8300), em /moba. Normalmente ele já vem junto do servidor do jogo
// (server.js da raiz monta o mesmo mountMoba); este arquivo serve pra rodar só o MOBA, e traz do jogo apenas
// os efeitos e as sprites (shared/ e gerador/saida).

const app = express();
app.use('/shared', express.static(path.join(RAIZ, 'shared')));
app.use('/gerador/saida', express.static(path.join(RAIZ, 'gerador', 'saida')));
mountMoba(app);
app.get('/', (request, response) => response.redirect('/moba/'));

http.createServer(app).listen(PORTA, () => {
  console.log(`⚔️  MOBA rodando em http://localhost:${PORTA}/moba/`);
});
