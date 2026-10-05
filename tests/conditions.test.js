// tests/conditions.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, placeAt, wall, CREATURE } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { TICK_MS } from '../js/simulation.js';
import { CONDITIONS, FIELDS } from '../shared/conditions.js';

const FIRE = 'itens/itens-encantados/fire-field';
const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: id.startsWith('criaturas') ? 'criaturas' : 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([asset(FIRE, { move: false }), asset(CREATURE, { vida: 500, comportamento: 'pacifico' })]);

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

function game(extra = {}) {
  return buildGame({ objects: floorRect(0, 14, 0, 14, 0), player: { x: 5, y: 5, z: 0 }, ...extra });
}

test('veneno: tira vida a cada intervalo, na cor dele, e acaba depois das vezes; o mais fraco não troca o mais forte', () => {
  const sim = game();
  const player = sim.player;
  sim.conditions.add(player, 'poison', { damage: 5, ticks: 3 });
  sim.conditions.add(player, 'poison', { damage: 1, ticks: 2 });
  assert.equal(player.conditions.poison.damage, 5);
  const hp = player.currentHp;
  const events = runFor(sim, CONDITIONS.poison.interval * 3 + TICK_MS);
  assert.equal(player.currentHp, hp - 15);
  assert.ok(events.some(e => e.type === 'damage' && e.targetId === player.id && e.element === 'poison'));
  assert.equal(player.conditions.poison, undefined);
  assert.deepEqual(sim.inventory.statsFor(player).conditions, []);
});

test('lento tira velocidade por um tempo; rápido tira o lento', () => {
  const sim = game();
  const player = sim.player;
  const speed = player.spd;
  sim.conditions.add(player, 'slow', { speed: -100, ms: 2000 });
  assert.equal(player.spd, speed - 100);
  assert.deepEqual(sim.inventory.statsFor(player).conditions, ['slow']);
  sim.conditions.add(player, 'haste', { speed: 50, ms: 1000 });
  assert.equal(player.spd, speed + 50);
  runFor(sim, 1100);
  assert.equal(player.spd, speed);
});

test('campo de fogo do mapa: pisar dá o dano na hora e deixa queimando', () => {
  const sim = game({ objects: [...floorRect(0, 14, 0, 14, 0), [FIRE, 6, 5, 0, 0, 0, 0, 0]] });
  const player = sim.player;
  const hp = player.currentHp;
  placeAt(sim, player, 6, 5, 0);
  const events = runFor(sim, TICK_MS);
  assert.equal(player.currentHp, hp - FIELDS[FIRE].hit);
  assert.ok(events.some(e => e.type === 'damage' && e.element === 'fire'));
  assert.equal(player.conditions.fire.ticks, FIELDS[FIRE].ticks);
  runFor(sim, TICK_MS * 4);
  assert.equal(player.currentHp, hp - FIELDS[FIRE].hit);
});

test('campo criado some no tempo dele; o dano dele numa criatura conta pro player que criou', () => {
  const sim = game({ enemies: [[9, 9, 0]] });
  const enemy = sim.enemies[0];
  const field = sim.conditions.placeField(FIRE, enemy.x, enemy.y, 0, sim.player);
  assert.ok(field);
  runFor(sim, TICK_MS);
  assert.ok(enemy.damageBy.get(sim.player.id) > 0);
  runFor(sim, FIELDS[FIRE].ms);
  assert.ok(!sim.objects.includes(field));
});

test('inimigo contorna o campo que fere; se o único caminho passa por ele, atravessa', () => {
  const open = game({ enemies: [[2, 5, 0]] });
  const enemy = open.enemies[0];
  open.conditions.placeField(FIRE, 6, 5, 0);
  const around = open.movement.findPath(enemy, { x: 10, y: 5, z: 0 }, { sameFloor: true });
  assert.ok(around.length > 0);
  assert.ok(!around.some(step => step.x === 6 && step.y === 5));

  const walls = [];
  for (let x = 0; x <= 14; x++) walls.push(...wall(x, 4), ...wall(x, 6));
  const corridor = buildGame({ objects: [...floorRect(0, 14, 0, 14, 0), ...walls], enemies: [[2, 5, 0]], player: { x: 12, y: 8, z: 0 } });
  corridor.conditions.placeField(FIRE, 6, 5, 0);
  const through = corridor.movement.findPath(corridor.enemies[0], { x: 10, y: 5, z: 0 }, { sameFloor: true });
  assert.ok(through.some(step => step.x === 6 && step.y === 5));
});
