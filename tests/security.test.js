// tests/security.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarGuarda, caminhoBloqueado, senhaConfere, criarPortaoAdmin, criarBalde, contarPorChave, criarJanela } from '../seguranca.js';

test('arquivos do servidor, dos jogadores e do repositório não saem pela web', () => {
  for (const url of ['/data/passwords.json', '/data/characters.json?x=1', '/DATA/map.json', '/.git/config', '/sftp-config.json', '/server.js', '/package.json', '/node_modules/ws/index.js', '/tests/tibia-780/Tibia.dat', '/ferramentas/ajustar-personagem.js', '/gerador/tibia/atual/Tibia.dat', '/%2e%2e/etc/passwd', '/data%2fpasswords.json', '/js/../data/passwords.json', '//data//passwords.json', '/CLAUDE.md', '/PENDENCIAS.md', '/.env', '/x/.hidden']) {
    assert.equal(caminhoBloqueado(url), true, url);
  }
});

test('o que o jogo, o editor e o gerador usam continua saindo', () => {
  for (const url of ['/', '/index.html', '/js/game.js', '/shared/assets.js', '/css/inventory.css', '/editor/index.html', '/gerador/saida/estrutura/pisos/grama-1.png', '/gerador/projetos/itens/ferramentas/pick.json', '/favicon.png', '/simulador.html']) {
    assert.equal(caminhoBloqueado(url), false, url);
  }
});

test('senha do editor: confere só a certa; sem senha configurada nada confere', () => {
  assert.equal(senhaConfere('abc', 'abc'), true);
  assert.equal(senhaConfere('abd', 'abc'), false);
  assert.equal(senhaConfere(undefined, 'abc'), false);
  assert.equal(senhaConfere('', ''), false);
});

// ================================================================================================================================================================================================================================================
// chamar
// Passa uma requisição falsa pelo portão e devolve o que ele fez.

function chamar(portao, { local = false, senha } = {}) {
  const req = { socket: { remoteAddress: local ? '127.0.0.1' : '203.0.113.9' }, get: (nome) => (nome === 'x-admin-senha' ? senha : undefined) };
  const out = { next: false, status: null };
  const res = { status(codigo) { out.status = codigo; return this; }, json() { return this; } };
  portao(req, res, () => { out.next = true; });
  return out;
}

test('portão do admin: sem senha configurada só a própria máquina; com senha, só quem a sabe, e erros seguidos travam', () => {
  const semSenha = criarPortaoAdmin('', criarGuarda());
  assert.equal(chamar(semSenha, { local: true }).next, true);
  assert.equal(chamar(semSenha).status, 403);

  const portao = criarPortaoAdmin('segredo', criarGuarda({ maxFalhas: 3, travaMs: 60000 }));
  assert.equal(chamar(portao, { senha: 'segredo' }).next, true);
  assert.equal(chamar(portao, { senha: 'errada' }).status, 401);
  assert.equal(chamar(portao).status, 401);
  assert.equal(chamar(portao, { senha: 'errada' }).status, 401);
  assert.equal(chamar(portao, { senha: 'segredo' }).status, 429);
});

test('balde de mensagens: aguenta a rajada, bloqueia o excesso e volta a encher com o tempo', () => {
  let agora = 0;
  const balde = criarBalde({ taxa: 10, rajada: 5, agora: () => agora });
  const passou = Array.from({ length: 8 }, () => balde.permitir());
  assert.deepEqual(passou, [true, true, true, true, true, false, false, false]);
  agora += 500;
  assert.equal(balde.permitir(), true);
});

test('limite de conexões por endereço e de contas novas por janela', () => {
  const conexoes = contarPorChave(2);
  assert.equal(conexoes.entrar('a'), true);
  assert.equal(conexoes.entrar('a'), true);
  assert.equal(conexoes.entrar('a'), false);
  conexoes.sair('a');
  assert.equal(conexoes.entrar('a'), true);

  let agora = 0;
  const contas = criarJanela({ maximo: 2, janelaMs: 1000, agora: () => agora });
  assert.deepEqual([contas.tentar('ip'), contas.tentar('ip'), contas.tentar('ip')], [true, true, false]);
  agora = 1500;
  assert.equal(contas.tentar('ip'), true);
});
