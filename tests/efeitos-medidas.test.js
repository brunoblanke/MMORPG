// tests/efeitos-medidas.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { comMedidas } = require('../ferramentas/efeitos.js');

test('efeitos.js grava no shared/effects.js os quadros, o tamanho e o tempo medidos no cliente', () => {
  const texto = [
    'export const EFFECTS = {',
    "  poff: { id: 3, frames: 8, size: 32, ms: 50 },",
    "  'draw-blood': { id: 1, frames: 4, size: 32, ms: 100 }",
    '};',
    'export const MISSILES = {',
    '  arrow: { id: 3, size: 32 }',
    '};'
  ].join('\n');
  const { texto: novo, mudancas } = comMedidas(texto, { 'draw-blood': { id: 1, frames: 7, size: 32, ms: 50 }, poff: { id: 3, frames: 8, size: 32, ms: 50 } }, { arrow: { id: 3, size: 64 } });
  assert.match(novo, /'draw-blood': \{ id: 1, frames: 7, size: 32, ms: 50 \}/);
  assert.match(novo, /  arrow: \{ id: 3, size: 64 \}/);
  assert.deepEqual(mudancas, ['draw-blood: frames 4 → 7, ms 100 → 50', 'projétil arrow: size 32 → 64']);
  assert.equal(novo.split('\n').length, texto.split('\n').length, 'só troca os números');
});
