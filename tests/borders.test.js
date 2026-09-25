// tests/borders.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMapData, floorRect, FLOOR, FLOOR2, HOLE } from './helpers/fixture.js';
import { generateObjects } from '../js/models/game-object.js';
import { buildLayersFromMapData, serializeMapFromLayers, addFloorToCell } from '../shared/map-format.js';
import { rebuildLayerBorders, refreshBordersAround, getStairTopKeys, computeCellBorders } from '../shared/floor-borders.js';

const GRID = 30;

// ================================================================================================================================================================================================================================================
// floors
// Pisos com a ordem (seq) em que foram colocados.

function floors(type, minX, maxX, minY, maxY, z, firstSeq) {
  return floorRect(minX, maxX, minY, maxY, z).map(([, x, y], i) => [type, x, y, z, 0, false, false, false, firstSeq + i]);
}

// ================================================================================================================================================================================================================================================
// oldMap
// Mapa de antes das bordas gravadas (versão 1): Piso 1 e Piso 2 se cruzando,
// um buraco e uma escada com o topo no andar de cima.

function oldMap() {
  return buildMapData({
    objects: [
      ...floors(FLOOR, 5, 14, 5, 14, 0, 1),
      ...floors(FLOOR2, 10, 20, 10, 18, 0, 500),
      [HOLE, 12, 7, 0, 0, false, false, false],
      ...floors(FLOOR, 4, 16, 2, 12, 1, 1000)
    ],
    stairs: [[8, 12, 0]]
  });
}

// ================================================================================================================================================================================================================================================
// migrate
// O que o editor faz ao abrir um mapa antigo: gera as bordas de todos os andares.

function migrate(mapData) {
  const { layers, layerOrder } = buildLayersFromMapData(mapData, GRID);
  for (const z of layerOrder) rebuildLayerBorders(layers[z], getStairTopKeys(layers[z - 1], z - 1));
  return { layers, layerOrder, map: serializeMapFromLayers(layerOrder, layers, GRID) };
}

// ================================================================================================================================================================================================================================================
// bordersOf
// Bordas do jogo por sqm, na ordem em que são desenhadas.

function bordersOf(objs) {
  const byTile = {};
  for (const obj of objs) {
    if (!obj.isBorder) continue;
    const key = `${obj.x},${obj.y},${obj.z}`;
    (byTile[key] = byTile[key] || []).push(obj.id.replace(/_\d+$/, ''));
  }
  return byTile;
}

test('mapa antigo convertido tem no jogo exatamente as mesmas bordas que o jogo gerava', () => {
  const before = bordersOf(generateObjects(oldMap()));
  const { map } = migrate(oldMap());
  assert.equal(map.version, 3);
  const after = bordersOf(generateObjects(map));

  assert.ok(Object.keys(before).length > 30);
  assert.deepEqual(after, before);
  assert.equal(before['12,7,0'], undefined);
});

test('borda tirada ou posta à mão fica assim no jogo', () => {
  const { layers, layerOrder } = migrate(oldMap());
  const edge = layers[0]['4,8'];
  assert.deepEqual(edge.borders, [{ type: FLOOR, variant: 'o' }]);

  edge.borders = [];
  layers[0]['2,2'].borders.push({ type: FLOOR2, variant: 'int-nl' });
  const objs = generateObjects(serializeMapFromLayers(layerOrder, layers, GRID));
  const borders = bordersOf(objs);

  assert.equal(borders['4,8,0'], undefined);
  assert.deepEqual(borders['2,2,0'], [`${FLOOR2}#int-nl`]);
  assert.ok(objs.filter(o => o.isBorder).every(o => o.floorType && !o.blocksMovement));
});

test('pintar um piso refaz só as bordas em volta dele', () => {
  const { layers } = migrate(oldMap());
  const layer = layers[0];
  layer['25,25'].borders = [{ type: FLOOR2, variant: 'n' }];

  addFloorToCell(layer['3,8'], FLOOR);
  refreshBordersAround(layer, 3, 8);

  assert.deepEqual(layer['3,8'].borders, []);
  assert.deepEqual(layer['2,8'].borders, [{ type: FLOOR, variant: 'o' }]);
  assert.deepEqual(layer['25,25'].borders, [{ type: FLOOR2, variant: 'n' }]);
  assert.deepEqual(computeCellBorders(layer, 12, 7), []);
});
