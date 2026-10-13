// tests/assets.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setAssets, floorMiddle, spriteFrame, objectProps, isFloorType, isStairsType, isHoleType, isItemType, isWallType, displayName, interiorVariant, objectIdType, blocksThrow, conjuntoPartes, supportsItems } from '../shared/assets.js';
import { serializeMapFromLayers, buildLayersFromMapData } from '../shared/map-format.js';

const GRID = 10;

setAssets([
  { id: 'estrutura/pisos/areia', ferramenta: 'pisos', rotulo: 'Estrutura › Pisos', nome: 'areia', url: '/s.png', quadro: 32, quadros: 1, variacoes: 1, padrao: [4, 2], pecas: [] },
  { id: 'estrutura/pisos/agua', ferramenta: 'pisos', rotulo: 'Estrutura › Pisos', nome: 'agua', url: '/a.png', quadro: 32, quadros: 14, msPorQuadro: 200, variacoes: 4, pecas: [] },
  { id: 'estrutura/pisos/grama', ferramenta: 'pisos', rotulo: 'Estrutura › Pisos', nome: 'grama', url: '/g.png', quadro: 32, quadros: 1, variacoes: 4, pecas: [] },
  { id: 'estrutura/paredes/tijolo', ferramenta: 'paredes', rotulo: 'Estrutura › Paredes', nome: 'tijolo', url: '/t.png', quadro: 64, quadros: 1, ordem: null, pecas: ['x', 'porta-x-aberta'] },
  { id: 'estrutura/cercas/mureta', ferramenta: 'paredes', rotulo: 'Estrutura › Cercas e parapeitos', nome: 'mureta', url: '/m.png', quadro: 64, quadros: 1, ordem: null, pecas: ['x', 'janela-x'] },
  { id: 'estrutura/parapeitos/cerca', ferramenta: 'paredes', rotulo: 'Estrutura › Cercas e parapeitos', nome: 'cerca', url: '/p.png', quadro: 64, quadros: 1, ordem: ['norte', 'sul'], pecas: ['norte', 'sul'] },
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
  assert.deepEqual(objectProps('estrutura/paredes/tijolo#x'), { movable: false, hasVolume: true, blocksMovement: true, volume: 1, climb: 1 });
  assert.deepEqual(objectProps('estrutura/paredes/tijolo#porta-x-aberta'), { movable: false, hasVolume: false, blocksMovement: false, volume: 0, climb: 1 });
  assert.deepEqual(objectProps('itens/recipientes/caixa'), { movable: true, hasVolume: true, blocksMovement: false, volume: 1, climb: 1 });

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

test('creatureFlies: só a criatura marcada como voadora (Voa no gerador)', async () => {
  const { setAssets, creatureFlies } = await import('../shared/assets.js');
  setAssets([
    { id: 'criaturas/mortos-vivos/bat', ferramenta: 'criaturas', grupo: 'criaturas', pasta: 'mortos-vivos', nome: 'bat', url: '/bat.png', quadro: 32, quadros: 1, pecas: [], propriedades: { voa: true } },
    { id: 'criaturas/mamiferos/rat', ferramenta: 'criaturas', grupo: 'criaturas', pasta: 'mamiferos', nome: 'rat', url: '/rat.png', quadro: 32, quadros: 1, pecas: [], propriedades: {} }
  ]);
  assert.equal(creatureFlies('criaturas/mortos-vivos/bat'), true);
  assert.equal(creatureFlies('criaturas/mamiferos/rat'), false);
  assert.equal(creatureFlies('criaturas/nao/existe'), false);
});

test('item jogado: peça fechada de parede e de mureta barra; janela, arco, passagem e porta aberta deixam passar; parapeito deixa passar', () => {
  setAssets([
    { id: 'estrutura/paredes/tijolo', ferramenta: 'paredes', nome: 'tijolo', pecas: ['x'] },
    { id: 'estrutura/cercas/mureta', ferramenta: 'paredes', nome: 'mureta', pecas: ['x'] },
    { id: 'estrutura/parapeitos/cerca', ferramenta: 'paredes', nome: 'cerca', pecas: ['norte'] }
  ]);
  for (const sheet of ['estrutura/paredes/tijolo']) {
    assert.equal(blocksThrow(`${sheet}#x`), true);
    assert.equal(blocksThrow(`${sheet}#xy`), true);
    assert.equal(blocksThrow(`${sheet}#porta-x`), true);
    for (const piece of ['janela-x', 'arco-x-oeste', 'passagem-y', 'porta-y-aberta']) assert.equal(blocksThrow(`${sheet}#${piece}`), false);
  }
  assert.equal(blocksThrow('estrutura/parapeitos/cerca#norte'), false);
  for (const piece of ['x', 'xy', 'porta-x']) assert.equal(blocksThrow(`estrutura/cercas/mureta#${piece}`), false);
});

test('mureta e peça extra: mureta não tem altura e deixa o arremesso passar; extra vale como parede fechada', () => {
  setAssets([{ id: 'estrutura/paredes/familia', ferramenta: 'paredes', nome: 'familia', quadro: 64, quadros: 1, pecas: ['x'], ordem: ['x', 'mureta-x-norte', 'extra-1', 'mureta-no-1'] }]);
  const props = (piece) => objectProps(`estrutura/paredes/familia#${piece}`);
  assert.deepEqual([props('x').hasVolume, props('x').blocksMovement], [true, true]);
  assert.deepEqual([props('mureta-x-sul').hasVolume, props('mureta-x-sul').blocksMovement], [false, true]);
  assert.deepEqual([props('mureta-no-1').hasVolume, props('mureta-no-1').blocksMovement], [false, true]);
  assert.deepEqual([props('extra-1').hasVolume, props('extra-1').blocksMovement], [true, true]);
  assert.equal(blocksThrow('estrutura/paredes/familia#extra-1'), true);
  assert.equal(blocksThrow('estrutura/paredes/familia#mureta-no-2'), false);
  assert.equal(spriteFrame('estrutura/paredes/familia#mureta-x-norte').x, 64);
});

test('conjunto de partes: devolve as peças da direção do tipo, com deslocamento', () => {
  const base = { ferramenta: 'objetos', grupo: 'estrutura', pasta: 'degraus', url: '/c.png', quadro: 64, quadros: 1, pecas: [] };
  setAssets([{ ...base, id: 'estrutura/degraus/escada', nome: 'escada', direcoes: ['norte', 'leste'], conjunto: { norte: [{ tipo: 'a/b/baixo', dx: 0, dy: 1 }, { tipo: 'a/b/alto', dx: 0, dy: 0 }], leste: [{ tipo: 'a/b/baixo', dx: -1, dy: 0 }] } }, { ...base, id: 'estrutura/degraus/outro', nome: 'outro' }]);
  assert.deepEqual(conjuntoPartes('estrutura/degraus/escada'), [{ type: 'a/b/baixo', dx: 0, dy: 1 }, { type: 'a/b/alto', dx: 0, dy: 0 }]);
  assert.deepEqual(conjuntoPartes('estrutura/degraus/escada#leste'), [{ type: 'a/b/baixo', dx: -1, dy: 0 }]);
  assert.deepEqual(conjuntoPartes('estrutura/degraus/outro'), []);
  setAssets([]);
});

test('balcão: peça fechada deixa o arremesso passar e apoia item; porta aberta não apoia; cerca e parede comum não apoiam', () => {
  setAssets([
    { id: 'estrutura/balcoes/loja', ferramenta: 'paredes', nome: 'loja', pecas: ['x'] },
    { id: 'estrutura/cercas/cerca', ferramenta: 'paredes', nome: 'cerca', pecas: ['x'] },
    { id: 'estrutura/paredes/tijolo', ferramenta: 'paredes', nome: 'tijolo', pecas: ['x'] }
  ]);
  assert.equal(blocksThrow('estrutura/balcoes/loja#x'), false);
  assert.equal(supportsItems('estrutura/balcoes/loja#x'), true);
  assert.equal(supportsItems('estrutura/balcoes/loja#porta-x-aberta'), false);
  assert.equal(supportsItems('estrutura/cercas/cerca#x'), false);
  assert.equal(supportsItems('estrutura/paredes/tijolo#x'), false);
  setAssets([]);
});
