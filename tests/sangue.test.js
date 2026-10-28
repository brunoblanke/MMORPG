// tests/sangue.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, FLOOR } from './helpers/fixture.js';
import { TICK_MS } from '../js/simulation.js';
import { setAssets, creatureRace } from '../shared/assets.js';
import { SPLASH_HP, SPLASH_SLIME, SPLASH_STAGES, SPLASH_STAGE_MS, RACES } from '../shared/items.js';
import { EFFECTS } from '../shared/effects.js';

const RAT = 'criaturas/teste/rato';
const SPIDER = 'criaturas/teste/aranha';
const SKELETON = 'criaturas/teste/esqueleto';
const FIRE = 'criaturas/teste/fogo';
const WATER = 'estrutura/pisos/agua-de-teste';

const asset = (id, propriedades, ferramenta = 'criaturas') => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta, grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(FLOOR, {}, 'pisos'),
  asset(WATER, { comportamento: 'bloqueia' }, 'pisos'),
  asset(RAT, { comportamento: 'agressivo' }),
  asset(SPIDER, { comportamento: 'agressivo', raca: 'veneno' }),
  asset(SKELETON, { comportamento: 'agressivo', raca: 'morto-vivo' }),
  asset(FIRE, { comportamento: 'agressivo', raca: 'fogo' }),
  asset(SPLASH_HP, { move: false }, 'objetos'),
  asset(SPLASH_SLIME, { move: false }, 'objetos')
]);

// ================================================================================================================================================================================================================================================
// game
// Player em (5, 5) e uma criatura do tipo em (6, 5).

function game(creature, objects = []) {
  const sim = buildGame({ objects: [...floorRect(0, 14, 0, 14, 0), ...objects], enemies: [[6, 5, 0]], player: { x: 5, y: 5, z: 0 } });
  sim.time = 1000;
  const enemy = sim.enemies[0];
  enemy.creature = creature;
  enemy.atk = 0;
  return { sim, enemy };
}

// ================================================================================================================================================================================================================================================
// hit
// Um golpe que tira dano do player na criatura; devolve os eventos.

function hit(sim, enemy, damage, blocked = null) {
  sim.combat.applyDamage(sim.player, enemy, damage, sim.time, true, blocked);
  return sim.drainEvents();
}

// ================================================================================================================================================================================================================================================
// splashes

function splashes(sim, type) {
  return sim.objects.filter(o => o.isSplash && o.id.startsWith(`${type}_`));
}

test('raça da criatura: a da receita, sangue sem ela; cada raça tem efeito de golpe que existe', () => {
  assert.equal(creatureRace(RAT), 'sangue');
  assert.equal(creatureRace(SPIDER), 'veneno');
  assert.equal(creatureRace(SKELETON), 'morto-vivo');
  for (const race of Object.values(RACES)) assert.ok(EFFECTS[race.hit], race.hit);
});

test('golpe físico que tira vida: sangue espirra e fica no chão embaixo da criatura', () => {
  const { sim, enemy } = game(RAT);
  const events = hit(sim, enemy, 5);
  assert.ok(events.some(e => e.type === 'effect' && e.effect === 'draw-blood' && e.x === 6 && e.y === 5));
  const blood = splashes(sim, SPLASH_HP);
  assert.equal(blood.length, 1);
  assert.deepEqual([blood[0].x, blood[0].y], [6, 5]);
});

test('veneno deixa gosma verde; morto-vivo só faísca, sem nada no chão', () => {
  const spider = game(SPIDER);
  assert.ok(hit(spider.sim, spider.enemy, 5).some(e => e.effect === 'hit-poison'));
  assert.equal(splashes(spider.sim, SPLASH_SLIME).length, 1);
  const skeleton = game(SKELETON);
  assert.ok(hit(skeleton.sim, skeleton.enemy, 5).some(e => e.effect === 'hit-area'));
  assert.equal(skeleton.sim.objects.some(o => o.isSplash), false);
});

test('o sangue no mesmo sqm não empilha: o golpe novo deixa o que já está lá fresco de novo', () => {
  const { sim, enemy } = game(RAT);
  hit(sim, enemy, 5);
  const [blood] = splashes(sim, SPLASH_HP);
  sim.time += SPLASH_STAGE_MS + 100;
  sim.tick(sim.time);
  assert.equal(blood.stage, 1, 'secou um pouco');
  hit(sim, enemy, 5);
  assert.equal(splashes(sim, SPLASH_HP).length, 1);
  assert.equal(blood.stage, 0, 'fresco de novo');
});

test('o sangue vai secando e some', () => {
  const { sim, enemy } = game(RAT);
  hit(sim, enemy, 5);
  const [blood] = splashes(sim, SPLASH_HP);
  for (let stage = 1; stage < SPLASH_STAGES; stage++) {
    sim.time += SPLASH_STAGE_MS + 100;
    sim.tick(sim.time);
    assert.equal(blood.stage, stage);
  }
  sim.time += SPLASH_STAGE_MS + 100;
  sim.tick(sim.time);
  assert.equal(splashes(sim, SPLASH_HP).length, 0);
});

test('golpe que não tira vida, como no Canary: poff se a defesa segurou, block se a armadura segurou', () => {
  const { sim, enemy } = game(RAT);
  assert.ok(hit(sim, enemy, 0).some(e => e.effect === 'poff'));
  assert.ok(hit(sim, enemy, 0, 'defense').some(e => e.effect === 'poff'));
  assert.ok(hit(sim, enemy, 0, 'armor').some(e => e.effect === 'block'));
  assert.equal(sim.objects.some(o => o.isSplash), false, 'sem sangue');
});

test('rollDamage diz quem segurou: defesa no corpo a corpo, armadura no de longe', () => {
  const { sim, enemy } = game(RAT);
  sim.player.atk = 0;
  const melee = sim.combat.rollDamage(sim.player, { ...enemy, def: 0, defense: 1000 }, sim.time, { melee: true, attack: 1 });
  assert.deepEqual(melee, { damage: 0, blocked: 'defense' });
  const ranged = sim.combat.rollDamage(sim.player, { ...enemy, def: 1000 }, sim.time, { melee: false, attack: 1 });
  assert.deepEqual(ranged, { damage: 0, blocked: 'armor' });
});

test('criatura de fogo espirra sangue sem respingo e o dano sai laranja; veneno sai verde', () => {
  const fire = game(FIRE);
  const events = hit(fire.sim, fire.enemy, 5);
  assert.ok(events.some(e => e.effect === 'draw-blood'));
  assert.equal(events.find(e => e.type === 'damage').color, RACES.fogo.color);
  assert.equal(fire.sim.objects.some(o => o.isSplash), false);
  const spider = game(SPIDER);
  assert.equal(hit(spider.sim, spider.enemy, 5).find(e => e.type === 'damage').color, RACES.veneno.color);
});

test('na zona segura não fica sangue no chão', () => {
  const { sim, enemy } = game(RAT);
  sim.world.safeTiles.add(sim.world.getTileKey(6, 5, 0));
  assert.ok(hit(sim, enemy, 5).some(e => e.effect === 'draw-blood'));
  assert.equal(sim.objects.some(o => o.isSplash), false);
});

test('não fica sangue na água', () => {
  const { sim, enemy } = game(RAT, [[WATER, 6, 5, 0, 0, 0, 0, 0, 999999]]);
  assert.ok(hit(sim, enemy, 5).some(e => e.effect === 'draw-blood'));
  assert.equal(sim.objects.some(o => o.isSplash), false);
});

test('a criatura que morre deixa sangue embaixo do corpo; o player que apanha também sangra', () => {
  const { sim, enemy } = game(RAT);
  enemy.takeDamage(enemy.currentHp + 10, sim.time);
  assert.equal(sim.objects.some(o => o.isSplash), false, 'morreu sem golpe físico');
  sim.tick(sim.time + TICK_MS);
  assert.ok(sim.deadBodies.some(c => c.x === 6 && c.y === 5), 'virou corpo');
  assert.equal(splashes(sim, SPLASH_HP).filter(o => o.x === 6 && o.y === 5).length, 1);
  sim.combat.applyDamage(enemy, sim.player, 3, sim.time, true);
  assert.equal(splashes(sim, SPLASH_HP).filter(o => o.x === 5 && o.y === 5).length, 1);
});
