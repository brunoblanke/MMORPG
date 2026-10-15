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
    const items = inventory.rollLoot({ creature: RAT });
    const coins = items.find(it => it.type === COIN);
    assert.ok(coins && coins.count >= 1 && coins.count <= 4);
    if (items.some(it => it.type === CHEESE)) cheese++;
  }
  assert.ok(cheese > 700 && cheese < 880, `cheese em ${cheese} de 2000`);
});

test('números do Tibia da criatura: vida, XP, velocidade, armadura e ataque', () => {
  assert.deepEqual(creatureStats(RAT), { hp: 20, xp: 5, spd: 134, def: 1, atk: 8 });
});

test('corpo no último estágio (ossos) não abre mais: o loot some', async () => {
  const { buildGame, floorRect } = await import('./helpers/fixture.js');
  const { CONFIG } = await import('../js/config.js');
  const sim = buildGame({ objects: floorRect(0, 10, 0, 10, 0), enemies: [[3, 2, 0]], player: { x: 2, y: 2, z: 0 } });
  const enemy = sim.enemies[0];
  enemy.currentHp = 0;
  sim.tick(sim.time + 50);
  const corpse = sim.deadBodies[0];
  corpse.itemData = corpse.itemData || { uid: 'x', type: enemy.creature, items: [null] };
  assert.equal(sim.inventory.isOpenable(corpse), true);
  sim.lifeCycle.processCorpseDecay(corpse.deathTime + CONFIG.corpseFrameDuration * (CONFIG.corpseFrameCount - 1) - 1);
  assert.equal(sim.inventory.isOpenable(corpse), true, 'apodrecendo ainda abre');
  sim.lifeCycle.processCorpseDecay(corpse.deathTime + CONFIG.corpseFrameDuration * (CONFIG.corpseFrameCount - 1));
  assert.equal(sim.inventory.isOpenable(corpse), false);
});

test('o loot cai solto a até 2 sqm da criatura, com o brilho, e o cadáver fica vazio', async () => {
  const { buildGame, floorRect } = await import('./helpers/fixture.js');
  const sim = buildGame({ objects: floorRect(0, 20, 0, 20, 0), enemies: [[10, 10, 0]], player: { x: 2, y: 2, z: 0 } });
  const enemy = sim.enemies[0];
  enemy.creature = RAT;
  sim.inventory.lootTable = { [RAT]: [{ tipo: COIN, chance: 1, min: 1, max: 1 }, { tipo: CHEESE, chance: 1 }, { tipo: COIN, chance: 1, min: 1, max: 1 }] };
  sim.drainEvents();
  enemy.currentHp = 0;
  sim.tick(sim.time + 50);
  const dropped = sim.objects.filter(o => o.itemData && [COIN, CHEESE].includes(o.itemData.type));
  assert.ok(dropped.length >= 2);
  for (const obj of dropped) assert.ok(Math.max(Math.abs(obj.x - 10), Math.abs(obj.y - 10)) <= 2, 'a até 2 sqm');
  assert.equal(sim.deadBodies[0].itemData.items.filter(Boolean).length, 0);
  assert.ok(sim.drainEvents().filter(e => e.type === 'effect' && e.effect === 'firework-yellow').length >= 3);
});
