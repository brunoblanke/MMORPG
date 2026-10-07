// tests/quiver.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, CREATURE } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { isAmmo, isQuiver } from '../shared/items.js';
import { TICK_MS } from '../js/simulation.js';

const BOW = 'itens/distancia/arco';
const CROSSBOW = 'itens/distancia/crossbow';
const ARROW = 'itens/municao/arrow';
const BOLT = 'itens/municao/bolt';
const QUIVER = 'itens/aljavas/aljava';
const SHIELD = 'itens/escudos/escudo';
const SWORD = 'itens/espadas/espada';
const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: id.startsWith('criaturas') ? 'criaturas' : 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(BOW, { move: true, peso: 30, duasMaos: true }),
  asset(CROSSBOW, { move: true, peso: 40, duasMaos: true }),
  asset(ARROW, { move: true, peso: 0.7, empilhavel: true, atk: 25 }),
  asset(BOLT, { move: true, peso: 0.7, empilhavel: true, atk: 30 }),
  asset(QUIVER, { move: true, peso: 5, espacos: 3 }),
  asset(SHIELD, { move: true, peso: 40, def: 20 }),
  asset(SWORD, { move: true, peso: 30, atk: 10 }),
  asset(CREATURE, { vida: 5000 })
]);

// ================================================================================================================================================================================================================================================
// archer
// Player em (5,5) com a criatura em (9,5) de alvo.

function archer() {
  const game = buildGame({ objects: floorRect(0, 14, 0, 14, 0), enemies: [[9, 5, 0]], player: { x: 5, y: 5, z: 0 } });
  const enemy = game.enemies[0];
  enemy.atk = 0;
  Object.assign(game.player, { lastAttackTime: -1e9, target: enemy, autoFollow: false });
  game.player.skills.distance.lvl = 200;
  return { game, player: game.player, enemy };
}

function runFor(game, ms) {
  const end = game.time + ms;
  while (game.time < end) game.tick(game.time + TICK_MS);
}

function equipTo(game, from, to, amount = 1) {
  game.enqueue('player1', { type: 'moveInv', from, to, amount });
  game.tick(game.time + TICK_MS);
  return game.drainEvents().filter(e => e.type === 'message').map(e => e.text);
}

test('munição e aljava são reconhecidas pelo tipo', () => {
  assert.equal(isAmmo(ARROW), true);
  assert.equal(isAmmo(QUIVER), false);
  assert.equal(isQuiver(QUIVER), true);
  assert.equal(isQuiver(ARROW), false);
});

test('arco de duas mãos não equipa com escudo na outra mão, nem o escudo com o arco', () => {
  const { game, player } = archer();
  player.equip.escudo = { uid: 's1', type: SHIELD };
  player.equip.mochila = { uid: 'b1', type: 'itens/recipientes/bag', items: [{ uid: 'w1', type: BOW }, { uid: 's2', type: SHIELD }, null, null] };
  const texts = equipTo(game, { t: 'c', uid: 'b1', i: 0 }, { t: 'e', key: 'arma' });
  assert.equal(player.equip.arma, null);
  assert.ok(texts.some(t => t.includes('duas mãos')));

  player.equip.escudo = null;
  equipTo(game, { t: 'c', uid: 'b1', i: 0 }, { t: 'e', key: 'arma' });
  assert.equal(player.equip.arma.type, BOW);
  const texts2 = equipTo(game, { t: 'c', uid: 'b1', i: 0 }, { t: 'e', key: 'escudo' });
  assert.equal(player.equip.escudo, null);
  assert.ok(texts2.some(t => t.includes('duas mãos')));
});

test('arma de uma mão equipa com escudo normalmente', () => {
  const { game, player } = archer();
  player.equip.escudo = { uid: 's1', type: SHIELD };
  player.equip.mochila = { uid: 'b1', type: 'itens/recipientes/bag', items: [{ uid: 'w1', type: SWORD }, null, null, null] };
  equipTo(game, { t: 'c', uid: 'b1', i: 0 }, { t: 'e', key: 'arma' });
  assert.equal(player.equip.arma.type, SWORD);
});

test('aljava no espaço de munição: o tiro sai da primeira pilha dentro dela e a pilha some quando acaba', () => {
  const { game, player } = archer();
  player.equip.arma = { uid: 'w1', type: BOW };
  player.equip.municao = { uid: 'q1', type: QUIVER, items: [{ uid: 'a1', type: ARROW, count: 1 }, { uid: 'a2', type: BOLT, count: 50 }, null] };
  const random = Math.random;
  Math.random = () => 0.5;
  runFor(game, 100);
  Math.random = random;
  assert.equal(player.equip.municao.type, QUIVER);
  assert.deepEqual(player.equip.municao.items.map(i => i && i.uid), ['a2', null, null]);
});

test('a aljava guarda mais de 100: cada espaço dela é uma pilha de até 100', () => {
  const { game, player } = archer();
  player.equip.municao = { uid: 'q1', type: QUIVER, items: [{ uid: 'a1', type: ARROW, count: 100 }, { uid: 'a2', type: ARROW, count: 100 }, null] };
  player.equip.mochila = { uid: 'b1', type: 'itens/recipientes/bag', items: [{ uid: 'a3', type: ARROW, count: 40 }, null, null, null] };
  equipTo(game, { t: 'c', uid: 'b1', i: 0 }, { t: 'e', key: 'municao' }, 40);
  const counts = player.equip.municao.items.filter(Boolean).map(i => i.count);
  assert.equal(counts.reduce((a, b) => a + b, 0), 240);
  assert.ok(counts.every(c => c <= 100));
});

test('aljava só aceita munição', () => {
  const { game, player } = archer();
  player.equip.municao = { uid: 'q1', type: QUIVER, items: [null, null, null] };
  player.equip.mochila = { uid: 'b1', type: 'itens/recipientes/bag', items: [{ uid: 'w1', type: SWORD }, null, null, null] };
  const texts = equipTo(game, { t: 'c', uid: 'b1', i: 0 }, { t: 'c', uid: 'q1', i: 0 });
  assert.ok(texts.some(t => t.includes('Só munição')));
  assert.deepEqual(player.equip.municao.items, [null, null, null]);
});

test('aljava sem munição dentro: o arco avisa que está sem munição', () => {
  const { game, player } = archer();
  player.equip.arma = { uid: 'w1', type: BOW };
  player.equip.municao = { uid: 'q1', type: QUIVER, items: [null, null, null] };
  assert.ok(game.combat.rangedWeapon(player).error);
});
