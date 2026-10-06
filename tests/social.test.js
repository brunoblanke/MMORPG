// tests/social.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, safeRect, placeAt, CREATURE } from './helpers/fixture.js';
import { setAssets } from '../shared/assets.js';
import { TICK_MS } from '../js/simulation.js';
import { SKULL_MS } from '../js/systems/social.js';

const BAG = 'itens/recipientes/bag';
const ROPE = 'itens/ferramentas/rope';
const SWORD = 'itens/espadas/sword';
const asset = (id, propriedades, ferramenta = 'objetos') => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta, grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(BAG, { move: true, peso: 8, espacos: 4 }), asset(ROPE, { move: true, peso: 18 }), asset(SWORD, { move: true, peso: 30, atk: 10 }),
  asset(CREATURE, { vida: 10, xp: 100 }, 'criaturas')
]);

// ================================================================================================================================================================================================================================================
// game
// Ana (player1) e Bia lado a lado, as duas com mochila.

function game(extra = {}) {
  const sim = buildGame({ objects: floorRect(0, 29, 0, 29, 0), player: { x: 5, y: 5, z: 0 }, ...extra });
  sim.player.name = 'Ana';
  const bia = sim.addPlayer('player2', { name: 'Bia' });
  placeAt(sim, bia, 6, 5, 0);
  bia.lvl = sim.player.lvl;
  for (const p of [sim.player, bia]) p.equip.mochila = { uid: `bag-${p.id}`, type: BAG, items: [null, null, null, null] };
  return { sim, ana: sim.player, bia };
}

function run(sim, playerId, command) {
  sim.enqueue(playerId, command);
  sim.tick(sim.time + TICK_MS);
  return sim.drainEvents();
}

const textsFor = (events, player) => events.filter(e => e.type === 'message' && e.playerId === player.id).map(e => e.text);

test('party: convida, entra e divide a XP das criaturas entre quem está perto', () => {
  const { sim, ana, bia } = game({ enemies: [[8, 8, 0]] });
  run(sim, 'player1', { type: 'partyInvite', targetId: bia.id });
  assert.equal(sim.inventory.viewFor(bia).social.invites[0].name, 'Ana');
  run(sim, 'player2', { type: 'partyJoin', leaderId: ana.id });
  assert.deepEqual(sim.inventory.viewFor(ana).social.party.map(m => m.name), ['Ana', 'Bia']);
  const enemy = sim.enemies[0];
  enemy.damageBy = new Map([[ana.id, 10]]);
  enemy.currentHp = 0;
  const xp = [ana.xp + ana.lvl * 1e6, bia.xp + bia.lvl * 1e6];
  sim.tick(sim.time + TICK_MS);
  const events = sim.drainEvents().filter(e => e.type === 'xp');
  assert.deepEqual(events.map(e => [e.playerId, e.amount]).sort(), [[ana.id, 50], [bia.id, 50]]);
  assert.ok(ana.xp + ana.lvl * 1e6 > xp[0] && bia.xp + bia.lvl * 1e6 > xp[1]);
  assert.equal(sim.social.canAttack(ana, bia), false);
  run(sim, 'player2', { type: 'partyLeave' });
  assert.equal(sim.social.partyOf(ana), null);
});

test('mensagem privada chega só pra quem tem o nome; quem não está online avisa', () => {
  const { sim, ana, bia } = game();
  const events = run(sim, 'player1', { type: 'privateMessage', to: 'bia', text: 'oi amiga' });
  assert.deepEqual(textsFor(events, bia), ['Ana: oi amiga']);
  assert.deepEqual(textsFor(events, ana), ['Para Bia: oi amiga']);
  assert.match(textsFor(run(sim, 'player1', { type: 'privateMessage', to: 'Caio', text: 'oi' }), ana)[0], /não está online/);
});

test('VIP: guarda os nomes, mostra quem está online e avisa quando entra e sai', () => {
  const { sim, ana, bia } = game();
  run(sim, 'player1', { type: 'vipAdd', name: 'bia' });
  run(sim, 'player1', { type: 'vipAdd', name: 'Caio' });
  assert.deepEqual(sim.inventory.viewFor(ana).social.vip, [{ name: 'Bia', online: true }, { name: 'Caio', online: false }]);
  sim.removePlayer(bia.id);
  assert.ok(textsFor(sim.drainEvents(), ana).includes('Bia saiu do jogo.'));
  sim.addPlayer('player3', { name: 'Caio' });
  assert.ok(textsFor(sim.drainEvents(), ana).includes('Caio entrou no jogo.'));
  assert.deepEqual(JSON.parse(JSON.stringify(ana.toSave())).vip, ['Bia', 'Caio']);
});

test('troca: cada uma oferece um item, as duas aceitam e os itens trocam de dono; mudar a oferta tira o aceite', () => {
  const { sim, ana, bia } = game();
  ana.equip.mochila.items[0] = { uid: 'rope1', type: ROPE };
  bia.equip.mochila.items[0] = { uid: 'sword1', type: SWORD };
  run(sim, 'player1', { type: 'tradeOpen', targetId: bia.id });
  run(sim, 'player1', { type: 'tradeOffer', from: { t: 'c', uid: ana.equip.mochila.uid, i: 0 } });
  run(sim, 'player1', { type: 'tradeAccept' });
  run(sim, 'player2', { type: 'tradeOffer', from: { t: 'c', uid: bia.equip.mochila.uid, i: 0 } });
  const view = sim.inventory.viewFor(bia).social.trade;
  assert.equal(view.with, 'Ana');
  assert.equal(view.theirs.item.type, ROPE);
  assert.equal(view.theirAccept, false);
  run(sim, 'player2', { type: 'tradeAccept' });
  run(sim, 'player1', { type: 'tradeAccept' });
  assert.ok(ana.equip.mochila.items.some(i => i && i.uid === 'sword1'));
  assert.ok(bia.equip.mochila.items.some(i => i && i.uid === 'rope1'));
  assert.equal(sim.social.tradeOf(ana), null);
});

test('troca é cancelada quando uma se afasta', () => {
  const { sim, ana, bia } = game();
  run(sim, 'player1', { type: 'tradeOpen', targetId: bia.id });
  placeAt(sim, bia, 20, 20, 0);
  const events = run(sim, 'player1', { type: 'turn', dx: 1, dy: 0 });
  assert.equal(sim.social.tradeOf(ana), null);
  assert.ok(textsFor(events, ana).some(t => /cancelada/.test(t)));
});

test('PvP: atacar quem não tem caveira dá a caveira branca; quem se defende não ganha; com caveira, morrer deixa tudo no corpo', () => {
  const { sim, ana, bia } = game();
  ana.hp = ana.currentHp = 100000;
  bia.hp = bia.currentHp = 100000;
  run(sim, 'player1', { type: 'attack', targetId: bia.id });
  assert.equal(ana.target, bia);
  ana.lastAttackTime = -1e9;
  sim.combat.attackTarget(ana, bia, sim.time);
  assert.ok(sim.social.hasSkull(ana));
  bia.lastAttackTime = -1e9;
  sim.combat.attackTarget(bia, ana, sim.time);
  assert.equal(sim.social.hasSkull(bia), false);
  sim.tick(sim.time + TICK_MS);
  assert.equal(ana.skull, 'white');

  ana.equip.arma = { uid: 's2', type: SWORD };
  ana.currentHp = 0;
  sim.tick(sim.time + TICK_MS);
  const corpse = sim.deadBodies.find(c => c.ownerId === ana.id);
  assert.ok(corpse.itemData.items.some(i => i && i.uid === 's2'));
  assert.ok(sim.time < SKULL_MS);
});

test('PvP: na zona segura ou abaixo do nível 8 não dá pra atacar player', () => {
  const safe = game({ safe: safeRect(0, 10, 0, 10, 0) });
  run(safe.sim, 'player1', { type: 'attack', targetId: safe.bia.id });
  assert.equal(safe.ana.target, null);
  const low = game();
  low.bia.lvl = 5;
  run(low.sim, 'player1', { type: 'attack', targetId: low.bia.id });
  assert.equal(low.ana.target, null);
});

// ================================================================================================================================================================================================================================================
// killWithoutReason
// Ana ataca Bia (sem justificativa) e Bia morre logo depois.

function killWithoutReason(sim, ana, bia) {
  bia.skullUntil = 0;
  bia.pvpAttacked = null;
  ana.pvpAttacked = null;
  bia.hp = bia.currentHp = 100000;
  ana.lastAttackTime = -1e9;
  sim.combat.attackTarget(ana, bia, sim.time);
  bia.currentHp = 0;
  sim.tick(sim.time + TICK_MS);
}

test('frags: matar sem justificativa conta; 3 dão a caveira vermelha e 6 a preta (nas 24 h)', () => {
  const { sim, ana, bia } = game();
  ana.hp = ana.currentHp = 100000;
  for (let i = 0; i < 2; i++) killWithoutReason(sim, ana, bia);
  assert.equal(ana.frags.length, 2);
  assert.equal(sim.social.skullOf(ana), 'white');
  killWithoutReason(sim, ana, bia);
  assert.equal(sim.social.skullOf(ana), 'red');
  for (let i = 0; i < 3; i++) killWithoutReason(sim, ana, bia);
  assert.equal(sim.social.skullOf(ana), 'black');
});

test('frags: matar quem tinha caveira ou atacou primeiro não conta e o frag velho expira', () => {
  const { sim, ana, bia } = game();
  ana.hp = ana.currentHp = 100000;
  bia.skullUntil = sim.time + SKULL_MS;
  bia.hp = bia.currentHp = 100000;
  ana.lastAttackTime = -1e9;
  sim.combat.attackTarget(ana, bia, sim.time);
  bia.currentHp = 0;
  sim.tick(sim.time + TICK_MS);
  assert.equal(ana.frags.length, 0);
  ana.frags = [sim.wallTime() - 25 * 60 * 60 * 1000, sim.wallTime() - 26 * 60 * 60 * 1000, sim.wallTime() - 27 * 60 * 60 * 1000];
  assert.notEqual(sim.social.skullOf(ana), 'red', 'três frags de mais de 24 h não dão vermelha');
  ana.frags = [...ana.frags, sim.wallTime(), sim.wallTime(), sim.wallTime(), sim.wallTime(), sim.wallTime()];
  assert.equal(sim.social.skullOf(ana), 'red', '5 frags na semana dão vermelha');
});
