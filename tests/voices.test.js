// tests/voices.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, CREATURE } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { TICK_MS } from '../js/simulation.js';
import { VOICE_MAX_MS } from '../js/systems/voices.js';

const LINES = ['Miau', 'Miu miu', 'Miaaaaauuu!'];

setAssets([{ id: CREATURE, ferramenta: 'criaturas', grupo: 'criaturas', pasta: 'mamiferos', nome: 'gato', url: '/t.png', quadro: 32, quadros: 3, pecas: [], propriedades: { comportamento: 'pacifico', falas: [...LINES, ' '] } }]);

// ================================================================================================================================================================================================================================================
// voicesIn

function voicesIn(game, ms) {
  const lines = [];
  const end = game.time + ms;
  while (game.time < end) {
    game.tick(game.time + TICK_MS);
    lines.push(...game.drainEvents().filter(e => e.type === 'speech' && e.orange).map(e => e.text));
  }
  return lines;
}

test('criatura com falas no gerador diz uma delas de vez em quando, com player por perto', () => {
  const game = buildGame({ objects: floorRect(0, 29, 0, 29, 0), enemies: [[8, 5, 0]], player: { x: 5, y: 5, z: 0 } });
  game.enemies[0].patrolRadius = 0;
  game.enemies[0].detectionRadius = 0;
  const lines = voicesIn(game, VOICE_MAX_MS * 3);
  assert.ok(lines.length >= 2);
  assert.ok(lines.every(line => LINES.includes(line)));
});

test('sem player por perto, a criatura não fala', () => {
  const game = buildGame({ objects: floorRect(0, 39, 0, 39, 0), enemies: [[35, 35, 0]], player: { x: 2, y: 2, z: 0 } });
  game.enemies[0].patrolRadius = 0;
  assert.deepEqual(voicesIn(game, VOICE_MAX_MS * 2), []);
});
