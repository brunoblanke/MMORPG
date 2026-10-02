// tests/depot.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, placeAt } from './helpers/fixture.js';
import { setAssets, objectIdType } from '../shared/assets.js';
import { TICK_MS } from '../js/simulation.js';
import { DEPOT_SIZE } from '../js/systems/inventory/depot.js';

const DEPOT = 'decoracao/baus/deposito';
const BAG = 'itens/recipientes/bag';
const ROPE = 'itens/ferramentas/rope';
const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(DEPOT, { bloqueia: true, move: false, uso: 'deposito' }),
  asset(BAG, { move: true, peso: 10, espacos: 4 }),
  asset(ROPE, { move: true, peso: 18 })
]);

// ================================================================================================================================================================================================================================================
// game
// Player colado num depósito, com uma corda na mochila.

function game() {
  const sim = buildGame({ objects: [...floorRect(0, 14, 0, 14, 0), [DEPOT, 6, 5, 0, 0, 0, 0, 1]], player: { x: 5, y: 5, z: 0 } });
  sim.player.equip.mochila = { uid: 'b1', type: BAG, items: [{ uid: 'r1', type: ROPE }, null, null, null] };
  sim.depotObj = sim.objects.find(obj => objectIdType(obj.id) === DEPOT);
  return sim;
}

function run(sim, command) {
  sim.enqueue('player1', command);
  sim.tick(sim.time + TICK_MS);
}

test('depósito: usar abre o do player; guardar tira o peso da mochila; afastar fecha', () => {
  const sim = game();
  const player = sim.player;
  run(sim, { type: 'useObject', id: sim.depotObj.id });
  const view = sim.inventory.viewFor(player);
  const opened = view.opened.find(o => o.depot);
  assert.ok(opened);
  assert.equal(opened.item.items.length, DEPOT_SIZE);
  const cap = sim.inventory.capUsed(player);
  run(sim, { type: 'moveInv', from: { t: 'c', uid: 'b1', i: 0 }, to: { t: 'c', uid: player.depot.uid, i: 0 }, amount: 1 });
  assert.equal(player.depot.items[0].type, ROPE);
  assert.equal(player.equip.mochila.items[0], null);
  assert.ok(sim.inventory.capUsed(player) < cap);
  placeAt(sim, player, 10, 10, 0);
  sim.tick(sim.time + TICK_MS);
  assert.ok(!sim.inventory.viewFor(player).opened.some(o => o.depot));
  run(sim, { type: 'moveInv', from: { t: 'c', uid: player.depot.uid, i: 0 }, to: { t: 'e', key: 'mochila' }, amount: 1 });
  assert.equal(player.depot.items[0].type, ROPE);
});

test('depósito: fica guardado no personagem e volta ao entrar de novo', () => {
  const sim = game();
  run(sim, { type: 'useObject', id: sim.depotObj.id });
  run(sim, { type: 'moveInv', from: { t: 'c', uid: 'b1', i: 0 }, to: { t: 'c', uid: sim.player.depot.uid, i: 0 }, amount: 1 });
  const saved = JSON.parse(JSON.stringify(sim.player.toSave()));
  const back = sim.addPlayer('volta', { name: 'Volta', saved });
  assert.equal(back.depot.items[0].type, ROPE);
  assert.equal(back.depot.items.length, DEPOT_SIZE);
});
