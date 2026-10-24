// tests/aneis.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { TICK_MS } from '../js/simulation.js';

const STEALTH = 'itens/aneis/stealth-ring';
const TIME = 'itens/aneis/time-ring';
const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(STEALTH, { move: true, peso: 1, slot: 'anel', invisivelEquipado: true, duracao: 1 }),
  asset(TIME, { move: true, peso: 1, slot: 'anel', speed: 40 })
]);

test('anel de invisibilidade: equipado, o player fica invisível; ao acabar a duração, volta a ser visto', () => {
  const game = buildGame({ objects: floorRect(0, 14, 0, 14, 0), player: { x: 5, y: 5, z: 0 } });
  game.time = 1000;
  assert.equal(game.player.isInvisible(game.time), false);
  game.player.equip.anel = { uid: 'r1', type: STEALTH };
  game.tick(game.time + TICK_MS);
  assert.equal(game.player.invisible, true);
  for (let i = 0; i < 25; i++) game.tick(game.time + TICK_MS);
  assert.equal(game.player.equip.anel, null);
  assert.equal(game.player.invisible, false);
});

test('anel do tempo: equipado, soma velocidade', () => {
  const game = buildGame({ objects: floorRect(0, 14, 0, 14, 0), player: { x: 5, y: 5, z: 0 } });
  const base = game.player.spd;
  game.player.equip.anel = { uid: 'r2', type: TIME };
  assert.equal(game.player.spd, base + 40);
});
