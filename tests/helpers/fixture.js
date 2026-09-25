// tests/helpers/fixture.js

import { Simulation } from '../../js/simulation.js';

// Tipos de teste, nas pastas que dão a regra (shared/assets.js).
export const FLOOR = 'estrutura/pisos/teste';
export const FLOOR2 = 'estrutura/pisos/teste-2';
export const HOLE = 'estrutura/entradas/teste';
export const STAIRS = 'estrutura/escadas/teste';
export const CREATURE = 'criaturas/mamiferos/teste';

// ================================================================================================================================================================================================================================================
// floorRect

export function floorRect(minX, maxX, minY, maxY, z = 0) {
  const tiles = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      tiles.push([FLOOR, x, y, z, 0, 0, 0, 0]);
    }
  }
  return tiles;
}

// ================================================================================================================================================================================================================================================
// wall

export function wall(x, y, z = 0) {
  return [['Wall-X', x, y, z, 0, 0, 0, 1]];
}

// ================================================================================================================================================================================================================================================
// pile

export function pile(x, y, height, z = 0) {
  const boxes = [];
  for (let step = 0; step < height; step++) {
    boxes.push(['Parcel', x, y, z, step, 1, 1, 0]);
  }
  return boxes;
}

// ================================================================================================================================================================================================================================================
// hole

export function hole(x, y, z) {
  return [[HOLE, x, y, z, 1, 0, 0, 0]];
}

// ================================================================================================================================================================================================================================================
// buildMapData

export function buildMapData({ objects = [], stairs = [], enemies = [], safe = [], spawn = { x: 1, y: 1, z: 0 } }) {
  return {
    objetosData: objects,
    transicoesData: stairs.map(([x, y, z]) => [STAIRS, x, y, z]),
    enemyData: enemies.map(([x, y, z, lvl = 5]) => [x, y, z, lvl, 32, CREATURE]),
    safeZoneData: safe,
    spawn
  };
}

// ================================================================================================================================================================================================================================================
// safeRect

export function safeRect(minX, maxX, minY, maxY, z = 0) {
  const tiles = [];
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) tiles.push([x, y, z]);
  }
  return tiles;
}

// ================================================================================================================================================================================================================================================
// buildGame
// Simulação com um jogador em `player`. `player` e `movementController`
// ficam à mão no objeto devolvido.

export function buildGame({ objects = [], stairs = [], enemies = [], safe = [], player = { x: 1, y: 1, z: 0 } }) {
  const sim = new Simulation(buildMapData({ objects, stairs, enemies, safe, spawn: player }));
  sim.player = sim.addPlayer('player1');
  sim.movementController = sim.movement;
  return sim;
}

// ================================================================================================================================================================================================================================================
// placeAt
// Põe a criatura direto no sqm (x, y, z) sobre `step` volumes, sem animação.

export function placeAt(game, entity, x, y, z, step = 0) {
  game.world.moveEntityTile(entity, entity.x, entity.y, entity.z || 0, x, y, z);
  entity.x = x;
  entity.y = y;
  entity.z = z;
  entity.step = step;
  entity.lastMoveTime = -Infinity;
}
