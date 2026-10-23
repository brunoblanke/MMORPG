// tests/spells-extra.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, CREATURE } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { TICK_MS } from '../js/simulation.js';
import { SUMMONS, SPELL_FOODS } from '../shared/spells.js';

const BAG = 'itens/recipientes/bag';
const RAT = SUMMONS.rat.creature;
const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: id.startsWith('criaturas') ? 'criaturas' : 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(BAG, { move: true, peso: 10, espacos: 4 }),
  ...SPELL_FOODS.map(id => asset(id, { move: true, peso: 5, alimento: 100 })),
  asset(CREATURE, { vida: 500, ataque: 10 }),
  asset(RAT, { vida: 60, ataque: 300 })
]);

// ================================================================================================================================================================================================================================================
// say

function say(game, text) {
  game.enqueue('player1', { type: 'say', text });
  game.tick(game.time + TICK_MS);
  return game.drainEvents();
}

function run(game, ms) {
  const end = game.time + ms;
  while (game.time < end) game.tick(game.time + TICK_MS);
}

// ================================================================================================================================================================================================================================================
// mage

function mage(extra = {}) {
  const game = buildGame({ objects: floorRect(0, 20, 0, 20, 0), player: { x: 5, y: 5, z: 0 }, ...extra });
  game.player.setVocation('druid');
  game.player.lvl = 60;
  game.player.applyLevelStats();
  game.player.mana = game.player.maxMana;
  game.player.equip.mochila = { uid: 'b1', type: BAG, items: [null, null, null, null] };
  game.time = 1000;
  return game;
}

test('exevo pan cria uma comida na mochila e gasta mana', () => {
  const game = mage();
  const before = game.player.mana;
  say(game, 'exevo pan');
  assert.ok(SPELL_FOODS.includes(game.player.equip.mochila.items.find(Boolean).type));
  assert.equal(game.player.mana, before - 80);
});

test('utamo vita: a mana absorve o dano antes da vida, e acaba quando a mana acaba', () => {
  const game = mage();
  say(game, 'utamo vita');
  const mana = game.player.mana;
  const hp = game.player.currentHp;
  game.player.takeDamage(40, game.time);
  assert.equal(game.player.currentHp, hp);
  assert.equal(game.player.mana, mana - 40);
  game.player.mana = 10;
  game.player.takeDamage(30, game.time);
  assert.equal(game.player.currentHp, hp - 20);
});

test('utana vid: o player fica invisível e a criatura não ataca nem o persegue', () => {
  const game = mage({ enemies: [[8, 5, 0]] });
  say(game, 'utana vid');
  assert.equal(game.player.invisible, true);
  const hp = game.player.currentHp;
  run(game, 3000);
  assert.equal(game.player.currentHp, hp);
});

test('utevo res: invoca até 2 criaturas, só as conhecidas, e elas seguem o dono', () => {
  const game = mage();
  say(game, 'utevo res "rat"');
  assert.equal(game.summons.count(game.player), 1);
  say(game, 'utevo res rat');
  game.time += 9000;
  say(game, 'utevo res "rat"');
  assert.equal(game.summons.count(game.player), 2);
  game.time += 9000;
  const events = say(game, 'utevo res "rat"');
  assert.ok(events.some(e => e.text === 'Você não pode invocar mais criaturas.'));
  game.time += 9000;
  assert.ok(say(game, 'utevo res "dragon"').some(e => e.text === 'Você não sabe invocar isso.'));
  const pet = game.enemies.find(e => e.pet);
  assert.equal(pet.summonedBy, 'player1');
  game.player.x = 12;
  game.world.moveEntityTile(game.player, 5, 5, 0, 12, 5, 0);
  run(game, 8000);
  assert.ok(Math.abs(pet.x - game.player.x) <= 3);
});

test('invocada ataca o alvo do dono, não ataca o dono e some quando ele morre', () => {
  const game = mage({ enemies: [[9, 5, 0]] });
  const foe = game.enemies[0];
  say(game, 'utevo res "rat"');
  const pet = game.enemies.find(e => e.pet);
  game.enqueue('player1', { type: 'setTarget', targetId: foe.id });
  game.player.target = foe;
  const hp = foe.currentHp;
  const mine = game.player.currentHp;
  run(game, 12000);
  assert.ok(foe.currentHp < hp, 'a invocada feriu o alvo');
  game.player.currentHp = 0;
  run(game, 200);
  assert.ok(!game.enemies.includes(pet));
});
