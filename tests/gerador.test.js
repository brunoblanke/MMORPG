// tests/gerador.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
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

test('gerador monta a folha da criatura: 4 direções × quadros, com cores e addons', () => {
  const assets = new TibiaAssets(CLIENT);
  const rat = assets.folhaDeCriatura(21);
  assert.deepEqual([rat.tamanho, rat.quadros], [32, 3]);
  assert.deepEqual(pngSize(rat.png), [32 * 3, 32 * 4]);

  const plain = assets.folhaDeCriatura(128, { cores: [78, 69, 58, 76] });
  const red = assets.folhaDeCriatura(128, { cores: [78, 94, 58, 76] });
  const dressed = assets.folhaDeCriatura(128, { cores: [78, 69, 58, 76], addons: [1, 2] });
  assert.deepEqual(pngSize(plain.png), [64 * 3, 64 * 4]);
  assert.notDeepEqual(plain.png, red.png);
  assert.notDeepEqual(plain.png, dressed.png);
  assert.equal(assets.folhaDeCriatura(99999), null);
});

test('gerador reconhece cada peça de borda pelo desenho, em qualquer ordem de conjunto', () => {
  const assets = new TibiaAssets(CLIENT);
  const byId = new Map(assets.conjuntosDeBorda().flat().map(peca => [peca.id, peca.chave]));
  const pieces = (first) => Array.from({ length: 12 }, (_, i) => byId.get(first + i));
  assert.deepEqual(pieces(4531), ['s', 'o', 'n', 'l', 'sl', 'so', 'nl', 'no', 'int-sl', 'int-so', 'int-nl', 'int-no']);
  assert.deepEqual(pieces(1054), ['no', 'nl', 'so', 'sl', 'o', 'l', 'n', 's', 'int-no', 'int-nl', 'int-so', 'int-sl']);
});

test('gerador sugere as bordas que combinam com o chão, ou nenhuma', () => {
  const assets = new TibiaAssets(CLIENT);
  const grass = assets.sugerirBordas([4526, 4527, 4528, 4529]);
  assert.deepEqual(grass.conjunto, [4531, 4542]);
  assert.equal(grass.pecas.s, 4531);
  assert.equal(grass.pecas['int-no'], 4542);
  assert.deepEqual(assets.sugerirBordas([231]).conjunto, [4749, 4760]);
  assert.equal(assets.sugerirBordas([4608]), null);
  assert.equal(assets.sugerirBordas([99999]), null);
});

test('gerador reconhece as 4 peças de parede pelo desenho e sugere as do mesmo material', () => {
  const assets = new TibiaAssets(CLIENT);
  assert.deepEqual([1271, 1270, 1274, 1272].map(id => assets.pecaDeParede(id)), ['x', 'y', 'xy', 'yx']);
  assert.equal(assets.pecaDeParede(4526), null);

  assert.deepEqual(assets.sugerirParedes(1271).pecas, { x: 1271, y: 1270, xy: 1274, yx: 1272 });
  assert.deepEqual(assets.sugerirParedes(1112).pecas, { x: 1113, y: 1112, xy: 1116, yx: 1114 });
  assert.equal(assets.sugerirParedes(4526), null);
});

test('gerador devolve cada quadro da animação de um item', () => {
  const assets = new TibiaAssets(CLIENT);
  assert.deepEqual(pngSize(assets.spriteDoItem(1442, 0, 2)), [64, 64]);
  assert.notDeepEqual(assets.spriteDoItem(1442, 0, 0), assets.spriteDoItem(1442, 0, 1));
  assert.equal(assets.spriteDoItem(1442, 0, 3), null);
});
