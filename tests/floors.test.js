// tests/floors.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, buildMapData, floorRect, hole, placeAt } from './helpers/fixture.js';
import { Simulation, TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';

const WATER = 'estrutura/pisos/agua';
const POISON = 'estrutura/pisos/veneno';
const LAKE = 'estrutura/pisos/lago';
const CAVE = 'estrutura/pisos/caverna';
const SWORD = 'itens/espadas/espada';
const STAIRS_STRAIGHT = 'estrutura/escadas/reta';

const floor = (id, propriedades) => ({ id, ferramenta: 'pisos', grupo: 'estrutura', pasta: 'pisos', nome: id.split('/').pop(), url: '/p.png', quadro: 32, quadros: 1, variacoes: 1, pecas: [], propriedades });

setAssets([
  floor('estrutura/pisos/teste', null),
  floor(WATER, { comportamento: 'bloqueia' }),
  floor(POISON, { comportamento: 'dano', dano: 7 }),
  floor(LAKE, { comportamento: 'bloqueia', bordaBloqueia: true }),
  floor(CAVE, { bordaBloqueia: true, bordaBarraArremesso: true }),
  { id: STAIRS_STRAIGHT, ferramenta: 'objetos', grupo: 'estrutura', pasta: 'escadas', nome: 'reta', url: '/r.png', quadro: 64, quadros: 1, pecas: [], propriedades: { altura: false } },
  { id: SWORD, ferramenta: 'objetos', grupo: 'itens', pasta: 'espadas', nome: 'espada', url: '/e.png', quadro: 32, quadros: 1, pecas: [], propriedades: { move: true, peso: 30 } }
]);

// ================================================================================================================================================================================================================================================
// game
// Chão de 10×10 com uma faixa de água em x = 6 e veneno em (3, 5).

function game() {
  const objects = [
    ...floorRect(0, 9, 0, 9),
    ...Array.from({ length: 10 }, (_, y) => [WATER, 6, y, 0, 0, 0, 0, 0]),
    [POISON, 3, 5, 0, 0, 0, 0, 0]
  ];
  const sim = buildGame({ objects, player: { x: 5, y: 5, z: 0 } });
  sim.time = 1000;
  return sim;
}

function run(sim, ms) {
  const end = sim.time + ms;
  while (sim.time < end) sim.tick(sim.time + TICK_MS);
}

test('água bloqueia o passo: o player não entra nela', () => {
  const sim = game();
  assert.equal(sim.world.isBlocked(6, 5, 0), true);
  sim.enqueue('player1', { type: 'walkDir', dx: 1, dy: 0 });
  run(sim, 1000);
  sim.enqueue('player1', { type: 'walkDir', dx: 0, dy: 0 });
  run(sim, 200);
  assert.equal(sim.player.x, 5);
});

test('item jogado na água afunda e some; por cima dela, o arremesso passa', () => {
  const sim = game();
  sim.player.equip.arma = { uid: 'w1', type: SWORD };
  sim.enqueue('player1', { type: 'moveInv', from: { t: 'e', key: 'arma' }, to: { t: 'w', x: 6, y: 5, z: 0 } });
  sim.tick(sim.time + TICK_MS);
  const texts = sim.drainEvents().filter(e => e.type === 'message').map(e => e.text);
  assert.equal(sim.player.equip.arma, null);
  assert.equal(sim.objects.some(o => o.itemData && o.itemData.uid === 'w1'), false);
  assert.ok(texts.some(t => t.endsWith('afundou.')));

  sim.player.equip.arma = { uid: 'w2', type: SWORD };
  sim.enqueue('player1', { type: 'moveInv', from: { t: 'e', key: 'arma' }, to: { t: 'w', x: 7, y: 5, z: 0 } });
  sim.tick(sim.time + TICK_MS);
  const landed = sim.objects.find(o => o.itemData && o.itemData.uid === 'w2');
  assert.deepEqual([landed.x, landed.y], [7, 5]);
});

test('veneno tira vida ao pisar e a cada segundo parado nele', () => {
  const sim = game();
  const hp = sim.player.currentHp;
  sim.enqueue('player1', { type: 'walkTo', x: 3, y: 5, z: 0 });
  run(sim, 1500);
  assert.deepEqual([sim.player.x, sim.player.y], [3, 5]);
  const afterStep = sim.player.currentHp;
  assert.ok(afterStep <= hp - 7);
  run(sim, 2100);
  assert.ok(sim.player.currentHp <= afterStep - 14);
});

test('objeto jogado na escada sem altura fica no pé dela', () => {
  const objects = [...floorRect(0, 14, 0, 14, 0), ...floorRect(0, 14, 0, 14, 1)];
  const mapData = { version: 3, objetosData: objects, transicoesData: [[STAIRS_STRAIGHT, 7, 7, 0]], enemyData: [], safeZoneData: [], spawn: { x: 7, y: 8, z: 0 } };
  const sim = new Simulation(mapData);
  const player = sim.addPlayer('p1', { name: 'Ana' });
  const obj = sim.inventory.spawnGroundItem({ type: 'itens/recipientes/bag' }, player.x, player.y, 0);
  sim.objectDrag.moveObject(player, obj, 7, 7, 0);
  assert.deepEqual([obj.x, obj.y, obj.z], [7, 7, 0]);
});

test('escada sem altura: pisar só posiciona; usada (duplo clique), sobe e sai na frente do topo; descer cai no pé dela', () => {
  const objects = [...floorRect(0, 14, 0, 14, 0), ...floorRect(0, 14, 0, 14, 1)];
  const mapData = { version: 3, objetosData: objects, transicoesData: [[STAIRS_STRAIGHT, 7, 7, 0]], enemyData: [], safeZoneData: [], spawn: { x: 7, y: 11, z: 0 } };
  const sim = new Simulation(mapData);
  sim.time = 1000;
  const player = sim.addPlayer('p1', { name: 'Ana' });
  sim.enqueue('p1', { type: 'walkTo', x: 7, y: 7, z: 0 });
  run(sim, 3000);
  assert.deepEqual([player.x, player.y, player.z], [7, 7, 0]);
  sim.enqueue('p1', { type: 'useStairs', x: 7, y: 7, z: 0 });
  run(sim, 200);
  assert.deepEqual([player.x, player.y, player.z], [6, 7, 1]);

  sim.enqueue('p1', { type: 'walkTo', x: 6, y: 6, z: 1 });
  run(sim, 1000);
  assert.deepEqual([player.x, player.y, player.z], [6, 7, 1]);
  sim.enqueue('p1', { type: 'walkDir', dx: 0, dy: -1 });
  for (let i = 0; i < 40 && player.z === 1; i++) run(sim, TICK_MS);
  assert.deepEqual([player.x, player.y, player.z], [7, 7, 0]);
  sim.enqueue('p1', { type: 'walkDir', dx: 0, dy: 0 });
  sim.enqueue('p1', { type: 'walkTo', x: 7, y: 9, z: 0 });
  run(sim, 2000);
  sim.enqueue('p1', { type: 'useStairs', x: 7, y: 7, z: 0 });
  run(sim, 2000);
  assert.deepEqual([player.x, player.y, player.z], [6, 7, 1]);

  const top = sim.world.getTransitionAt(6, 6, 1);
  assert.deepEqual([top.targetX, top.targetY, top.targetZ], [7, 7, 0]);
});

test('no andar de cima, clique no sqm do pé da escada desce por ela (vai até o topo)', () => {
  const objects = [...floorRect(0, 14, 0, 14, 0), ...floorRect(0, 14, 0, 8, 1)];
  const mapData = { version: 3, objetosData: objects, transicoesData: [['estrutura/escadas/normal', 7, 10, 0]], enemyData: [], safeZoneData: [], spawn: { x: 6, y: 5, z: 1 } };
  const sim = new Simulation(mapData);
  sim.time = 1000;
  const player = sim.addPlayer('p1', { name: 'Ana' });
  assert.equal(player.z, 1);
  sim.enqueue('p1', { type: 'walkTo', x: 7, y: 10, z: 1 });
  run(sim, 3000);
  assert.deepEqual([player.x, player.y, player.z], [7, 11, 0]);
});

test('buraco leva pro andar de baixo, 1 sqm ao sul e 1 ao leste', () => {
  const objects = [...floorRect(0, 14, 0, 14, 0), ...floorRect(0, 14, 0, 14, 1), ['estrutura/entradas/buraco', 5, 5, 1, 0, 0, 0, 0]];
  const mapData = { version: 3, objetosData: objects, transicoesData: [], enemyData: [], safeZoneData: [], spawn: { x: 3, y: 5, z: 1 } };
  const sim = new Simulation(mapData);
  sim.time = 1000;
  const player = sim.addPlayer('p1', { name: 'Ana' });
  sim.enqueue('p1', { type: 'walkTo', x: 5, y: 5, z: 1 });
  run(sim, 2000);
  assert.deepEqual([player.x, player.y, player.z], [6, 6, 0]);
});

test('entrada desenhada no topo da escada mantém o piso; descer por ali leva ao pé da escada', () => {
  const objects = [...floorRect(0, 14, 0, 14, 0), ...floorRect(0, 14, 0, 14, 1), ['estrutura/entradas/alcapao', 6, 6, 1, 0, 0, 0, 0]];
  const mapData = { version: 3, objetosData: objects, transicoesData: [[STAIRS_STRAIGHT, 7, 7, 0]], enemyData: [], safeZoneData: [], spawn: { x: 6, y: 8, z: 1 } };
  const sim = new Simulation(mapData);
  sim.time = 1000;
  const player = sim.addPlayer('p1', { name: 'Ana' });
  assert.equal(sim.world.hasFloorAt(6, 6, 1), true);
  sim.enqueue('p1', { type: 'walkTo', x: 6, y: 6, z: 1 });
  run(sim, 2000);
  assert.deepEqual([player.x, player.y, player.z], [7, 7, 0]);
});

test('borda de piso com "Borda bloqueia": o sqm de grama com a borda da água não deixa passar; a da água comum deixa', () => {
  const objects = [
    ...floorRect(0, 9, 0, 9),
    [`Border:${LAKE}:n`, 4, 4, 0, 0, false, false, false],
    [`Border:${WATER}:n`, 6, 6, 0, 0, false, false, false]
  ];
  const sim = new Simulation({ ...buildMapData({ objects, spawn: { x: 1, y: 1, z: 0 } }), version: 2 });
  assert.equal(sim.world.isBlocked(4, 4, 0), true);
  assert.equal(sim.world.isBlocked(6, 6, 0), false);
  assert.equal(sim.world.isBlocked(5, 4, 0), false);
});

test('borda com "Borda barra arremesso" (caverna) barra item jogado e linha de visão; a do lago deixa passar', () => {
  const objects = [
    ...floorRect(0, 9, 0, 9),
    [`Border:${CAVE}:n`, 5, 5, 0, 0, false, false, false],
    [`Border:${LAKE}:n`, 5, 7, 0, 0, false, false, false]
  ];
  const sim = new Simulation({ ...buildMapData({ objects, spawn: { x: 1, y: 1, z: 0 } }), version: 2 });
  assert.equal(sim.world.hasThrowBlockingEdge(5, 5, 0), true);
  assert.equal(sim.world.hasThrowBlockingEdge(5, 7, 0), false);
  assert.equal(sim.movement.hasLineOfSight({ x: 2, y: 5, z: 0 }, { x: 8, y: 5, z: 0 }), false);
  assert.equal(sim.movement.hasLineOfSight({ x: 2, y: 7, z: 0 }, { x: 8, y: 7, z: 0 }), true);
});

// ================================================================================================================================================================================================================================================
// stairsGame
// Escada sem altura em (7, 7) e dois players: Ana e Bia.

function stairsGame() {
  const objects = [...floorRect(0, 14, 0, 14, 0), ...floorRect(0, 14, 0, 14, 1)];
  const mapData = { version: 3, objetosData: objects, transicoesData: [[STAIRS_STRAIGHT, 7, 7, 0]], enemyData: [], safeZoneData: [], spawn: { x: 7, y: 11, z: 0 } };
  const sim = new Simulation(mapData);
  sim.time = 1000;
  return { sim, ana: sim.addPlayer('p1', { name: 'Ana' }), bia: sim.addPlayer('p2', { name: 'Bia' }) };
}

test('escada com player em cima: o vizinho usa e sobe, inclusive na diagonal; quem está em cima fica', () => {
  for (const [x, y] of [[7, 8], [8, 8], [6, 6], [8, 7]]) {
    const { sim, ana, bia } = stairsGame();
    placeAt(sim, ana, 7, 7, 0);
    placeAt(sim, bia, x, y, 0);
    sim.enqueue('p2', { type: 'useStairs', x: 7, y: 7, z: 0 });
    run(sim, 200);
    assert.deepEqual([bia.x, bia.y, bia.z], [6, 7, 1], `de (${x}, ${y})`);
    assert.deepEqual([ana.x, ana.y, ana.z], [7, 7, 0]);
  }
});

test('escada com player em cima, de longe: anda até um sqm livre colado nela e sobe', () => {
  const { sim, ana, bia } = stairsGame();
  placeAt(sim, ana, 7, 7, 0);
  sim.enqueue('p2', { type: 'useStairs', x: 7, y: 7, z: 0 });
  run(sim, 4000);
  assert.deepEqual([bia.x, bia.y, bia.z], [6, 7, 1]);
  assert.deepEqual([ana.x, ana.y, ana.z], [7, 7, 0]);
});

test('escada: chegada ocupada leva pro sqm livre mais perto (só buraco e respawn dividem o sqm)', () => {
  const { sim, ana, bia } = stairsGame();
  placeAt(sim, ana, 6, 7, 1);
  placeAt(sim, bia, 7, 8, 0);
  sim.enqueue('p2', { type: 'useStairs', x: 7, y: 7, z: 0 });
  run(sim, 200);
  assert.equal(bia.z, 1);
  assert.equal(Math.max(Math.abs(bia.x - 6), Math.abs(bia.y - 7)), 1);
  assert.equal(sim.world.getTileEntities(6, 7, 1).filter(e => e.isPlayer).length, 1);
});

test('buraco: quem cai no sqm de outro player fica no mesmo sqm', () => {
  const objects = [...floorRect(0, 14, 0, 14, 0), ...floorRect(0, 14, 0, 14, 1), ...hole(5, 5, 1)];
  const sim = buildGame({ objects, player: { x: 4, y: 5, z: 1 } });
  sim.time = 1000;
  const other = sim.addPlayer('player2', { name: 'Bia' });
  placeAt(sim, other, 6, 6, 0);
  sim.enqueue('player1', { type: 'walkDir', dx: 1, dy: 0 });
  for (let i = 0; i < 40 && sim.player.z === 1; i++) run(sim, TICK_MS);
  assert.deepEqual([sim.player.x, sim.player.y, sim.player.z], [6, 6, 0]);
  assert.deepEqual([other.x, other.y, other.z], [6, 6, 0]);
});
