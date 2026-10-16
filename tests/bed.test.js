// tests/bed.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';

const BED = 'decoracao/moveis/teste-cama';
const BED_FULL = 'decoracao/moveis/teste-cama-ocupada';

const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, rotulo: `${grupo} › ${pasta}`, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([asset(BED, { bloqueia: true, uso: 'cama', ativoComo: BED_FULL }), asset(BED_FULL, {})]);

// ================================================================================================================================================================================================================================================
// game

function game() {
  const sim = buildGame({ objects: [...floorRect(0, 14, 0, 14, 0), [BED, 6, 5, 0, 0, 0, 0, 1]], player: { x: 5, y: 5, z: 0 } });
  sim.time = 1000;
  return sim;
}

test('cama: o player deita, sai do jogo e a cama fica ocupada; ao voltar, vida e mana sobem 4× mais rápido pelo tempo fora', () => {
  const sim = game();
  let clock = 1_000_000;
  sim.wallClock = () => clock;
  sim.player.currentHp = 100;
  sim.player.mana = 10;
  const bed = sim.objects.find(o => o.id.startsWith(BED));
  sim.enqueue('player1', { type: 'useObject', id: bed.id });
  sim.tick(sim.time + 25);
  assert.ok(bed.active);
  assert.equal(sim.players.length, 0);
  const left = sim.drainLoggedOut();
  assert.equal(left.length, 1);
  assert.ok(left[0].toSave().sleep);

  clock += 60000;
  const back = sim.addPlayer('player2', { name: left[0].name, saved: left[0].toSave() });
  assert.equal(back.currentHp, 100 + 40);
  assert.equal(back.mana, 10 + 40);
  assert.ok(!bed.active);
  assert.equal(back.sleep, null);
});

test('cama: ocupada ou em combate não deixa deitar', () => {
  const sim = game();
  const bed = sim.objects.find(o => o.id.startsWith(BED));
  sim.interactions.setActive(bed, true);
  sim.enqueue('player1', { type: 'useObject', id: bed.id });
  sim.tick(sim.time + 25);
  assert.equal(sim.players.length, 1);
  sim.interactions.setActive(bed, false);
  sim.player.lastCombatTime = sim.time;
  sim.enqueue('player1', { type: 'useObject', id: bed.id });
  sim.tick(sim.time + 25);
  assert.equal(sim.players.length, 1);
});
