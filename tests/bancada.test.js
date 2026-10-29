// tests/bancada.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setAssets } from '../shared/assets.js';
import { restackItems, stackBase, buildLayersFromMapData } from '../shared/map-format.js';

const COUNTER = 'estrutura/balcoes/bancada-de-teste';
const WALL = 'estrutura/paredes/parede-de-teste';
const LOCKER = 'decoracao/baus/locker-de-teste';
const COIN = 'itens/valiosos/moeda-de-teste';

setAssets([
  { id: COUNTER, ferramenta: 'paredes', grupo: 'estrutura', pasta: 'balcoes', nome: 'bancada-de-teste', url: '/b.png', quadro: 64, quadros: 1, pecas: ['x', 'y'], volumePecas: 1, propriedades: { colisao: { arremesso: false, apoia: true } } },
  { id: WALL, ferramenta: 'paredes', grupo: 'estrutura', pasta: 'paredes', nome: 'parede-de-teste', url: '/p.png', quadro: 64, quadros: 1, pecas: ['x', 'y'], propriedades: {} },
  { id: LOCKER, ferramenta: 'objetos', grupo: 'decoracao', pasta: 'baus', nome: 'locker-de-teste', url: '/l.png', quadro: 32, quadros: 1, pecas: [], propriedades: { altura: true, bloqueia: true } },
  { id: COIN, ferramenta: 'objetos', grupo: 'itens', pasta: 'valiosos', nome: 'moeda-de-teste', url: '/m.png', quadro: 32, quadros: 1, pecas: [], propriedades: { move: true } }
]);

test('editor: objeto posto na bancada fica em cima dela; na parede comum fica no chão', () => {
  const onCounter = [{ type: `${COUNTER}#x` }, { type: LOCKER, step: 0 }, { type: COIN, step: 0 }];
  assert.equal(stackBase(onCounter), 1);
  restackItems(onCounter);
  assert.deepEqual(onCounter.slice(1).map(o => o.step), [1, 2]);
  const onWall = [{ type: `${WALL}#x` }, { type: LOCKER, step: 0 }];
  restackItems(onWall);
  assert.equal(onWall[1].step, 0);
});

test('editor: o mapa aberto recalcula a altura do que já estava em cima da bancada', () => {
  const mapData = { version: 3, objetosData: [[`${COUNTER}#x`, 5, 5, 0, 0, false, false, true], [LOCKER, 5, 5, 0, 0, false, true, true]], transicoesData: [], enemyData: [], safeZoneData: [], spawn: { x: 1, y: 1, z: 0 } };
  const { layers } = buildLayersFromMapData(mapData, 64);
  assert.equal(layers[0]['5,5'].objects.find(o => o.type === LOCKER).step, 1);
});
