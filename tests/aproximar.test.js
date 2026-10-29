// tests/aproximar.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, FLOOR } from './helpers/fixture.js';
import { TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';

const SEED = 'itens/plantas-e-ervas/semente-de-teste';
const BREAD = 'itens/comidas/pao-de-teste';

const asset = (id, propriedades, ferramenta = 'objetos') => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta, grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(FLOOR, {}, 'pisos'),
  asset(SEED, { move: true, plantaComo: 'estrutura/natureza/muda-de-teste' }),
  asset(BREAD, { move: true, alimento: 60 })
]);

// ================================================================================================================================================================================================================================================
// game
// Player em (1, 5) e o item em (6, 5).

function game(type) {
  const sim = buildGame({ objects: floorRect(0, 12, 0, 12, 0), player: { x: 1, y: 5, z: 0 } });
  sim.time = 100000;
  const item = sim.inventory.spawnGroundItem({ uid: 'i1', type }, 6, 5, 0);
  return { sim, item };
}

function run(sim, ticks) {
  for (let i = 0; i < ticks; i++) sim.tick(sim.time + TICK_MS);
}

test('approach: o player vai pro lado do objeto, sem pisar em cima', () => {
  const { sim, item } = game(SEED);
  sim.enqueue('player1', { type: 'approach', id: item.id });
  run(sim, 200);
  assert.deepEqual([sim.player.x, sim.player.y], [5, 5]);
});

test('o andar do 1º clique até o objeto para quando o 2º clique usa: o player fica ao lado, não em cima', () => {
  const { sim, item } = game(BREAD);
  sim.enqueue('player1', { type: 'walkTo', x: 6, y: 5, z: 0 });
  for (let i = 0; i < 200 && sim.player.x < 5; i++) run(sim, 1);
  assert.equal(sim.player.x, 5, 'chegou do lado, ainda andando pra cima do item');
  sim.enqueue('player1', { type: 'useItem', from: { t: 'g', id: item.id } });
  run(sim, 200);
  assert.deepEqual([sim.player.x, sim.player.y], [5, 5]);
  assert.ok(sim.player.food > 0, 'comeu ao chegar do lado');
});
