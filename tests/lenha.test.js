// tests/lenha.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildMapData, floorRect, placeAt, FLOOR } from './helpers/fixture.js';
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
const SAPLING = 'estrutura/natureza/muda-de-teste';
const ROCK = 'estrutura/natureza/pedra-de-teste';
const TREE_BAG = 'estrutura/natureza/arvore-da-mochila';
const STONE_FLOOR = 'estrutura/pisos/pedra-de-teste';

const asset = (id, propriedades, ferramenta = 'objetos') => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta, grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};
const chop = (chance) => [{ gatilho: { tipo: 'capacidade', capacidade: 'lenhar' }, condicoes: { alcance: 1, chance }, efeitos: [{ tipo: 'soltar-item', item: WOOD, quantidade: 1 }] }];

setAssets([
  asset(FLOOR, { plantavel: true }, 'pisos'),
  asset(STONE_FLOOR, {}, 'pisos'),
  asset(BAG, { move: true, peso: 18, espacos: 10 }),
  asset(AXE, { move: true, peso: 40, slot: 'arma', atk: 12, skillArma: 'axe', capacidade: ['lenhar'] }),
  asset(WOOD, { move: true, empilhavel: true, peso: 10 }),
  asset(TREE, { bloqueia: true, interacoes: chop(100) }),
  asset(TREE_LUCK, { bloqueia: true, interacoes: chop(1) }),
  asset(TREE_CYCLE, { bloqueia: true, interacoes: [...chop(100), { gatilho: { tipo: 'capacidade', capacidade: 'lenhar' }, condicoes: { alcance: 1, vezes: 3 }, efeitos: [{ tipo: 'efeito-visual', nome: 'earth' }, { tipo: 'soltar-item', item: SEED, quantidade: 1 }, { tipo: 'remover', rebroteMs: 0 }] }] }),
  asset(STUMP, { interacoes: [{ gatilho: { tipo: 'capacidade', capacidade: 'lenhar' }, condicoes: { alcance: 1 }, efeitos: [{ tipo: 'soltar-item', item: WOOD, quantidade: 1 }, { tipo: 'remover', rebroteMs: 0 }] }] }),
  asset(SEED, { move: true, plantaComo: SAPLING }),
  asset(SAPLING, { interacoes: [{ gatilho: { tipo: 'tempo' }, condicoes: { idade: 600 }, efeitos: [{ tipo: 'trocar-por', item: `${TREE}, ${TREE}` }] }] }),
  asset(ROCK, { bloqueia: true }),
  asset(TREE_BAG, { bloqueia: true, interacoes: [{ gatilho: { tipo: 'capacidade', capacidade: 'lenhar' }, condicoes: { alcance: 1 }, efeitos: [{ tipo: 'dar-itens', item: WOOD, quantidade: 1, umaVez: 'nao' }] }] })
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

test('a cada N cortes a árvore cai (efeito), solta uma semente ao lado do player e some de vez', () => {
  const { sim, ana } = game([[TREE_CYCLE, 11, 10, 0, 0, 0, 0, 1]]);
  chopAt(sim, 11, 10);
  chopAt(sim, 11, 10);
  assert.equal(at(sim, TREE_CYCLE, 11, 10).length, 1, 'ainda em pé');
  const events = chopAt(sim, 11, 10);
  assert.ok(events.some(e => e.type === 'effect' && e.effect === 'earth' && e.x === 11));
  assert.equal(at(sim, TREE_CYCLE, 11, 10).length, 0);
  assert.equal(sim.objects.some(o => o.x === 11 && o.y === 10 && !o.floorType && !o.isBorder), false, 'nada no lugar, nem toco');
  assert.equal(woodCount(sim), 3);
  const seeds = sim.objects.filter(o => o.id.startsWith(SEED));
  assert.equal(seeds.length, 1);
  assert.ok(Math.max(Math.abs(seeds[0].x - ana.x), Math.abs(seeds[0].y - ana.y)) <= 1);
  assert.equal(sim.world.isBlocked(11, 10, 0), false);
  assert.equal(sim.liveMap.collect(), true, 'sai do mapa');
  assert.equal(sim.mapData.objetosData.some(e => e[0] === TREE_CYCLE), false);
});

test('o toco antigo cortado solta madeira e some, liberando o sqm', () => {
  const { sim } = game([[STUMP, 11, 10, 0, 0, 0, 0, 0]]);
  chopAt(sim, 11, 10);
  assert.equal(at(sim, STUMP, 11, 10).length, 0);
  assert.equal(woodCount(sim), 1);
});

// ================================================================================================================================================================================================================================================
// plantAt
// Usa a semente da mochila com a mira no sqm.

function plantAt(sim, x, y) {
  sim.time += 2000;
  sim.enqueue('p1', { type: 'useItem', from: { t: 'c', uid: 'b1', i: 0 }, target: { x, y, z: 0 } });
  return tick(sim);
}

test('semente usada no chão ao lado vira muda na hora e gasta uma; longe, em pedra, em piso que não é de plantar ou em outra muda não planta', () => {
  const { sim, ana } = game([[ROCK, 9, 10, 0, 0, 0, 0, 1], [STONE_FLOOR, 10, 9, 0, 0, 0, 0, 0, 999999]]);
  ana.equip.mochila.items[0] = { uid: 's1', type: SEED, count: 3 };
  plantAt(sim, 11, 11);
  assert.equal(at(sim, SAPLING, 11, 11).length, 1, 'plantou');
  assert.equal(ana.equip.mochila.items[0].count, 2);
  assert.equal(sim.liveMap.collect(), true, 'a muda vai pro mapa');
  assert.ok(sim.mapData.objetosData.some(e => e[0] === SAPLING && e[1] === 11 && e[2] === 11));
  plantAt(sim, 11, 11);
  assert.equal(at(sim, SAPLING, 11, 11).length, 1, 'não planta em cima de outra muda');
  const events = plantAt(sim, 9, 10);
  assert.equal(at(sim, SAPLING, 9, 10).length, 0, 'nem na pedra');
  assert.ok(events.some(e => e.type === 'effect' && e.effect === 'poff'));
  plantAt(sim, 15, 15);
  assert.equal(at(sim, SAPLING, 15, 15).length, 0, 'nem longe');
  plantAt(sim, 10, 9);
  assert.equal(at(sim, SAPLING, 10, 9).length, 0, 'nem no piso de pedra');
  assert.equal(ana.equip.mochila.items[0].count, 2);
});

test('semente solta no chão não vira nada; a muda vira árvore depois do tempo dela, e não em cima de alguém', () => {
  const { sim, ana } = game();
  const { inventory } = sim;
  const seed = inventory.spawnGroundItem(newItem(inventory.nextUid(), SEED, 1), 12, 12, 0);
  seed.bornAt = sim.time - 10000000;
  ana.equip.mochila.items[0] = { uid: 's1', type: SEED, count: 1 };
  plantAt(sim, 11, 11);
  assert.equal(ana.equip.mochila.items[0], null, 'gastou a última');
  const sapling = at(sim, SAPLING, 11, 11)[0];
  sapling.bornAt = sim.time - 590000;
  tick(sim, 25);
  assert.equal(at(sim, TREE, 11, 11).length, 0, 'ainda não');
  assert.equal(at(sim, TREE, 12, 12).length, 0, 'semente no chão não cresce');
  placeAt(sim, ana, 11, 11, 0);
  sapling.bornAt = sim.time - 700000;
  tick(sim, 25);
  assert.equal(at(sim, TREE, 11, 11).length, 0, 'com o player em cima, espera');
  placeAt(sim, ana, 10, 10, 0);
  tick(sim, 25);
  assert.equal(at(sim, TREE, 11, 11).length, 1, 'virou árvore');
  assert.equal(at(sim, SAPLING, 11, 11).length, 0);
  assert.equal(sim.world.isBlocked(11, 11, 0), true);
});

test('muda que veio do mapa espera o tempo todo depois que o servidor sobe', () => {
  const { sim } = game([[SAPLING, 12, 12, 0, 0, 0, 0, 0]]);
  tick(sim, 25);
  assert.equal(at(sim, TREE, 12, 12).length, 0);
  at(sim, SAPLING, 12, 12)[0].bornAt = sim.time - 700000;
  tick(sim, 25);
  assert.equal(at(sim, TREE, 12, 12).length, 1);
});

test('receitas: a árvore cai e dá semente; a semente planta a muda; a muda vira árvore', () => {
  const ler = (id) => JSON.parse(fs.readFileSync(new URL(`../gerador/projetos/${id}.json`, import.meta.url), 'utf8'));
  const arvore = ler('estrutura/natureza/arvore-1').propriedades.interacoes;
  assert.equal(arvore.some(i => i.efeitos.some(e => e.tipo === 'trocar-por')), false, 'não vira mais toco');
  const cai = arvore.find(i => i.efeitos.some(e => e.tipo === 'remover'));
  assert.deepEqual(cai.efeitos.map(e => e.tipo), ['efeito-visual', 'dar-itens', 'remover']);
  assert.equal(cai.efeitos[1].umaVez, 'nao');
  assert.equal(arvore.find(i => i.condicoes.chance).efeitos[0].tipo, 'dar-itens', 'a madeira vai pra mochila');
  assert.equal(cai.efeitos[1].item, 'itens/plantas-e-ervas/seeds');
  assert.equal(cai.efeitos[2].rebroteMs, 0);
  const semente = ler('itens/plantas-e-ervas/seeds').propriedades;
  assert.equal(semente.plantaComo, 'estrutura/natureza/sapling');
  assert.equal(semente.interacoes, undefined);
  assert.equal(ler('estrutura/pisos/grama-1').propriedades.plantavel, true, 'grama é de plantar');
  assert.equal(ler('estrutura/pisos/terra-1').propriedades.plantavel, true, 'terra é de plantar');
  assert.equal(ler('estrutura/pisos/pedra-1').propriedades.plantavel, undefined, 'pedra não');
  const muda = ler('estrutura/natureza/sapling').propriedades.interacoes[0];
  assert.equal(muda.gatilho.tipo, 'tempo');
  assert.ok(muda.efeitos[0].item.includes('estrutura/natureza/pine'));
});

test('madeira com dar-itens vai direto pra mochila de quem cortou, a cada corte', () => {
  const { sim, ana } = game([[TREE_BAG, 11, 10, 0, 0, 0, 0, 1]]);
  chopAt(sim, 11, 10);
  chopAt(sim, 11, 10);
  assert.equal(woodOnGround(sim).length, 0, 'nada no chão');
  const wood = ana.equip.mochila.items.find(it => it && it.type === WOOD);
  assert.ok(wood, 'na mochila');
  assert.equal(wood.count || 1, 2, 'empilha');
});
