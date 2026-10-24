// tests/gatilhos-criatura.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, CREATURE } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { TICK_MS } from '../js/simulation.js';

const fala = (gatilho, texto) => ({ gatilho: { tipo: gatilho }, condicoes: {}, efeitos: [{ tipo: 'falar', texto }] });

setAssets([{
  id: CREATURE, ferramenta: 'criaturas', grupo: 'criaturas', pasta: 'mamiferos', nome: 'teste', url: '/teste.png', quadro: 32, quadros: 1, pecas: [],
  propriedades: { vida: 50, comportamento: 'pacifico', interacoes: [fala('ser-atingido', 'Ai!'), fala('morrer', 'Adeus'), fala('tempo', 'Tic')] }
}]);

// ================================================================================================================================================================================================================================================
// runFor

function runFor(sim, ms) {
  const events = [];
  const end = sim.time + ms;
  while (sim.time < end) {
    sim.tick(sim.time + TICK_MS);
    events.push(...sim.drainEvents());
  }
  return events;
}

test('gatilho tempo: a criatura viva roda a interação a cada segundo', () => {
  const sim = buildGame({ objects: floorRect(0, 14, 0, 14, 0), player: { x: 5, y: 5, z: 0 }, enemies: [[9, 9, 0]] });
  const events = runFor(sim, 3000);
  assert.ok(events.filter(e => e.type === 'speech' && e.text === 'Tic').length >= 2);
});

test('gatilho ser-atingido e morrer: fala ao levar o golpe e ao morrer', () => {
  const sim = buildGame({ objects: floorRect(0, 14, 0, 14, 0), player: { x: 5, y: 5, z: 0 }, enemies: [[9, 9, 0]] });
  const enemy = sim.enemies[0];
  sim.combat.applyDamage(sim.player, enemy, 5, sim.time, true);
  assert.ok(sim.drainEvents().some(e => e.type === 'speech' && e.text === 'Ai!'));
  sim.combat.applyDamage(sim.player, enemy, 500, sim.time, true);
  const events = runFor(sim, TICK_MS * 2);
  assert.ok(events.some(e => e.type === 'speech' && e.text === 'Adeus'));
  assert.equal(events.some(e => e.type === 'speech' && e.text === 'Ai!'), false);
});

test('gatilho falar: objeto reage à palavra dita perto dele, e só a ela', () => {
  const BOX = 'decoracao/adornos/caixa-falante';
  setAssets([{
    id: BOX, ferramenta: 'objetos', grupo: 'decoracao', pasta: 'adornos', nome: 'caixa-falante', url: '/c.png', quadro: 32, quadros: 1, pecas: [],
    propriedades: { bloqueia: true, interacoes: [{ gatilho: { tipo: 'falar' }, condicoes: { alcance: 3, palavra: 'abre te' }, efeitos: [{ tipo: 'falar', texto: 'Abri!' }] }] }
  }]);
  const sim = buildGame({ objects: [...floorRect(0, 14, 0, 14, 0), [BOX, 6, 5, 0, 0, 0, 0, 1]], player: { x: 5, y: 5, z: 0 } });
  sim.drainEvents();
  sim.enqueue(sim.player.id, { type: 'say', text: 'Abre-te, caixa' });
  assert.ok(runFor(sim, TICK_MS * 2).some(e => e.type === 'speech' && e.text === 'Abri!'));
  sim.enqueue(sim.player.id, { type: 'say', text: 'bom dia' });
  assert.equal(runFor(sim, TICK_MS * 2).some(e => e.text === 'Abri!'), false);
});

test('gatilho item-em-cima consome o item certo; gatilho tempo roda em objeto do mapa', () => {
  const ALTAR = 'decoracao/adornos/altar-teste';
  const COIN = 'itens/valiosos/moeda-teste';
  const BAG = 'itens/recipientes/mochila-teste';
  const prop = { move: true, peso: 1 };
  const base = { ferramenta: 'objetos', quadro: 32, quadros: 1, pecas: [], url: '/x.png' };
  setAssets([
    { ...base, id: ALTAR, grupo: 'decoracao', pasta: 'adornos', nome: 'altar-teste', propriedades: { move: false, interacoes: [
      { gatilho: { tipo: 'item-em-cima' }, condicoes: { alcance: 3, item: 'moeda' }, efeitos: [{ tipo: 'consumir-item' }, { tipo: 'falar', texto: 'Obrigado' }] },
      { gatilho: { tipo: 'tempo' }, condicoes: {}, efeitos: [{ tipo: 'falar', texto: 'Zum' }] }] } },
    { ...base, id: COIN, grupo: 'itens', pasta: 'valiosos', nome: 'moeda-teste', propriedades: prop },
    { ...base, id: BAG, grupo: 'itens', pasta: 'recipientes', nome: 'mochila-teste', propriedades: { ...prop, espacos: 10 } }
  ]);
  const sim = buildGame({ objects: [...floorRect(0, 14, 0, 14, 0), [ALTAR, 6, 5, 0, 0, 0, 0, 1]], player: { x: 5, y: 5, z: 0 } });
  sim.player.equip.mochila = { uid: 'b1', type: BAG, items: [{ uid: 'c1', type: COIN }, ...new Array(9).fill(null)] };
  sim.drainEvents();
  sim.enqueue(sim.player.id, { type: 'moveInv', from: { t: 'c', uid: 'b1', i: 0 }, to: { t: 'w', x: 6, y: 5, z: 0 } });
  const events = runFor(sim, TICK_MS * 2);
  assert.ok(events.some(e => e.type === 'speech' && e.text === 'Obrigado'));
  assert.equal(sim.player.equip.mochila.items[0], null);
  assert.ok(runFor(sim, 2000).some(e => e.type === 'speech' && e.text === 'Zum'));
});
