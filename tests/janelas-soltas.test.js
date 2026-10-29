// tests/janelas-soltas.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freePosition, FREE_WINDOW_W, FREE_HEADER_H } from '../js/views/inventory-ui/common.js';

test('janela solta guardada no PC aparece dentro da tela do celular; dentro da tela fica onde está', () => {
  assert.deepEqual(freePosition(1300, 600, 412, 915), { x: 412 - FREE_WINDOW_W, y: 600 });
  assert.deepEqual(freePosition(1300, 1200, 412, 915), { x: 412 - FREE_WINDOW_W, y: 915 - FREE_HEADER_H });
  assert.deepEqual(freePosition(-50, -20, 412, 915), { x: 0, y: 0 });
  assert.deepEqual(freePosition(100, 200, 1400, 900), { x: 100, y: 200 });
});
