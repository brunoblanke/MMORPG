// tests/combat.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, wall, HOLE } from './helpers/fixture.js';
import { TICK_MS } from '../js/simulation.js';

test('alvo em outro andar não é aceito (e não gera "Alvo perdido")', () => {
  const game = buildGame({ objects: [...floorRect(0, 14, 0, 14, 0), ...floorRect(0, 14, 0, 14, -1)], enemies: [[6, 5, -1]], player: { x: 5, y: 5, z: 0 } });
  const enemy = game.enemies[0];
  game.enqueue('player1', { type: 'attack', targetId: enemy.id });
  game.tick(game.time + TICK_MS);
  game.tick(game.time + TICK_MS);
  assert.equal(game.player.target, null);
  assert.deepEqual(game.drainEvents().filter(e => e.type === 'message').map(e => e.text), []);
});

test('auto ataque: alvo que ficou inacessível é largado e o próximo da fila vira alvo', async () => {

  const { UNREACHABLE_MS } = await import('../js/systems/combat.js');
  const walls = [];
  for (let x = 13; x <= 17; x++) for (let y = 3; y <= 7; y++) if (x === 13 || x === 17 || y === 3 || y === 7) walls.push(...wall(x, y));
  const game = buildGame({ objects: [...floorRect(0, 24, 0, 24, 0), ...walls], enemies: [[15, 5, 0], [5, 9, 0]], player: { x: 10, y: 5, z: 0 } });
  const [trapped, free] = game.enemies;
  for (const e of game.enemies) { e.detectionRadius = 8; e.atk = 0; }
  game.player.attackMode = true;
  game.player.target = trapped;
  game.player.autoFollow = true;
  const end = game.time + UNREACHABLE_MS + 3000;
  while (game.time < end) game.tick(game.time + TICK_MS);
  assert.notEqual(game.player.target, trapped);
  assert.equal(game.player.target, free);
});

test('auto ataque: sem seguir, o alvo é o inimigo mais perto; seguindo, mantém o alvo', () => {
  const game = buildGame({ objects: floorRect(0, 24, 0, 24, 0), enemies: [[8, 5, 0], [5, 9, 0]], player: { x: 5, y: 5, z: 0 } });
  const [a, b] = game.enemies;
  for (const e of game.enemies) { e.detectionRadius = 10; e.atk = 0; e.patrolRadius = 0; }
  game.player.attackMode = true;
  game.player.followMode = false;
  game.player.autoFollow = false;
  game.combat.updateAutoAttack(game.player);
  assert.equal(game.player.target, a, '3 sqm contra 4');
  game.world.moveEntityTile(a, a.x, a.y, 0, 11, 5, 0);
  a.x = 11;
  game.combat.updateAutoAttack(game.player);
  assert.equal(game.player.target, b, 'o primeiro se afastou: o mais perto agora é o outro');
  game.player.autoFollow = true;
  game.world.moveEntityTile(a, a.x, a.y, 0, 6, 5, 0);
  a.x = 6;
  game.combat.updateAutoAttack(game.player);
  assert.equal(game.player.target, b, 'seguindo o alvo (com caminho), não troca por proximidade');
});

test('perseguir: o lado do alvo mais perto não tem caminho, mas outro tem — segue pelo outro e não larga o alvo', () => {
  const walls = [];
  for (let y = 0; y <= 12; y++) if (y !== 10) walls.push(...wall(4, y));
  for (const [x, y] of [[5, 1], [6, 1], [6, 2], [6, 3]]) walls.push(...wall(x, y));
  const game = buildGame({ objects: [...floorRect(0, 12, 0, 12, 0), ...walls], enemies: [[5, 3, 0]], player: { x: 3, y: 2, z: 0 } });
  const [enemy] = game.enemies;
  const reachable = game.movement.moveTowardsPosition(game.player, enemy.x, enemy.y, game.time, enemy, game.searchBoundsAround(game.player), game.enemies);
  assert.equal(reachable, true);
});

test('sqm reservado por quem ficou preso atrás de outro inimigo não segura quem tem caminho livre até ele', () => {
  const open = new Set([...Array.from({ length: 8 }, (_, i) => `${3 + i},10`), ...Array.from({ length: 6 }, (_, i) => `10,${4 + i}`)]);
  const walls = [];
  for (let x = 0; x <= 14; x++) for (let y = 0; y <= 14; y++) if (!open.has(`${x},${y}`)) walls.push(...wall(x, y));
  const game = buildGame({ objects: [...floorRect(0, 14, 0, 14, 0), ...walls], enemies: [[9, 10, 0], [8, 10, 0], [10, 4, 0]], player: { x: 10, y: 10, z: 0 } });
  for (const e of game.enemies) { e.detectionRadius = 10; e.atk = 0; e.patrolRadius = 0; }
  const north = game.enemies[2];
  const end = game.time + 8000;
  while (game.time < end && !(north.x === 10 && north.y === 9)) game.tick(game.time + TICK_MS);
  assert.deepEqual([north.x, north.y], [10, 9]);
});

test('perseguindo, o player não vai pro buraco colado na criatura (vai pra outro lado dela)', () => {
  const game = buildGame({ objects: [...floorRect(0, 14, 0, 14, 0), ...floorRect(0, 14, 0, 14, -1), [HOLE, 6, 5, 0, 0, 0, 0, 0]], enemies: [[7, 5, 0]], player: { x: 3, y: 5, z: 0 } });
  const enemy = game.enemies[0];
  Object.assign(enemy, { atk: 0, detectionRadius: 0, patrolRadius: 0 });
  game.player.target = enemy;
  game.player.autoFollow = true;
  const end = game.time + 6000;
  while (game.time < end) game.tick(game.time + TICK_MS);
  assert.equal(game.player.z, 0);
  assert.ok(Math.max(Math.abs(game.player.x - enemy.x), Math.abs(game.player.y - enemy.y)) <= 1);
});

