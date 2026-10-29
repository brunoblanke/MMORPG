// tests/fogueira.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, FLOOR } from './helpers/fixture.js';
import { TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';
import { CAMPFIRE_WOOD, CAMPFIRE_MS } from '../js/systems/interactions.js';

const BAG = 'itens/recipientes/bolsa-de-teste';
const WOOD = 'itens/materiais/madeira-de-teste';
const FIRE = 'decoracao/iluminacao/fogo-de-teste';

const asset = (id, propriedades, ferramenta = 'objetos') => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta, grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(FLOOR, {}, 'pisos'),
  asset(BAG, { move: true, espacos: 4 }),
  asset(WOOD, { move: true, empilhavel: true, peso: 5, uso: 'fogueira', ativoComo: FIRE }),
  asset(FIRE, { move: false })
]);

// ================================================================================================================================================================================================================================================
// game
// Player em (5, 5) com count madeiras no chão em (6, 5).

function game(count) {
  const sim = buildGame({ objects: floorRect(0, 12, 0, 12, 0), player: { x: 5, y: 5, z: 0 } });
  sim.time = 100000;
  const wood = sim.inventory.spawnGroundItem({ uid: 'w1', type: WOOD, count }, 6, 5, 0);
  return { sim, wood };
}

function light(sim, wood) {
  sim.enqueue('player1', { type: 'useItem', from: { t: 'g', id: wood.id } });
  sim.tick(sim.time + TICK_MS);
  return sim.drainEvents();
}

test('fogueira: 3 madeiras no chão acendem o fogo só pra quem usou e ele sai do jogo depois de CAMPFIRE_MS', () => {
  const { sim, wood } = game(CAMPFIRE_WOOD);
  const player = sim.player;
  const fire = light(sim, wood).find(e => e.type === 'campfire');
  assert.ok(fire);
  assert.deepEqual([fire.playerId, fire.x, fire.y, fire.look, fire.ms], [player.id, 6, 5, FIRE, CAMPFIRE_MS]);
  assert.equal(sim.inventory.groundItem(wood).count, CAMPFIRE_WOOD, 'a pilha fica como está');
  sim.tick(sim.time + CAMPFIRE_MS - 2 * TICK_MS);
  assert.ok(sim.players.includes(player), 'ainda no jogo');
  sim.tick(sim.time + CAMPFIRE_MS);
  assert.equal(sim.players.includes(player), false);
  const out = sim.drainLoggedOut();
  assert.equal(out[0], player);
  assert.equal(player.rested, true);
});

test('fogueira: com menos de 3 madeiras não acende', () => {
  const small = game(2);
  const events = light(small.sim, small.wood);
  assert.ok(!events.some(e => e.type === 'campfire'));
  assert.ok(events.some(e => e.type === 'message' && /Junte 3 madeiras/.test(e.text)));
  assert.equal(small.sim.inventory.groundItem(small.wood).count, 2);
});

test('fogueira: não acende em combate; entrar em combate depois de acender apaga e o player fica', () => {
  const { sim, wood } = game(6);
  sim.player.lastCombatTime = sim.time;
  assert.ok(light(sim, wood).some(e => e.type === 'message' && /combate/.test(e.text)));
  sim.player.lastCombatTime = -Infinity;
  light(sim, wood);
  assert.ok(sim.player.restingUntil);
  sim.player.lastCombatTime = sim.time;
  sim.tick(sim.time + CAMPFIRE_MS + TICK_MS);
  assert.ok(sim.players.includes(sim.player));
  assert.equal(sim.player.restingUntil, null);
});

test('fogueira: madeira na mochila não acende', () => {
  const { sim } = game(1);
  sim.player.equip.mochila = { uid: 'b1', type: BAG, items: [{ uid: 'w2', type: WOOD, count: 10 }, null, null, null] };
  sim.enqueue('player1', { type: 'useItem', from: { t: 'c', uid: 'b1', i: 0 } });
  sim.tick(sim.time + TICK_MS);
  assert.ok(sim.drainEvents().some(e => e.type === 'message' && /no chão/.test(e.text)));
  assert.equal(sim.player.equip.mochila.items[0].count, 10);
});
