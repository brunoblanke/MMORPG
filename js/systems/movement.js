// js/systems/movement.js

import { calculateMoveDelay, distance, directionFromDelta, getAdjacentPositions, isPositionAdjacentTo } from '../utils/helpers.js';
import { resolveStep, isSameLanding } from '../core/movement.js';
import { findPath, hasHarmfulField } from '../core/pathfinding.js';
import { isValidFloor } from '../../shared/constants.js';
import { blocksThrow, objectIdType } from '../../shared/assets.js';

// Sem caminho até o alvo: só procura de novo depois deste tempo (ms).
const NO_PATH_RETRY_MS = 500;

// Perseguição: a busca de caminho fica na área de busca e desiste depois de
// tantos sqms (um caminho de perseguição maior que isso não vale a pena e,
// sem caminho, a busca sem limite travava o servidor).
const CHASE_MAX_NODES = 1000;

// Quanto vale a mais pisar num campo que fere, pro inimigo (em sqms andados):
// contorna se o desvio for menor que isso.
const FIELD_STEP_COST = 30;

export class MovementController {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(world) {
    this.world = world;
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
  // A regra de passo (core/movement.js) sobre este mundo. Quem tem
  // avoidsSafeZones (inimigos) não pisa em zona segura; player não entra em
  // casa de outro dono.

  resolveStep(from, dx, dy, options = {}) {
    return resolveStep(this.world, from, dx, dy, { enemiesPassable: this.enemiesPassable, avoidSafe: !!from.avoidsSafeZones, groundOnly: !!from.groundOnly, entering: from.isPlayer ? from : null, ...options });
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
  // Caminho de start até end = { x, y, z } (core/pathfinding.js). Inimigo
  // contorna campo que fere; se não achar caminho assim (sem passagem ou
  // longe demais), o caminho atravessa o campo.

  findPath(start, end, options = {}) {
    const base = { enemiesPassable: this.enemiesPassable, avoidSafe: !!start.avoidsSafeZones, groundOnly: !!start.groundOnly, entering: start.isPlayer ? start : null, ...options };
    if (start.isPlayer) return findPath(this.world, start, end, base);
    const avoiding = findPath(this.world, start, end, { ...base, fieldCost: FIELD_STEP_COST });
    return avoiding.length ? avoiding : findPath(this.world, start, end, base);
  }

  // ================================================================================================================================================================================================================================================
  // findPathWithFallback
  // Caminho no mesmo andar; tenta primeiro dentro de searchBounds e, se não
  // achar, sem limite. chase: só dentro de searchBounds e no máximo
  // CHASE_MAX_NODES sqms (perseguição).

  findPathWithFallback(entity, targetPos, searchBounds, { chase = false } = {}) {
    const end = { x: targetPos.x, y: targetPos.y, z: entity.z || 0 };
    if (chase) return this.findPath(entity, end, { sameFloor: true, bounds: searchBounds, maxNodes: CHASE_MAX_NODES });
    let path = this.findPath(entity, end, { sameFloor: true, bounds: searchBounds });
    if (path.length === 0 && searchBounds) {
      path = this.findPath(entity, end, { sameFloor: true });
    }
    return path;
  }

  // ================================================================================================================================================================================================================================================
  // applyStep
  // Efetiva um passo: atualiza a pilha, a posição e o estado da animação de
  // movimento. A animação parte de onde a criatura está desenhada e dura
  // `duration` (o tempo até o próximo passo), pra um passo emendar no outro.

  applyStep(entity, landing, timestamp, duration = entity.getStepInterval()) {
    const fromX = entity.x;
    const fromY = entity.y;
    const fromZ = entity.z || 0;
    const fromStep = entity.step || 0;
    const midStep = entity.isMoving && Math.abs(entity.renderX - fromX) <= 1 && Math.abs(entity.renderY - fromY) <= 1;

    this.world.moveEntityTile(entity, fromX, fromY, fromZ, landing.x, landing.y, landing.z);
    entity.x = landing.x;
    entity.y = landing.y;
    entity.z = landing.z;
    entity.step = landing.step;
    entity.lastMoveTime = timestamp;

    entity.isMoving = true;
    entity.moveDirection = directionFromDelta(entity.x - fromX, entity.y - fromY);
    entity.moveStartX = midStep ? entity.renderX : fromX;
    entity.moveStartY = midStep ? entity.renderY : fromY;
    entity.moveStartZ = midStep ? entity.renderZ : fromZ;
    entity.moveStartStep = midStep ? entity.renderStep : fromStep;
    entity.moveStartTime = midStep && entity.renderTime !== null ? Math.min(entity.renderTime, timestamp) : timestamp;
    entity.stepDuration = duration;
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
  // blockedByField
  // O passo entra num campo que fere e há outro caminho até o destino da rota
  // (entity.route) sem passar por campo? Então não pisa: o caminho é refeito
  // (um campo novo no meio do caminho). Sem outro caminho, atravessa.

  blockedByField(entity, landing) {
    if (entity.isPlayer || !entity.route || entity.route.x === null || entity.route.x === undefined) return false;
    const floor = entity.z || 0;
    const z = landing.z ?? floor;
    if (!hasHarmfulField(this.world, landing.x, landing.y, z) || hasHarmfulField(this.world, entity.x, entity.y, floor)) return false;
    const around = this.findPath(entity, { x: entity.route.x, y: entity.route.y, z: floor }, { sameFloor: true });
    if (around.length === 0 || around.some(step => hasHarmfulField(this.world, step.x, step.y, step.z ?? floor))) return false;
    entity.route.path = null;
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // stepAlongPath
  // Dá o passo nextStep de um caminho no mesmo andar, se ele ainda termina
  // onde o caminho previa. Devolve false (sem andar) se o mapa mudou.

  stepAlongPath(entity, nextStep, timestamp, duration) {
    const landing = this.resolveStep(entity, nextStep.dx, nextStep.dy, { sameFloor: true });
    if (!isSameLanding(landing, nextStep) || this.blockedByField(entity, landing)) return false;

    this.faceTowards(entity, nextStep.dx, nextStep.dy);
    this.applyStep(entity, landing, timestamp, duration);
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // ensureRoute
  // entity.route = { path, x, y }: caminho no mesmo andar até (x, y).
  // Recalcula se o alvo mudou ou o caminho acabou. false se não há caminho
  // possível. options.chase: busca curta de perseguição (findPathWithFallback).

  ensureRoute(entity, targetPos, searchBounds, options = {}) {
    const route = entity.route;
    const needsNewPath = !route.path || route.path.length === 0 || route.x !== targetPos.x || route.y !== targetPos.y;
    if (!needsNewPath) return true;

    if (this.getPassableStep(targetPos.x, targetPos.y, entity.z || 0, entity.step || 0) === null) {
      route.path = null;
      return false;
    }

    const newPath = this.findPathWithFallback(entity, targetPos, searchBounds, options);
    if (newPath.length === 0) {
      route.path = null;
      return false;
    }

    entity.route = { path: newPath, x: targetPos.x, y: targetPos.y };
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // routeToAny
  // Perseguição: uma busca só até o mais perto (pelo caminho) dos sqms goals.
  // Achou, entity.route vai até ele e devolve o sqm; senão, null.

  routeToAny(entity, goals, searchBounds) {
    const floor = entity.z || 0;
    const reachable = goals.filter(goal => this.getPassableStep(goal.x, goal.y, floor, entity.step || 0) !== null);
    if (!reachable.length) return null;
    const path = this.findPath(entity, { x: reachable[0].x, y: reachable[0].y, z: floor }, { sameFloor: true, bounds: searchBounds, maxNodes: CHASE_MAX_NODES, goals: reachable });
    if (!path.length) return null;
    const last = path[path.length - 1];
    entity.route = { path, x: last.x, y: last.y };
    return { x: last.x, y: last.y };
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
  // hasLineOfSight
  // Linha reta livre de parede entre from e to, no andar de from (a mesma
  // regra do arremesso: janela e porta aberta deixam passar; não passa pela
  // quina entre duas paredes). Usado pelo ataque de longe do mago.

  hasLineOfSight(from, to) {
    const z = from.z || 0;
    const isWall = (x, y) => this.world.getObjectsAt(x, y).some(o => (o.z || 0) === z && o.blocksMovement && blocksThrow(objectIdType(o.id)));
    let x = from.x;
    let y = from.y;
    const dx = Math.abs(to.x - x);
    const dy = Math.abs(to.y - y);
    const sx = to.x > x ? 1 : -1;
    const sy = to.y > y ? 1 : -1;
    let err = dx - dy;
    while (x !== to.x || y !== to.y) {
      const e2 = 2 * err;
      let nx = x;
      let ny = y;
      if (e2 > -dy) { err -= dy; nx += sx; }
      if (e2 < dx) { err += dx; ny += sy; }
      if (nx !== x && ny !== y && isWall(nx, y) && isWall(x, ny)) return false;
      if (isWall(nx, ny)) return false;
      x = nx;
      y = ny;
    }
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // moveTowardsPosition
  // Um passo rumo a (targetX, targetY). Com uma criatura lá (targetEntity),
  // vai pro lado livre dela mais perto que tenha caminho (um lado preso atrás
  // de parede ou quina não conta); segue o lado escolhido enquanto ele
  // continuar livre. Sem lado livre, vai rumo à própria criatura. Devolve
  // false se não há caminho (e só procura de novo depois de NO_PATH_RETRY_MS).

  moveTowardsPosition(entity, targetX, targetY, timestamp, targetEntity = null, searchBounds = null, enemies = []) {
    const isAdjacent = isPositionAdjacentTo(entity.x, entity.y, targetX, targetY);
    if (isAdjacent) {
      entity.route.path = null;
      return true;
    }

    const around = targetEntity ? this.surroundPositions(entity, targetX, targetY, enemies) : [];
    const options = around.length ? around : [{ x: targetX, y: targetY }];
    const route = entity.route;
    const current = route.path && route.path.length ? options.find(pos => pos.x === route.x && pos.y === route.y) : null;
    const key = `${targetX},${targetY}`;
    const recentlyFailed = route.failedKey === key && timestamp - route.failedAt < NO_PATH_RETRY_MS;
    const reached = current
      ? this.ensureRoute(entity, current, searchBounds, { chase: !!targetEntity })
      : !recentlyFailed && (targetEntity ? !!this.routeToAny(entity, options, searchBounds) : this.ensureRoute(entity, options[0], searchBounds));
    if (!reached) {
      if (!recentlyFailed) Object.assign(entity.route, { failedKey: key, failedAt: timestamp });
      if (this.onNoPath) this.onNoPath(entity, timestamp);
      return false;
    }

    const floor = entity.z || 0;
    this.followRoute(entity, timestamp, (nextStep) => this.isBlocked(nextStep.x, nextStep.y, floor, targetEntity));
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // surroundPositions
  // Os sqms livres em volta de (x, y), do mais perto da entidade pro mais
  // longe (sem ninguém de enemies neles, sem escada nem buraco: perseguindo,
  // ninguém troca de andar sem querer).

  surroundPositions(entity, x, y, enemies) {
    const floor = entity.z || 0;
    return getAdjacentPositions(x, y)
      .filter(pos => this.isInsideMap(pos.x, pos.y) && !this.isBlocked(pos.x, pos.y, floor) && !this.world.getTransitionAt(pos.x, pos.y, floor))
      .filter(pos => !enemies.some(e => e !== entity && e.x === pos.x && e.y === pos.y))
      .sort((a, b) => distance(entity.x, entity.y, a.x, a.y) - distance(entity.x, entity.y, b.x, b.y));
  }

  // ================================================================================================================================================================================================================================================
  // checkFloorTransitions
  // Escada ('up'), topo de escada e buraco ('down'): teleporta a entidade pro
  // alvo (targetX, targetY, targetZ) — regras em shared/stairs.js.

  checkFloorTransitions(entities) {
    for (const entity of entities) {
      const floor = entity.z || 0;
      const transitionObj = this.world.getTransitionAt(entity.x, entity.y, floor);

      if (!transitionObj || transitionObj.manualStairs) continue;
      this.useTransition(entity, transitionObj);
    }
  }

  // ================================================================================================================================================================================================================================================
  // useTransition
  // Leva a entidade pro alvo da escada/buraco, se ele tiver piso. Devolve true
  // se ela trocou de andar.

  useTransition(entity, transitionObj) {
    const floor = entity.z || 0;
    const targetFloor = transitionObj.targetZ;
    if (!isValidFloor(targetFloor)) return false;

    if (!this.world.hasFloorAt(transitionObj.targetX, transitionObj.targetY, targetFloor)) {
      console.log(`💀 ${transitionObj.id} está morta: não há piso em (${transitionObj.targetX},${transitionObj.targetY}) andar ${targetFloor}`);
      return false;
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
    return true;
  }
}
