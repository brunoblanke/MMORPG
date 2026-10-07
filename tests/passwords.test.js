// tests/passwords.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PasswordStore, LoginGuard } from '../js/net/passwords.js';
import { validatePassword } from '../js/net/protocol.js';

test('a senha precisa ter de 4 a 64 caracteres', () => {
  assert.ok(validatePassword('abc').error);
  assert.ok(validatePassword(undefined).error);
  assert.ok(validatePassword('a'.repeat(65)).error);
  assert.equal(validatePassword('abcd').password, 'abcd');
  assert.equal(validatePassword('  espaços contam  ').password, '  espaços contam  ');
});

test('o 1º acesso define a senha; depois só a mesma entra; o arquivo guarda hash, nunca a senha', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'jogo-senhas-'));
  try {
    const file = path.join(dir, 'passwords.json');
    const store = new PasswordStore(file);
    assert.equal(store.has('Ana'), false);
    assert.equal(await store.claim('Ana', 'minhasenha'), true);
    assert.equal(await store.claim('ana', 'outra'), false);
    assert.equal(store.has('ANA'), true);
    assert.equal(await store.verify('Ana', 'minhasenha'), true);
    assert.equal(await store.verify('Ana', 'minhasenhA'), false);
    assert.equal(await store.verify('Bia', 'minhasenha'), false);
    assert.ok(!readFileSync(file, 'utf8').includes('minhasenha'));
    const reloaded = new PasswordStore(file);
    assert.equal(await reloaded.verify('ana', 'minhasenha'), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('arquivo de senhas estragado começa vazio em vez de derrubar o servidor', () => {
  const store = new PasswordStore('/caminho/que/nao/existe/passwords.json');
  assert.equal(store.has('Ana'), false);
});

test('depois de 5 senhas erradas seguidas a chave fica travada até passar o tempo', () => {
  let now = 1000;
  const guard = new LoginGuard({ maxFailures: 5, lockMs: 30000, now: () => now });
  for (let i = 0; i < 4; i++) guard.fail('ip|ana');
  assert.equal(guard.retryIn('ip|ana'), 0);
  guard.fail('ip|ana');
  assert.equal(guard.retryIn('ip|ana'), 30000);
  assert.equal(guard.retryIn('ip|bia'), 0);
  now += 31000;
  assert.equal(guard.retryIn('ip|ana'), 0);
  guard.fail('ip|ana');
  guard.clear('ip|ana');
  for (let i = 0; i < 4; i++) guard.fail('ip|ana');
  assert.equal(guard.retryIn('ip|ana'), 0);
});
