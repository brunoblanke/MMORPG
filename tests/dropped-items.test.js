// tests/dropped-items.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMapData, floorRect, placeAt } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { Simulation } from '../js/simulation.js';
import { newItem } from '../shared/items.js';
import { DROPPED_LIFETIME_MS } from '../js/systems/dropped-items.js';

const ROPE = 'itens/ferramentas/rope';
const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([asset(ROPE, { move: true, peso: 18 })]);

// ================================================================================================================================================================================================================================================
// game

function game(clock, dropped = []) {
  const map = buildMapData({ objects: floorRect(0, 29, 0, 29, 0), spawn: { x: 5, y: 5, z: 0 } });
  map.houseData = [];
  const sim = new Simulation(map, { clock: () => clock.now, dropped });
  sim.time = 1000;
  return sim;
}

const ropesOf = sim => sim.objects.filter(o => o.itemData && o.itemData.type === ROPE);

test('item jogado no chão some depois de 24h', () => {
  const clock = { now: 1000000 };
  const sim = game(clock);
  sim.inventory.spawnGroundItem(newItem('r1', ROPE, 1), 8, 8, 0);
  sim.tick(1000);
  assert.equal(ropesOf(sim).length, 1);
  clock.now += DROPPED_LIFETIME_MS - 120000;
  sim.tick(2000);
  assert.equal(ropesOf(sim).length, 1, 'ainda não passou 24h');
  clock.now += 180000;
  sim.tick(3000);
  assert.equal(ropesOf(sim).length, 0);
});

test('os itens jogados ficam guardados e voltam com a hora em que foram jogados', () => {
  const clock = { now: 5000000 };
  const sim = game(clock);
  sim.inventory.spawnGroundItem(newItem('r1', ROPE, 1), 8, 8, 0);
  const saved = JSON.parse(JSON.stringify(sim.dropped.toSave()));
  assert.equal(saved.length, 1);
  clock.now += DROPPED_LIFETIME_MS - 60000;
  const again = game(clock, saved);
  assert.deepEqual(ropesOf(again).map(o => [o.x, o.y]), [[8, 8]]);
  clock.now += 120000;
  again.tick(1000);
  assert.equal(ropesOf(again).length, 0);
  assert.equal(game(clock, saved).dropped.toSave().length, 0, 'o que já passou de 24h não volta');
});

