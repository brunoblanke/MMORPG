// tests/editor-fill.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaCells, fillActive } from '../editor/js/model/brush.js';
import { state } from '../editor/js/model/state.js';
import { GRID } from '../editor/js/config.js';

test('preencher área: os sqm do retângulo entre os dois cantos, em qualquer ordem, dentro do mapa', () => {
  assert.equal(areaCells({ x0: 2, y0: 3, x1: 4, y1: 1 }).length, 9);
  assert.deepEqual(areaCells({ x0: 5, y0: 5, x1: 5, y1: 5 }), [{ x: 5, y: 5 }]);
  assert.equal(areaCells({ x0: -3, y0: 0, x1: 1, y1: 0 }).length, 2);
  assert.ok(areaCells({ x0: GRID - 2, y0: 0, x1: GRID + 5, y1: 0 }).every(c => c.x < GRID));
});

test('arrastar preenche área nas ferramentas de pintar, não pras de pôr uma coisa só', () => {
  for (const tool of ['floor', 'item', 'deco', 'wall', 'eraser', 'safe', 'house']) {
    state.tool = tool;
    assert.equal(fillActive(), true, tool);
  }
  for (const tool of ['select', 'enemy', 'npc', 'stairs', 'spawn']) {
    state.tool = tool;
    assert.equal(fillActive(), false, tool);
  }
});
