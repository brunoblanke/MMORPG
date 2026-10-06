// tests/joystick.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directionFromOffset } from '../js/input/joystick.js';

test('o controle anda na direção do eixo que mais passou do centro', () => {
  assert.deepEqual(directionFromOffset(30, 5, 36), { dx: 1, dy: 0 });
  assert.deepEqual(directionFromOffset(-30, 5, 36), { dx: -1, dy: 0 });
  assert.deepEqual(directionFromOffset(4, 30, 36), { dx: 0, dy: 1 });
  assert.deepEqual(directionFromOffset(-4, -30, 36), { dx: 0, dy: -1 });
});

test('perto do centro o controle não anda', () => {
  assert.equal(directionFromOffset(0, 0, 36), null);
  assert.equal(directionFromOffset(5, -5, 36), null);
});
