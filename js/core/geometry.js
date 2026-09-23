// js/core/geometry.js

import { CONFIG } from '../config.js';

// ================================================================================================================================================================================================================================================
// levelOf
// Andar de quem está no andar z sobre `step` volumes: sobe 1 andar a cada
// CONFIG.floorHeight volumes.

export function levelOf(z, step) {
  return Math.floor(z || 0) + Math.floor((step || 0) / (CONFIG.floorHeight || 4));
}

// ================================================================================================================================================================================================================================================
// isCreature

export function isCreature(entity) {
  return !entity.isCorpse && (entity.isPlayer === true || entity.type === 'enemy');
}

// ================================================================================================================================================================================================================================================
// getLevel
// Andar em que uma coisa está de fato, pela posição lógica. Itens e objetos
// ficam sempre no z em que foram colocados, por mais alta que seja a pilha;
// player e inimigos sobem 1 andar a cada CONFIG.floorHeight volumes sob eles.
// Decide alcance de combate e perseguição.

export function getLevel(entity) {
  if (!isCreature(entity)) return Math.floor(entity.z ?? 0);
  return levelOf(entity.z, entity.step);
}

// ================================================================================================================================================================================================================================================
// getEntityLevel
// Andar em que uma coisa é desenhada (e apontada pelo mouse). Igual a
// getLevel, mas no meio de um passo entre andares (pilha ↔ piso de cima) vale
// o maior entre o andar de onde saiu e o de onde vai chegar — senão, no meio
// do passo, a criatura sumiria sob o piso de cima por um instante.

export function getEntityLevel(entity) {
  const level = getLevel(entity);
  if (!isCreature(entity) || !entity.isMoving || entity.moveStartZ === undefined) return level;
  return Math.max(level, levelOf(entity.moveStartZ, entity.moveStartStep));
}
