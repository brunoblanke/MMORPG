// tests/critico.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, FLOOR } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { equipBonus } from '../shared/items.js';
import { describeItem } from '../js/views/look.js';

const RING = 'itens/aneis/anel-de-teste';
const AMULET = 'itens/amuletos-e-colares/amuleto-de-teste';
const ORC = 'criaturas/teste/orc-critico';
const RAT = 'criaturas/teste/rato';

const asset = (id, propriedades, ferramenta = 'objetos') => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta, grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(FLOOR, {}, 'pisos'),
  asset(RING, { move: true, slot: 'anel', criticoChance: 60, criticoDano: 50 }),
  asset(AMULET, { move: true, slot: 'amuleto', criticoChance: 40, criticoDano: 50 }),
  asset(ORC, { comportamento: 'agressivo', criticoChance: 100, criticoDano: 50 }, 'criaturas'),
  asset(RAT, { comportamento: 'agressivo' }, 'criaturas')
]);

// ================================================================================================================================================================================================================================================
// game
// Player em (5, 5) e uma criatura do tipo em (6, 5).

function game(creature = RAT) {
  const sim = buildGame({ objects: floorRect(0, 14, 0, 14, 0), enemies: [[6, 5, 0]], player: { x: 5, y: 5, z: 0 } });
  sim.time = 1000;
  const enemy = sim.enemies[0];
  enemy.creature = creature;
  enemy.atk = 0;
  return { sim, enemy };
}

test('crítico dos itens equipados soma: chance e dano extra', () => {
  const bonus = equipBonus({ anel: { type: RING }, amuleto: { type: AMULET } });
  assert.equal(bonus.critChance, 100);
  assert.equal(bonus.critDamage, 100);
  assert.match(describeItem({ type: RING }), /Crítico: 60% de chance, \+50% de dano\./);
});

test('rollCritical: com 100% sai o multiplicador do dano extra; sem chance, 1', () => {
  const { sim, enemy } = game(ORC);
  assert.equal(sim.combat.rollCritical(sim.player), 1, 'player sem itens');
  sim.player.equip.anel = { uid: 'r1', type: RING };
  sim.player.equip.amuleto = { uid: 'a1', type: AMULET };
  assert.equal(sim.combat.rollCritical(sim.player), 2);
  assert.equal(sim.combat.rollCritical(enemy), 1.5, 'criatura pela receita');
});

test('golpe físico crítico que tira vida mostra o efeito critical; sem tirar vida, não', () => {
  const { sim, enemy } = game();
  sim.combat.applyDamage(sim.player, enemy, 5, sim.time, true, null, true);
  assert.ok(sim.drainEvents().some(e => e.type === 'effect' && e.effect === 'critical' && e.x === 6));
  sim.combat.applyDamage(sim.player, enemy, 0, sim.time, true, 'armor', true);
  assert.equal(sim.drainEvents().some(e => e.effect === 'critical'), false);
});

test('o crítico entra no sorteio antes da defesa e da armadura', () => {
  const { sim, enemy } = game();
  enemy.def = 0;
  enemy.defense = 0;
  sim.player.equip.anel = { uid: 'r1', type: RING };
  sim.player.equip.amuleto = { uid: 'a1', type: AMULET };
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    const normal = game().sim.combat.rollDamage(game().sim.player, { ...enemy }, sim.time, { melee: false, attack: 40 });
    const crit = sim.combat.rollDamage(sim.player, enemy, sim.time, { melee: false, attack: 40 });
    assert.equal(crit.critical, true);
    assert.equal(normal.critical, false);
    assert.equal(crit.damage, normal.damage * 2);
  } finally {
    Math.random = random;
  }
});

test('magia, runa e wand também saem críticas: dano dobrado e o efeito', () => {
  const { sim, enemy } = game();
  sim.player.equip.anel = { uid: 'r1', type: RING };
  sim.player.equip.amuleto = { uid: 'a1', type: AMULET };
  enemy.currentHp = 1000;
  sim.spells.hurt(sim.player, enemy, 30, sim.time, 'fire');
  const events = sim.drainEvents();
  assert.equal(events.find(e => e.type === 'damage').amount, 60);
  assert.ok(events.some(e => e.effect === 'critical'));
});

test('criatura com crítico na receita: o golpe dela pode sair crítico no player', () => {
  const { sim, enemy } = game(ORC);
  enemy.atk = 30;
  let crit = false;
  for (let i = 0; i < 20 && !crit; i++) crit = sim.combat.rollDamage(enemy, sim.player, sim.time, { melee: false }).critical;
  assert.ok(crit);
});
