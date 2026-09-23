// js/core/movement.js

import { CONFIG } from '../config.js';
import { toUpperLevel, toLowerLevel } from '../../shared/stairs.js';
import { FLOOR_MIN, isValidFloor } from '../../shared/constants.js';

export const DIRECTIONS = [
  { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
  { dx: -1, dy: -1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
];

// ================================================================================================================================================================================================================================================
// hasStepToClimb
// Subir 1 volume exige um vizinho do destino com no máximo 1 volume a menos.

function hasStepToClimb(world, x, y, z, targetStep) {
  for (const { dx, dy } of DIRECTIONS) {
    const adjacentStep = world.getPassableStep(x + dx, y + dy, z, targetStep);
    if (adjacentStep !== null && adjacentStep >= targetStep - 1) return true;
  }
  return false;
}

// ================================================================================================================================================================================================================================================
// stepOnSameFloor
// Passo no mesmo andar: o destino precisa estar no mapa, livre, ter piso ou
// volume, e a diferença de altura ser de no máximo 1 volume. Devolve o step
// em que a criatura fica, ou null.

function stepOnSameFloor(world, from, toX, toY, enemiesPassable) {
  if (!world.isInside(toX, toY)) return null;
  if (world.isBlocked(toX, toY, from.z, null, enemiesPassable)) return null;

  const step = world.getPassableStep(toX, toY, from.z, from.step);
  if (step === null) return null;

  const stepDiff = Math.abs(step - from.step);
  if (stepDiff > 1) return null;
  if (step > from.step && !hasStepToClimb(world, toX, toY, from.z, step)) return null;
  return step;
}

// ================================================================================================================================================================================================================================================
// stepAcrossFloors
// Passo entre andares por pilha de volumes. Em cima da pilha a criatura
// aparece 1 sqm acima e 1 à esquerda — no sqm correspondente do andar de
// cima (shared/stairs.js → toUpperLevel). Andando na direção (dx, dy):
//   - sobre floorHeight-1 ou mais volumes: sobe pro piso do andar de cima a
//     1 sqm, nessa direção, de onde ela aparece — ou a 2 sqm no eixo em que
//     anda pra leste/sul (o prédio de baixo se estende 1 sqm a mais nesses
//     lados; pra norte/oeste a pilha tem que estar encostada);
//   - do andar de cima, indo pra um sqm sem piso: desce pra pilha de
//     floorHeight-1+ volumes — o espelho da subida (os 2 sqm valem no eixo
//     em que anda pra oeste/norte).

function stepAcrossFloors(world, from, dx, dy, enemiesPassable) {
  const floorHeight = CONFIG.floorHeight || 4;
  const toX = from.x + dx;
  const toY = from.y + dy;
  const isFree = (c) => !world.isBlocked(c.x, c.y, c.z, null, enemiesPassable);

  if (from.step >= floorHeight - 1) {
    const near = toUpperLevel(toX, toY, from.z);
    const candidates = [near, { x: near.x + Math.max(dx, 0), y: near.y + Math.max(dy, 0), z: near.z }];
    const up = candidates.find(c => world.hasFloorAt(c.x, c.y, c.z) && isFree(c));
    if (up) return { x: up.x, y: up.y, z: up.z, step: 0 };
  }

  if (from.step === 0 && from.z > FLOOR_MIN && world.getStepHeight(toX, toY, from.z) === 0 && !world.hasFloorAt(toX, toY, from.z)) {
    const near = toLowerLevel(toX, toY, from.z);
    const candidates = [near, { x: near.x + Math.min(dx, 0), y: near.y + Math.min(dy, 0), z: near.z }];
    const down = candidates.find(c => world.getStepHeight(c.x, c.y, c.z) >= floorHeight - 1 && isFree(c));
    if (down) return { x: down.x, y: down.y, z: down.z, step: world.getStepHeight(down.x, down.y, down.z) };
  }

  return null;
}

// ================================================================================================================================================================================================================================================
// getTransitionTarget
// Escada, topo de escada ou buraco no sqm: pra onde leva. Transição que
// aponta pra sqm sem piso está "morta" e não leva a lugar nenhum (null).

export function getTransitionTarget(world, x, y, z) {
  const transition = world.getTransitionAt(x, y, z);
  if (!transition || !isValidFloor(transition.targetZ)) return null;
  if (!world.hasFloorAt(transition.targetX, transition.targetY, transition.targetZ)) return null;
  return { x: transition.targetX, y: transition.targetY, z: transition.targetZ, step: 0, transition };
}

// ================================================================================================================================================================================================================================================
// resolveStep
// A regra de passo, usada por player, inimigos e busca de caminho. Onde um
// passo (dx, dy) a partir de from = { x, y, z, step } termina: mesmo andar
// primeiro; senão, troca de andar pela pilha. Devolve { x, y, z, step } ou null.
// Opções:
//   - sameFloor: só passos no mesmo andar (inimigos não trocam de andar);
//   - transitions: aplica escada/buraco do sqm de chegada — o resultado leva
//     `via`, o sqm pisado antes do teleporte;
//   - enemiesPassable: inimigos não bloqueiam (o player continua bloqueando);
//   - avoidSafe: não pisa em zona segura (inimigos).

export function resolveStep(world, from, dx, dy, options = {}) {
  const landing = resolveLanding(world, from, dx, dy, options);
  if (!landing || !options.avoidSafe) return landing;
  const entered = landing.via || landing;
  if (world.isSafe(entered.x, entered.y, entered.z) || world.isSafe(landing.x, landing.y, landing.z)) return null;
  return landing;
}

// ================================================================================================================================================================================================================================================
// resolveLanding

function resolveLanding(world, from, dx, dy, options) {
  const { sameFloor = false, transitions = false, enemiesPassable = false } = options;
  const origin = { x: from.x, y: from.y, z: from.z || 0, step: from.step || 0 };
  const toX = origin.x + dx;
  const toY = origin.y + dy;

  let landing = null;
  const step = stepOnSameFloor(world, origin, toX, toY, enemiesPassable);
  if (step !== null) {
    landing = { x: toX, y: toY, z: origin.z, step };
  } else if (!sameFloor) {
    landing = stepAcrossFloors(world, origin, dx, dy, enemiesPassable);
  }
  if (!landing || !transitions) return landing;

  const target = getTransitionTarget(world, landing.x, landing.y, landing.z);
  if (!target) return landing;
  return { x: target.x, y: target.y, z: target.z, step: 0, via: { x: landing.x, y: landing.y, z: landing.z } };
}

// ================================================================================================================================================================================================================================================
// isSameLanding

export function isSameLanding(a, b) {
  return !!a && !!b && a.x === b.x && a.y === b.y && a.z === b.z && a.step === b.step;
}
