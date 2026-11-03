// tests/hide-covered.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

test('pelo buraco do andar de cima aparece o desenho grande de baixo que sobe até ele (escada, parede)', async () => {
  globalThis.window = globalThis.window || { addEventListener() {}, devicePixelRatio: 1 };
  const { hideCovered } = await import('../js/views/renderer.js');
  const floor = (x, y, level) => ({ x, y, level, isFloor: true, entity: { floorType: 'piso' } });
  const thing = (x, y, level, name) => ({ x, y, level, name });
  const drawables = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (!(x === 1 && y === 1)) drawables.push(floor(x, y, 1));
  drawables.push(thing(2, 2, 0, 'escada'), thing(3, 3, 0, 'bau'), thing(1, 1, 0, 'pilar'));
  const kept = hideCovered(drawables).filter(d => d.name).map(d => d.name).sort();
  assert.deepEqual(kept, ['escada', 'pilar']);
});
