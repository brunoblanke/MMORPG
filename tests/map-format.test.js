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
