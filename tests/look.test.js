// tests/look.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMapData, floorRect } from './helpers/fixture.js';
import { Simulation } from '../js/simulation.js';
import { describeGroundObject } from '../js/views/look.js';

const DOOR = 'estrutura/paredes/teste#porta-x';

// ================================================================================================================================================================================================================================================
// world
// A Casa Azul (10..12, 10..12) com a porta no sqm (13, 11), do lado de fora.

function world(houses = {}) {
  const map = buildMapData({ objects: floorRect(0, 29, 0, 29, 0), spawn: { x: 5, y: 5, z: 0 } });
  map.houseData = [];
  for (let y = 10; y <= 12; y++) for (let x = 10; x <= 12; x++) map.houseData.push([x, y, 0, 'Casa Azul', 100]);
  return new Simulation(map, { houses }).world;
}

test('Shift + clique na porta de uma casa com dono mostra de quem ela é', () => {
  const door = { id: `${DOOR}_1`, x: 13, y: 11, z: 0 };
  assert.equal(describeGroundObject(door, world({ 'Casa Azul': { owner: 'Ana', guests: [] } })), 'Essa casa pertence a Ana');
});

test('porta de casa sem dono, ou longe de qualquer casa, não mostra nada', () => {
  const near = { id: `${DOOR}_1`, x: 13, y: 11, z: 0 };
  const far = { id: `${DOOR}_2`, x: 20, y: 20, z: 0 };
  const owned = world({ 'Casa Azul': { owner: 'Ana', guests: [] } });
  assert.equal(describeGroundObject(near, world()), null);
  assert.equal(describeGroundObject(far, owned), null);
});
