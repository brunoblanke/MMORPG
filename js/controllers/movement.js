// js/controllers/movement.js

import { calculateMoveDelay, distance, directionFromDelta, getAdjacentPositions, isPositionAdjacentTo } from '../utils/helpers.js';
import { Pathfinding } from '../utils/pathfinding.js';
import { CONFIG } from '../config.js';
import { toUpperLevel, toLowerLevel } from '../../shared/stairs.js';

export class MovementController {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(world) {
    this.world = world;
    this.autoFollow = true;
    this.onNoPath = null;
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
    return this.world.isBlocked(x, y, floor, ignoreEnemy, !!this.enemiesPassable);
  }

  // ================================================================================================================================================================================================================================================
  // isBlockedForPathing

  isBlockedForPathing(x, y, floor) {
    return this.world.hasBlockerAt(x, y, floor);
  }

  // ================================================================================================================================================================================================================================================
  // hasStepToClimb

  hasStepToClimb(x, y, floor, targetStep, entityHeight = 1) {
    for (const pos of getAdjacentPositions(x, y)) {
      const adjacentStep = this.world.getPassableStep(pos.x, pos.y, floor, targetStep);
      if (adjacentStep !== null && adjacentStep >= targetStep - 1) {
        return true;
      }
    }
    return false;
  }

  // ================================================================================================================================================================================================================================================
  // canMove

  canMove(x, y, floor, fromStep, toX, toY, entityHeight = 1, targetStep = null) {
    if (!this.isInsideMap(toX, toY)) {
      return false;
    }
    if (this.isBlocked(toX, toY, floor)) {
      return false;
    }

    const calculatedStep = targetStep !== null ? targetStep : this.world.getPassableStep(toX, toY, floor, fromStep);
    if (calculatedStep === null) {
      return false;
    }

    const stepDiff = Math.abs(calculatedStep - fromStep);
    if (stepDiff === 0) return true;
    if (stepDiff > 1) return false;
    if (calculatedStep > fromStep && !this.hasStepToClimb(toX, toY, floor, calculatedStep, entityHeight)) {
      return false;
    }
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // applyStep
  // Efetiva um passo: atualiza o stack, a posição e o estado da animação de movimento.
  // toStep === null → recalcula o step passável no destino a partir do step atual.

  applyStep(entity, toX, toY, toZ, toStep, timestamp) {
    const fromX = entity.x;
    const fromY = entity.y;
    const fromZ = entity.z || 0;
    const fromStep = entity.step || 0;

    this.world.moveEntityTile(entity, fromX, fromY, fromZ, toX, toY, toZ);
    entity.x = toX;
    entity.y = toY;
    entity.z = toZ;
    entity.step = toStep !== null ? toStep : this.world.getPassableStep(toX, toY, toZ, fromStep);
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
  // tryFloorCarry

  // Passo entre andares por pilha de volumes. Em cima da pilha o player
  // aparece 1 sqm acima e 1 à esquerda — no sqm correspondente do andar de
  // cima (shared/stairs.js → toUpperLevel). Andando na direção (dx, dy):
  //   - sobre floorHeight-1 ou mais volumes: sobe pro piso do andar de cima a
  //     1 sqm, nessa direção, de onde ele aparece — ou a 2 sqm no eixo em que
  //     anda pra leste/sul (o prédio de baixo se estende 1 sqm a mais nesses
  //     lados; pra norte/oeste a pilha tem que estar encostada);
  //   - do andar de cima, indo pra um sqm sem piso: desce pra pilha de
  //     floorHeight-1+ volumes — o espelho da subida (os 2 sqm valem no eixo
  //     em que anda pra oeste/norte).
  // Devolve { x, y, z, step } ou null.

  tryFloorCarry(entity, toX, toY, entityHeight = 1) {
    return this.getFloorCarryTarget(entity.x, entity.y, entity.z || 0, entity.step || 0, toX, toY);
  }

  getFloorCarryTarget(fromX, fromY, floor, fromStep, toX, toY) {
    const floorHeight = CONFIG.floorHeight || 4;
    const dx = toX - fromX;
    const dy = toY - fromY;

    if (fromStep >= floorHeight - 1) {
      const near = toUpperLevel(toX, toY, floor);
      const candidates = [near, { x: near.x + Math.max(dx, 0), y: near.y + Math.max(dy, 0), z: near.z }];
      const up = candidates.find(c => this.world.hasFloorAt(c.x, c.y, c.z) && !this.isBlocked(c.x, c.y, c.z));
      if (up) return { x: up.x, y: up.y, z: up.z, step: 0 };
    }

    if (fromStep === 0 && floor > 0) {
      const stepHeightSameFloor = this.world.getStepHeight(toX, toY, floor);
      const hasFloorSameFloor = this.world.hasFloorAt(toX, toY, floor);
      if (stepHeightSameFloor === 0 && !hasFloorSameFloor) {
        const near = toLowerLevel(toX, toY, floor);
        const candidates = [near, { x: near.x + Math.min(dx, 0), y: near.y + Math.min(dy, 0), z: near.z }];
        const down = candidates.find(c =>
          this.world.getStepHeight(c.x, c.y, c.z) >= floorHeight - 1 && !this.isBlocked(c.x, c.y, c.z));
        if (down) return { x: down.x, y: down.y, z: down.z, step: this.world.getStepHeight(down.x, down.y, down.z) };
      }
    }

    return null;
  }

  // ================================================================================================================================================================================================================================================
  // moveEntity

  moveEntity(entity, dx, dy, timestamp, targetStep = null) {
    const moveDelay = calculateMoveDelay(entity.spd);
    const timeSinceLastMove = timestamp - entity.lastMoveTime;

    this.faceTowards(entity, dx, dy);

    if (timeSinceLastMove < moveDelay) return false;

    const newX = entity.x + dx;
    const newY = entity.y + dy;
    const entityHeight = entity.height || 1;
    const floor = entity.z || 0;
    const fromStep = entity.step || 0;

    let resultX = newX;
    let resultY = newY;
    let resultZ = null;
    let resultStep = null;

    if (targetStep !== null) {
      if (!this.canMove(entity.x, entity.y, floor, fromStep, newX, newY, entityHeight, targetStep)) {
        return false;
      }
      resultZ = floor;
      resultStep = targetStep;
    } else if (this.canMove(entity.x, entity.y, floor, fromStep, newX, newY, entityHeight)) {
      resultZ = floor;
      resultStep = this.world.getPassableStep(newX, newY, floor, fromStep);
    } else {
      // Troca de andar: o sqm de destino é o correspondente no andar vizinho.
      const carry = this.tryFloorCarry(entity, newX, newY, entityHeight);
      if (!carry) return false;
      resultX = carry.x;
      resultY = carry.y;
      resultZ = carry.z;
      resultStep = carry.step;
    }

    this.applyStep(entity, resultX, resultY, resultZ, resultStep, timestamp);
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // simulateMove
  // Onde um passo (dx, dy) a partir de state = { x, y, z, step } termina, pelas
  // mesmas regras de moveEntity (mesmo andar primeiro, senão troca por pilha) e
  // de checkFloorTransitions (escada/buraco). Devolve { x, y, z, step } ou null;
  // depois de escada/buraco, `via` é o sqm pisado antes do teleporte.

  simulateMove(state, dx, dy) {
    const toX = state.x + dx;
    const toY = state.y + dy;

    let result;
    if (this.canMove(state.x, state.y, state.z, state.step, toX, toY)) {
      result = { x: toX, y: toY, z: state.z, step: this.world.getPassableStep(toX, toY, state.z, state.step) };
    } else {
      result = this.getFloorCarryTarget(state.x, state.y, state.z, state.step, toX, toY);
      if (!result) return null;
    }

    const transition = this.world.getTransitionAt(result.x, result.y, result.z);
    if (transition && transition.targetZ >= 0 &&
        this.world.hasFloorAt(transition.targetX, transition.targetY, transition.targetZ)) {
      return {
        x: transition.targetX, y: transition.targetY, z: transition.targetZ, step: 0,
        via: { x: result.x, y: result.y, z: result.z }
      };
    }
    return result;
  }

  // ================================================================================================================================================================================================================================================
  // findPathWithFallback
  // Tenta primeiro dentro de searchBounds; se não achar, tenta de novo sem limite.

  findPathWithFallback(entity, targetPos, targetStep, searchBounds) {
    const floor = entity.z || 0;
    const findPath = (bounds) => Pathfinding.findPath(
      entity.x,
      entity.y,
      targetPos.x,
      targetPos.y,
      (nx, ny) => this.isBlockedForPathing(nx, ny, floor),
      entity.step || 0,
      targetStep,
      this,
      bounds,
      floor
    );

    let path = findPath(searchBounds);
    if (path.length === 0 && searchBounds) {
      path = findPath(null);
    }
    return path;
  }

  // ================================================================================================================================================================================================================================================
  // ensureChasePath
  // Recalcula entity.chasePath se o alvo mudou. Retorna false se não há caminho possível.

  ensureChasePath(entity, targetPos, searchBounds) {
    const needsNewPath = !entity.chasePath ||
      entity.chasePath.length === 0 ||
      entity.chasePathTargetX !== targetPos.x ||
      entity.chasePathTargetY !== targetPos.y;

    if (!needsNewPath) return true;

    const floor = entity.z || 0;
    const targetStep = this.getPassableStep(targetPos.x, targetPos.y, floor, entity.step || 0);
    if (targetStep === null) {
      entity.chasePath = null;
      return false;
    }

    const newPath = this.findPathWithFallback(entity, targetPos, targetStep, searchBounds);
    if (newPath.length === 0) {
      entity.chasePath = null;
      return false;
    }

    entity.chasePath = newPath;
    entity.chasePathTargetX = targetPos.x;
    entity.chasePathTargetY = targetPos.y;
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // followChasePath
  // Dá o próximo passo de entity.chasePath. isNextBlocked(nextStep) permite ao chamador esperar sem descartar o caminho.

  followChasePath(entity, timestamp, isNextBlocked) {
    if (!entity.chasePath || entity.chasePath.length === 0) {
      return;
    }

    const moveDelay = calculateMoveDelay(entity.spd);
    if (timestamp - entity.lastMoveTime < moveDelay) return;

    const nextStep = entity.chasePath[0];
    const floor = entity.z || 0;
    const entityHeight = entity.height || 1;

    if (isNextBlocked(nextStep)) {
      return;
    }

    if (!this.canMove(entity.x, entity.y, floor, entity.step || 0, nextStep.x, nextStep.y, entityHeight, nextStep.step)) {
      entity.chasePath = null;
      return;
    }

    this.faceTowards(entity, nextStep.x - entity.x, nextStep.y - entity.y);
    this.applyStep(entity, nextStep.x, nextStep.y, floor, nextStep.step, timestamp);

    entity.chasePath.shift();
  }

  // ================================================================================================================================================================================================================================================
  // moveTowardsPosition

  moveTowardsPosition(entity, targetX, targetY, timestamp, targetEntity = null, searchBounds = null, enemies = []) {
    const isAdjacent = isPositionAdjacentTo(entity.x, entity.y, targetX, targetY);
    if (isAdjacent) {
      entity.chasePath = null;
      return;
    }

    const targetPos = targetEntity
      ? (this.findBestSurroundPosition(entity, targetX, targetY, enemies) || { x: targetX, y: targetY })
      : { x: targetX, y: targetY };

    if (!this.ensureChasePath(entity, targetPos, searchBounds)) {
      if (this.onNoPath) this.onNoPath(timestamp);
      return;
    }

    const floor = entity.z || 0;
    this.followChasePath(entity, timestamp, (nextStep) => this.isBlocked(nextStep.x, nextStep.y, floor, targetEntity));
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
      entity.chasePath = null;

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
