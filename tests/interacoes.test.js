// tests/interacoes.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMapData, floorRect } from './helpers/fixture.js';
import { Simulation, TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';
import { GREET_WORDS, BYE_WORDS } from '../shared/npcs.js';
import { fichaDe, normalizarInteracoes } from '../shared/ficha.js';

const BAG = 'itens/recipientes/backpack-azul';
const GOLD = 'itens/valiosos/gold-coin';
const SPOON = 'itens/ferramentas/colher-de-teste';
const NPC = 'personagens/npcs/teste-reage';
const BOX = 'decoracao/adornos/caixa-de-teste';
const MAT = 'estrutura/natureza/capacho-de-teste';

const asset = (id, propriedades, ferramenta = 'objetos') => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta, grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

const fala = { gatilho: { tipo: 'capacidade', capacidade: 'cavar' }, condicoes: { alcance: 1 }, efeitos: [{ tipo: 'falar', texto: 'Ei, isso dói!' }, { tipo: 'soltar-item', item: GOLD, quantidade: 3 }] };

setAssets([
  asset(BAG, { move: true, peso: 18, espacos: 10 }),
  asset(GOLD, { move: true, empilhavel: true }),
  asset(SPOON, { move: true, peso: 2, capacidade: ['cavar'] }),
  asset(NPC, { comportamento: 'npc', interacoes: [fala] }, 'criaturas'),
  asset(BOX, { bloqueia: true, interacoes: [{ gatilho: { tipo: 'clicar' }, condicoes: { alcance: 1 }, efeitos: [{ tipo: 'mostrar-texto', texto: 'Está vazia.' }, { tipo: 'efeito-visual', nome: 'poff' }] }] }),
  asset(MAT, { interacoes: [{ gatilho: { tipo: 'pisar' }, condicoes: {}, efeitos: [{ tipo: 'dano', valor: 7, elemento: 'physical', alvo: 'ator' }, { tipo: 'mostrar-texto', texto: 'Ai!' }] }] })
]);

const NPC_DEF = {
  id: 'reage', name: 'Reage', gender: 'male', creature: NPC, at: { dx: 1, dy: 0 }, radius: 0,
  greet: { words: GREET_WORDS, reply: 'Oi' }, bye: { words: BYE_WORDS, reply: 'Tchau' }, topics: []
};

// ================================================================================================================================================================================================================================================
// game

function game(objects = []) {
  const sim = new Simulation(buildMapData({ objects: [...floorRect(0, 20, 0, 20, 0), ...objects], spawn: { x: 10, y: 10, z: 0 } }), { npcs: [NPC_DEF] });
  sim.time = 1000;
  const ana = sim.addPlayer('p1', { name: 'Ana' });
  ana.equip.mochila = { uid: 'b1', type: BAG, items: [{ uid: 'c1', type: SPOON }, ...new Array(9).fill(null)] };
  return { sim, ana };
}

function tick(sim, times = 2) {
  const events = [];
  for (let i = 0; i < times; i++) {
    sim.tick(sim.time + TICK_MS);
    events.push(...sim.drainEvents());
  }
  return events;
}

test('qualquer objeto reage à ferramenta: um NPC com a reação cavar → falar e soltar item, sem código novo', () => {
  const { sim, ana } = game();
  const npc = sim.npcs[0];
  assert.ok(fichaDe(NPC).interacoes.some(i => i.propria && i.gatilho.capacidade === 'cavar'));
  assert.ok(Math.abs(npc.x - ana.x) <= 1 && Math.abs(npc.y - ana.y) <= 1);
  sim.enqueue('p1', { type: 'useItem', from: { t: 'c', uid: 'b1', i: 0 }, target: { x: npc.x, y: npc.y, z: 0 } });
  const events = tick(sim);
  assert.ok(events.some(e => e.type === 'speech' && e.text === 'Ei, isso dói!'));
  assert.ok(sim.objects.some(o => o.id.startsWith(GOLD)), 'soltou as moedas no chão');
});

test('a mesma ferramenta não faz nada num alvo que não tem a reação', () => {
  const { sim, ana } = game([[BOX, 11, 10, 0, 0, 0, 0, 1]]);
  sim.enqueue('p1', { type: 'useItem', from: { t: 'c', uid: 'b1', i: 0 }, target: { x: 11, y: 10, z: 0 } });
  const events = tick(sim);
  assert.equal(events.some(e => e.type === 'speech'), false);
});

test('clicar num objeto com interação própria roda os efeitos dela', () => {
  const { sim } = game([[BOX, 11, 10, 0, 0, 0, 0, 1]]);
  const box = sim.objects.find(o => o.id.startsWith(BOX));
  sim.enqueue('p1', { type: 'useObject', id: box.id });
  const events = tick(sim);
  assert.ok(events.some(e => e.type === 'message' && e.text === 'Está vazia.'));
  assert.ok(events.some(e => e.type === 'effect' && e.effect === 'poff'));
});

test('pisar num objeto com interação própria: dano em quem pisou e mensagem', () => {
  const { sim, ana } = game([[MAT, 9, 10, 0, 0, 0, 0, 0]]);
  const hp = ana.currentHp;
  sim.enqueue('p1', { type: 'walkTo', x: 9, y: 10, z: 0 });
  const events = tick(sim, 40);
  assert.ok(ana.x <= 9, 'chegou ao capacho');
  assert.ok(ana.currentHp <= hp - 7);
  assert.ok(events.some(e => e.type === 'message' && e.text === 'Ai!'));
});

test('as interações da receita são limpas: só vocabulário conhecido e campos do esquema', () => {
  const limpas = normalizarInteracoes([
    { gatilho: { tipo: 'capacidade', capacidade: 'voar' }, efeitos: [{ tipo: 'falar', texto: 'x' }] },
    { gatilho: { tipo: 'clicar' }, condicoes: { alcance: 99, chance: 500, extra: 1 }, efeitos: [{ tipo: 'hackear' }, { tipo: 'falar', texto: 'Oi', lixo: 1 }, { tipo: 'teletransportar', destino: { x: 1, y: 2 } }] },
    'lixo'
  ]);
  assert.equal(limpas.length, 1);
  assert.deepEqual(limpas[0].condicoes, { alcance: 12, chance: 100 });
  assert.deepEqual(limpas[0].efeitos, [{ tipo: 'falar', texto: 'Oi' }]);
});
