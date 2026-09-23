// js/systems/movement.js

import { calculateMoveDelay, distance, directionFromDelta, getAdjacentPositions, isPositionAdjacentTo } from '../utils/helpers.js';
import { resolveStep, isSameLanding } from '../core/movement.js';
import { findPath } from '../core/pathfinding.js';

export class MovementController {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(world) {
    this.world = world;
    this.autoFollow = true;
    this.onNoPath = null;
    this.enemiesPassable = false;
  }

  // ================================================================================================================================================================================================================================================
  // withEnemiesPassable
  // Roda fn() tratando os inimigos como passáveis (o player continua
  // bloqueando). Serve pra saber se existe rota: um inimigo no caminho uma hora
  // sai do lugar; uma parede, não.

  withEnemiesPassable(fn) {
    const previous = this.enemiesPassable;
    this.enemiesPassable = true;
    try {
      return fn();
    } finally {
      this.enemiesPassable = previous;
    }
  }

  // ================================================================================================================================================================================================================================================
  // isInsideMap

  isInsideMap(x, y) {
    return this.world.isInside(x, y);
  }

  // ================================================================================================================================================================================================================================================
  // getPassableStep

  getPassableStep(x, y, floor, currentStep = null) {
    return this.world.getPassableStep(x, y, floor, currentStep);
  }

  // ================================================================================================================================================================================================================================================
  // getStepHeight

  getStepHeight(x, y, floor) {
    return this.world.getStepHeight(x, y, floor);
  }

  // ================================================================================================================================================================================================================================================
  // isBlocked

  isBlocked(x, y, floor, ignoreEnemy = null) {
    return this.world.isBlocked(x, y, floor, ignoreEnemy, this.enemiesPassable);
  }

  // ================================================================================================================================================================================================================================================
  // resolveStep
  // A regra de passo (core/movement.js) sobre este mundo.

  resolveStep(from, dx, dy, options = {}) {
    return resolveStep(this.world, from, dx, dy, { enemiesPassable: this.enemiesPassable, ...options });
  }

  // ================================================================================================================================================================================================================================================
  // simulateMove
  // Onde um passo (dx, dy) a partir de state = { x, y, z, step } termina,
  // já aplicando escada/buraco. Devolve { x, y, z, step, via? } ou null.

  simulateMove(state, dx, dy) {
    return this.resolveStep(state, dx, dy, { transitions: true });
  }

  // ================================================================================================================================================================================================================================================
  // findPath
  // Caminho de start até end = { x, y, z } (core/pathfinding.js).

  findPath(start, end, options = {}) {
    return findPath(this.world, start, end, { enemiesPassable: this.enemiesPassable, ...options });
  }

  // ================================================================================================================================================================================================================================================
  // findPathWithFallback
  // Caminho no mesmo andar; tenta primeiro dentro de searchBounds e, se não
  // achar, sem limite.

  findPathWithFallback(entity, targetPos, searchBounds) {
    const end = { x: targetPos.x, y: targetPos.y, z: entity.z || 0 };
    let path = this.findPath(entity, end, { sameFloor: true, bounds: searchBounds });
    if (path.length === 0 && searchBounds) {
      path = this.findPath(entity, end, { sameFloor: true });
    }
    return path;
  }

  // ================================================================================================================================================================================================================================================
  // applyStep
  // Efetiva um passo: atualiza a pilha, a posição e o estado da animação de movimento.

  applyStep(entity, landing, timestamp) {
    const fromX = entity.x;
    const fromY = entity.y;
    const fromZ = entity.z || 0;
    const fromStep = entity.step || 0;

    this.world.moveEntityTile(entity, fromX, fromY, fromZ, landing.x, landing.y, landing.z);
    entity.x = landing.x;
    entity.y = landing.y;
    entity.z = landing.z;
    entity.step = landing.step;
    entity.lastMoveTime = timestamp;

    entity.isMoving = true;
    entity.moveStartX = fromX;
    entity.moveStartY = fromY;
    entity.moveStartZ = fromZ;
    entity.moveStartStep = fromStep;
    entity.moveStartTime = timestamp;
  }

  // ================================================================================================================================================================================================================================================
  // faceTowards

  faceTowards(entity, dx, dy) {
    const newDirection = directionFromDelta(dx, dy);
    if (newDirection) {
      entity.direction = newDirection;
    }
  }

  // ================================================================================================================================================================================================================================================
  // moveEntity
  // Passo do player pelo teclado ou pelo caminho: mesmo andar ou troca pela
  // pilha. Escada/buraco ficam pra checkFloorTransitions.

  moveEntity(entity, dx, dy, timestamp) {
    const moveDelay = calculateMoveDelay(entity.spd);
    this.faceTowards(entity, dx, dy);
    if (timestamp - entity.lastMoveTime < moveDelay) return false;

    const landing = this.resolveStep(entity, dx, dy);
    if (!landing) return false;

    this.applyStep(entity, landing, timestamp);
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // stepAlongPath
  // Dá o passo nextStep de um caminho no mesmo andar, se ele ainda termina
  // onde o caminho previa. Devolve false (sem andar) se o mapa mudou.

  stepAlongPath(entity, nextStep, timestamp) {
    const landing = this.resolveStep(entity, nextStep.dx, nextStep.dy, { sameFloor: true });
    if (!isSameLanding(landing, nextStep)) return false;

    this.faceTowards(entity, nextStep.dx, nextStep.dy);
    this.applyStep(entity, landing, timestamp);
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // ensureRoute
  // entity.route = { path, x, y }: caminho no mesmo andar até (x, y).
  // Recalcula se o alvo mudou ou o caminho acabou. false se não há caminho possível.

  ensureRoute(entity, targetPos, searchBounds) {
    const route = entity.route;
    const needsNewPath = !route.path || route.path.length === 0 || route.x !== targetPos.x || route.y !== targetPos.y;
    if (!needsNewPath) return true;

    if (this.getPassableStep(targetPos.x, targetPos.y, entity.z || 0, entity.step || 0) === null) {
      route.path = null;
      return false;
    }

    const newPath = this.findPathWithFallback(entity, targetPos, searchBounds);
    if (newPath.length === 0) {
      route.path = null;
      return false;
    }

    entity.route = { path: newPath, x: targetPos.x, y: targetPos.y };
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // followRoute
  // Dá o próximo passo de entity.route. isNextBlocked(nextStep) permite ao
  // chamador esperar sem descartar o caminho; se o passo não termina mais onde
  // o caminho previa, o caminho é descartado (recalculado no próximo quadro).

  followRoute(entity, timestamp, isNextBlocked) {
    const path = entity.route.path;
    if (!path || path.length === 0) return;

    const moveDelay = calculateMoveDelay(entity.spd);
    if (timestamp - entity.lastMoveTime < moveDelay) return;

    const nextStep = path[0];
    if (isNextBlocked(nextStep)) return;

    if (!this.stepAlongPath(entity, nextStep, timestamp)) {
      entity.route.path = null;
      return;
    }

    path.shift();
  }

  // ================================================================================================================================================================================================================================================
  // moveTowardsPosition

  moveTowardsPosition(entity, targetX, targetY, timestamp, targetEntity = null, searchBounds = null, enemies = []) {
    const isAdjacent = isPositionAdjacentTo(entity.x, entity.y, targetX, targetY);
    if (isAdjacent) {
      entity.route.path = null;
      return;
    }

    const targetPos = targetEntity
      ? (this.findBestSurroundPosition(entity, targetX, targetY, enemies) || { x: targetX, y: targetY })
      : { x: targetX, y: targetY };

    if (!this.ensureRoute(entity, targetPos, searchBounds)) {
      if (this.onNoPath) this.onNoPath(timestamp);
      return;
    }

    const floor = entity.z || 0;
    this.followRoute(entity, timestamp, (nextStep) => this.isBlocked(nextStep.x, nextStep.y, floor, targetEntity));
  }

  // ================================================================================================================================================================================================================================================
  // findBestSurroundPosition

  findBestSurroundPosition(enemy, playerX, playerY, enemies) {
    const freePositions = [];
    for (const pos of getAdjacentPositions(playerX, playerY)) {
      if (!this.isInsideMap(pos.x, pos.y)) continue;
      if (this.isBlocked(pos.x, pos.y, enemy.z || 0)) continue;
      const occupied = enemies.some(e => e !== enemy && e.x === pos.x && e.y === pos.y);
      if (occupied) continue;
      freePositions.push(pos);
    }
    if (freePositions.length === 0) return null;

    let bestPos = null;
    let minDist = Infinity;
    for (const pos of freePositions) {
      const dist = distance(enemy.x, enemy.y, pos.x, pos.y);
      if (dist < minDist) {
        minDist = dist;
        bestPos = pos;
      }
    }
    return bestPos;
  }

  // ================================================================================================================================================================================================================================================
  // checkFloorTransitions
  // Escada ('up'), topo de escada e buraco ('down'): teleporta a entidade pro
  // alvo (targetX, targetY, targetZ) — regras em shared/stairs.js.

  checkFloorTransitions(entities) {
    for (const entity of entities) {
      const floor = entity.z || 0;
      const transitionObj = this.world.getTransitionAt(entity.x, entity.y, floor);

      if (!transitionObj) continue;

      const targetFloor = transitionObj.targetZ;
      if (targetFloor < 0) continue;

      if (!this.world.hasFloorAt(transitionObj.targetX, transitionObj.targetY, targetFloor)) {
        console.log(`💀 ${transitionObj.id} está morta: não há piso em (${transitionObj.targetX},${transitionObj.targetY}) andar ${targetFloor}`);
        continue;
      }

      const fromX = entity.x;
      const fromY = entity.y;

      this.world.moveEntityTile(entity, fromX, fromY, floor, transitionObj.targetX, transitionObj.targetY, targetFloor);
      entity.x = transitionObj.targetX;
      entity.y = transitionObj.targetY;
      entity.z = targetFloor;
      entity.step = 0;
      entity.renderX = entity.x;
      entity.renderY = entity.y;
      entity.renderZ = entity.z;
      entity.isMoving = false;
      entity.route.path = null;

      const who = entity.isPlayer ? 'Player' : `Inimigo ${entity.id}`;
      const via = transitionObj.stairDirection === 'up' ? 'escada' : 'buraco';
      console.log(`🪜 ${who} usou ${via} (${transitionObj.id}): (${fromX},${fromY}) andar ${floor} → (${entity.x},${entity.y}) andar ${targetFloor}`);
    }
  }

  // ================================================================================================================================================================================================================================================
  // toggleAutoFollow

  toggleAutoFollow() {
    this.autoFollow = !this.autoFollow;
    console.log("🏃 Auto-follow: " + (this.autoFollow ? 'ATIVADO' : 'DESATIVADO'));
  }
}
