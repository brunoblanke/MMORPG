// tests/mail.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMapData, floorRect } from './helpers/fixture.js';
import { Simulation, TICK_MS } from '../js/simulation.js';
import { setAssets, objectIdType } from '../shared/assets.js';

const BAG = 'itens/recipientes/backpack-azul';
const LETTER = 'itens/documentos-e-papeis/letter';
const SENT_LETTER = 'itens/documentos-e-papeis/letter-stamped';
const PARCEL = 'itens/recipientes/parcel';
const SENT_PARCEL = 'itens/recipientes/parcel-stamped';
const LABEL = 'itens/documentos-e-papeis/label';
const BOX_PARCEL = 'itens/recipientes/caixa-de-teste';
const ROPE = 'itens/ferramentas/rope';
const BOX = 'decoracao/moveis/mailbox';
const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(BAG, { move: true, peso: 18, espacos: 20 }),
  asset(LETTER, { move: true, peso: 1, postal: true, escrita: 'carta', enviadoComo: SENT_LETTER }),
  asset(SENT_LETTER, { move: true, peso: 1, uso: 'livro' }),
  asset(PARCEL, { move: true, peso: 5, postal: true, espacos: 4, enviadoComo: SENT_PARCEL }),
  asset(SENT_PARCEL, { move: true, peso: 5, espacos: 4 }),
  asset(LABEL, { move: true, peso: 0.1, escrita: 'etiqueta' }),
  asset(BOX_PARCEL, { move: true, peso: 5, postal: true, espacos: 4, escrita: 'etiqueta', enviadoComo: SENT_PARCEL }),
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
  ana.equip.mochila = { uid: 'b1', type: BAG, items: [{ uid: 'l1', type: LETTER }, { uid: 'r1', type: ROPE }, { uid: 'p1', type: PARCEL, items: [null, null, null, null] }, ...new Array(17).fill(null)] };
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

function write(sim, slot, para, texto = '') {
  return run(sim, { type: 'writeItem', from: { t: 'c', uid: 'b1', i: slot }, para, texto });
}

test('correio: a carta com o nome escrito vai carimbada pro depósito de quem está no jogo, com quem mandou e a mensagem', () => {
  const { sim, ana, bia } = game();
  write(sim, 0, ' bia ', 'Oi, Bia!');
  assert.equal(ana.equip.mochila.items[0].para, 'bia');
  post(sim, 0);
  assert.ok(!has(ana, LETTER));
  const letter = bia.depot.items[0];
  assert.equal(letter.type, SENT_LETTER);
  assert.match(letter.texto, /^De: Ana\nPara: Bia\n\nOi, Bia!$/);
});

test('correio: pra personagem guardado a carta entra no depósito salvo', () => {
  const { sim, ana } = game();
  write(sim, 0, 'Carol');
  post(sim, 0);
  assert.ok(!has(ana, LETTER));
  assert.equal(sim.savedCharacters.carol.depot[0].type, SENT_LETTER);
});

test('correio: a encomenda vai com a etiqueta escrita dentro, carimbada e com tudo que tem dentro', () => {
  const { sim, ana, bia } = game();
  const parcel = ana.equip.mochila.items[2];
  const events = post(sim, 2);
  assert.ok(events.some(e => e.type === 'message' && /etiqueta/.test(e.text)), 'sem etiqueta não vai');
  parcel.items[0] = { uid: 'e1', type: LABEL };
  parcel.items[1] = { uid: 'r2', type: ROPE };
  run(sim, { type: 'writeItem', from: { t: 'c', uid: 'p1', i: 0 }, para: 'Bia', texto: 'ignorado' });
  assert.equal(parcel.items[0].para, 'Bia');
  assert.equal(parcel.items[0].texto, undefined, 'etiqueta só tem o nome');
  post(sim, 2);
  const sent = bia.depot.items[0];
  assert.equal(sent.type, SENT_PARCEL);
  assert.deepEqual(sent.items.filter(Boolean).map(i => i.type), [LABEL, ROPE]);
});

test('correio: a carta ou encomenda já enviada não vai de novo', () => {
  const { sim, ana, bia } = game();
  write(sim, 0, 'Bia');
  post(sim, 0);
  ana.equip.mochila.items[0] = bia.depot.items[0];
  const events = post(sim, 0);
  assert.ok(has(ana, SENT_LETTER));
  assert.ok(events.some(e => e.type === 'message' && /só recebe/.test(e.text)));
});

test('correio: sem nome (pergunta), nome inexistente, item comum e depósito cheio não enviam', () => {
  const { sim, ana, bia } = game();
  assert.ok(post(sim, 0).some(e => e.type === 'askRecipient'), 'carta sem nome: a caixa pergunta o destinatário');
  assert.ok(has(ana, LETTER));
  write(sim, 0, 'Fulano');
  assert.ok(post(sim, 0).some(e => e.type === 'message' && /Não existe/.test(e.text)));
  assert.ok(has(ana, LETTER));
  post(sim, 1);
  assert.ok(has(ana, ROPE));
  write(sim, 0, 'Bia');
  bia.depot.items.fill({ uid: 'x', type: ROPE });
  post(sim, 0);
  assert.ok(has(ana, LETTER));
});

test('correio: só carta e etiqueta se escrevem; o nome e a mensagem são cortados no tamanho', () => {
  const { sim, ana } = game();
  write(sim, 1, 'Bia');
  assert.equal(ana.equip.mochila.items[1].para, undefined);
  write(sim, 0, 'x'.repeat(80), 'y'.repeat(5000));
  assert.equal(ana.equip.mochila.items[0].para.length, 30);
  assert.equal(ana.equip.mochila.items[0].texto.length, 1000);
});

test('correio: encomenda sem destinatário jogada na caixa pergunta "Para:"; escrito o nome nela, vai', () => {
  const { sim, ana, bia } = game();
  ana.equip.mochila.items[3] = { uid: 'p2', type: BOX_PARCEL, items: [{ uid: 'r3', type: ROPE }, null, null, null] };
  const ask = post(sim, 3).find(e => e.type === 'askRecipient');
  assert.ok(ask, 'pergunta o destinatário');
  assert.deepEqual(ask.from, { t: 'c', uid: 'b1', i: 3 });
  assert.equal(ask.then.type, 'moveInv');
  assert.ok(has(ana, BOX_PARCEL), 'ainda não foi');
  write(sim, 3, 'Bia');
  run(sim, ask.then);
  assert.ok(!has(ana, BOX_PARCEL));
  assert.equal(bia.depot.items[0].type, SENT_PARCEL);
  assert.deepEqual(bia.depot.items[0].items.filter(Boolean).map(i => i.type), [ROPE]);
});
