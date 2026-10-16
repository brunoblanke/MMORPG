// tests/doors.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';

const GROUND = floorRect(0, 14, 0, 14, 0);
const DOOR = 'estrutura/paredes/teste#porta-x';
const LEVER = 'decoracao/alavancas/teste';
const LEVER_ON = 'decoracao/alavancas/teste-ligada';
const BUSH = 'estrutura/natureza/teste-mato';

const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, rotulo: `${grupo} › ${pasta}`, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(LEVER, { bloqueia: true, uso: 'alavanca', ativoComo: LEVER_ON }),
  asset(LEVER_ON, {}),
  asset(BUSH, { bloqueia: true, uso: 'machete' })
]);

const door = (x, y, dados) => [DOOR, x, y, 0, 0, 0, 1, 1, null, null, dados];

// ================================================================================================================================================================================================================================================
// game
// O player está em (5, 5), colado na porta (6, 5).

function game(objects) {
  const sim = buildGame({ objects: [...GROUND, ...objects], player: { x: 5, y: 5, z: 0 } });
  sim.time = 1000;
  return sim;
}

function run(sim, ms) {
  const end = sim.time + ms;
  while (sim.time < end) sim.tick(sim.time + 25);
}

function click(sim, x = 6, y = 5) {
  sim.enqueue('player1', { type: 'useDoor', x, y, z: 0 });
  sim.tick(sim.time + 25);
  return sim.drainEvents().filter(e => e.type === 'message').map(e => e.text);
}

test('porta com chave: trancada não abre; a chave certa destranca, a errada não serve e só trava fechada', () => {
  const sim = game([door(6, 5, { chave: 7 })]);
  assert.deepEqual(click(sim), ['Está trancada.']);
  assert.ok(sim.world.isBlocked(6, 5, 0));
  assert.equal(sim.interactions.useKey(sim.player, { chave: 9 }, { x: 6, y: 5 }), false);
  assert.ok(sim.drainEvents().some(e => e.text === 'A chave não serve.'));
  assert.equal(sim.interactions.useKey(sim.player, { chave: 7 }, { x: 6, y: 5 }), true);
  assert.deepEqual(click(sim), []);
  assert.ok(!sim.world.isBlocked(6, 5, 0));
  assert.equal(sim.interactions.useKey(sim.player, { chave: 7 }, { x: 6, y: 5 }), false);
  click(sim);
  assert.equal(sim.interactions.useKey(sim.player, { chave: 7 }, { x: 6, y: 5 }), true);
  assert.deepEqual(click(sim), ['Está trancada.']);
});

test('porta de nível: só abre a partir do nível, e fecha sozinha', () => {
  const sim = game([door(6, 5, { nivel: 60 })]);
  assert.deepEqual(click(sim), ['Só quem tem nível 60 passa.']);
  sim.player.lvl = 60;
  assert.deepEqual(click(sim), []);
  assert.ok(!sim.world.isBlocked(6, 5, 0));
  run(sim, 3500);
  assert.ok(sim.world.isBlocked(6, 5, 0));
});

test('porta de quest: abre só pra quem já fez a quest', () => {
  const sim = game([door(6, 5, { quest: 'torre' })]);
  assert.deepEqual(click(sim), ['Você não pode passar por aqui.']);
  sim.player.quests = ['torre'];
  assert.deepEqual(click(sim), []);
  assert.ok(!sim.world.isBlocked(6, 5, 0));
});

test('alavanca: ligada abre a porta alvo e o objeto que alterna; desligada fecha', () => {
  const sim = game([door(10, 5), [LEVER, 6, 5, 0, 0, 0, 0, 1, null, null, { alvos: [{ x: 10, y: 5, z: 0 }] }]]);
  const lever = sim.objects.find(o => o.id.startsWith(LEVER));
  sim.enqueue('player1', { type: 'useObject', id: lever.id });
  sim.tick(sim.time + 25);
  assert.ok(lever.active);
  assert.ok(!sim.world.isBlocked(10, 5, 0));
  sim.enqueue('player1', { type: 'useObject', id: lever.id });
  sim.tick(sim.time + 25);
  assert.ok(!lever.active);
  assert.ok(sim.world.isBlocked(10, 5, 0));
});

test('machete corta o mato, que rebrota depois de 2 minutos', () => {
  const sim = game([[BUSH, 6, 5, 0, 0, 0, 0, 1]]);
  assert.ok(sim.world.isBlocked(6, 5, 0));
  assert.equal(sim.interactions.useTool(sim.player, 'ferramenta-machete', { x: 6, y: 5, z: 0 }), true);
  assert.ok(!sim.world.isBlocked(6, 5, 0));
  run(sim, 119000);
  assert.ok(!sim.world.isBlocked(6, 5, 0));
  run(sim, 2000);
  assert.ok(sim.world.isBlocked(6, 5, 0));
});
