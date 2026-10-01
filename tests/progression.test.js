// tests/progression.test.js

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, safeRect } from './helpers/fixture.js';
import { Player, xpForLevel } from '../js/models/player.js';
import { playerStats } from '../js/utils/helpers.js';
import { TICK_MS } from '../js/simulation.js';

const GROUND = floorRect(0, 24, 0, 24, 0);
const originalRandom = Math.random;

beforeEach(() => {
  let seed = 42;
  Math.random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
});

afterEach(() => {
  Math.random = originalRandom;
});

// ================================================================================================================================================================================================================================================
// runFor

function runFor(sim, ms) {
  const events = [];
  const end = sim.time + ms;
  while (sim.time + TICK_MS <= end) {
    sim.tick(sim.time + TICK_MS);
    events.push(...sim.drainEvents());
  }
  return events;
}

test('subir de nível guarda o XP que sobra e melhora os atributos', () => {
  const player = new Player({ x: 0, y: 0, lvl: 1 });
  assert.equal(player.nextLevelXp, 100);

  assert.equal(player.gainXp(130), 1);
  assert.equal(player.lvl, 2);
  assert.equal(player.xp, 30);
  const stats = playerStats(2);
  assert.deepEqual([player.maxHp, player.currentHp, player.maxMana, player.spd], [stats.hp, stats.hp, stats.mana, stats.spd]);

  assert.equal(player.gainXp(500), 2);
  assert.equal(player.lvl, 4);
  assert.equal(player.xp, 500 + 30 - 100 - 200);
});

test('XP por nível segue a tabela do Tibia (total: 100, 200, 400, 800, 1500…)', () => {
  const totals = [];
  let total = 0;
  for (let lvl = 1; lvl <= 9; lvl++) {
    totals.push(total);
    total += new Player({ x: 0, y: 0, lvl }).nextLevelXp;
  }
  assert.deepEqual(totals, [0, 100, 200, 400, 800, 1500, 2600, 4200, 6400]);
});

test('skills seguem a progressão do Tibia (vocação None, o player não tem vocação)', async () => {
  const { triesFor } = await import('../shared/skills.js');
  assert.equal(triesFor(10, 'sword'), 50);
  assert.equal(triesFor(11, 'sword'), 100);
  assert.equal(triesFor(10, 'distance'), 30);
  assert.equal(triesFor(11, 'distance'), 60);
  assert.equal(triesFor(10, 'shielding'), 100);
  assert.equal(triesFor(10, 'fist'), 50);
  assert.equal(triesFor(11, 'fist'), 75);
});

test('matar um inimigo dá o XP inteiro dele e pode subir o nível', () => {
  const sim = buildGame({ objects: GROUND, enemies: [[8, 5, 0, 30]], player: { x: 2, y: 5, z: 0 } });
  const enemy = sim.enemies[0];
  const reward = enemy.xp;
  Object.assign(enemy, { currentHp: 1, def: 0, defense: 0 });
  sim.player.xp = sim.player.nextLevelXp - 1;
  const lvlBefore = sim.player.lvl;

  sim.enqueue('player1', { type: 'attack', targetId: enemy.id });
  const events = runFor(sim, 8000);

  assert.equal(events.find(e => e.type === 'xp').amount, reward);
  assert.ok(events.some(e => e.type === 'levelUp' && e.lvl === lvlBefore + 1));
  assert.equal(sim.player.lvl, lvlBefore + 1);
  assert.equal(sim.player.xp, reward - 1);
});

test('na zona segura os inimigos não perseguem nem atacam; fora dela, sim', () => {
  const sim = buildGame({
    objects: GROUND,
    enemies: [[12, 5, 0, 5]],
    safe: safeRect(2, 6, 3, 7),
    player: { x: 4, y: 5, z: 0 }
  });
  const enemy = sim.enemies[0];
  const hp = sim.player.currentHp;

  runFor(sim, 8000);
  assert.equal(enemy.ai.state, 'patrol');
  assert.equal(sim.player.currentHp, hp);
  assert.equal(sim.player.isTarget, false);

  sim.enqueue('player1', { type: 'walkTo', x: 9, y: 5, z: 0 });
  runFor(sim, 8000);
  assert.equal(enemy.ai.state, 'chase');
  assert.ok(sim.player.currentHp < hp);
});

test('entrar na zona segura faz o inimigo colado parar de atacar e voltar a patrulhar', () => {
  const sim = buildGame({
    objects: GROUND,
    enemies: [[10, 5, 0, 5]],
    safe: safeRect(2, 6, 3, 7),
    player: { x: 9, y: 5, z: 0 }
  });
  const enemy = sim.enemies[0];
  runFor(sim, 3000);
  assert.equal(enemy.ai.state, 'chase');

  sim.player.currentHp = sim.player.maxHp;
  sim.enqueue('player1', { type: 'walkTo', x: 3, y: 5, z: 0 });
  runFor(sim, 4000);
  const hpInside = sim.player.currentHp;
  runFor(sim, 6000);

  assert.ok(sim.world.isInSafeZone(sim.player));
  assert.equal(enemy.ai.state, 'patrol');
  assert.equal(sim.player.currentHp, hpInside);
});

test('zona segura vale só no andar pintado', () => {
  const sim = buildGame({ objects: GROUND, safe: safeRect(2, 4, 2, 4, 1), player: { x: 3, y: 3, z: 0 } });
  assert.equal(sim.world.isInSafeZone(sim.player), false);
  assert.equal(sim.world.isSafe(3, 3, 1), true);
});

test('inimigo colado na borda da zona segura não ataca quem está dentro', () => {
  const sim = buildGame({
    objects: GROUND,
    enemies: [[7, 5, 0, 5]],
    safe: safeRect(2, 6, 3, 7),
    player: { x: 6, y: 5, z: 0 }
  });
  const hp = sim.player.currentHp;
  for (let t = 1000; t <= 6000; t += TICK_MS) {
    sim.time = t;
    sim.combat.processEnemies(sim.player, t);
  }
  assert.equal(sim.player.currentHp, hp);
});

test('subir de nível enche a vida; a mana só ganha o que o máximo aumentou', async () => {
  const { Player } = await import('../js/models/player.js');
  const player = new Player({ x: 0, y: 0, lvl: 1 });
  player.currentHp = 40;
  player.mana = 10;
  player.gainXp(player.nextLevelXp);
  assert.equal(player.lvl, 2);
  assert.deepEqual([player.hp, player.maxMana], [155, 60]);
  assert.deepEqual([player.currentHp, player.mana], [155, 15]);
});

test('criatura com a vida preenchida no gerador e armadura/defesa 0 fica com 0 (não usa as do nível)', async () => {
  const { setAssets } = await import('../shared/assets.js');
  const { Enemy } = await import('../js/models/enemy.js');
  const SNAKE = 'criaturas/repteis/cobra-teste';
  setAssets([{ id: SNAKE, ferramenta: 'criaturas', grupo: 'criaturas', pasta: 'repteis', nome: 'cobra-teste', rotulo: 'criaturas › repteis', url: '/c.png', quadro: 32, quadros: 3, pecas: [],
    propriedades: { comportamento: 'normal', vida: 15, xp: 10, velocidade: 120, armadura: 0, defesa: 0, ataque: 8 } }]);
  const snake = new Enemy({ x: 0, y: 0, lvl: 5, creature: SNAKE });
  assert.deepEqual([snake.maxHp, snake.def, snake.defense, snake.atk, snake.xp], [15, 0, 0, 8, 10]);
});

test('a XP da criatura é dividida pelo dano que cada player causou', () => {
  const sim = buildGame({ objects: GROUND, enemies: [[8, 5, 0, 30]], player: { x: 2, y: 5, z: 0 } });
  const other = sim.addPlayer('player2');
  const enemy = sim.enemies[0];
  enemy.xp = 100;
  sim.player.xp = 0;
  other.xp = 0;
  sim.combat.recordDamage(enemy, sim.player, 30);
  sim.combat.recordDamage(enemy, other, 10);
  enemy.currentHp = 0;
  sim.tick(sim.time + TICK_MS);
  const events = sim.drainEvents().filter(e => e.type === 'xp');

  assert.deepEqual(events.map(e => [e.playerId, e.amount]).sort(), [['player1', 75], ['player2', 25]]);
});

test('morrer perde 10% da XP total abaixo do nível 24 e pode cair de nível', () => {
  const player = new Player({ x: 0, y: 0, lvl: 1 });
  player.gainXp(xpForLevel(10) + 50);
  const total = player.totalXp();
  player.respawn({ x: 0, y: 0 });
  assert.equal(player.totalXp(), total - Math.floor(total * 0.1));
  assert.equal(player.lvl, 9);
});

test('morrer do nível 24 pra cima segue a fórmula do Tibia atual', () => {
  const player = new Player({ x: 0, y: 0, lvl: 1 });
  player.gainXp(xpForLevel(30));
  player.respawn({ x: 0, y: 0 });
  assert.equal(player.totalXp(), xpForLevel(30) - Math.floor(80 / 100 * 50 * (900 - 150 + 8)));
});

test('morrer tira dos skills a mesma fração da XP', () => {
  const player = new Player({ x: 0, y: 0, lvl: 1 });
  player.gainXp(xpForLevel(10));
  player.skills.sword = { lvl: 11, tries: 0, pct: 0 };
  player.respawn({ x: 0, y: 0 });
  assert.deepEqual([player.skills.sword.lvl, player.skills.sword.tries], [10, 45]);
  assert.equal(player.skills.fist.lvl, 10);
});

test('vocação: vida, mana e cap do Tibia por nível e ritmo próprio dos skills', async () => {
  const { vocationStats } = await import('../shared/vocations.js');
  const { triesFor } = await import('../shared/skills.js');
  assert.deepEqual(vocationStats(8, 'knight'), { hp: 185, mana: 90, cap: 470 });
  assert.deepEqual(vocationStats(20, 'knight'), { hp: 365, mana: 150, cap: 770 });
  assert.deepEqual(vocationStats(20, 'paladin'), { hp: 305, mana: 270, cap: 710 });
  assert.deepEqual(vocationStats(20, 'sorcerer'), { hp: 245, mana: 450, cap: 590 });
  assert.deepEqual(vocationStats(20, 'none'), { hp: 245, mana: 150, cap: 590 });
  assert.equal(triesFor(11, 'sword', 'knight'), 55);
  assert.equal(triesFor(11, 'distance', 'paladin'), 33);

  const player = new Player({ x: 0, y: 0, lvl: 20 });
  player.setVocation('knight');
  assert.deepEqual([player.vocation, player.maxHp, player.maxMana], ['knight', 365, 150]);
});
