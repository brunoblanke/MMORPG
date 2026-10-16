// tests/amulet-loss.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { TICK_MS } from '../js/simulation.js';

const AOL = 'itens/amuletos-e-colares/amulet-of-loss';
const SWORD = 'itens/espadas/teste';
const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([asset(AOL, { move: true, peso: 1, protegePerda: true }), asset(SWORD, { move: true, peso: 10, atk: 10 })]);

// ================================================================================================================================================================================================================================================
// die
// O player morre com o amuleto da perda, a espada e (se pedido) a caveira vermelha; devolve o game.

function die({ red = false, amulet = true } = {}) {
  const game = buildGame({ objects: floorRect(0, 14, 0, 14, 0), player: { x: 5, y: 5, z: 0 } });
  game.time = 1000;
  game.player.equip.arma = { uid: 's1', type: SWORD };
  if (amulet) game.player.equip.amuleto = { uid: 'a1', type: AOL };
  if (red) game.player.frags = [game.wallTime(), game.wallTime(), game.wallTime()];
  game.player.skills.sword = { lvl: 50, pct: 0, tries: 0 };
  const xp = game.player.totalXp();
  game.player.currentHp = 0;
  game.tick(game.time + TICK_MS);
  return { game, xp };
}

test('amuleto da perda: nada cai, só o amuleto se perde; XP e skills ainda caem', () => {
  const { game, xp } = die();
  const corpse = game.deadBodies.find(c => c.ownerId === game.player.id);
  assert.ok(corpse.itemData.items.every(i => !i));
  assert.equal(game.player.equip.arma.uid, 's1');
  assert.equal(game.player.equip.amuleto, null);
  game.player.respawn();
  assert.ok(game.player.totalXp() < xp);
  assert.ok(game.player.skills.sword.lvl < 50);
});

test('sem o amuleto (ou com caveira vermelha) a perda é a de sempre', () => {
  const red = die({ red: true });
  const corpse = red.game.deadBodies.find(c => c.ownerId === red.game.player.id);
  assert.ok(corpse.itemData.items.some(i => i && i.uid === 's1'));
  assert.ok(corpse.itemData.items.some(i => i && i.uid === 'a1'));
});
