// tests/geometry.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLevel, getEntityLevel } from '../js/core/geometry.js';
import { Player } from '../js/models/player.js';
import { Enemy } from '../js/models/enemy.js';
import { calculateMoveDelay } from '../js/utils/helpers.js';

test('criatura sobe 1 andar a cada 4 volumes; item fica no andar em que foi posto', () => {
  assert.equal(getLevel({ isPlayer: true, z: 0, step: 3 }), 0);
  assert.equal(getLevel({ isPlayer: true, z: 0, step: 4 }), 1);
  assert.equal(getLevel({ type: 'enemy', z: 1, step: 4 }), 2);
  assert.equal(getLevel({ id: 'Parcel_1', z: 0, step: 7 }), 0);
  assert.equal(getLevel({ isCorpse: true, isPlayer: true, z: 1, step: 4 }), 1);
});

test('no meio do passo entre andares, desenha no maior dos dois', () => {
  const moving = { isPlayer: true, z: 0, step: 3, isMoving: true, moveStartZ: 1, moveStartStep: 0 };
  assert.equal(getLevel(moving), 0);
  assert.equal(getEntityLevel(moving), 1);
  assert.equal(getEntityLevel({ ...moving, isMoving: false }), 0);
});

test('o deslize de um passo nunca dura mais que o intervalo entre passos', () => {
  for (const lvl of [1, 5, 10, 20, 45, 80]) {
    for (const creature of [new Player({ x: 0, y: 0, lvl }), new Enemy({ x: 0, y: 0, lvl, type: 'enemy' })]) {
      assert.ok(creature.getStepAnimationDuration() <= calculateMoveDelay(creature.spd), `lvl ${lvl}`);
    }
  }
});
