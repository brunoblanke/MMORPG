// tests/resistance.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { itemInfo, equipDamageFactor } from '../shared/items.js';
import { describeItem } from '../js/views/look.js';

const item = (pasta, nome, propriedades) => ({ id: `itens/${pasta}/${nome}`, ferramenta: 'objetos', grupo: 'itens', pasta, nome, url: '/i.png', quadro: 32, quadros: 1, pecas: [], propriedades });
const ARMOR = 'itens/armaduras/teste';
const AMULET = 'itens/amuletos-e-colares/teste';

function game() {
  setAssets([item('armaduras', 'teste', { resistencias: { fire: 50, ice: -20, physical: 0, lixo: 10 } }), item('amuletos-e-colares', 'teste', { resistencias: { fire: 20 } })]);
  return buildGame({ objects: floorRect(0, 9, 0, 9, 0), player: { x: 5, y: 5, z: 0 } });
}

test('resistência do item: só os elementos válidos e sem zero', () => {
  game();
  assert.deepEqual(itemInfo(ARMOR).resist, { fire: 50, ice: -20 });
});

test('o player leva menos dano do elemento com o item vestido; as resistências se multiplicam e a fraqueza aumenta o dano', () => {
  const sim = game();
  const { player } = sim;
  assert.equal(sim.powers.resisted(player, 'fire', 100), 100);
  player.equip.corpo = { uid: 'a', type: ARMOR };
  assert.equal(sim.powers.resisted(player, 'fire', 100), 50);
  assert.equal(sim.powers.resisted(player, 'ice', 100), 120);
  assert.equal(sim.powers.resisted(player, 'energy', 100), 100);
  player.equip.amuleto = { uid: 'b', type: AMULET };
  assert.equal(sim.powers.resisted(player, 'fire', 100), 40);
  assert.equal(equipDamageFactor(player.equip, 'fire'), 0.4);
});

test('inspecionar o item mostra a proteção', () => {
  game();
  assert.match(describeItem({ type: ARMOR }), /Proteção: fogo \+50%, gelo -20%\./);
});
