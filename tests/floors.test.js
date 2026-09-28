// tests/floors.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect } from './helpers/fixture.js';
import { TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';

const WATER = 'estrutura/pisos/agua';
const POISON = 'estrutura/pisos/veneno';
const SWORD = 'itens/espadas/espada';

const floor = (id, propriedades) => ({ id, ferramenta: 'pisos', grupo: 'estrutura', pasta: 'pisos', nome: id.split('/').pop(), url: '/p.png', quadro: 32, quadros: 1, variacoes: 1, pecas: [], propriedades });

setAssets([
  floor('estrutura/pisos/teste', null),
  floor(WATER, { comportamento: 'bloqueia' }),
  floor(POISON, { comportamento: 'dano', dano: 7 }),
  { id: SWORD, ferramenta: 'objetos', grupo: 'itens', pasta: 'espadas', nome: 'espada', url: '/e.png', quadro: 32, quadros: 1, pecas: [], propriedades: { move: true, peso: 30 } }
]);

// ================================================================================================================================================================================================================================================
// game
// Chão de 10×10 com uma faixa de água em x = 6 e veneno em (3, 5).

function game() {
  const objects = [
    ...floorRect(0, 9, 0, 9),
    ...Array.from({ length: 10 }, (_, y) => [WATER, 6, y, 0, 0, 0, 0, 0]),
    [POISON, 3, 5, 0, 0, 0, 0, 0]
  ];
  const sim = buildGame({ objects, player: { x: 5, y: 5, z: 0 } });
  sim.time = 1000;
  return sim;
}

function run(sim, ms) {
  const end = sim.time + ms;
  while (sim.time < end) sim.tick(sim.time + TICK_MS);
}

test('água bloqueia o passo: o player não entra nela', () => {
  const sim = game();
  assert.equal(sim.world.isBlocked(6, 5, 0), true);
  sim.enqueue('player1', { type: 'walkDir', dx: 1, dy: 0 });
  run(sim, 1000);
  sim.enqueue('player1', { type: 'walkDir', dx: 0, dy: 0 });
  run(sim, 200);
  assert.equal(sim.player.x, 5);
});

test('item jogado na água afunda e some; por cima dela, o arremesso passa', () => {
  const sim = game();
  sim.player.equip.arma = { uid: 'w1', type: SWORD };
  sim.enqueue('player1', { type: 'moveInv', from: { t: 'e', key: 'arma' }, to: { t: 'w', x: 6, y: 5, z: 0 } });
  sim.tick(sim.time + TICK_MS);
  const texts = sim.drainEvents().filter(e => e.type === 'message').map(e => e.text);
  assert.equal(sim.player.equip.arma, null);
  assert.equal(sim.objects.some(o => o.itemData && o.itemData.uid === 'w1'), false);
  assert.ok(texts.some(t => t.endsWith('afundou.')));

  sim.player.equip.arma = { uid: 'w2', type: SWORD };
  sim.enqueue('player1', { type: 'moveInv', from: { t: 'e', key: 'arma' }, to: { t: 'w', x: 7, y: 5, z: 0 } });
  sim.tick(sim.time + TICK_MS);
  const landed = sim.objects.find(o => o.itemData && o.itemData.uid === 'w2');
  assert.deepEqual([landed.x, landed.y], [7, 5]);
});

test('veneno tira vida ao pisar e a cada segundo parado nele', () => {
  const sim = game();
  const hp = sim.player.currentHp;
  sim.enqueue('player1', { type: 'walkTo', x: 3, y: 5, z: 0 });
  run(sim, 1500);
  assert.deepEqual([sim.player.x, sim.player.y], [3, 5]);
  const afterStep = sim.player.currentHp;
  assert.ok(afterStep <= hp - 7);
  run(sim, 2100);
  assert.ok(sim.player.currentHp <= afterStep - 14);
});
