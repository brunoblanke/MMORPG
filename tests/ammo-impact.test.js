// tests/ammo-impact.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, wall, CREATURE } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { itemInfo } from '../shared/items.js';
import { TICK_MS } from '../js/simulation.js';

const CROSSBOW = 'itens/distancia/crossbow';
const BURST = 'itens/municao/burst-arrow';
const FLAME = 'itens/municao/flame-arrow';
const PLAIN = 'itens/municao/arrow';
const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: id.startsWith('criaturas') ? 'criaturas' : 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(CROSSBOW, { move: true, peso: 40, duasMaos: true }),
  asset(PLAIN, { move: true, peso: 0.7, empilhavel: true, atk: 25 }),
  asset(BURST, { move: true, peso: 0.9, empilhavel: true, atk: 27, impacto: { tipo: 'area', elemento: 'physical', raio: 1, efeito: 'explosion' } }),
  asset(FLAME, { move: true, peso: 0.9, empilhavel: true, atk: 20, impacto: { tipo: 'elemento', elemento: 'fire', dano: 15, efeito: 'fire' } }),
  asset(CREATURE, { vida: 5000 })
]);

// ================================================================================================================================================================================================================================================
// archer
// Player em (5,5) e criaturas paradas nos sqms dados; o alvo é a primeira.

function archer(enemies, objects = []) {
  const game = buildGame({ objects: [...floorRect(0, 14, 0, 14, 0), ...objects], enemies, player: { x: 5, y: 5, z: 0 } });
  for (const enemy of game.enemies) enemy.atk = 0;
  Object.assign(game.player, { lastAttackTime: -1e9, target: game.enemies[0], autoFollow: false });
  game.player.skills.distance.lvl = 200;
  return { game, player: game.player };
}

function runFor(game, ms) {
  const events = [];
  const end = game.time + ms;
  while (game.time < end) {
    game.tick(game.time + TICK_MS);
    events.push(...game.drainEvents());
  }
  return events;
}

function damaged(events, enemy) {
  return events.some(e => e.type === 'damage' && e.targetId === enemy.id);
}

test('a munição lê o efeito do gerador: burst explode em área, flame dá dano extra, flecha comum nada', () => {
  assert.deepEqual(itemInfo(BURST).impact, { kind: 'area', element: 'physical', radius: 1, damage: 0, ticks: 6, effect: 'explosion' });
  assert.equal(itemInfo(FLAME).impact.kind, 'element');
  assert.equal(itemInfo(PLAIN).impact, null);
});

test('burst arrow: explode 3×3 no alvo, fere quem está em volta (o alvo junto) e não quem está fora', () => {
  const { game, player } = archer([[9, 5, 0], [10, 6, 0], [12, 5, 0]]);
  const [target, neighbor, far] = game.enemies;
  player.equip.arma = { uid: 'w1', type: CROSSBOW };
  player.equip.municao = { uid: 'a1', type: BURST, count: 3 };
  const random = Math.random;
  Math.random = () => 0.5;
  game.combat.shoot(player, target, game.combat.rangedWeapon(player), game.time);
  Math.random = random;
  const events = game.drainEvents();
  assert.equal(player.equip.municao.count, 2);
  assert.ok(damaged(events, target));
  assert.ok(damaged(events, neighbor));
  assert.ok(!damaged(events, far));
  const effect = events.find(e => e.type === 'effect' && e.effect === 'explosion');
  assert.equal(effect.tiles.length, 9);
});

test('burst arrow: a parede segura a explosão (quem está atrás dela não leva)', () => {
  const { game, player } = archer([[9, 5, 0], [10, 6, 0]], [...wall(10, 5), ...wall(9, 6)]);
  const [target, behind] = game.enemies;
  player.equip.arma = { uid: 'w1', type: CROSSBOW };
  player.equip.municao = { uid: 'a1', type: BURST, count: 3 };
  const random = Math.random;
  Math.random = () => 0.5;
  game.combat.shoot(player, target, game.combat.rangedWeapon(player), game.time);
  Math.random = random;
  const events = game.drainEvents();
  const effect = events.find(e => e.type === 'effect' && e.effect === 'explosion');
  assert.ok(effect);
  assert.ok(!effect.tiles.some(([x, y]) => x === 10 && y === 6));
  assert.ok(damaged(events, target));
  assert.ok(!damaged(events, behind));
});

test('flame arrow: além do dano do tiro, o dano extra do elemento no alvo atingido', () => {
  const { game, player } = archer([[9, 5, 0]]);
  player.equip.arma = { uid: 'w1', type: CROSSBOW };
  player.equip.municao = { uid: 'a1', type: FLAME, count: 3 };
  const random = Math.random;
  Math.random = () => 0.5;
  const events = runFor(game, 100);
  Math.random = random;
  assert.ok(events.some(e => e.type === 'damage' && e.element === 'fire' && e.amount === 15));
  assert.ok(events.some(e => e.type === 'effect' && e.effect === 'fire'));
});
