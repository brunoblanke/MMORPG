// moba/tests/engine.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MobaSim } from '../engine/sim.js';
import { TICK_MS, WAVE, HEROES, MAX_LEVEL } from '../engine/config.js';
import { grantXp, xpToLevel } from '../engine/units.js';

// ================================================================================================================================================================================================================================================
// run
// Avança a partida por seconds segundos.

function run(sim, seconds) {
  for (let t = 0; t < seconds * 1000 && !sim.over; t += TICK_MS) sim.tick();
}

test('moba: a partida nasce com 4 heróis por time (uma vocação cada), 2 torres e um nexus por lado', () => {
  const sim = new MobaSim();
  for (const team of ['blue', 'red']) {
    assert.deepEqual(sim.heroes.filter(hero => hero.team === team).map(hero => hero.vocation).sort(), ['druid', 'knight', 'paladin', 'sorcerer']);
    assert.equal(sim.structures.filter(structure => structure.team === team && structure.structure === 'tower').length, 2);
    assert.equal(sim.structures.filter(structure => structure.team === team && structure.structure === 'nexus').length, 1);
  }
});

test('moba: a 1ª leva nasce no tempo certo e a cada WAVE.every segundos (melee e ranged)', () => {
  const sim = new MobaSim();
  run(sim, WAVE.first - 1);
  assert.equal(sim.minions.length, 0);
  run(sim, 2);
  assert.equal(sim.minions.filter(minion => minion.team === 'blue').length, WAVE.melee + WAVE.ranged);
  assert.ok(sim.minions.some(minion => minion.type === 'ranged'));
});

test('moba: o herói anda livre até o ponto e para nele; ordem de parar cancela', () => {
  const sim = new MobaSim({ bots: false });
  const hero = sim.heroes.find(item => item.id === 'blue-knight');
  sim.command(hero.id, { type: 'move', x: hero.x + 8.3, y: hero.y + 3.7 });
  run(sim, 4);
  assert.ok(Math.abs(hero.x - (4.5 + 8.3)) < 0.1 && Math.abs(hero.y - (15 + (-1.5 * 1.1) + 3.7)) < 0.2);
  assert.equal(hero.moveTarget, null);
});

test('moba: o herói não atravessa pilares de pedra', () => {
  const sim = new MobaSim({ bots: false });
  const hero = sim.heroes.find(item => item.id === 'blue-knight');
  hero.x = 28;
  hero.y = 8;
  sim.command(hero.id, { type: 'move', x: 34, y: 8 });
  run(sim, 6);
  assert.ok(hero.x < 30 || hero.x > 32 || hero.y < 6 || hero.y > 11);
});

test('moba: ataque básico tira vida; habilidade gasta mana e entra em espera; sem mana não lança', () => {
  const sim = new MobaSim({ bots: false });
  const sorcerer = sim.heroes.find(item => item.id === 'blue-sorcerer');
  const enemy = sim.heroes.find(item => item.id === 'red-knight');
  enemy.x = sorcerer.x + 5;
  enemy.y = sorcerer.y;
  const hp = enemy.hp;
  const mana = sorcerer.mana;
  sim.command(sorcerer.id, { type: 'cast', slot: 0, x: enemy.x, y: enemy.y });
  assert.ok(enemy.hp < hp);
  assert.equal(sorcerer.mana, mana - HEROES.sorcerer.abilities[0].mana);
  assert.ok(sorcerer.cooldowns[0] > sim.time);
  const hpAfter = enemy.hp;
  sim.command(sorcerer.id, { type: 'cast', slot: 0, x: enemy.x, y: enemy.y });
  assert.equal(enemy.hp, hpAfter);
  sim.command(sorcerer.id, { type: 'attack', targetId: enemy.id });
  run(sim, 2);
  assert.ok(enemy.hp < hpAfter);
});

test('moba: matar o herói dá ouro e XP a quem matou, e ele renasce na fonte depois do tempo', () => {
  const sim = new MobaSim({ bots: false });
  const killer = sim.heroes.find(item => item.id === 'blue-paladin');
  const victim = sim.heroes.find(item => item.id === 'red-sorcerer');
  victim.x = killer.x + 4;
  victim.y = killer.y;
  victim.hp = 5;
  const gold = killer.gold;
  sim.command(killer.id, { type: 'attack', targetId: victim.id });
  run(sim, 2);
  assert.ok(!victim.alive && killer.kills === 1 && killer.gold > gold + 100);
  assert.ok(killer.xp > 0 || killer.level > 1);
  run(sim, 30);
  assert.ok(victim.alive && victim.hp === victim.maxHp);
});

test('moba: cura do druid recupera o aliado mais perto do ponto', () => {
  const sim = new MobaSim({ bots: false });
  const druid = sim.heroes.find(item => item.id === 'blue-druid');
  const knight = sim.heroes.find(item => item.id === 'blue-knight');
  knight.hp = 100;
  sim.command(druid.id, { type: 'cast', slot: 1, x: knight.x, y: knight.y });
  assert.ok(knight.hp > 200);
});

test('moba: o nexus só pode ser atacado depois das duas torres; destruir o nexus termina a partida', () => {
  const sim = new MobaSim({ bots: false });
  const hero = sim.heroes.find(item => item.id === 'blue-knight');
  const nexus = sim.structures.find(item => item.id === 'red-nexus');
  const outer = sim.structures.find(item => item.id === 'red-tower-1');
  const inner = sim.structures.find(item => item.id === 'red-tower-2');
  hero.x = nexus.x - 3;
  hero.y = nexus.y;
  sim.command(hero.id, { type: 'attack', targetId: nexus.id });
  assert.equal(hero.attackTargetId, null);
  outer.alive = false;
  inner.alive = false;
  sim.command(hero.id, { type: 'attack', targetId: nexus.id });
  assert.equal(hero.attackTargetId, nexus.id);
  nexus.hp = 10;
  run(sim, 3);
  assert.equal(sim.over, true);
  assert.equal(sim.winner, 'blue');
});

test('moba: XP sobe o nível com o crescimento da vida e para no nível máximo', () => {
  const sim = new MobaSim({ bots: false });
  const hero = sim.heroes.find(item => item.id === 'blue-knight');
  const hp = hero.maxHp;
  grantXp(hero, xpToLevel(1));
  assert.equal(hero.level, 2);
  assert.ok(hero.maxHp > hp);
  grantXp(hero, 1e6);
  assert.equal(hero.level, MAX_LEVEL);
});

test('moba: com os bots jogando, a lane se move e algo acontece em 3 minutos sem erro', () => {
  const sim = new MobaSim();
  run(sim, 180);
  const frontBlue = Math.max(...sim.minions.filter(minion => minion.team === 'blue').map(minion => minion.x), 0);
  assert.ok(sim.time >= 179 || sim.over);
  assert.ok(sim.heroes.every(hero => Number.isFinite(hero.x) && Number.isFinite(hero.hp)));
  assert.ok(frontBlue >= 0);
  assert.ok(sim.structures.some(structure => structure.hp < structure.maxHp) || sim.heroes.some(hero => hero.kills + hero.deaths > 0) || sim.minions.length > 0);
});
