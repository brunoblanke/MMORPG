// tests/creature-powers.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, wall, CREATURE } from './helpers/fixture.js';
import { setAssets, creaturePowers } from '../shared/assets.js';
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
  side.enemies[0].direction = 'sul';
  const wave = side.powers.waveTiles(side.enemies[0], { length: 8, spread: 3 });
  assert.ok(wave.every(([x, y]) => y > 5 && Math.abs(x - 7) <= 3));
  assert.ok(!wave.some(([x, y]) => x === 5 && y === 5));
});

test('onda: parede segura o fogo', () => {
  const open = game({ ataque: 0, ataques: [DRAGON_WAVE] }, [[9, 5, 0]]);
  open.enemies[0].direction = 'oeste';
  assert.ok(open.powers.waveTiles(open.enemies[0], { length: 8, spread: 3 }).length > 8);
  const walls = Array.from({ length: 20 }, (_, y) => wall(7, y)).flat();
  const closed = game({ ataque: 0, ataques: [DRAGON_WAVE] }, [[9, 5, 0]], walls);
  closed.enemies[0].direction = 'oeste';
  assert.equal(closed.powers.waveTiles(closed.enemies[0], { length: 8, spread: 3 }).length, 1);
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

test('onda: sai sempre na direção em que a criatura está virada, mesmo com o player na diagonal', () => {
  const sim = game({ ataque: 0, ataques: [DRAGON_WAVE] }, [[6, 6, 0]]);
  const enemy = sim.enemies[0];
  for (const [direction, inFront] of [['norte', [6, 3]], ['sul', [6, 9]], ['leste', [9, 6]], ['oeste', [3, 6]]]) {
    enemy.direction = direction;
    const tiles = sim.powers.waveTiles(enemy, { length: 8, spread: 3 });
    assert.ok(tiles.some(([x, y]) => x === inFront[0] && y === inFront[1]), direction);
    assert.ok(!tiles.some(([x, y]) => Math.abs(x - 6) === Math.abs(y - 6) && x !== 6));
  }
});

test('lançar onda: a criatura vira pro player antes e o leque sai nessa direção', () => {
  const sim = game({ ataque: 0, ataques: [DRAGON_WAVE] }, [[6, 6, 0]]);
  const enemy = sim.enemies[0];
  enemy.direction = 'norte';
  Object.assign(sim.player, { x: 9, y: 6 });
  assert.ok(sim.powers.cast(enemy, sim.player, { shape: 'wave', element: 'fire', min: 1, max: 1, length: 8, spread: 3, widths: [], center: 'self', range: 0, radius: 0 }, sim.time));
  assert.equal(enemy.direction, 'leste');
});

test('cura: a criatura que foge ferida também se cura', () => {
  const sim = game({ ataque: 0, ataques: [{ forma: 'cura', min: 40, max: 70, chance: 100 }] });
  const enemy = sim.enemies[0];
  enemy.ai.state = 'flee';
  enemy.currentHp = enemy.hp - 150;
  const before = enemy.currentHp;
  sim.powers.update(enemy, sim.player, sim.time + 5000);
  assert.ok(enemy.currentHp > before);
});

// ================================================================================================================================================================================================================================================
// shapeOf
// Os sqms que a magia da forma dada alcança, com a criatura em (9, 9) e o player em (5, 9) (oeste dela).

function shapeOf(attack, playerAt = [5, 9]) {
  const sim = game({ ataque: 0, ataques: [{ elemento: 'fire', min: 1, max: 1, chance: 100, ...attack }] }, [[9, 9, 0]]);
  const enemy = sim.enemies[0];
  enemy.direction = 'oeste';
  Object.assign(sim.player, { x: playerAt[0], y: playerAt[1] });
  const powers = sim.powers;
  const spell = { shape: ({ onda: 'wave', raio: 'beam', varredura: 'sweep', redor: 'around', anel: 'ring', cruz: 'cross', bola: 'ball' })[attack.forma], center: attack.forma === 'bola' ? 'target' : 'self', widths: attack.larguras || [], length: attack.larguras ? attack.larguras.length : attack.comprimento || 0, spread: attack.abertura || 0, radius: attack.raio || 0, range: attack.alcance || 0, element: 'fire' };
  return { sim, enemy, area: powers.areaOf(enemy, sim.player, spell) };
}

test('onda com larguras 1-1-3-3 e 1-3-3-5 desenha as fileiras do Tibia', () => {
  for (const [widths, expected] of [[[1, 1, 3, 3], [1, 1, 3, 3]], [[1, 3, 3, 5], [1, 3, 3, 5]]]) {
    const { area } = shapeOf({ forma: 'onda', larguras: widths });
    const rows = [1, 2, 3, 4].map(d => area.tiles.filter(([x]) => x === 9 - d).length);
    assert.deepEqual(rows, expected);
  }
});

test('raio: linha reta de comprimento sqm na direção em que a criatura está virada', () => {
  const { area } = shapeOf({ forma: 'raio', comprimento: 6 });
  assert.deepEqual(area.tiles, [[8, 9], [7, 9], [6, 9], [5, 9], [4, 9], [3, 9]]);
});

test('varredura: os 3 sqms colados na frente; redor: os 8 colados nela', () => {
  const sweep = shapeOf({ forma: 'varredura' }, [8, 9]);
  assert.deepEqual(sweep.area.tiles.map(t => t.join(',')).sort(), ['8,10', '8,8', '8,9']);
  const around = shapeOf({ forma: 'redor' }, [8, 10]);
  assert.equal(around.area.tiles.length, 8);
  assert.equal(shapeOf({ forma: 'redor' }, [5, 9]).area, null);
});

test('anel em volta dela: o aro de raio 3 fere quem está nele, não quem está dentro', () => {
  const ring = shapeOf({ forma: 'anel', raio: 3 }, [6, 9]);
  assert.ok(ring.area.tiles.some(([x, y]) => x === 6 && y === 9));
  assert.ok(!ring.area.tiles.some(([x, y]) => x === 9 && y === 9));
  assert.equal(shapeOf({ forma: 'anel', raio: 3 }, [8, 9]).area, null);
});

test('cruz: as 5 casas da explosion rune no player; bola de raio 1 é o 3×3 do dragon', () => {
  const cross = shapeOf({ forma: 'cruz', alcance: 7 }, [6, 9]);
  assert.equal(cross.area.tiles.length, 5);
  const ball = shapeOf({ forma: 'bola', alcance: 7, raio: 1 }, [6, 9]);
  assert.equal(ball.area.tiles.length, 9);
});

test('campo: a magia cria o campo no alvo e em volta, e o player entra nele sem ser ferido na hora', () => {
  const FIELD = 'itens/itens-encantados/fire-field';
  setAssets([creature(CREATURE, { vida: 300, xp: 100, ataque: 0, ataques: [{ forma: 'campo', campo: FIELD, chance: 100, alcance: 7, raio: 1 }] }), { id: FIELD, ferramenta: 'objetos', grupo: 'itens', pasta: 'itens-encantados', nome: 'fire-field', url: '/f.png', quadro: 32, quadros: 1, pecas: [], propriedades: { move: false } }]);
  const sim = buildGame({ objects: floorRect(0, 19, 0, 19, 0), enemies: [[8, 5, 0]], player: { x: 5, y: 5, z: 0 } });
  sim.player.hp = sim.player.currentHp = 100000;
  runFor(sim, 2100);
  const fields = sim.objects.filter(o => o.id.startsWith(FIELD));
  assert.ok(fields.length >= 5);
  assert.ok(fields.some(o => o.x === 5 && o.y === 5));
});

// ================================================================================================================================================================================================================================================
// attackOf
// A magia normalizada da criatura de teste.

function attackOf(sim) {
  return creaturePowers(sim.enemies[0].creature).attacks[0];
}

test('corrente: acerta o player e pula pros mais perto, até o limite de saltos e de distância', () => {
  const sim = game({ ataque: 0, ataques: [{ forma: 'corrente', elemento: 'energy', min: 50, max: 50, chance: 100, alcance: 8, saltos: 3, alcanceSalto: 4 }] }, [[9, 5, 0]]);
  const near = sim.addPlayer('player2', { name: 'Dois' });
  const next = sim.addPlayer('player3', { name: 'Tres' });
  const far = sim.addPlayer('player4', { name: 'Quatro' });
  for (const [p, x, y] of [[near, 5, 8], [next, 5, 11], [far, 5, 18]]) {
    sim.world.moveEntityTile(p, p.x, p.y, 0, x, y, 0);
    Object.assign(p, { x, y, z: 0, step: 0 });
  }
  const players = [sim.player, near, next, far];
  for (const p of players) p.hp = p.currentHp = 100000;
  sim.powers.cast(sim.enemies[0], sim.player, attackOf(sim), sim.time);
  const events = sim.drainEvents();
  const hit = (p) => events.some(e => e.type === 'damage' && e.targetId === p.id && e.amount === 50);
  assert.deepEqual(players.map(hit), [true, true, true, false]);
  const effect = events.find(e => e.type === 'effect' && e.effect === 'energy');
  assert.ok(effect.tiles.length >= 10);
});

test('lentidão: deixa o player lento pelo tempo dela', () => {
  const sim = game({ ataque: 0, ataques: [{ forma: 'lentidao', velocidade: -100, ms: 5000, chance: 100, alcance: 8 }] }, [[8, 5, 0]]);
  sim.powers.cast(sim.enemies[0], sim.player, attackOf(sim), sim.time);
  assert.equal(sim.player.conditions.slow.speed, -100);
});

test('parry: a criatura devolve parte do dano a quem bate nela', () => {
  const sim = game({ ataque: 0, ataques: [{ forma: 'reflexo', chance: 100, porcentagem: 50 }] }, [[6, 5, 0]]);
  const player = sim.player;
  player.hp = player.currentHp = 1000;
  const random = Math.random;
  Math.random = () => 0.5;
  sim.combat.applyDamage(player, sim.enemies[0], 100, sim.time, true);
  Math.random = random;
  assert.equal(player.currentHp, 950);
});

test('resistências: imune não leva dano do tipo, fraca leva mais, o resto normal', () => {
  const sim = game({ ataque: 0, resistencias: { fire: 0, ice: 200 } }, [[6, 5, 0]]);
  const enemy = sim.enemies[0];
  const before = enemy.currentHp;
  sim.spells.hurt(sim.player, enemy, 50, sim.time, 'fire');
  assert.equal(enemy.currentHp, before);
  sim.spells.hurt(sim.player, enemy, 50, sim.time, 'ice');
  assert.equal(enemy.currentHp, before - 100);
  sim.spells.hurt(sim.player, enemy, 50, sim.time, 'energy');
  assert.equal(enemy.currentHp, before - 150);
  sim.conditions.add(enemy, 'fire', { damage: 5, ticks: 3 });
  assert.equal(enemy.conditions && enemy.conditions.fire, undefined);
});

test('magias só alcançam sqms com chão no andar em que são lançadas (piso só no andar de cima não conta)', () => {
  game({ ataque: 0, ataques: [DRAGON_WAVE] });
  const sim = buildGame({ objects: [...floorRect(0, 9, 0, 19, 0), ...floorRect(7, 19, 0, 19, 1)], enemies: [[6, 6, 0]], player: { x: 5, y: 5, z: 0 } });
  const enemy = sim.enemies[0];
  enemy.direction = 'leste';
  const tiles = sim.powers.waveTiles(enemy, { length: 8, spread: 3 });
  assert.ok(tiles.length > 0);
  assert.ok(tiles.every(([x, y]) => sim.world.hasFloorAt(x, y, 0)));
  assert.ok(sim.world.hasFloorAt(12, 6, 1) && !tiles.some(([x]) => x > 9));
});
