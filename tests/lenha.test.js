// tests/lenha.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildMapData, floorRect, placeAt } from './helpers/fixture.js';
import { Simulation, TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';
import { fichaDe, CAPACIDADES, normalizarInteracoes } from '../shared/ficha.js';
import { newItem } from '../shared/items.js';

const BAG = 'itens/recipientes/backpack-azul';
const AXE = 'itens/machados/axe';
const WOOD = 'itens/materiais/wood';
const TREE = 'estrutura/natureza/arvore-de-teste';
const TREE_LUCK = 'estrutura/natureza/arvore-sem-sorte';
const TREE_CYCLE = 'estrutura/natureza/arvore-que-acaba';
const STUMP = 'estrutura/natureza/toco-de-teste';
const SEED = 'itens/plantas-e-ervas/semente-de-teste';

const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};
const chop = (chance) => [{ gatilho: { tipo: 'capacidade', capacidade: 'lenhar' }, condicoes: { alcance: 1, chance }, efeitos: [{ tipo: 'soltar-item', item: WOOD, quantidade: 1 }] }];

setAssets([
  asset(BAG, { move: true, peso: 18, espacos: 10 }),
  asset(AXE, { move: true, peso: 40, slot: 'arma', atk: 12, skillArma: 'axe', capacidade: ['lenhar'] }),
  asset(WOOD, { move: true, empilhavel: true, peso: 10 }),
  asset(TREE, { bloqueia: true, interacoes: chop(100) }),
  asset(TREE_LUCK, { bloqueia: true, interacoes: chop(1) }),
  asset(TREE_CYCLE, { bloqueia: true, interacoes: [...chop(100), { gatilho: { tipo: 'capacidade', capacidade: 'lenhar' }, condicoes: { alcance: 1, vezes: 3 }, efeitos: [{ tipo: 'trocar-por', item: STUMP }, { tipo: 'soltar-item', item: SEED, quantidade: 1 }] }] }),
  asset(STUMP, { interacoes: [{ gatilho: { tipo: 'capacidade', capacidade: 'lenhar' }, condicoes: { alcance: 1 }, efeitos: [{ tipo: 'soltar-item', item: WOOD, quantidade: 1 }, { tipo: 'remover', rebroteMs: 0 }] }] }),
  asset(SEED, { move: true, interacoes: [{ gatilho: { tipo: 'tempo' }, condicoes: { idade: 600 }, efeitos: [{ tipo: 'trocar-por', item: `${TREE}, ${TREE}` }] }] })
]);

// ================================================================================================================================================================================================================================================
// game

function game(objects = []) {
  const sim = new Simulation(buildMapData({ objects: [...floorRect(0, 20, 0, 20, 0), ...objects], spawn: { x: 10, y: 10, z: 0 } }));
  sim.time = 1000;
  const ana = sim.addPlayer('p1', { name: 'Ana' });
  ana.equip.mochila = { uid: 'b1', type: BAG, items: new Array(10).fill(null) };
  ana.equip.arma = { uid: 'a1', type: AXE };
  return { sim, ana };
}

// ================================================================================================================================================================================================================================================
// tick

function tick(sim, times = 2) {
  const events = [];
  for (let i = 0; i < times; i++) {
    sim.tick(sim.time + TICK_MS);
    events.push(...sim.drainEvents());
  }
  return events;
}

// ================================================================================================================================================================================================================================================
// woodOnGround

function woodOnGround(sim) {
  return sim.objects.filter(o => o.id.startsWith(WOOD));
}

// ================================================================================================================================================================================================================================================
// chopAt
// Um golpe de machado no sqm, depois de passar o tempo de uso.

function chopAt(sim, x, y) {
  sim.time += 2000;
  sim.enqueue('p1', { type: 'useItem', from: { t: 'e', key: 'arma' }, target: { x, y, z: 0 } });
  return tick(sim);
}

// ================================================================================================================================================================================================================================================
// woodCount

function woodCount(sim) {
  return woodOnGround(sim).reduce((sum, o) => sum + ((o.itemData && o.itemData.count) || 1), 0);
}

// ================================================================================================================================================================================================================================================
// at
// Os objetos do tipo no sqm.

function at(sim, type, x, y) {
  return sim.objects.filter(o => o.id.startsWith(`${type}_`) && o.x === x && o.y === y);
}

test('machado tem a capacidade lenhar e a árvore reage a ela', () => {
  assert.ok(CAPACIDADES.includes('lenhar'));
  assert.deepEqual(fichaDe(AXE).tracos.capacidade, ['lenhar']);
  assert.ok(fichaDe(TREE).interacoes.some(i => i.gatilho.capacidade === 'lenhar'));
});

test('machado em mãos usado na árvore ao lado solta madeira no chão ao lado do player, não em cima da árvore', () => {
  const { sim, ana } = game([[TREE, 11, 10, 0, 0, 0, 0, 1]]);
  sim.enqueue('p1', { type: 'useItem', from: { t: 'e', key: 'arma' }, target: { x: 11, y: 10, z: 0 } });
  tick(sim);
  const wood = woodOnGround(sim);
  assert.equal(wood.length, 1);
  assert.ok(!(wood[0].x === 11 && wood[0].y === 10), 'não cai no sqm da árvore');
  assert.ok(Math.max(Math.abs(wood[0].x - ana.x), Math.abs(wood[0].y - ana.y)) <= 1, 'cai ao lado do player');
});

test('longe da árvore o player anda até ela e corta ao chegar', () => {
  const { sim, ana } = game([[TREE, 15, 10, 0, 0, 0, 0, 1]]);
  sim.enqueue('p1', { type: 'useItem', from: { t: 'e', key: 'arma' }, target: { x: 15, y: 10, z: 0 } });
  tick(sim, 60);
  assert.ok(Math.abs(ana.x - 15) <= 1, 'chegou ao lado da árvore');
  assert.equal(woodOnGround(sim).length, 1);
});

test('um corte por vez: espera o tempo de uso entre um e outro', () => {
  const { sim } = game([[TREE, 11, 10, 0, 0, 0, 0, 1]]);
  for (let i = 0; i < 5; i++) sim.enqueue('p1', { type: 'useItem', from: { t: 'e', key: 'arma' }, target: { x: 11, y: 10, z: 0 } });
  tick(sim, 1);
  const total = woodOnGround(sim).reduce((sum, o) => sum + ((o.itemData && o.itemData.count) || 1), 0);
  assert.equal(total, 1);
});

test('sem sorte no corte sobe a fumacinha e não cai nada', () => {
  const { sim } = game([[TREE_LUCK, 11, 10, 0, 0, 0, 0, 1]]);
  const random = Math.random;
  Math.random = () => 0.99;
  try {
    sim.enqueue('p1', { type: 'useItem', from: { t: 'e', key: 'arma' }, target: { x: 11, y: 10, z: 0 } });
    const events = tick(sim);
    assert.equal(woodOnGround(sim).length, 0);
    assert.ok(events.some(e => e.type === 'effect' && e.effect === 'poff' && e.x === 11));
  } finally {
    Math.random = random;
  }
});

test('receitas: machados lenham e as árvores soltam a madeira', () => {
  const ler = (id) => JSON.parse(fs.readFileSync(new URL(`../gerador/projetos/${id}.json`, import.meta.url), 'utf8'));
  assert.ok(ler('itens/machados/axe').propriedades.capacidade.includes('lenhar'));
  assert.ok(ler('itens/machados/hatchet').propriedades.capacidade.includes('lenhar'));
  assert.equal(ler('itens/machados/halberd').propriedades.capacidade, undefined);
  const arvore = ler('estrutura/natureza/arvore-1').propriedades.interacoes.find(i => i.gatilho.capacidade === 'lenhar');
  assert.equal(arvore.efeitos[0].item, WOOD);
  assert.equal(ler(WOOD).propriedades.empilhavel, true);
});

test('a cada N cortes a árvore vira toco e solta uma semente ao lado do player', () => {
  const { sim, ana } = game([[TREE_CYCLE, 11, 10, 0, 0, 0, 0, 1]]);
  chopAt(sim, 11, 10);
  chopAt(sim, 11, 10);
  assert.equal(at(sim, TREE_CYCLE, 11, 10).length, 1, 'ainda é árvore');
  chopAt(sim, 11, 10);
  assert.equal(at(sim, TREE_CYCLE, 11, 10).length, 0);
  assert.equal(at(sim, STUMP, 11, 10).length, 1, 'virou toco');
  assert.equal(woodCount(sim), 3);
  const seeds = sim.objects.filter(o => o.id.startsWith(SEED));
  assert.equal(seeds.length, 1);
  assert.ok(Math.max(Math.abs(seeds[0].x - ana.x), Math.abs(seeds[0].y - ana.y)) <= 1);
  assert.equal(sim.world.isBlocked(11, 10, 0), false, 'o toco não bloqueia');
});

test('o toco cortado solta madeira e some, liberando o sqm', () => {
  const { sim } = game([[STUMP, 11, 10, 0, 0, 0, 0, 0]]);
  chopAt(sim, 11, 10);
  assert.equal(at(sim, STUMP, 11, 10).length, 0);
  assert.equal(woodCount(sim), 1);
});

test('semente solta no chão vira árvore depois do tempo dela, e não nasce em cima de alguém', () => {
  const { sim, ana } = game();
  const { inventory } = sim;
  const seed = inventory.spawnGroundItem(newItem(inventory.nextUid(), SEED, 1), 13, 13, 0);
  sim.time += 1000;
  seed.bornAt = sim.time - 590000;
  tick(sim, 25);
  assert.equal(at(sim, TREE, 13, 13).length, 0, 'ainda não');
  placeAt(sim, ana, 13, 13, 0);
  seed.bornAt = sim.time - 700000;
  tick(sim, 25);
  assert.equal(at(sim, TREE, 13, 13).length, 0, 'com o player em cima, espera');
  placeAt(sim, ana, 10, 10, 0);
  tick(sim, 25);
  assert.equal(at(sim, TREE, 13, 13).length, 1, 'virou árvore');
  assert.equal(sim.objects.some(o => o.id.startsWith(SEED)), false);
  assert.equal(sim.world.isBlocked(13, 13, 0), true);
});

test('vezes, idade e a lista longa de objetos passam pela limpeza da ficha', () => {
  const longa = new Array(20).fill('estrutura/natureza/arvore-de-teste').join(', ');
  const [ix] = normalizarInteracoes([{ gatilho: { tipo: 'tempo' }, condicoes: { idade: 600, vezes: 8 }, efeitos: [{ tipo: 'trocar-por', item: longa }] }]);
  assert.deepEqual(ix.condicoes, { vezes: 8, idade: 600 });
  assert.equal(ix.efeitos[0].item, longa);
});

test('receitas: a árvore vira toco e dá semente; a semente vira árvore', () => {
  const ler = (id) => JSON.parse(fs.readFileSync(new URL(`../gerador/projetos/${id}.json`, import.meta.url), 'utf8'));
  const arvore = ler('estrutura/natureza/arvore-1').propriedades.interacoes.find(i => i.efeitos.some(e => e.tipo === 'trocar-por'));
  assert.equal(arvore.efeitos[0].item, 'estrutura/natureza/tree-stump');
  assert.equal(arvore.efeitos[1].item, 'itens/plantas-e-ervas/seeds');
  const semente = ler('itens/plantas-e-ervas/seeds').propriedades.interacoes[0];
  assert.equal(semente.gatilho.tipo, 'tempo');
  assert.ok(semente.efeitos[0].item.includes('estrutura/natureza/pine'));
});
