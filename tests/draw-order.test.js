// tests/draw-order.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareDrawables } from '../js/views/draw-order.js';
import { setAssets } from '../shared/assets.js';

setAssets([{ id: 'estrutura/paredes/teste', ferramenta: 'paredes', rotulo: 'Paredes', nome: 'teste', url: '/p.png', quadro: 64, quadros: 1, ordem: null, pecas: ['x', 'passagem-x'] }]);

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

test('a passagem (topo da parede sobre o vão) fica por cima de quem passa por baixo', () => {
  const lintel = { id: 'estrutura/paredes/teste#passagem-x_1', x: 5, y: 5, z: 0, step: 0, order: 0 };
  const wall = { id: 'estrutura/paredes/teste#x_1', x: 6, y: 5, z: 0, step: 0, order: 0 };
  const list = prepareDrawables(stateWith([lintel, wall]));
  const index = (pred) => list.findIndex(pred);
  assert.ok(index(d => d.id === lintel.id) > index(d => d.entity && d.entity.id === 'p1'));
  assert.ok(index(d => d.id === wall.id) < index(d => d.entity && d.entity.id === 'e1'));
});

test('com a área visível, só os objetos dela entram, os mesmos de quando se olha o mapa todo', async () => {
  const { World } = await import('../js/core/world.js');
  const real = new World();
  const objects = [];
  for (let x = 0; x < 30; x++) {
    for (let y = 0; y < 30; y++) objects.push({ id: `Box_${x}_${y}`, x, y, z: x % 2, step: 0, order: 0, hasVolume: false });
  }
  objects.forEach(obj => real.addObject(obj));
  const base = stateWith(objects);
  base.world = real;
  const all = prepareDrawables({ ...base, visibleArea: null }).map(d => d.id).filter(Boolean);
  const area = { startX: 4, endX: 12, startY: 6, endY: 15 };
  const inArea = prepareDrawables({ ...base, visibleArea: area }).map(d => d.id).filter(Boolean);
  const expected = all.filter(id => { const [, x, y] = id.split('_').map(Number); return x >= area.startX && x < area.endX && y >= area.startY && y < area.endY; });
  assert.equal(inArea.length, 8 * 9);
  assert.deepEqual([...inArea].sort(), [...expected].sort());
});
