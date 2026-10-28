// tests/explorado.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect } from './helpers/fixture.js';
import { TICK_MS } from '../js/simulation.js';
import { Explored, EXPLORE_RANGE_X, EXPLORE_RANGE_Y } from '../shared/explored.js';
import { minimapCells } from '../js/views/minimap.js';

test('o pincel marca o retângulo em volta do player, no andar dele, e nada fora', () => {
  const explored = new Explored();
  explored.visit({ x: 40, y: 40, z: 0 });
  assert.equal(explored.has(40 + EXPLORE_RANGE_X, 40 - EXPLORE_RANGE_Y, 0), true);
  assert.equal(explored.has(40 + EXPLORE_RANGE_X + 1, 40, 0), false);
  assert.equal(explored.has(40, 40, 1), false, 'outro andar');
  explored.visit({ x: -3, y: -3, z: -1 });
  assert.equal(explored.has(-3 - EXPLORE_RANGE_X, -3, -1), true, 'coordenadas negativas');
});

test('guardar e voltar: o mesmo mapa; o que não serve é ignorado; juntar soma os dois', () => {
  const a = new Explored();
  a.visit({ x: 10, y: 10, z: 0 });
  const saved = JSON.parse(JSON.stringify(a.toSave()));
  const b = new Explored({ ...saved, lixo: 'x', '1,1,0': 'curto', '2,2,0': 5 });
  assert.equal(b.has(10, 10, 0), true);
  assert.deepEqual(Object.keys(b.toSave()), Object.keys(saved));
  const c = new Explored();
  c.visit({ x: 100, y: 10, z: 0 });
  c.merge(saved);
  assert.equal(c.has(10, 10, 0) && c.has(100, 10, 0), true);
});

test('o servidor marca o que o player anda e guarda no personagem', () => {
  const game = buildGame({ objects: floorRect(0, 40, 0, 20, 0), player: { x: 5, y: 5, z: 0 } });
  game.tick(game.time + TICK_MS);
  assert.equal(game.player.explored.has(5, 5, 0), true);
  assert.equal(game.player.explored.has(30, 5, 0), false);
  game.player.x = 30;
  game.tick(game.time + TICK_MS);
  assert.equal(game.player.explored.has(30, 5, 0), true);
  const saved = JSON.parse(JSON.stringify(game.player.toSave()));
  const again = buildGame({ objects: floorRect(0, 40, 0, 20, 0), player: { x: 5, y: 5, z: 0 } });
  again.player.loadSave(saved);
  assert.equal(again.player.explored.has(30, 5, 0), true);
});

test('mini mapa: o que não foi explorado fica preto', () => {
  const game = buildGame({ objects: floorRect(0, 40, 0, 20, 0), player: { x: 5, y: 5, z: 0 } });
  const explored = new Explored();
  explored.visit(game.player);
  const cells = minimapCells(game.world, game.player, () => 'piso', { x: 5 + EXPLORE_RANGE_X, y: 5 }, 3, 1, explored);
  assert.deepEqual(cells, ['piso', 'piso', '#000000']);
});
