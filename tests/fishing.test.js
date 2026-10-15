// tests/fishing.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { TICK_MS } from '../js/simulation.js';

const ROD = 'itens/ferramentas/vara';
const WORM = 'itens/produtos-de-criaturas/worm';
const FISH = 'itens/peixes/peixe';
const PIKE = 'itens/peixes/lucio';
const BAG = 'itens/recipientes/bolsa';
const WATER = 'estrutura/pisos/agua-teste';
const LAND = 'estrutura/pisos/terra-teste';
const SHOVEL = 'itens/ferramentas/pa';

const asset = (id, propriedades, ferramenta = 'objetos') => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta, grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(ROD, { move: true, peso: 8, uso: 'ferramenta-pesca', isca: WORM }),
  asset(WORM, { move: true, peso: 0.05, empilhavel: true }),
  asset(FISH, { move: true, peso: 5, empilhavel: true, alimento: 144 }),
  asset(PIKE, { move: true, peso: 8, empilhavel: true, alimento: 145, nivelPesca: 20 }),
  asset(BAG, { move: true, peso: 8, espacos: 4 }),
  asset(WATER, { comportamento: 'bloqueia', pescavel: [FISH, PIKE] }, 'pisos'),
  asset(LAND, { minhocas: 100 }, 'pisos'),
  asset(SHOVEL, { move: true, peso: 35, uso: 'ferramenta-pa' })
]);

function game(worms = 2) {
  const water = [];
  for (let x = 8; x <= 12; x++) for (let y = 3; y <= 7; y++) water.push([WATER, x, y, 0, 0, false, false, false]);
  const sim = buildGame({ objects: [...floorRect(0, 20, 0, 20, 0), ...water], player: { x: 6, y: 5, z: 0 } });
  sim.player.equip.mochila = { uid: 'bag0', type: BAG, items: [{ uid: 'rod0', type: ROD }, worms ? { uid: 'w0', type: WORM, count: worms } : null, null, null] };
  sim.time = 1000;
  return sim;
}

function cast(sim, x, y) {
  sim.enqueue('player1', { type: 'useItem', from: { t: 'c', uid: 'bag0', i: 0 }, target: { x, y, z: 0 } });
  sim.tick(sim.time + TICK_MS);
  return sim.drainEvents();
}

const onGroundOf = (sim, type) => sim.objects.filter(o => o.itemData && o.itemData.type === type).map(o => [o.x, o.y]);
const count = (sim, type) => sim.player.equip.mochila.items.reduce((sum, item) => sum + (item && item.type === type ? item.count || 1 : 0), 0) + (type === WORM ? 0 : onGroundOf(sim, type).length);

test('vara na água pescável: gasta uma minhoca, mostra o respingo e treina o fishing', () => {
  const sim = game();
  const tries = sim.player.skills.fishing.tries;
  const events = cast(sim, 9, 5);
  assert.equal(count(sim, WORM), 1);
  assert.ok(events.some(e => e.type === 'effect' && e.effect === 'ripple' && e.x === 9 && e.y === 5));
  assert.ok(sim.player.skills.fishing.tries > tries || sim.player.skills.fishing.lvl > 10);
});

test('com a sorte, o peixe vem de um dos peixes do piso; sem a sorte, só a isca se vai', () => {
  const lucky = game();
  const random = Math.random;
  Math.random = () => 0;
  const events = cast(lucky, 9, 5);
  Math.random = random;
  assert.ok(events.some(e => e.type === 'effect' && e.effect === 'heal' && e.x === 7 && e.y === 5), 'brilho onde o peixe cai');
  assert.deepEqual(onGroundOf(lucky, FISH), [[7, 5]], 'o peixe cai no chão ao lado do player, do lado da água');
  assert.equal(lucky.player.equip.mochila.items.some(item => item && (item.type === FISH || item.type === PIKE)), false, 'e não vai pra mochila');

  const unlucky = game();
  Math.random = () => 0.99;
  cast(unlucky, 9, 5);
  Math.random = random;
  assert.equal(count(unlucky, FISH) + count(unlucky, PIKE), 0);
  assert.equal(count(unlucky, WORM), 1);
});

test('sem minhoca, em terra firme ou fora do alcance nada acontece', () => {
  const none = game(0);
  const events = cast(none, 9, 5);
  assert.deepEqual(events.filter(e => e.type === 'effect'), []);
  assert.deepEqual(events.filter(e => e.type === 'message').map(e => e.text), ['Você não tem isca.']);

  const sim = game();
  cast(sim, 6, 8);
  assert.equal(count(sim, WORM), 2, 'terra firme');
  sim.player.useReadyAt = 0;
  cast(sim, 20, 20);
  assert.equal(count(sim, WORM), 2, 'longe ou sem água');
});

test('só pesca até 6 sqm de distância da água', () => {
  const near = game();
  near.player.x = 3;
  cast(near, 9, 5);
  assert.equal(count(near, WORM), 1, '6 sqm: pesca');
  const far = game();
  far.player.x = 2;
  cast(far, 9, 5);
  assert.equal(count(far, WORM), 2, '7 sqm: nada acontece');
});

test('a chance sobe com o skill (10% no 10, até 50%)', () => {
  const random = Math.random;
  for (const [level, value, caught] of [[10, 0.099, true], [10, 0.101, false], [100, 0.499, true], [100, 0.501, false]]) {
    const sim = game();
    sim.player.skills.fishing.lvl = level;
    Math.random = () => value;
    cast(sim, 9, 5);
    Math.random = random;
    assert.equal(count(sim, FISH) + count(sim, PIKE) === 1, caught, `${level}/${value}`);
  }
});

test('peixe melhor pede skill e fica mais comum quanto mais o skill passa dele', () => {
  const random = Math.random;
  const pick = (level, roll) => {
    const sim = game();
    sim.player.skills.fishing.lvl = level;
    const values = [0, roll];
    Math.random = () => (values.length ? values.shift() : 0.5);
    cast(sim, 9, 5);
    Math.random = random;
    return [count(sim, FISH), count(sim, PIKE)];
  };
  assert.deepEqual(pick(15, 0.99), [1, 0], 'abaixo do nível o lúcio não sai');
  assert.deepEqual(pick(25, 0.9), [0, 1], 'no 25 o lúcio já sai (peso 6 de 26)');
  assert.deepEqual(pick(25, 0.5), [1, 0]);
  assert.deepEqual(pick(60, 0.99), [0, 1], 'no 60 os dois pesam igual');
});

test('pá num piso com minhocas: ao lado do player, pela chance do piso, dá uma minhoca; longe ou em piso sem minhocas, nada', () => {
  const dirt = [];
  for (let x = 5; x <= 8; x++) for (let y = 3; y <= 6; y++) dirt.push([LAND, x, y, 0, 0, false, false, false]);
  const sim = buildGame({ objects: [...floorRect(0, 20, 0, 20, 0), ...dirt], player: { x: 6, y: 5, z: 0 } });
  sim.player.equip.mochila = { uid: 'bag0', type: BAG, items: [{ uid: 's0', type: SHOVEL }, null, null, null] };
  sim.time = 1000;
  const dig = (x, y) => {
    sim.player.useReadyAt = 0;
    sim.enqueue('player1', { type: 'useItem', from: { t: 'c', uid: 'bag0', i: 0 }, target: { x, y, z: 0 } });
    sim.tick(sim.time + TICK_MS);
  };
  const onGround = () => sim.objects.filter(o => o.itemData && o.itemData.type === WORM).map(o => [o.x, o.y]);
  dig(7, 5);
  assert.deepEqual(onGround(), [[7, 5]], 'a minhoca cai no chão, no sqm cavado');
  assert.equal(count(sim, WORM), 0, 'e não vai pra mochila');
  dig(8, 3);
  dig(6, 7);
  assert.equal(onGround().length, 1, 'longe ou em piso sem minhocas, nada');
  const random = Math.random;
  Math.random = () => 0.999;
  setAssets([asset(LAND, { minhocas: 50 }, 'pisos'), asset(SHOVEL, { move: true, peso: 35, uso: 'ferramenta-pa' }), asset(WORM, { move: true, peso: 0.05, empilhavel: true }), asset(BAG, { move: true, peso: 8, espacos: 4 })]);
  sim.drainEvents();
  dig(7, 5);
  Math.random = random;
  assert.equal(onGround().length, 1, 'sem sorte');
  assert.ok(sim.drainEvents().some(e => e.type === 'effect' && e.effect === 'poff' && e.x === 7 && e.y === 5), 'sobe a fumacinha');
});

test('!efeito nome mostra o efeito no sqm da frente e solta um peixe ali', () => {
  const sim = game();
  sim.player.direction = 'leste';
  sim.enqueue('player1', { type: 'say', text: '!efeito teleport' });
  sim.tick(sim.time + TICK_MS);
  const events = sim.drainEvents();
  assert.ok(events.some(e => e.type === 'effect' && e.effect === 'teleport' && e.x === 7 && e.y === 5));
  assert.deepEqual(onGroundOf(sim, 'itens/peixes/fish'), [[7, 5]]);
  assert.equal(events.some(e => e.type === 'say'), false, 'e não vira fala');
});
