// tests/creature-powers.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, CREATURE } from './helpers/fixture.js';
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

function game(propriedades, enemies = [[8, 5, 0]]) {
  setAssets([creature(CREATURE, { vida: 300, xp: 100, ...propriedades }), creature(MINION, { vida: 50, xp: 40 })]);
  return buildGame({ objects: floorRect(0, 19, 0, 19, 0), enemies, player: { x: 5, y: 5, z: 0 } });
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
  runFor(sim, 30000);
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
  assert.equal(sim.enemies.length, 1);
});

test('respawn do gerador: o chefe demora o tempo dele pra renascer', () => {
  const sim = game({ respawn: 600 });
  sim.enemies[0].currentHp = 0;
  runFor(sim, CONFIG.enemyRespawnTime + 1000);
  assert.equal(sim.enemies.length, 0);
  runFor(sim, 600000 - CONFIG.enemyRespawnTime);
  assert.equal(sim.enemies.length, 1);
});
