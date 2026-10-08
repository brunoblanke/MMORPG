// js/utils/helpers.js

import { TICK_MS } from '../../shared/constants.js';
import { vocationStats } from '../../shared/vocations.js';

// ================================================================================================================================================================================================================================================
// directionFromDelta

export function directionFromDelta(dx, dy) {
  if (dx === 0 && dy === 0) return null;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx >= absDy) {
    return dx > 0 ? 'leste' : 'oeste';
  } else {
    return dy > 0 ? 'sul' : 'norte';
  }
}

// ================================================================================================================================================================================================================================================
// rand

export function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ================================================================================================================================================================================================================================================
// randFloat

export function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

// ================================================================================================================================================================================================================================================
// randEnemyColor

export function randEnemyColor() {
  const colors = [
    '#FF4444', '#FF8844', '#44FF44', '#FF44FF',
    '#44FFFF', '#FF44AA', '#AA44FF', '#FFAA44'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ================================================================================================================================================================================================================================================
// calculateStats
// Atributos de criatura pelo nível do mapa, pra criatura sem números próprios
// no gerador (creatureStats). A velocidade já vem na escala do Tibia.

export function calculateStats(level) {
  return {
    hp: 50 + level * 10,
    atk: 5 + level * 2,
    def: 2 + level,
    spd: Math.round(STEP_FACTOR / Math.max(50, 150 - level * 3)),
    xp: 20 + level * 5
  };
}

// ================================================================================================================================================================================================================================================
// playerStats
// Progressão do Tibia: vida, mana e cap pela vocação (shared/vocations.js) e
// 220 de velocidade (110 do Tibia, dobrada) no nível 1, +4 por nível (+2 no Tibia). Ataque e defesa vêm da arma, do
// escudo, da armadura e dos skills (js/systems/combat.js), não do nível.

export function playerStats(level, vocation = 'none') {
  return { ...vocationStats(level, vocation), spd: 220 + Math.max(0, level - 1) * 4 };
}

// ================================================================================================================================================================================================================================================
// roundUpToTick
// O passo só acontece num tick: um intervalo de 125 ms na prática vira 150 ms.

export function roundUpToTick(ms) {
  return Math.ceil(ms / TICK_MS) * TICK_MS;
}

// ================================================================================================================================================================================================================================================
// calculateMoveDelay
// Tempo entre passos pela velocidade, como no Tibia atual: a velocidade do jogo é o dobro da
// do Tibia (player nível 1 = 220, rat = 134), vira a velocidade de passo pela fórmula do
// servidor (857,36 · ln(speed + 261,29) − 4795,01) e o passo dura 1000 · 150 (chão de grama) /
// essa velocidade em ms (player nível 1: 539 ms; troll: 925 ms; rat: 872 ms).

export const STEP_FACTOR = 32000;
export const GROUND_SPEED = 150;
const MAX_STEP_MS = 3000;

export function calculateMoveDelay(spd) {
  const real = Math.max(1, spd) / 2;
  const stepSpeed = Math.max(1, Math.floor(857.36 * Math.log(real + 261.29) - 4795.01 + 0.5));
  return Math.min(MAX_STEP_MS, Math.max(50, Math.floor(1000 * GROUND_SPEED / stepSpeed)));
}

// ================================================================================================================================================================================================================================================
// distance

export function distance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// ================================================================================================================================================================================================================================================
// isInRadius

export function isInRadius(x1, y1, x2, y2, radius) {
  return distance(x1, y1, x2, y2) <= radius;
}

// ================================================================================================================================================================================================================================================
// getAdjacentPositions

export function getAdjacentPositions(x, y) {
  return [
    { x: x - 1, y: y },
    { x: x + 1, y: y },
    { x: x, y: y - 1 },
    { x: x, y: y + 1 },
    { x: x - 1, y: y - 1 },
    { x: x + 1, y: y + 1 },
    { x: x + 1, y: y - 1 },
    { x: x - 1, y: y + 1 }
  ];
}

// ================================================================================================================================================================================================================================================
// isPositionAdjacentTo

export function isPositionAdjacentTo(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) <= 1 && Math.abs(y1 - y2) <= 1 && !(x1 === x2 && y1 === y2);
}

// ================================================================================================================================================================================================================================================
// shadeColor

export function shadeColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}
