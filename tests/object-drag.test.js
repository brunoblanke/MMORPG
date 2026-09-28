// tests/object-drag.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, pile, wall, hole, placeAt } from './helpers/fixture.js';

const GROUND = floorRect(0, 14, 0, 14, 0);

// ================================================================================================================================================================================================================================================
// setup

function setup(...extra) {
  return buildGame({ objects: [...GROUND, ...extra.flat()] });
}

// ================================================================================================================================================================================================================================================
// box

function box(game, x, y) {
  return game.objects.find(o => o.id.startsWith('Parcel') && o.x === x && o.y === y);
}

test('arremesso vai em linha reta e para na parede', () => {
  const game = setup(pile(3, 5, 1), wall(6, 5));
  placeAt(game, game.player, 4, 5, 0);
  const parcel = box(game, 3, 5);

  game.objectDrag.moveObject(game.player, parcel, 9, 5, 0);
  assert.deepEqual([parcel.x, parcel.y], [3, 5]);

  game.objectDrag.moveObject(game.player, parcel, 5, 5, 0);
  assert.deepEqual([parcel.x, parcel.y], [5, 5]);
});

test('arremesso na diagonal não passa pela quina entre duas paredes', () => {
  const game = setup(pile(3, 3, 1), wall(5, 4), wall(4, 5));
  placeAt(game, game.player, 4, 4, 0);
  const parcel = box(game, 3, 3);

  game.objectDrag.moveObject(game.player, parcel, 6, 6, 0);
  assert.deepEqual([parcel.x, parcel.y], [3, 3]);
});

test('não solta em cima de parede nem fora do piso', () => {
  const game = setup(pile(3, 3, 1), wall(4, 3));
  placeAt(game, game.player, 3, 4, 0);
  const parcel = box(game, 3, 3);

  game.objectDrag.moveObject(game.player, parcel, 4, 3, 0);
  assert.deepEqual([parcel.x, parcel.y], [3, 3]);
  game.objectDrag.moveObject(game.player, parcel, 3, 3, 1);
  assert.deepEqual([parcel.x, parcel.y, parcel.z], [3, 3, 0]);
});

test('volume solto sobre outro vai pro topo da pilha', () => {
  const game = setup(pile(3, 3, 1), pile(5, 3, 2));
  placeAt(game, game.player, 4, 3, 0);
  const parcel = box(game, 3, 3);

  game.objectDrag.moveObject(game.player, parcel, 5, 3, 0);
  assert.deepEqual([parcel.x, parcel.y, parcel.step], [5, 3, 2]);
  assert.equal(game.world.getStepHeight(5, 3, 0), 3);
  assert.equal(game.world.getStepHeight(3, 3, 0), 0);
});

test('tirar o volume de baixo da criatura faz ela descer', () => {
  const game = setup(pile(3, 3, 1));
  placeAt(game, game.player, 3, 3, 0, 1);
  const parcel = box(game, 3, 3);

  game.objectDrag.moveObject(game.player, parcel, 4, 3, 0);
  assert.equal(game.player.step, 0);
});

test('objeto solto num buraco cai pro andar de baixo', () => {
  const game = setup(floorRect(3, 8, 3, 8, 1), pile(3, 3, 1, 1), hole(5, 5, 1));
  placeAt(game, game.player, 4, 4, 1);
  const parcel = game.objects.find(o => o.id.startsWith('Parcel'));

  game.objectDrag.moveObject(game.player, parcel, 5, 5, 1);
  assert.deepEqual([parcel.x, parcel.y, parcel.z], [5, 5, 0]);
});

test('arremesso pro andar de cima passa por cima das paredes de baixo; parede no andar de cima barra', () => {
  const game = setup(pile(3, 5, 1), wall(6, 5), wall(6, 6), floorRect(6, 9, 3, 7, 1));
  placeAt(game, game.player, 4, 5, 0);
  const parcel = box(game, 3, 5);

  game.objectDrag.moveObject(game.player, parcel, 8, 5, 1);
  assert.deepEqual([parcel.x, parcel.y, parcel.z], [8, 5, 1]);

  const blocked = setup(pile(3, 5, 1), floorRect(6, 9, 3, 7, 1), wall(7, 5, 1));
  placeAt(blocked, blocked.player, 4, 5, 0);
  const other = box(blocked, 3, 5);
  blocked.objectDrag.moveObject(blocked.player, other, 9, 5, 1);
  assert.deepEqual([other.x, other.y, other.z], [3, 5, 0]);
});

test('árvore e objetos que bloqueiam o player não barram o arremesso; parede barra', () => {
  const tree = [['estrutura/natureza/arvore#x', 6, 5, 0, 0, 0, 1, 1]];
  const game = setup(pile(3, 5, 1), tree);
  placeAt(game, game.player, 4, 5, 0);
  const parcel = box(game, 3, 5);
  game.objectDrag.moveObject(game.player, parcel, 8, 5, 0);
  assert.deepEqual([parcel.x, parcel.y], [8, 5]);
  assert.equal(game.world.isBlocked(6, 5, 0), true);
});

test('volume jogado do inventário no próprio sqm vai pra baixo e o player sobe', () => {
  const game = setup();
  placeAt(game, game.player, 4, 5, 0);
  const dropped = [];
  for (let i = 0; i < 3; i++) {
    const obj = game.inventory.spawnGroundItem({ type: 'Parcel' }, 4, 5, 0);
    obj.hasVolume = true;
    game.objectDrag.moveObject(game.player, obj, 4, 5, 0);
    dropped.push(obj.step);
  }
  assert.deepEqual(dropped, [0, 1, 2]);
  assert.equal(game.player.step, 3);
});
