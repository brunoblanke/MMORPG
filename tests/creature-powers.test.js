// tests/creature-powers.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, wall, CREATURE } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { TICK_MS } from '../js/simulation.js';
import { CONFIG } from '../js/config.js';

const MINION = 'criaturas/mamiferos/filhote';
const creature = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'criaturas', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 3, pecas: [], propriedades };
};

// ================================================================================================================================================================================================================================================
// game
// A criatura (com as propriedades dadas) perto do player.

function game(propriedades, enemies = [[8, 5, 0]], extra = []) {
  setAssets([creature(CREATURE, { vida: 300, xp: 100, ...propriedades }), creature(MINION, { vida: 50, xp: 40 })]);
  return buildGame({ objects: [...floorRect(0, 19, 0, 19, 0), ...extra], enemies, player: { x: 5, y: 5, z: 0 } });
}

function runFor(sim, ms) {
  const events = [];
  const end = sim.time + ms;
  while (sim.time < end) {
    sim.tick(sim.time + TICK_MS);
    events.push(...sim.drainEvents());
  }
  return events;
}

test('magia de longe: a criatura que persegue lança a magia do tipo dela no player', () => {
  const sim = game({ ataque: 0, magia: { tipo: 'fire', dano: 40, chance: 100 } });
  const hp = sim.player.currentHp;
  const events = runFor(sim, 3000);
  assert.ok(events.some(e => e.type === 'missile' && e.kind === 'fire'));
  assert.ok(events.some(e => e.type === 'damage' && e.targetId === sim.player.id && e.element === 'fire'));
  assert.ok(sim.player.currentHp < hp);
});

test('veneno no golpe: o golpe que acerta deixa o player envenenado', () => {
  const sim = game({ ataque: 500, veneno: 4 }, [[6, 5, 0]]);
  sim.player.hp = sim.player.currentHp = 100000;
  runFor(sim, 5000);
  assert.ok(sim.player.conditions.poison);
  assert.equal(sim.player.conditions.poison.damage, 4);
});

test('invocar: chama até o máximo; a invocada não dá XP nem renasce e morre junto com quem invocou', () => {
  const sim = game({ ataque: 0, invoca: { tipo: MINION, max: 2 } });
  const random = Math.random;
  Math.random = () => 0;
  try {
    runFor(sim, 30000);
  } finally {
    Math.random = random;
  }
  const minions = sim.enemies.filter(e => e.summonedBy);
  assert.equal(minions.length, 2);
  assert.ok(minions.every(m => m.creature === MINION && m.xp === 0));
  const xp = sim.player.xp;
  const lvl = sim.player.lvl;
  const master = sim.enemies.find(e => !e.summonedBy);
  master.damageBy = new Map([[sim.player.id, 300]]);
  master.currentHp = 0;
  runFor(sim, TICK_MS * 3);
  assert.equal(sim.enemies.filter(e => e.summonedBy).length, 0);
  assert.ok(sim.player.xp > xp || sim.player.lvl > lvl);
  runFor(sim, CONFIG.enemyRespawnTime + 1000);
  assert.deepEqual(sim.enemies.filter(e => !e.summonedBy).map(e => e.creature), [CREATURE]);
});

test('respawn do gerador: o chefe demora o tempo dele pra renascer', () => {
  const sim = game({ respawn: 600 });
  sim.enemies[0].currentHp = 0;
  runFor(sim, CONFIG.enemyRespawnTime + 1000);
  assert.equal(sim.enemies.length, 0);
  runFor(sim, 600000 - CONFIG.enemyRespawnTime);
  assert.equal(sim.enemies.length, 1);
});

// ================================================================================================================================================================================================================================================
// firstEffect

function firstEffect(events, effect) {
  return events.find(e => e.type === 'effect' && e.effect === effect);
}

const DRAGON_WAVE = { forma: 'onda', elemento: 'fire', min: 100, max: 100, chance: 100, comprimento: 8, abertura: 3 };
const DRAGON_BALL = { forma: 'bola', elemento: 'fire', min: 60, max: 60, chance: 100, alcance: 7, raio: 3 };

test('onda: o leque de fogo pra frente fere o player dentro dele, com o efeito em cada sqm', () => {
  const sim = game({ ataque: 0, ataques: [DRAGON_WAVE] }, [[9, 5, 0]]);
  sim.player.hp = sim.player.currentHp = 100000;
  const events = runFor(sim, 3000);
  const effect = firstEffect(events, 'fire');
  assert.ok(effect);
  assert.ok(effect.tiles.length > 8);
  assert.ok(effect.tiles.some(([x, y]) => x === sim.player.x && y === sim.player.y));
  assert.ok(events.some(e => e.type === 'damage' && e.targetId === sim.player.id && e.element === 'fire' && e.amount === 100));
});

test('onda: não sai pra quem está fora do alcance ou do leque', () => {
  const far = game({ ataque: 0, ataques: [{ ...DRAGON_WAVE, comprimento: 3 }] }, [[15, 5, 0]]);
  far.player.hp = far.player.currentHp = 100000;
  assert.ok(!runFor(far, 1500).some(e => e.type === 'effect'));
  const side = game({ ataque: 0, ataques: [DRAGON_WAVE] }, [[7, 5, 0]]);
  const wave = side.powers.waveTiles(side.enemies[0], { x: 7, y: 15 }, { length: 8, spread: 3 });
  assert.ok(wave.every(([x, y]) => y > 5 && Math.abs(x - 7) <= 3));
  assert.ok(!wave.some(([x, y]) => x === 5 && y === 5));
});

test('onda: parede segura o fogo', () => {
  const open = game({ ataque: 0, ataques: [DRAGON_WAVE] }, [[9, 5, 0]]);
  assert.ok(open.powers.waveTiles(open.enemies[0], open.player, { length: 8, spread: 3 }).length > 8);
  const walls = Array.from({ length: 20 }, (_, y) => wall(7, y)).flat();
  const closed = game({ ataque: 0, ataques: [DRAGON_WAVE] }, [[9, 5, 0]], walls);
  assert.equal(closed.powers.waveTiles(closed.enemies[0], closed.player, { length: 8, spread: 3 }).length, 1);
});

test('bola: tiro que explode em círculo e fere todo player na área, não quem está fora dela', () => {
  const sim = game({ ataque: 0, ataques: [DRAGON_BALL] }, [[10, 5, 0]]);
  const near = sim.addPlayer('player2', { name: 'Perto' });
  const away = sim.addPlayer('player3', { name: 'Longe' });
  for (const [p, x, y] of [[sim.player, 5, 5], [near, 6, 7], [away, 5, 14]]) {
    p.hp = p.currentHp = 100000;
    sim.world.moveEntityTile(p, p.x, p.y, p.z || 0, x, y, 0);
    Object.assign(p, { x, y, z: 0, step: 0 });
  }
  const events = runFor(sim, 3000);
  assert.ok(events.some(e => e.type === 'missile' && e.kind === 'fire'));
  const hit = (id) => events.some(e => e.type === 'damage' && e.targetId === id && e.amount === 60);
  assert.ok(hit(sim.player.id));
  assert.ok(hit(near.id));
  assert.ok(!hit(away.id));
});

test('cura: a criatura ferida se cura dentro da faixa; inteira, não faz nada', () => {
  const sim = game({ ataque: 0, ataques: [{ forma: 'cura', min: 40, max: 70, chance: 100 }] });
  const enemy = sim.enemies[0];
  enemy.currentHp = enemy.hp - 150;
  const before = enemy.currentHp;
  const events = runFor(sim, 2100);
  assert.ok(enemy.currentHp - before >= 40 && enemy.currentHp - before <= 140);
  assert.ok(firstEffect(events, 'heal'));
  enemy.currentHp = enemy.hp;
  assert.ok(!firstEffect(runFor(sim, 4100), 'heal'));
});
