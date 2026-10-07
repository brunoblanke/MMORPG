// tests/mail.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMapData, floorRect } from './helpers/fixture.js';
import { Simulation, TICK_MS } from '../js/simulation.js';
import { setAssets, objectIdType } from '../shared/assets.js';

const BAG = 'itens/recipientes/backpack-azul';
const LETTER = 'itens/documentos-e-papeis/letter';
const ROPE = 'itens/ferramentas/rope';
const BOX = 'decoracao/moveis/mailbox';
const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(BAG, { move: true, peso: 18, espacos: 20 }),
  asset(LETTER, { move: true, peso: 1, postal: true }),
  asset(ROPE, { move: true, peso: 1 }),
  asset(BOX, { bloqueia: true, move: false, uso: 'correio' })
]);

// ================================================================================================================================================================================================================================================
// game
// Ana ao lado da caixa de correio com uma carta e uma corda; Bia online e Carol guardada (offline).

function game(characters = { carol: { name: 'Carol' } }) {
  const sim = new Simulation(buildMapData({ objects: [...floorRect(0, 30, 0, 30, 0), [BOX, 11, 10, 0, 0, 0, 0, 1]], spawn: { x: 10, y: 10, z: 0 } }), { characters });
  sim.time = 1000;
  const ana = sim.addPlayer('p1', { name: 'Ana' });
  const bia = sim.addPlayer('p2', { name: 'Bia' });
  ana.equip.mochila = { uid: 'b1', type: BAG, items: [{ uid: 'l1', type: LETTER }, { uid: 'r1', type: ROPE }, ...new Array(18).fill(null)] };
  sim.box = sim.objects.find(obj => objectIdType(obj.id) === BOX);
  return { sim, ana, bia };
}

function run(sim, command) {
  sim.enqueue('p1', command);
  sim.tick(sim.time + TICK_MS);
  return sim.drainEvents();
}

function has(player, type) {
  return player.equip.mochila.items.some(item => item && item.type === type);
}

function post(sim, slot) {
  return run(sim, { type: 'moveInv', from: { t: 'c', uid: 'b1', i: slot }, to: { t: 'w', x: sim.box.x, y: sim.box.y, z: 0 }, amount: 1 });
}

test('correio: !enviar + carta na caixa vai pro depósito de quem está no jogo', () => {
  const { sim, ana, bia } = game();
  run(sim, { type: 'say', text: '!enviar bia' });
  assert.equal(ana.mailTo, 'Bia');
  post(sim, 0);
  assert.ok(!has(ana, LETTER));
  assert.equal(bia.depot.items[0].type, LETTER);
});

test('correio: pra personagem guardado a carta entra no depósito salvo', () => {
  const { sim, ana } = game();
  run(sim, { type: 'say', text: '!enviar Carol' });
  post(sim, 0);
  assert.ok(!has(ana, LETTER));
  assert.equal(sim.savedCharacters.carol.depot[0].type, LETTER);
});

test('correio: sem destinatário, nome inexistente, item comum e depósito cheio não enviam', () => {
  const { sim, ana, bia } = game();
  post(sim, 0);
  assert.ok(has(ana, LETTER));
  const events = run(sim, { type: 'say', text: '!enviar Fulano' });
  assert.ok(events.some(e => e.type === 'message' && /Não existe/.test(e.text)));
  assert.equal(ana.mailTo, undefined);
  run(sim, { type: 'say', text: '!enviar Bia' });
  post(sim, 1);
  assert.ok(has(ana, ROPE));
  bia.depot.items.fill({ uid: 'x', type: ROPE });
  post(sim, 0);
  assert.ok(has(ana, LETTER));
});
