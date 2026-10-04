// tests/distance.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, wall, placeAt, CREATURE } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { TICK_MS } from '../js/simulation.js';

const CROSSBOW = 'itens/distancia/crossbow';
const SPEAR = 'itens/distancia/spear';
const ARROW = 'itens/municao/arrow';
const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: id.startsWith('criaturas') ? 'criaturas' : 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(CROSSBOW, { move: true, peso: 40 }),
  asset(SPEAR, { move: true, peso: 20, empilhavel: true, atk: 25 }),
  asset(ARROW, { move: true, peso: 0.7, empilhavel: true, atk: 25 }),
  asset(CREATURE, { vida: 5000 })
]);

// ================================================================================================================================================================================================================================================
// archer
// Player parado em (5,5) com a criatura em (9,5) como alvo, sem seguir.

function archer(objects = []) {
  const game = buildGame({ objects: [...floorRect(0, 14, 0, 14, 0), ...objects], enemies: [[9, 5, 0]], player: { x: 5, y: 5, z: 0 } });
  const enemy = game.enemies[0];
  enemy.atk = 0;
  game.player.lastAttackTime = -1e9;
  game.player.target = enemy;
  game.player.autoFollow = false;
  game.player.skills.distance.lvl = 200;
  return { game, enemy };
}

// ================================================================================================================================================================================================================================================
// runFor

function runFor(game, ms) {
  const events = [];
  const end = game.time + ms;
  while (game.time < end) {
    game.tick(game.time + TICK_MS);
    events.push(...game.drainEvents());
  }
  return events;
}

test('besta: atira a flecha do espaço de munição de longe, gasta uma por tiro e treina distance', () => {
  const { game, enemy } = archer();
  const player = game.player;
  player.equip.arma = { uid: 'w1', type: CROSSBOW };
  player.equip.municao = { uid: 'a1', type: ARROW, count: 3 };
  const tries = player.skills.distance.tries;
  const events = runFor(game, 100);
  assert.ok(events.some(e => e.type === 'missile' && e.kind === 'arrow'));
  assert.ok(enemy.currentHp < enemy.hp);
  assert.equal(player.equip.municao.count, 2);
  assert.ok(player.skills.distance.tries > tries || player.skills.distance.lvl > 200);
  assert.equal(player.x, 5);
});

test('besta sem munição não ataca e avisa', () => {
  const { game, enemy } = archer();
  game.player.equip.arma = { uid: 'w1', type: CROSSBOW };
  const events = runFor(game, 100);
  assert.equal(enemy.currentHp, enemy.hp);
  assert.ok(events.some(e => e.type === 'message' && /munição/.test(e.text)));
});

test('lança: jogada até 4 sqm, cai no sqm do alvo; a última sai da mão', () => {
  const { game } = archer();
  game.player.equip.arma = { uid: 'w1', type: SPEAR, count: 1 };
  runFor(game, 100);
  assert.equal(game.player.equip.arma, null);
  const dropped = game.objects.filter(o => o.itemData && o.itemData.type === SPEAR);
  assert.equal(dropped.length, 1);
  assert.deepEqual([dropped[0].x, dropped[0].y], [9, 5]);
});

test('distância: alvo fora do alcance ou atrás da parede não leva tiro', () => {
  const far = archer();
  far.game.player.equip.arma = { uid: 'w1', type: SPEAR, count: 5 };
  placeAt(far.game, far.enemy, 10, 5, 0);
  far.game.combat.processPlayer(far.game.player, far.game.time);
  assert.equal(far.game.player.equip.arma.count, 5);

  const walled = archer(wall(7, 5));
  walled.game.player.equip.arma = { uid: 'w1', type: CROSSBOW };
  walled.game.player.equip.municao = { uid: 'a1', type: ARROW, count: 3 };
  walled.game.combat.processPlayer(walled.game.player, walled.game.time);
  assert.equal(walled.game.player.equip.municao.count, 3);
});

test('flechas empilham e juntam na pilha do espaço de munição', () => {
  const { game } = archer();
  const player = game.player;
  player.equip.mochila = { uid: 'b1', type: 'itens/recipientes/bag', items: [{ uid: 'a2', type: ARROW, count: 10 }, null] };
  player.equip.municao = { uid: 'a1', type: ARROW, count: 5 };
  game.enqueue('player1', { type: 'moveInv', from: { t: 'c', uid: 'b1', i: 0 }, to: { t: 'e', key: 'municao' }, amount: 10 });
  game.tick(game.time + TICK_MS);
  assert.equal(player.equip.municao.count, 15);
});
