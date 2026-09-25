// tests/gerador.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { TibiaAssets } = require('../gerador/tibia-assets.js');
const CLIENT = new URL('../gerador/tibia/780', import.meta.url).pathname;

// ================================================================================================================================================================================================================================================
// pngSize

function pngSize(png) {
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

test('gerador lê o Tibia 7.8 e separa o catálogo por categoria, com as variações', () => {
  const { items, creatures } = new TibiaAssets(CLIENT).catalogo();
  const count = (kind) => items.filter(([, category]) => category === kind).length;
  for (const kind of ['ground', 'border', 'wall', 'object', 'item']) assert.ok(count(kind) > 100, `${kind}: ${count(kind)}`);
  assert.ok(creatures.length > 100);
  assert.deepEqual(items.find(([id]) => id === 103), [103, 'ground', 1, 1, 1, 12]);
  assert.deepEqual(items.filter(([id]) => id >= 4531 && id <= 4542).map(([, category]) => category), Array(12).fill('border'));
});

test('gerador devolve o PNG de cada variação de um item', () => {
  const assets = new TibiaAssets(CLIENT);
  assert.deepEqual(pngSize(assets.spriteDoItem(103, 0)), [32, 32]);
  assert.deepEqual(pngSize(assets.spriteDoItem(103, 11)), [32, 32]);
  assert.notDeepEqual(assets.spriteDoItem(103, 0), assets.spriteDoItem(103, 5));
  assert.deepEqual(pngSize(assets.spriteDoItem(1284, 0)), [64, 64]);
  assert.equal(assets.spriteDoItem(103, 12), null);
  assert.equal(assets.spriteDoItem(99999, 0), null);
});

test('gerador monta a folha da criatura: 4 direções × quadros', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gerador-'));
  try {
    const sheet = new TibiaAssets(CLIENT).exportarCriatura(21, dir);
    assert.deepEqual(pngSize(fs.readFileSync(path.join(dir, sheet.file))), [32 * sheet.frames, 32 * 4]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
