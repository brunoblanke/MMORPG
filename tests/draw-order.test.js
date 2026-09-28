// tests/draw-order.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareDrawables } from '../js/views/draw-order.js';

const world = { getObjectsAt: () => [] };

function stateWith(objects, deadBodies = []) {
  const player = { id: 'p1', isPlayer: true, x: 5, y: 5, z: 0, step: 1, renderX: 5, renderY: 5, order: 1 };
  const enemy = { id: 'e1', type: 'enemy', x: 6, y: 5, z: 0, step: 0, renderX: 6, renderY: 5, order: 2 };
  return { player, players: [player], enemies: [enemy], objects, deadBodies, world };
}

test('item jogado no sqm do player ou do inimigo fica embaixo dele, mesmo com volume', () => {
  const box = { id: 'Box_1', x: 5, y: 5, z: 0, step: 0, hasVolume: true, order: 50 };
  const bag = { id: 'Bag_1', x: 6, y: 5, z: 0, step: 0, order: 60 };
  const corpse = { id: 'c1', isCorpse: true, x: 6, y: 5, z: 0, step: 0, order: 70 };
  const list = prepareDrawables(stateWith([box, bag], [corpse]));
  const index = (pred) => list.findIndex(pred);
  assert.ok(index(d => d.id === 'Box_1') < index(d => d.entity && d.entity.id === 'p1'));
  assert.ok(index(d => d.id === 'Bag_1') < index(d => d.entity && d.entity.id === 'e1'));
  assert.ok(index(d => d.id === 'c1') < index(d => d.entity && d.entity.id === 'e1'));
});

test('o que está num andar acima continua por cima do player', () => {
  const roofItem = { id: 'Bag_2', x: 5, y: 5, z: 1, step: 0, order: 0 };
  const state = stateWith([roofItem]);
  const list = prepareDrawables(state);
  assert.ok(list.findIndex(d => d.id === 'Bag_2') > list.findIndex(d => d.entity && d.entity.id === 'p1'));
});
