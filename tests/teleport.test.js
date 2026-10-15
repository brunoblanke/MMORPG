// tests/teleport.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { TICK_MS } from '../js/simulation.js';

const PAD = 'decoracao/teleportes/teste';

setAssets([{ id: PAD, ferramenta: 'objetos', grupo: 'decoracao', pasta: 'teleportes', nome: 'teste', url: '/t.png', quadro: 32, quadros: 1, pecas: [], propriedades: { uso: 'teleporte' } }]);

// ================================================================================================================================================================================================================================================
// game

function game(dest = { x: 20, y: 20, z: 0 }, extra = []) {
  const pad = [PAD, 5, 6, 0, 0, 0, 0, 0, 1, 1, { destino: dest }];
  return buildGame({ objects: [...floorRect(0, 30, 0, 30, 0), pad, ...extra], player: { x: 5, y: 5, z: 0 } });
}

test('pisar no teletransporte leva o player pro destino, com o efeito nos dois lugares', () => {
  const sim = game();
  sim.player.useReadyAt = 0;
  sim.enqueue('player1', { type: 'walkTo', x: 5, y: 6, z: 0 });
  const events = [];
  for (let i = 0; i < 80; i++) {
    sim.tick(sim.time + TICK_MS);
    events.push(...sim.drainEvents());
  }
  assert.deepEqual([sim.player.x, sim.player.y, sim.player.z], [20, 20, 0]);
  const effects = events.filter(e => e.type === 'effect' && e.effect === 'teleport');
  assert.deepEqual(effects.map(e => [e.x, e.y]), [[5, 6], [20, 20]]);
});

test('o destino que também é um teletransporte não leva de novo até o player sair de lá', () => {
  const back = [PAD, 20, 20, 0, 0, 0, 0, 0, 2, 1, { destino: { x: 5, y: 5, z: 0 } }];
  const sim = game({ x: 20, y: 20, z: 0 }, [back]);
  sim.enqueue('player1', { type: 'walkTo', x: 5, y: 6, z: 0 });
  for (let i = 0; i < 80; i++) sim.tick(sim.time + TICK_MS);
  assert.deepEqual([sim.player.x, sim.player.y], [20, 20]);
});

test('destino sem piso não leva a lugar nenhum', () => {
  const sim = game({ x: 100, y: 100, z: 0 });
  sim.enqueue('player1', { type: 'walkTo', x: 5, y: 6, z: 0 });
  for (let i = 0; i < 80; i++) sim.tick(sim.time + TICK_MS);
  assert.deepEqual([sim.player.x, sim.player.y], [5, 6]);
});
