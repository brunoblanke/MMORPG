// tests/lenha.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildMapData, floorRect } from './helpers/fixture.js';
import { Simulation, TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';
import { fichaDe, CAPACIDADES } from '../shared/ficha.js';

const BAG = 'itens/recipientes/backpack-azul';
const AXE = 'itens/machados/axe';
const WOOD = 'itens/materiais/wood';
const TREE = 'estrutura/natureza/arvore-de-teste';
const TREE_LUCK = 'estrutura/natureza/arvore-sem-sorte';

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
  asset(TREE_LUCK, { bloqueia: true, interacoes: chop(1) })
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
