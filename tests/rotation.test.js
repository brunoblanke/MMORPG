// tests/rotation.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setAssets, spriteFrame, objectDirection, rotateType, withDirection, extraSquares } from '../shared/assets.js';
import { collectObjectDescriptors } from '../shared/map-format.js';
import { buildMapData, floorRect, FLOOR, CREATURE } from './helpers/fixture.js';
import { Simulation } from '../js/simulation.js';

const CHEST = 'decoracao/baus/bau';
const BED = 'decoracao/moveis/cama';
const STAIRS = 'estrutura/escadas/escada';
const LIT = 'decoracao/iluminacao/tocha-acesa';

const object = (id, quadro, direcoes, extra = {}) => ({ id, ferramenta: 'objetos', rotulo: 'Teste', nome: id.split('/').pop(), url: `/${id}.png`, quadro, quadros: 1, direcoes, propriedades: { bloqueia: true, altura: true }, ...extra });

setAssets([
  { id: FLOOR, ferramenta: 'pisos', rotulo: 'Pisos', nome: 'teste', url: '/p.png', quadro: 32, quadros: 1, variacoes: 1, pecas: [] },
  { id: CREATURE, ferramenta: 'criaturas', rotulo: 'Criaturas', nome: 'teste', url: '/c.png', quadro: 32, quadros: 1, propriedades: {} },
  object(CHEST, 32, ['norte', 'leste', 'oeste']),
  object(BED, 64, ['norte', 'oeste'], { sqms: 2 }),
  object(STAIRS, 64, ['norte', 'oeste']),
  object(LIT, 32, ['leste', 'oeste'])
]);

test('cada direção é uma linha da folha; sem direção (ou uma que não tem) vale a 1ª', () => {
  assert.deepEqual(spriteFrame(`${CHEST}#oeste`), { url: `/${CHEST}.png`, x: 0, y: 64, size: 32, frames: 1, ms: 0 });
  assert.equal(spriteFrame(CHEST).y, 0);
  assert.equal(objectDirection(`${CHEST}#sul`), 'norte');
});

test('girar pula as direções que o objeto não tem e não mexe no que não gira', () => {
  assert.equal(rotateType(`${CHEST}#leste`), `${CHEST}#oeste`);
  assert.equal(rotateType(`${CHEST}#oeste`), `${CHEST}#norte`);
  assert.equal(rotateType(`${CHEST}#norte`, -1), `${CHEST}#oeste`);
  assert.equal(rotateType(FLOOR), FLOOR);
  assert.equal(withDirection(LIT, `${CHEST}#oeste`), `${LIT}#oeste`);
  assert.equal(withDirection(LIT, `${CHEST}#norte`), LIT);
});

test('cama ocupa 2 sqm: em pé o de cima, deitada o da esquerda, e os dois bloqueiam', () => {
  assert.deepEqual(extraSquares(`${BED}#norte`), [[0, -1]]);
  assert.deepEqual(extraSquares(`${BED}#oeste`), [[-1, 0]]);
  assert.deepEqual(extraSquares(CHEST), []);
  const parts = collectObjectDescriptors({ objetosData: [[`${BED}#oeste`, 5, 5, 0, 0, false, true, true]] });
  assert.equal(parts.length, 2);
  assert.deepEqual([parts[1].x, parts[1].y, parts[1].hidden, parts[1].blocksMovement], [4, 5, true, true]);

  const sim = new Simulation(buildMapData({ objects: [...floorRect(0, 9, 0, 9), [`${BED}#norte`, 5, 5, 0, 0, false, true, true]] }));
  assert.equal(sim.movement.simulateMove({ x: 5, y: 3, z: 0, step: 0 }, 0, 1), null);
  assert.ok(sim.movement.simulateMove({ x: 4, y: 3, z: 0, step: 0 }, 0, 1));
});

test('escada virada pro oeste sobe pro oeste e o topo desce pro leste do pé', () => {
  const mapData = buildMapData({ objects: [...floorRect(0, 14, 0, 14, 0), ...floorRect(2, 12, 2, 12, 1)] });
  mapData.transicoesData = [[`${STAIRS}#oeste`, 7, 10, 0]];
  const sim = new Simulation(mapData);
  const up = sim.movement.simulateMove({ x: 8, y: 10, z: 0, step: 0 }, -1, 0);
  assert.deepEqual([up.x, up.y, up.z], [5, 9, 1]);
  const down = sim.movement.simulateMove({ x: 5, y: 9, z: 1, step: 0 }, 1, 0);
  assert.deepEqual([down.x, down.y, down.z], [8, 10, 0]);
});
