// tests/spells.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, safeRect, CREATURE } from './helpers/fixture.js';
import { setAssets, MAGIC_WALL } from '../shared/assets.js';
import { TICK_MS } from '../js/simulation.js';
import { BLANK_RUNE, SPELL_COOLDOWN_MS } from '../shared/spells.js';
import { toPlain, fromPlain } from '../shared/items.js';

const BAG = 'itens/recipientes/bag';
const LMM = 'itens/runas/light-magic-missile-rune';
const IH = 'itens/runas/intense-healing-rune';
const GFB = 'itens/runas/great-fireball-rune';
const FIRE_BOMB = 'itens/runas/fire-bomb-rune';
const MW_RUNE = 'itens/runas/magic-wall-rune';
const CURE = 'itens/runas/cure-poison-rune';
const FIRE_FIELD = 'itens/itens-encantados/fire-field';
const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: id.startsWith('criaturas') ? 'criaturas' : 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(BAG, { move: true, peso: 10, espacos: 4 }),
  asset(BLANK_RUNE, { move: true, peso: 2.1 }),
  asset(LMM, { move: true, peso: 1.2 }),
  asset(IH, { move: true, peso: 1.2 }),
  asset(GFB, { move: true, peso: 1.2 }),
  asset(FIRE_BOMB, { move: true, peso: 1.2 }),
  asset(MW_RUNE, { move: true, peso: 1.2 }),
  asset(CURE, { move: true, peso: 1.2 }),
  asset(FIRE_FIELD, { move: false }),
  asset(MAGIC_WALL, { move: false, bloqueia: true }),
  asset(CREATURE, { vida: 500 })
]);

// ================================================================================================================================================================================================================================================
// say
// O player diz text e passa um tick; devolve os eventos.

function say(game, text) {
  game.enqueue('player1', { type: 'say', text });
  game.tick(game.time + TICK_MS);
  return game.drainEvents();
}

// ================================================================================================================================================================================================================================================
// mage
// Jogo com o player druid (ou a vocação dada) com a mana cheia.

function mage(vocation = 'druid', extra = {}) {
  const game = buildGame({ objects: floorRect(0, 14, 0, 14, 0), player: { x: 5, y: 5, z: 0 }, ...extra });
  game.player.setVocation(vocation);
  game.player.mana = game.player.maxMana;
  game.player.equip.mochila = { uid: 'b1', type: BAG, items: [null, null, null, null] };
  return game;
}

test('exura: cura, gasta a mana, as palavras saem em laranja e o magic level treina', () => {
  const game = mage();
  const player = game.player;
  player.currentHp = 10;
  const mana = player.mana;
  const events = say(game, 'Exura!');
  assert.ok(player.currentHp > 10);
  assert.equal(player.mana, mana - 20);
  assert.ok(events.some(e => e.type === 'speech' && e.orange && e.text === 'exura' && !e.name));
  assert.ok(events.some(e => e.type === 'heal' && e.playerId === player.id));
  assert.equal(player.skills.magic.tries, 20);
});

test('magia: sem a vocação, sem o nível ou sem mana não sai, não gasta nada e avisa; logo depois de outra, exausto', () => {
  const none = mage('none');
  const before = none.player.mana;
  const events = say(none, 'exura');
  assert.equal(none.player.mana, before);
  assert.ok(events.some(e => e.type === 'message' && /vocação/.test(e.text)));
  assert.ok(!events.some(e => e.type === 'speech'));

  const game = mage();
  game.player.lvl = 5;
  assert.ok(say(game, 'exura').some(e => e.type === 'message' && /nível 9/.test(e.text)));
  game.player.lvl = 50;
  game.player.mana = 5;
  assert.ok(say(game, 'exura').some(e => e.type === 'message' && /mana/.test(e.text)));
  game.player.mana = game.player.maxMana;
  say(game, 'exura');
  assert.ok(say(game, 'exura').some(e => e.type === 'message' && /exausto/.test(e.text)));
  const end = game.time + SPELL_COOLDOWN_MS;
  while (game.time < end) game.tick(game.time + TICK_MS);
  assert.ok(say(game, 'exura').some(e => e.type === 'heal'));
});

test('fala comum não é magia: vai pro chat como sempre', () => {
  const game = mage();
  const events = say(game, 'exura mais tarde');
  assert.ok(events.some(e => e.type === 'speech' && e.name && e.text === 'exura mais tarde'));
});

test('utevo lux: o player passa a iluminar mais', () => {
  const game = mage();
  game.tick(game.time + TICK_MS);
  const before = game.player.light;
  say(game, 'utevo lux');
  assert.ok(game.player.light > before);
});

test('exori vis fere o alvo até 3 sqm e conta pra XP; na zona segura não sai', () => {
  const game = mage('sorcerer', { enemies: [[7, 5, 0]] });
  const enemy = game.enemies[0];
  enemy.atk = 0;
  game.player.target = enemy;
  const hp = enemy.currentHp;
  const events = say(game, 'exori vis');
  assert.ok(enemy.currentHp < hp);
  assert.ok(events.some(e => e.type === 'missile'));
  assert.ok(enemy.damageBy.get(game.player.id) > 0);

  const safe = mage('sorcerer', { enemies: [[7, 5, 0]], safe: safeRect(5, 5, 5, 5, 0) });
  safe.player.target = safe.enemies[0];
  const mana = safe.player.mana;
  assert.ok(say(safe, 'exori vis').some(e => e.type === 'message' && /zona segura/.test(e.text)));
  assert.equal(safe.player.mana, mana);
});

test('adori: a blank rune da mochila vira light magic missile com 5 cargas; sem blank rune não sai', () => {
  const game = mage();
  game.player.equip.mochila.items[2] = { uid: 'r1', type: BLANK_RUNE };
  say(game, 'adori');
  const rune = game.player.equip.mochila.items[2];
  assert.equal(rune.type, LMM);
  assert.equal(rune.charges, 5);
  assert.equal(fromPlain(toPlain(rune), () => 'x').charges, 5);
  const end = game.time + SPELL_COOLDOWN_MS;
  while (game.time < end) game.tick(game.time + TICK_MS);
  assert.ok(say(game, 'adori').some(e => e.type === 'message' && /blank rune/.test(e.text)));
});

test('runa: a de ataque fere a criatura na mira e gasta uma carga; a de cura cura o player; a última carga some com a runa', () => {
  const game = mage('druid', { enemies: [[8, 5, 0]] });
  const enemy = game.enemies[0];
  enemy.atk = 0;
  game.player.equip.mochila.items[0] = { uid: 'r1', type: LMM, charges: 2 };
  game.player.equip.mochila.items[1] = { uid: 'r2', type: IH, charges: 1 };
  const hp = enemy.currentHp;
  game.enqueue('player1', { type: 'useItem', from: { t: 'c', uid: 'b1', i: 0 }, target: { x: 8, y: 5, z: 0 } });
  game.tick(game.time + TICK_MS);
  assert.ok(enemy.currentHp < hp);
  assert.equal(game.player.equip.mochila.items[0].charges, 1);

  const end = game.time + SPELL_COOLDOWN_MS;
  while (game.time < end) game.tick(game.time + TICK_MS);
  game.player.currentHp = 10;
  game.player.skills.magic.lvl = 1;
  game.enqueue('player1', { type: 'useItem', from: { t: 'c', uid: 'b1', i: 1 }, target: { x: 5, y: 5, z: 0 } });
  game.tick(game.time + TICK_MS);
  assert.ok(game.player.currentHp > 10);
  assert.equal(game.player.equip.mochila.items[1], null);
});

// ================================================================================================================================================================================================================================================
// rune
// Usa a runa type (no 1º espaço da mochila) mirando em (x, y); devolve os eventos.

function rune(game, type, x, y, charges = 3) {
  game.player.equip.mochila.items[0] = { uid: 'r9', type, charges };
  game.player.useReadyAt = 0;
  game.enqueue('player1', { type: 'useItem', from: { t: 'c', uid: 'b1', i: 0 }, target: { x, y, z: 0 } });
  game.tick(game.time + TICK_MS);
  return game.drainEvents();
}

test('utani hur deixa o player mais rápido; exana pox tira o veneno', () => {
  const game = mage();
  const speed = game.player.spd;
  say(game, 'utani hur');
  assert.ok(game.player.spd > speed);
  game.conditions.add(game.player, 'poison', { damage: 5, ticks: 5 });
  game.player.spellReadyAt = 0;
  say(game, 'exana pox');
  assert.equal(game.player.conditions.poison, undefined);
});

test('exori flam: o golpe e o número saem como fogo', () => {
  const game = mage('sorcerer', { enemies: [[7, 5, 0]] });
  game.enemies[0].atk = 0;
  game.player.target = game.enemies[0];
  const events = say(game, 'exori flam');
  assert.ok(events.some(e => e.type === 'missile' && e.kind === 'fire'));
  assert.ok(events.some(e => e.type === 'damage' && e.element === 'fire'));
});

test('great fireball fere todas as criaturas da área; fire bomb põe fogo nos 9 sqms', () => {
  const game = mage('sorcerer', { enemies: [[9, 5, 0], [9, 6, 0], [12, 12, 0]] });
  game.player.skills.magic.lvl = 10;
  for (const enemy of game.enemies) enemy.atk = 0;
  const hp = game.enemies.map(e => e.currentHp);
  const events = rune(game, GFB, 9, 5);
  assert.ok(game.enemies[0].currentHp < hp[0] && game.enemies[1].currentHp < hp[1]);
  assert.equal(game.enemies[2].currentHp, hp[2]);
  assert.ok(events.some(e => e.type === 'effect' && e.effect === 'fire' && e.tiles.length === 37));

  rune(game, FIRE_BOMB, 6, 9);
  const fires = game.objects.filter(o => o.id.startsWith(FIRE_FIELD) && Math.abs(o.x - 6) <= 1 && Math.abs(o.y - 9) <= 1);
  assert.equal(fires.length, 9);
});

test('magic wall bloqueia o sqm e a linha de tiro e some sozinho; não vai em cima de criatura', () => {
  const game = mage('sorcerer', { enemies: [[9, 9, 0]] });
  game.player.skills.magic.lvl = 10;
  rune(game, MW_RUNE, 7, 5);
  assert.ok(game.world.isBlocked(7, 5, 0));
  assert.equal(game.movement.hasLineOfSight(game.player, { x: 9, y: 5 }), false);
  const events = rune(game, MW_RUNE, 9, 9);
  assert.ok(events.some(e => e.type === 'message' && /Não dá/.test(e.text)));
  const end = game.time + 20000;
  while (game.time < end) game.tick(game.time + TICK_MS);
  assert.equal(game.world.isBlocked(7, 5, 0), false);
});

test('cure poison rune tira o veneno do player mirado', () => {
  const game = mage();
  game.conditions.add(game.player, 'poison', { damage: 5, ticks: 5 });
  rune(game, CURE, 5, 5, 1);
  assert.equal(game.player.conditions.poison, undefined);
  assert.equal(game.player.equip.mochila.items[0], null);
});

test('efeitos do Tibia: UH brilha em quem cura, SD a bola preta no alvo, explosion nos 9 sqms; o campo criado vai pro navegador', async () => {
  const UH = 'itens/runas/ultimate-healing-rune';
  const SD = 'itens/runas/sudden-death-rune';
  const EXPLOSION = 'itens/runas/explosion-rune';
  setAssets([asset(BAG, { move: true }), asset(UH, { move: true }), asset(SD, { move: true }), asset(EXPLOSION, { move: true }), asset(MAGIC_WALL, { move: false, bloqueia: true }), asset(MW_RUNE, { move: true }), asset(CREATURE, { vida: 5000 })]);
  const game = mage('sorcerer', { enemies: [[8, 5, 0]] });
  game.player.skills.magic.lvl = 50;
  game.enemies[0].atk = 0;
  const effects = (events) => events.filter(e => e.type === 'effect');
  assert.deepEqual(effects(rune(game, UH, 5, 5, 1)).map(e => e.effect), ['heal']);
  assert.deepEqual(effects(rune(game, SD, 8, 5)).map(e => [e.effect, e.tiles]), [['death', [[8, 5]]]]);
  const boom = effects(rune(game, EXPLOSION, 8, 5));
  assert.equal(boom[0].effect, 'explosion');
  assert.equal(boom[0].tiles.length, 9);
  rune(game, MW_RUNE, 6, 7);
  const { serializeState } = await import('../js/net/protocol.js');
  const state = serializeState(game, 'player1');
  assert.ok(state.items.some(i => i.id.startsWith(MAGIC_WALL) && i.blocksMovement && i.temporary));
});
