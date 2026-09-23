// tests/save.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, wall } from './helpers/fixture.js';
import { calculateStats } from '../js/utils/helpers.js';
import { CONFIG } from '../js/config.js';

const START = CONFIG.playerStartLevel;

const GROUND = floorRect(0, 24, 0, 24, 0);

// ================================================================================================================================================================================================================================================
// roundTrip
// O que o servidor grava no arquivo e lê de volta.

function roundTrip(player) {
  return JSON.parse(JSON.stringify(player.toSave()));
}

test('personagem volta com nível, XP, vida e lugar onde saiu', () => {
  const game = buildGame({ objects: GROUND, player: { x: 2, y: 2, z: 0 } });
  const player = game.addPlayer('player2', { name: 'Ana', gender: 'female' });
  player.gainXp(player.nextLevelXp + 7);
  player.currentHp = 40;
  game.world.moveEntityTile(player, player.x, player.y, 0, 15, 12, 0);
  Object.assign(player, { x: 15, y: 12 });

  const saved = roundTrip(player);
  game.removePlayer('player2');
  const back = game.addPlayer('player3', { name: 'Ana', gender: 'female', saved });

  assert.deepEqual([back.lvl, back.xp, back.currentHp, back.maxHp], [START + 1, 7, 40, calculateStats(START + 1).hp]);
  assert.deepEqual([back.x, back.y, back.z], [15, 12, 0]);
  assert.deepEqual([back.spawnX, back.spawnY, back.spawnZ], [2, 2, 0]);
  assert.equal(back.atk, calculateStats(START + 1).atk);
});

test('lugar guardado ocupado: nasce no sqm livre mais perto', () => {
  const game = buildGame({ objects: [...GROUND, ...wall(10, 10)], player: { x: 2, y: 2, z: 0 } });
  const back = game.addPlayer('player2', { name: 'Beto', saved: { lvl: 12, xp: 0, currentHp: 10, x: 10, y: 10, z: 0 } });
  assert.notDeepEqual([back.x, back.y], [10, 10]);
  assert.ok(Math.max(Math.abs(back.x - 10), Math.abs(back.y - 10)) === 1);
});

test('lugar guardado que não existe mais no mapa: volta pro spawn', () => {
  const game = buildGame({ objects: GROUND, player: { x: 2, y: 2, z: 0 } });
  const back = game.addPlayer('player2', { name: 'Beto', saved: { lvl: 12, xp: 0, currentHp: 10, x: 15, y: 15, z: 3 } });
  assert.equal(back.lvl, 12);
  assert.equal(back.z, 0);
  assert.ok(Math.max(Math.abs(back.x - 2), Math.abs(back.y - 2)) <= 1);
});

test('dados estragados não quebram: valores fora do lugar são corrigidos', () => {
  const game = buildGame({ objects: GROUND, player: { x: 2, y: 2, z: 0 } });
  const back = game.addPlayer('player2', { name: 'Caio', saved: { lvl: 'x', xp: 99999, currentHp: 0, x: 1.5, y: 3, z: 99 } });
  assert.equal(back.lvl, START);
  assert.equal(back.xp, back.nextLevelXp - 1);
  assert.equal(back.currentHp, back.hp);
  assert.equal(back.z, 0);

  const fresh = game.addPlayer('player3', { name: 'Duda', saved: null });
  assert.deepEqual([fresh.lvl, fresh.xp, fresh.currentHp], [START, 0, calculateStats(START).hp]);
});
