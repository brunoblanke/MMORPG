// tests/lighting.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, NIGHT_AMBIENT, PLAYER_LIGHT, ambientLight, dayPhase, lightAt } from '../shared/lighting.js';
import { buildGame, floorRect } from './helpers/fixture.js';
import { TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';
import { itemInfo } from '../shared/items.js';

test('dia de 10 minutos: meio-dia claro, meia-noite escura, amanhecer no meio; subsolo sempre breu', () => {
  assert.equal(DAY_MS, 600000);
  assert.equal(dayPhase(DAY_MS * 3 + DAY_MS / 2), 0.5);
  assert.equal(ambientLight(DAY_MS / 2, 0), 1);
  assert.equal(ambientLight(0, 0), NIGHT_AMBIENT);
  const dawn = ambientLight(DAY_MS / 4, 0);
  assert.ok(dawn > NIGHT_AMBIENT && dawn < 1);
  assert.equal(ambientLight(DAY_MS / 2, -1), 0);
});

test('luz no sqm: a geral ou a da fonte, caindo até o raio', () => {
  const sources = [{ x: 10, y: 10, radius: 2 }];
  assert.equal(lightAt(10, 10, 0, sources), 1);
  assert.ok(lightAt(11, 10, 0, sources) > lightAt(12, 10, 0, sources));
  assert.equal(lightAt(14, 10, 0, sources), 0);
  assert.equal(lightAt(14, 10, 0.5, sources), 0.5);
});

test('tocha vai na mão (espaço do escudo) e aumenta a luz do player', () => {
  const TORCH = 'itens/fontes-de-luz/torch';
  setAssets([{ id: TORCH, ferramenta: 'objetos', grupo: 'itens', pasta: 'fontes-de-luz', nome: 'torch', rotulo: 'itens › fontes-de-luz', url: '/t.png', quadro: 32, quadros: 1, pecas: [], propriedades: { move: true, peso: 5, luz: 6 } }]);
  assert.deepEqual([itemInfo(TORCH).slot, itemInfo(TORCH).light], ['escudo', 6]);
  const sim = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 2, y: 2, z: 0 } });
  assert.equal(sim.player.equip.escudo.type, TORCH, 'nasce com a tocha');
  sim.player.equip.escudo = null;
  sim.tick(sim.time + TICK_MS);
  assert.equal(sim.player.light, PLAYER_LIGHT);
  sim.player.equip.escudo = { uid: 't1', type: TORCH };
  sim.tick(sim.time + TICK_MS);
  assert.equal(sim.player.light, 6);
});
