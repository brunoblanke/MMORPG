// tests/mundo-vivo.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMapData, floorRect } from './helpers/fixture.js';
import { Simulation, TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';
import { mergeObjects } from '../js/systems/live-map.js';

const BAG = 'itens/recipientes/backpack-azul';
const AXE = 'itens/machados/axe';
const WOOD = 'itens/materiais/wood';
const TREE = 'estrutura/natureza/arvore-de-teste';
const STUMP = 'estrutura/natureza/toco-de-teste';
const BUSH = 'estrutura/natureza/mato-de-teste';

const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};
const lenhar = { tipo: 'capacidade', capacidade: 'lenhar' };

setAssets([
  asset(BAG, { move: true, peso: 18, espacos: 10 }),
  asset(AXE, { move: true, peso: 40, slot: 'arma', capacidade: ['lenhar'] }),
  asset(WOOD, { move: true, empilhavel: true }),
  asset(TREE, { bloqueia: true, interacoes: [{ gatilho: lenhar, condicoes: { alcance: 1 }, efeitos: [{ tipo: 'trocar-por', item: STUMP }] }] }),
  asset(STUMP, { interacoes: [{ gatilho: lenhar, condicoes: { alcance: 1 }, efeitos: [{ tipo: 'remover', rebroteMs: 0 }] }] }),
  asset(BUSH, { interacoes: [{ gatilho: lenhar, condicoes: { alcance: 1 }, efeitos: [{ tipo: 'remover', rebroteMs: 60000 }] }] })
]);

// ================================================================================================================================================================================================================================================
// game

function game(mapData) {
  const sim = new Simulation(mapData);
  sim.time = 1000;
  const ana = sim.addPlayer('p1', { name: 'Ana' });
  ana.equip.mochila = { uid: 'b1', type: BAG, items: new Array(10).fill(null) };
  ana.equip.arma = { uid: 'a1', type: AXE };
  return { sim, ana };
}

// ================================================================================================================================================================================================================================================
// chopAt

function chopAt(sim, x, y) {
  sim.time += 2000;
  sim.enqueue('p1', { type: 'useItem', from: { t: 'e', key: 'arma' }, target: { x, y, z: 0 } });
  for (let i = 0; i < 2; i++) sim.tick(sim.time + TICK_MS);
  sim.drainEvents();
}

// ================================================================================================================================================================================================================================================
// typesAt

function typesAt(mapData, x, y) {
  return mapData.objetosData.filter(e => e[1] === x && e[2] === y && !e[0].includes('piso')).map(e => e[0]);
}

test('o que o jogo muda no mapa vai pro mapData e vale ao recarregar o mundo', () => {
  const mapData = buildMapData({ objects: [...floorRect(0, 20, 0, 20, 0), [TREE, 11, 10, 0, 0, 0, 0, 1], [TREE, 9, 10, 0, 0, 0, 0, 1]], spawn: { x: 10, y: 10, z: 0 } });
  const { sim } = game(mapData);
  assert.equal(sim.liveMap.collect(), false, 'nada mudou ainda');
  chopAt(sim, 11, 10);
  assert.equal(sim.liveMap.collect(), true);
  assert.equal(sim.liveMap.collect(), false, 'já foi');
  assert.deepEqual(typesAt(sim.mapData, 11, 10), [STUMP]);
  assert.deepEqual(typesAt(sim.mapData, 9, 10), [TREE]);
  chopAt(sim, 11, 10);
  assert.equal(sim.liveMap.collect(), true);
  assert.deepEqual(typesAt(sim.mapData, 11, 10), [], 'o toco que nasceu no jogo também some de vez');
  const again = new Simulation(JSON.parse(JSON.stringify(sim.mapData)));
  assert.equal(again.objects.some(o => o.id.startsWith(TREE) && o.x === 11), false);
  assert.equal(again.objects.some(o => o.id.startsWith(TREE) && o.x === 9), true);
});

test('o que rebrota não sai do mapa', () => {
  const mapData = buildMapData({ objects: [...floorRect(0, 20, 0, 20, 0), [BUSH, 11, 10, 0, 0, 0, 0, 0]], spawn: { x: 10, y: 10, z: 0 } });
  const { sim } = game(mapData);
  chopAt(sim, 11, 10);
  assert.equal(sim.objects.some(o => o.id.startsWith(BUSH)), false, 'cortado');
  assert.equal(sim.liveMap.collect(), false);
  assert.deepEqual(typesAt(sim.mapData, 11, 10), [BUSH]);
});

test('mergeObjects: as mudanças do editor entram por cima das do jogo', () => {
  const a = ['a', 1, 1, 0, 0, false, false, false];
  const b = ['b', 2, 2, 0, 0, false, false, false];
  const c = ['c', 3, 3, 0, 0, false, false, false];
  const d = ['d', 4, 4, 0, 0, false, false, true];
  assert.deepEqual(mergeObjects([a, b], [a, c], [a, b, d]), [a, d, c], 'o editor tirou b e pôs c; o jogo pôs d');
  assert.deepEqual(mergeObjects([a, b], [a, b], [a, d]), [a, d], 'o editor não mexeu: o jogo tirou b e pôs d');
  assert.deepEqual(mergeObjects([a, a], [a], [a, a, a]), [a, a], 'conta repetidos');
});
