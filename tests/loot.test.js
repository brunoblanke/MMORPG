// tests/loot.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setAssets, creatureLoot, creatureStats } from '../shared/assets.js';
import { InventoryController } from '../js/systems/inventory.js';

const RAT = 'criaturas/mamiferos/rat';
const COIN = 'itens/valiosos/gold-coin';
const CHEESE = 'itens/comidas/cheese';

setAssets([
  { id: RAT, ferramenta: 'criaturas', grupo: 'criaturas', pasta: 'mamiferos', nome: 'rat', url: '/rat.png', quadro: 32, quadros: 3, pecas: [],
    propriedades: { vida: 20, xp: 5, velocidade: 134, armadura: 1, ataque: 8, loot: [{ tipo: COIN, chance: 1, min: 1, max: 4 }, { tipo: CHEESE, chance: 0.3941 }, { tipo: '', chance: 1 }] } },
  { id: COIN, ferramenta: 'objetos', grupo: 'itens', pasta: 'valiosos', nome: 'gold-coin', url: '/c.png', quadro: 32, quadros: 8, pilha: true, pecas: [], propriedades: { move: true, empilhavel: true, peso: 0.1 } },
  { id: CHEESE, ferramenta: 'objetos', grupo: 'itens', pasta: 'comidas', nome: 'cheese', url: '/q.png', quadro: 32, quadros: 1, pecas: [], propriedades: { move: true, peso: 4, alimento: 108 } }
]);

test('loot vem da criatura no gerador: chance e quantidade de cada item', () => {
  assert.deepEqual(creatureLoot(RAT), [{ tipo: COIN, chance: 1, min: 1, max: 4 }, { tipo: CHEESE, chance: 0.3941, min: 1, max: 1 }]);
  const inventory = new InventoryController({});
  let cheese = 0;
  for (let i = 0; i < 2000; i++) {
    const corpse = {};
    inventory.fillCorpse(corpse, { creature: RAT });
    const items = corpse.itemData.items.filter(Boolean);
    const coins = items.find(it => it.type === COIN);
    assert.ok(coins && coins.count >= 1 && coins.count <= 4);
    if (items.some(it => it.type === CHEESE)) cheese++;
  }
  assert.ok(cheese > 700 && cheese < 880, `cheese em ${cheese} de 2000`);
});

test('números do Tibia da criatura: vida, XP, velocidade, armadura e ataque', () => {
  assert.deepEqual(creatureStats(RAT), { hp: 20, xp: 5, spd: 134, def: 1, atk: 8 });
});
