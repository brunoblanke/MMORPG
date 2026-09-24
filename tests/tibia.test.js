// tests/tibia.test.js

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildMapData, floorRect } from './helpers/fixture.js';
import { Simulation } from '../js/simulation.js';
import { setTibiaRegistry, tibiaFrameRect, tibiaItemType, parseTibiaType } from '../shared/tibia-registry.js';
import { serializeMapFromLayers, buildLayersFromMapData } from '../shared/map-format.js';

const require = createRequire(import.meta.url);
const { TibiaAssets } = require('../server/tibia-assets.js');
const CLIENT = new URL('../img/780', import.meta.url).pathname;

const REGISTRY = {
  items: {
    103: { file: 'tibia/items/103.png', kind: 'ground', fw: 32, fh: 32, frames: 1, patterns: [4, 3, 1], blocks: false, movable: false, hasVolume: false },
    1284: { file: 'tibia/items/1284.png', kind: 'wall', fw: 64, fh: 64, frames: 1, patterns: [1, 1, 1], blocks: true, movable: false, hasVolume: false },
    2469: { file: 'tibia/items/2469.png', kind: 'item', fw: 32, fh: 32, frames: 1, patterns: [1, 1, 1], blocks: false, movable: true, hasVolume: true }
  },
  creatures: {
    Rato: { outfit: 21, file: 'tibia/creatures/21.png', spriteSize: 32, frames: 3, color: '#8B6B4A', defaultLvl: 3, corpse: null, corpseSize: 32, corpseFrames: 1 }
  }
};

afterEach(() => setTibiaRegistry(null));

test('lê o Tibia.spr/Tibia.dat 7.8 e separa o catálogo por categoria', () => {
  const assets = new TibiaAssets(CLIENT);
  const { items, creatures } = assets.catalogo();
  const count = (kind) => items.filter(([, category]) => category === kind).length;
  for (const kind of ['ground', 'border', 'wall', 'object', 'item']) assert.ok(count(kind) > 100, `${kind}: ${count(kind)}`);
  assert.ok(creatures.length > 100);
  assert.deepEqual(items.find(([id]) => id === 103).slice(0, 2), [103, 'ground']);
});

test('gera o PNG do item com as propriedades do .dat', () => {
  const assets = new TibiaAssets(CLIENT);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tibia-'));
  try {
    const wall = assets.exportarItem(1284, dir);
    assert.deepEqual([wall.kind, wall.blocks, wall.movable, wall.fw, wall.fh], ['wall', true, false, 64, 64]);
    const box = assets.exportarItem(2469, dir);
    assert.deepEqual([box.kind, box.movable, box.hasVolume, box.blocks], ['item', true, true, false]);
    const ground = assets.exportarItem(103, dir);
    assert.deepEqual(ground.patterns, [4, 3, 1]);

    const png = fs.readFileSync(path.join(dir, ground.file));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [32, 32 * 12]);

    const creature = assets.exportarCriatura(21, dir);
    const sheet = fs.readFileSync(path.join(dir, creature.file));
    assert.deepEqual([sheet.readUInt32BE(16), sheet.readUInt32BE(20)], [32 * creature.frames, 32 * 4]);
    assert.equal(assets.exportarItem(99999, dir), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('chão do Tibia alterna a variação pelo sqm e o item animado pelo tempo', () => {
  const ground = REGISTRY.items[103];
  assert.deepEqual(tibiaFrameRect(ground, 0, 0, 0, 0), { sx: 0, sy: 0, sw: 32, sh: 32 });
  assert.equal(tibiaFrameRect(ground, 5, 2, 0, 0).sy, (2 * 4 + 1) * 32);
  assert.equal(tibiaFrameRect(ground, -1, 0, 0, 0).sy, 3 * 32);
  const water = { ...ground, frames: 4, patterns: [1, 1, 1] };
  assert.equal(tibiaFrameRect(water, 0, 0, 0, 1200).sx, 2 * 32);
});

test('o mapa guarda chão, item e criatura do Tibia e o editor lê de volta', () => {
  setTibiaRegistry(REGISTRY);
  assert.equal(tibiaItemType(103, 'ground'), 'TibiaGround:103');
  assert.deepEqual(parseTibiaType('Tibia:2469_7'), { id: 2469, ground: false });

  const mapData = buildMapData({
    objects: [['TibiaGround:103', 2, 2, 0, 0, false, false, false, 1], ['Tibia:2469', 2, 2, 0], ['Tibia:2469', 2, 2, 0]],
    spawn: { x: 1, y: 1, z: 0 }
  });
  const { layers } = buildLayersFromMapData(mapData, 5);
  const cell = layers[0]['2,2'];
  assert.equal(cell.floor.type, 'TibiaGround:103');
  assert.deepEqual(cell.objects.map(o => o.type), ['Tibia:2469', 'Tibia:2469']);

  const saved = serializeMapFromLayers([0], layers, 5);
  const tibiaEntries = saved.objetosData.filter(([type]) => String(type).startsWith('Tibia'));
  assert.deepEqual(tibiaEntries.map(e => e.slice(0, 8)), [
    ['TibiaGround:103', 2, 2, 0, 0, false, false, false],
    ['Tibia:2469', 2, 2, 0, 0, true, true, false],
    ['Tibia:2469', 2, 2, 0, 1, true, true, false]
  ]);
});

test('no jogo: chão do Tibia é pisável, parede bloqueia e a criatura gerada existe', () => {
  setTibiaRegistry(REGISTRY);
  const mapData = buildMapData({
    objects: [
      ...floorRect(0, 3, 0, 3, 0).map(([, x, y, z]) => ['TibiaGround:103', x, y, z, 0, false, false, false]),
      ['Tibia:1284', 2, 1, 0, 0, false, false, true]
    ],
    spawn: { x: 0, y: 0, z: 0 }
  });
  mapData.enemyData = [[3, 3, 0, 3, 32, 'Rato']];
  const sim = new Simulation(mapData);

  assert.equal(sim.world.hasFloorAt(1, 1, 0), true);
  assert.equal(sim.world.isBlocked(1, 1, 0), false);
  assert.equal(sim.world.isBlocked(2, 1, 0), true);
  assert.ok(sim.objects.some(o => o.floorType === 'TibiaGround' && o.id.startsWith('TibiaGround:103_')));
  assert.equal(sim.enemies[0].creature, 'Rato');
});
