// tests/animation.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../js/models/player.js';
import { SpriteSheet } from '../shared/sprite-sheet.js';

// ================================================================================================================================================================================================================================================
// stepping
// Player no meio de um passo de (5, 5) pra (6, 5), indo pra leste.

function stepping() {
  const player = new Player({ x: 6, y: 5, lvl: 1 });
  Object.assign(player, { isMoving: true, moveDirection: 'leste', direction: 'leste', moveStartX: 5, moveStartY: 5, moveStartZ: 0, moveStartStep: 0, moveStartTime: 0, stepDuration: 400 });
  return player;
}

test('andando: no meio do passo desliza na direção dele', () => {
  const player = stepping();
  player.updateAnimation(200);
  assert.equal(player.isMoving, true);
  assert.equal(player.renderX, 5.5);
});

test('virou pro outro lado no meio do passo: o deslize para no sqm, sem andar de costas', () => {
  const player = stepping();
  player.updateAnimation(100);
  player.direction = 'oeste';
  player.updateAnimation(150);
  assert.equal(player.isMoving, false);
  assert.deepEqual([player.renderX, player.renderY], [6, 5]);
  assert.ok(player.walkingUntil > 150, 'segura o quadro de andar um instante');
});

test('quadro de andar nunca usa o quadro parado (o 1º da linha)', () => {
  const sheet = Object.create(SpriteSheet.prototype);
  Object.assign(sheet, { frameWidth: 32, frameHeight: 32, totalFrames: 3, directions: ['sul', 'norte'], origin: { x: 0, y: 0 } });
  const columns = new Set();
  for (let t = 0; t < 2000; t += 25) columns.add(sheet.getWalkRect('norte', t, 100).sx / 32);
  assert.deepEqual([...columns].sort(), [1, 2]);
  assert.equal(sheet.getWalkRect('norte', 0, 100).sy, 32);
});
