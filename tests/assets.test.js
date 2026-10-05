// tests/assets.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setAssets, floorMiddle, spriteFrame, objectProps, isFloorType, isStairsType, isHoleType, isItemType, isWallType, displayName, interiorVariant, objectIdType } from '../shared/assets.js';
import { serializeMapFromLayers, buildLayersFromMapData } from '../shared/map-format.js';

const GRID = 10;

setAssets([
  { id: 'estrutura/pisos/areia', ferramenta: 'pisos', rotulo: 'Estrutura › Pisos', nome: 'areia', url: '/s.png', quadro: 32, quadros: 1, variacoes: 1, padrao: [4, 2], pecas: [] },
  { id: 'estrutura/pisos/agua', ferramenta: 'pisos', rotulo: 'Estrutura › Pisos', nome: 'agua', url: '/a.png', quadro: 32, quadros: 14, msPorQuadro: 200, variacoes: 4, pecas: [] },
  { id: 'estrutura/pisos/grama', ferramenta: 'pisos', rotulo: 'Estrutura › Pisos', nome: 'grama', url: '/g.png', quadro: 32, quadros: 1, variacoes: 4, pecas: [] },
  { id: 'estrutura/paredes/tijolo', ferramenta: 'paredes', rotulo: 'Estrutura › Paredes', nome: 'tijolo', url: '/t.png', quadro: 64, quadros: 1, ordem: null, pecas: ['x', 'porta-x-aberta'] },
  { id: 'itens/recipientes/caixa', ferramenta: 'objetos', rotulo: 'Itens › Recipientes', nome: 'caixa', url: '/c.png', quadro: 32, quadros: 2, propriedades: { bloqueia: false, move: true, altura: true } },
  { id: 'estrutura/escadas/escada', ferramenta: 'objetos', rotulo: 'Estrutura › Escadas', nome: 'escada', url: '/e.png', quadro: 64, quadros: 1, propriedades: {} }
]);

test('a pasta da folha diz o que ela é', () => {
  assert.ok(isFloorType('estrutura/pisos/grama#meio-2'));
  assert.ok(isStairsType('estrutura/escadas/escada'));
  assert.ok(isHoleType('estrutura/entradas/bueiro'));
  assert.ok(isWallType('estrutura/paredes/tijolo#x'));
  assert.ok(isItemType('itens/recipientes/caixa'));
  assert.ok(!isItemType('estrutura/escadas/escada'));
  assert.equal(displayName('criaturas/elementais/fire-elemental'), 'Fire Elemental');
  assert.equal(objectIdType('estrutura/pisos/grama#nl_12'), 'estrutura/pisos/grama#nl');
  assert.match(interiorVariant(3, 4, 0, 4), /^meio-[1-4]$/);
});

test('cada peça sai do lugar certo da folha', () => {
  assert.deepEqual(spriteFrame('estrutura/pisos/grama#meio-3'), { url: '/g.png', x: 64, y: 0, size: 32, frames: 1, ms: 0 });
  assert.deepEqual(spriteFrame('estrutura/pisos/grama#nl'), { url: '/g.png', x: 64, y: 64, size: 32, frames: 1, ms: 0 });
  assert.deepEqual(spriteFrame('estrutura/paredes/tijolo#porta-x-aberta'), { url: '/t.png', x: 64, y: 64, size: 64, frames: 1, ms: 0 });
  assert.deepEqual(spriteFrame('itens/recipientes/caixa'), { url: '/c.png', x: 0, y: 0, size: 32, frames: 2, ms: 0 });
  assert.equal(spriteFrame('itens/nada/nada'), null);
  assert.deepEqual(spriteFrame('estrutura/pisos/agua#meio-2'), { url: '/a.png', x: 14 * 32, y: 0, size: 32, frames: 14, ms: 200 });
  assert.deepEqual(spriteFrame('estrutura/pisos/agua#l'), { url: '/a.png', x: 3 * 14 * 32, y: 32, size: 32, frames: 14, ms: 200 });
});

test('parede e objeto gravam no mapa o comportamento deles', () => {
  assert.deepEqual(objectProps('estrutura/paredes/tijolo#x'), { movable: false, hasVolume: true, blocksMovement: true });
  assert.deepEqual(objectProps('estrutura/paredes/tijolo#porta-x-aberta'), { movable: false, hasVolume: false, blocksMovement: false });
  assert.deepEqual(objectProps('itens/recipientes/caixa'), { movable: true, hasVolume: true, blocksMovement: false });

  const { layers, layerOrder } = buildLayersFromMapData({ objetosData: [] }, GRID);
  layerOrder.push(0);
  layers[0] = buildLayersFromMapData({ objetosData: [['estrutura/pisos/grama', 2, 2, 0, 0, 0, 0, 0, 1]] }, GRID).layers[0];
  const cell = layers[0]['2,2'];
  cell.objects.push({ type: 'itens/recipientes/caixa', step: 0 }, { type: 'itens/recipientes/caixa', step: 0 }, { type: 'estrutura/paredes/tijolo#x' }, { type: 'estrutura/escadas/escada' });
  const map = serializeMapFromLayers(layerOrder, layers, GRID);
  assert.deepEqual(map.objetosData.slice(1), [
    ['itens/recipientes/caixa', 2, 2, 0, 0, true, true, false],
    ['itens/recipientes/caixa', 2, 2, 0, 1, true, true, false],
    ['estrutura/paredes/tijolo#x', 2, 2, 0, 0, false, true, true]
  ]);
  assert.equal(map.transicoesData[0][0], 'estrutura/escadas/escada');
});

test('piso com padrão usa o pedaço da posição (emenda sem costura); sem padrão, sorteia o meio', () => {
  assert.equal(floorMiddle('estrutura/pisos/areia', 5, 3, 0), 'padrao-1-1');
  assert.equal(floorMiddle('estrutura/pisos/areia', 8, 4, 0), 'padrao-0-0');
  assert.deepEqual(spriteFrame('estrutura/pisos/areia#padrao-3-1'), { url: '/s.png', x: 96, y: 5 * 32, size: 32, frames: 1, ms: 0 });
  assert.match(floorMiddle('estrutura/pisos/grama', 5, 3, 0), /^meio-[1-4]$/);
});
