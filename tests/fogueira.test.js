// tests/fogueira.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, FLOOR } from './helpers/fixture.js';
import { TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';
import { CAMPFIRE_WOOD, CAMPFIRE_MS, CAMPFIRE_BURN_MS } from '../js/systems/interactions.js';
import { objectIdType } from '../shared/assets.js';

const BAG = 'itens/recipientes/bolsa-de-teste';
const WOOD = 'itens/materiais/madeira-de-teste';
const FIRE = 'decoracao/iluminacao/fogo-de-teste';
const MAT = 'decoracao/moveis/esteira-de-teste';

const asset = (id, propriedades, ferramenta = 'objetos') => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta, grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(FLOOR, {}, 'pisos'),
  asset(BAG, { move: true, espacos: 4 }),
  asset(WOOD, { move: true, empilhavel: true, peso: 5, uso: 'fogueira', ativoComo: FIRE, descansaComo: MAT }),
  asset(FIRE, { move: false }),
  asset(MAT, { move: false })
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

test('fogueira: a pilha inteira queima e vira o fogo pra todos; o player deita (só ele vê) e sai depois de CAMPFIRE_MS', () => {
  const { sim, wood } = game(7);
  const player = sim.player;
  const rest = light(sim, wood).find(e => e.type === 'campfire');
  assert.ok(rest);
  assert.deepEqual([rest.playerId, rest.x, rest.y, rest.look, rest.ms], [player.id, 5, 5, MAT, CAMPFIRE_MS]);
  assert.equal(sim.objects.includes(wood), false, 'as 7 madeiras queimaram');
  const fire = sim.objects.find(o => objectIdType(o.id) === FIRE);
  assert.ok(fire && fire.temporary, 'o fogo está no chão pra todos');
  assert.deepEqual([fire.x, fire.y], [6, 5]);
  sim.tick(sim.time + CAMPFIRE_MS - 2 * TICK_MS);
  assert.ok(sim.players.includes(player), 'ainda no jogo');
  sim.tick(sim.time + CAMPFIRE_MS);
  assert.equal(sim.players.includes(player), false);
  assert.equal(sim.drainLoggedOut()[0], player);
  assert.equal(player.rested, true);
  sim.tick(sim.time + CAMPFIRE_BURN_MS);
  assert.equal(sim.objects.includes(fire), false, 'o fogo apagou');
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
  assert.equal(sim.objects.includes(wood), false);
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

test('fogueira: deitado o player não anda; a cama fica no sqm dele, pro lado oposto ao fogo quando o fogo está em cima', () => {
  const side = game(3);
  const rest = light(side.sim, side.wood).find(e => e.type === 'campfire');
  assert.deepEqual([rest.x, rest.y], [5, 5], 'fogo ao lado: pés no sqm do player, cabeça no de cima');
  side.sim.enqueue('player1', { type: 'walkDir', dx: 0, dy: 1 });
  side.sim.enqueue('player1', { type: 'walkTo', x: 5, y: 9, z: 0 });
  for (let i = 0; i < 5; i++) side.sim.tick(side.sim.time + TICK_MS);
  assert.deepEqual([side.sim.player.x, side.sim.player.y], [5, 5]);
  const { sim } = game(3);
  const north = sim.inventory.spawnGroundItem({ uid: 'w9', type: WOOD, count: 3 }, 5, 4, 0);
  const above = light(sim, north).find(e => e.type === 'campfire');
  assert.deepEqual([above.x, above.y], [5, 6], 'fogo em cima: a cama vai pra baixo');
});

test('fogueira: o player em cima das madeiras dá um passo pro lado antes de deitar, e a cama não fica no fogo', () => {
  const { sim } = game(3);
  const under = sim.inventory.spawnGroundItem({ uid: 'w8', type: WOOD, count: 3 }, 5, 5, 0);
  const rest = light(sim, under).find(e => e.type === 'campfire');
  const fire = sim.objects.find(o => objectIdType(o.id) === FIRE);
  assert.deepEqual([fire.x, fire.y], [5, 5]);
  assert.notDeepEqual([sim.player.x, sim.player.y], [5, 5]);
  assert.equal(Math.max(Math.abs(sim.player.x - 5), Math.abs(sim.player.y - 5)), 1, 'ao lado do fogo');
  assert.equal(rest.x, sim.player.x);
  const bedTiles = [[rest.x, rest.y], [rest.x, rest.y - 1]];
  assert.ok(!bedTiles.some(([bx, by]) => bx === 5 && by === 5), 'a cama não cobre o fogo');
});
