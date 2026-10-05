// tests/distance.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, wall, placeAt, CREATURE } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { TICK_MS } from '../js/simulation.js';

const CROSSBOW = 'itens/distancia/crossbow';
const SPEAR = 'itens/distancia/spear';
const ARROW = 'itens/municao/arrow';
const POISON_ARROW = 'itens/municao/poison-arrow';
const INFERNO = 'itens/wands/wand-of-inferno';
const TERRA = 'itens/rods/terra-rod';
const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: id.startsWith('criaturas') ? 'criaturas' : 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(CROSSBOW, { move: true, peso: 40 }),
  asset(SPEAR, { move: true, peso: 20, empilhavel: true, atk: 25 }),
  asset(ARROW, { move: true, peso: 0.7, empilhavel: true, atk: 25 }),
  asset(POISON_ARROW, { move: true, peso: 0.8, empilhavel: true, atk: 23 }),
  asset(INFERNO, { move: true, peso: 27 }),
  asset(TERRA, { move: true, peso: 25 }),
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
  const random = Math.random;
  Math.random = () => 0.5;
  const events = runFor(game, 100);
  Math.random = random;
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

test('flecha envenenada deixa o alvo envenenado', () => {
  const { game, enemy } = archer();
  game.player.equip.arma = { uid: 'w1', type: CROSSBOW };
  game.player.equip.municao = { uid: 'a1', type: POISON_ARROW, count: 3 };
  const random = Math.random;
  Math.random = () => 0.5;
  runFor(game, 100);
  Math.random = random;
  assert.equal(enemy.conditions.poison.source, game.player.id);
});

test('wand: o sorcerer atira fogo até 3 sqm, gastando a mana dela (que treina o magic level); de outra vocação ou sem mana não atira', () => {
  const { game, enemy } = archer();
  const player = game.player;
  player.setVocation('sorcerer');
  player.mana = player.maxMana;
  player.equip.arma = { uid: 'w1', type: INFERNO };
  placeAt(game, enemy, 8, 5, 0);
  const mana = player.mana;
  const events = runFor(game, 100);
  assert.ok(events.some(e => e.type === 'missile' && e.kind === 'fire'));
  assert.ok(events.some(e => e.type === 'damage' && e.targetId === enemy.id && e.element === 'fire' && e.amount >= 56 && e.amount <= 74));
  assert.equal(player.mana, mana - 8);
  assert.ok(player.skills.magic.tries > 0 || player.skills.magic.lvl > 0);

  const druid = archer();
  druid.game.player.setVocation('druid');
  druid.game.player.equip.arma = { uid: 'w2', type: INFERNO };
  placeAt(druid.game, druid.enemy, 8, 5, 0);
  const warned = runFor(druid.game, 100);
  assert.equal(druid.enemy.currentHp, druid.enemy.hp);
  assert.ok(warned.some(e => e.type === 'message' && /sorcerer/.test(e.text)));

  const empty = archer();
  empty.game.player.setVocation('druid');
  empty.game.player.mana = 0;
  empty.game.player.equip.arma = { uid: 'w3', type: TERRA };
  placeAt(empty.game, empty.enemy, 8, 5, 0);
  runFor(empty.game, 100);
  assert.equal(empty.enemy.currentHp, empty.enemy.hp);
});
