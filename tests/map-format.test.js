// tests/map-format.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLayersFromMapData, serializeMapFromLayers } from '../shared/map-format.js';
import { buildMapData, floorRect } from './helpers/fixture.js';

test('o editor abre e salva o spawn no andar em que ele está', () => {
  for (const z of [-3, 0, 2]) {
    const mapData = buildMapData({ objects: floorRect(0, 5, 0, 5, z), spawn: { x: 2, y: 3, z } });
    const { layers, layerOrder } = buildLayersFromMapData(mapData, 250);
    const saved = serializeMapFromLayers(layerOrder, layers, 250);
    assert.deepEqual(saved.spawn, { x: 2, y: 3, z });
  }
});

test('o editor abre e salva a zona segura de cada andar', () => {
  const safe = [[1, 1, 0], [2, 1, 0], [3, 4, -2], [0, 0, 3]];
  const mapData = buildMapData({ objects: floorRect(0, 5, 0, 5, 0), safe });
  const { layers, layerOrder, stats } = buildLayersFromMapData(mapData, 250);
  assert.equal(stats.safe, 4);
  const saved = serializeMapFromLayers(layerOrder, layers, 250);
  const key = (list) => list.map(t => t.join(',')).sort();
  assert.deepEqual(key(saved.safeZoneData), key(safe));
});

test('pilha do editor: a quantidade vai pro arquivo e volta, e o jogo carrega ela no item do chão', async () => {
  const { collectObjectDescriptors } = await import('../shared/map-format.js');
  const { setAssets } = await import('../shared/assets.js');
  setAssets([{ id: 'itens/comidas/meet', ferramenta: 'objetos', grupo: 'itens', pasta: 'comidas', nome: 'meet', rotulo: 'Itens › Comidas', url: '/meet.png', quadro: 32, quadros: 8, pilha: true, pecas: [], propriedades: { move: true, empilhavel: true } }]);
  const mapData = { objetosData: [['itens/comidas/meet', 2, 3, 0, 0, true, false, false, null, 12]] };
  const { layers, layerOrder } = buildLayersFromMapData(mapData, 10);
  assert.equal(layers[0]['2,3'].objects[0].count, 12);
  const saved = serializeMapFromLayers(layerOrder, layers, 10);
  const entry = saved.objetosData.find(e => e[0] === 'itens/comidas/meet');
  assert.equal(entry[9], 12);
  assert.equal(collectObjectDescriptors(saved).find(d => d.type === 'itens/comidas/meet').count, 12);
});

test('texto da placa/livro e itens do baú vão pro arquivo e voltam', async () => {
  const { collectObjectDescriptors } = await import('../shared/map-format.js');
  const { setAssets } = await import('../shared/assets.js');
  setAssets([{ id: 'estrutura/natureza/placa', ferramenta: 'objetos', grupo: 'estrutura', pasta: 'natureza', nome: 'placa', rotulo: 'Estrutura › Natureza', url: '/p.png', quadro: 32, quadros: 1, pecas: [], propriedades: { bloqueia: true, uso: 'placa' } }]);
  const mapData = { objetosData: [['estrutura/natureza/placa', 1, 2, 0, 0, false, false, true, null, null, { texto: 'Oi' }]] };
  const { layers, layerOrder } = buildLayersFromMapData(mapData, 10);
  assert.deepEqual(layers[0]['1,2'].objects[0].dados, { texto: 'Oi' });
  const saved = serializeMapFromLayers(layerOrder, layers, 10);
  const entry = saved.objetosData.find(e => e[0] === 'estrutura/natureza/placa');
  assert.deepEqual(entry[10], { texto: 'Oi' });
  assert.deepEqual(collectObjectDescriptors(saved).find(d => d.type === 'estrutura/natureza/placa').data, { texto: 'Oi' });
});

test('escada que não gira: o editor guarda pra onde ela sobe e o jogo sobe pra lá', async () => {
  const { setAssets } = await import('../shared/assets.js');
  const { getStairTarget } = await import('../shared/stairs.js');
  const { collectObjectDescriptors } = await import('../shared/map-format.js');
  setAssets([{ id: 'estrutura/escadas/escada-fixa', ferramenta: 'objetos', grupo: 'estrutura', pasta: 'escadas', nome: 'escada-fixa', url: '/e.png', quadro: 32, quadros: 1, pecas: [], propriedades: { transicao: 'escada' } }]);
  const mapData = buildMapData({ objects: floorRect(0, 5, 0, 5, 0) });
  mapData.transicoesData = [['estrutura/escadas/escada-fixa', 2, 2, 0, 'up', 0, 0, 'leste'], ['estrutura/escadas/escada-fixa', 3, 3, 0, 'up', 0, 0]];
  const { layers, layerOrder } = buildLayersFromMapData(mapData, 250);
  assert.equal(layers[0]['2,2'].objects[0].facing, 'leste');
  layers[0]['3,3'].objects[0].facing = 'oeste';
  const saved = serializeMapFromLayers(layerOrder, layers, 250);
  const stairs = collectObjectDescriptors(saved).filter(d => d.stairDirection === 'up');
  const at = (x, y) => stairs.find(d => d.x === x && d.y === y);
  assert.equal(at(2, 2).stairFacing, 'leste');
  assert.equal(at(3, 3).stairFacing, 'oeste');
  const target = getStairTarget(2, 2, 0, 'normal', 'leste');
  assert.deepEqual([at(2, 2).targetX, at(2, 2).targetY, at(2, 2).targetZ], [target.x, target.y, target.z]);
});
