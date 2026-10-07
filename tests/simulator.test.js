// tests/simulator.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMapData, floorRect } from './helpers/fixture.js';
import { Simulation, TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';
import { buildArenaMap } from '../shared/simulator-map.js';
import { DUMMY_SPOTS, DUMMY_HP } from '../js/systems/simulator.js';

const DRAGON = 'criaturas/dragoes/dragon';
const BOW = 'itens/distancia/crossbow';
const ARROW = 'itens/municao/arrow';
const FLOOR = 'estrutura/pisos/piso-grama-1';
const asset = (id, propriedades, extra = {}) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: id.startsWith('criaturas') ? 'criaturas' : 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades, ...extra };
};

setAssets([
  asset(FLOOR, {}, { ferramenta: 'pisos', grupo: 'estrutura', pecas: ['meio'] }),
  asset(DRAGON, {
    hp: 200,
    ataques: [
      { forma: 'bola', elemento: 'fire', min: 60, max: 110, chance: 15, alcance: 7, raio: 1 },
      { forma: 'onda', elemento: 'fire', min: 100, max: 170, chance: 10, comprimento: 8, abertura: 3 },
      { forma: 'cura', min: 38, max: 72, chance: 15 }
    ],
    resistencias: { fire: 0 }
  }),
  asset(BOW, { move: true, peso: 10, duasMaos: true }),
  asset(ARROW, { move: true, empilhavel: true, peso: 1 })
]);

// ================================================================================================================================================================================================================================================
// game
// O simulador com o player e os bonecos de dragon nas posições de DUMMY_SPOTS.

function game() {
  const sim = new Simulation(buildMapData({ objects: floorRect(0, 40, 0, 30, 0), spawn: { x: 10, y: 10, z: 0 } }), { simulator: true });
  sim.time = 1000;
  const player = sim.addPlayer('p1', { name: 'Ana' });
  sim.simulator.setTarget(player, DRAGON);
  return { sim, player };
}

function run(sim, command) {
  sim.enqueue('p1', { type: 'simulate', ...command });
  sim.tick(sim.time + TICK_MS);
  return sim.drainEvents();
}

test('simulador: os bonecos nascem nas posições e a vida deles nunca acaba', () => {
  const { sim } = game();
  const dummies = sim.simulator.dummies();
  assert.equal(dummies.length, DUMMY_SPOTS.length);
  assert.ok(dummies.every(d => d.dummy && d.currentHp === DUMMY_HP));
  dummies[0].currentHp = 1;
  sim.tick(sim.time + TICK_MS);
  assert.equal(dummies[0].currentHp, DUMMY_HP);
});

test('simulador: a onda de fogo do dragon mostra o leque, mas não fere o dragon (imune a fogo)', () => {
  const { sim, player } = game();
  const events = run(sim, { kind: 'creature', id: DRAGON, index: 1, x: player.x + 4, y: player.y });
  const hurt = events.filter(e => e.type === 'damage');
  assert.ok(events.some(e => e.type === 'effect' && e.effect === 'fire' && e.tiles.length > 5));
  assert.equal(hurt.length, 0);
});

test('simulador: a cura do dragon recupera a vida do player', () => {
  const { sim, player } = game();
  const events = run(sim, { kind: 'creature', id: DRAGON, index: 2 });
  assert.ok(events.some(e => e.type === 'effect' && e.effect === 'heal'));
  assert.ok(player.currentHp > Math.floor(player.hp / 2));
});

test('simulador: magia, runa e wand de player e munição saem com mana e munição sempre cheias', () => {
  const { sim, player } = game();
  const dummy = sim.simulator.dummies()[0];
  player.x = dummy.x - 2;
  player.y = dummy.y;
  let events = run(sim, { kind: 'spell', id: 'exori flam', x: dummy.x, y: dummy.y });
  assert.ok(events.some(e => e.type === 'speech' && e.text === 'exori flam'));
  events = run(sim, { kind: 'rune', id: 'itens/runas/great-fireball-rune', x: dummy.x, y: dummy.y });
  assert.ok(events.some(e => e.type === 'effect' && e.tiles.length === 37));
  events = run(sim, { kind: 'wand', id: 'itens/wands/wand-of-inferno', x: dummy.x, y: dummy.y });
  assert.ok(events.some(e => e.type === 'missile'));
  assert.equal(player.mana, player.maxMana - 8);
  events = run(sim, { kind: 'ammo', id: ARROW, x: dummy.x, y: dummy.y });
  assert.ok(events.some(e => e.type === 'missile'));
  assert.equal(player.equip.municao, null);
});

test('simulador: magia montada (wave de veneno, ball de morte) usa a forma e o elemento escolhidos', () => {
  const { sim, player } = game();
  let events = run(sim, { kind: 'custom', attack: { shape: 'wave', element: 'poison', min: 10, max: 20, length: 6, spread: 2 }, x: player.x + 4, y: player.y });
  assert.ok(events.some(e => e.type === 'effect' && e.effect === 'poison' && e.tiles.length > 8));
  events = run(sim, { kind: 'custom', attack: { shape: 'ball', element: 'death', min: 10, max: 20, radius: 2, center: 'target' }, x: player.x + 4, y: player.y });
  assert.ok(events.some(e => e.type === 'effect' && e.effect === 'death' && e.tiles.length === 21));
  assert.ok(events.some(e => e.type === 'damage' && e.element === 'death'));
  events = run(sim, { kind: 'custom', attack: { shape: 'nada' } });
  assert.equal(events.length, 0);
});

test('simulador: mapa da arena é um campo de grama com o spawn dentro', () => {
  const map = buildArenaMap();
  assert.ok(map.objetosData.length > 500);
  assert.ok(map.objetosData.some(([type, x, y]) => type === FLOOR && x === map.spawn.x && y === map.spawn.y));
  const sim = new Simulation(map, { simulator: true });
  const player = sim.addPlayer('p1', { name: 'Ana' });
  assert.equal(sim.simulator.setTarget(player, DRAGON), DUMMY_SPOTS.length);
});
