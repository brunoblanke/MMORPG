// js/systems/object-drag.js

import { CONFIG } from '../config.js';
import { distance, getAdjacentPositions, isPositionAdjacentTo } from '../utils/helpers.js';
import { toUpperLevel } from '../../shared/stairs.js';
import { isValidFloor } from '../../shared/constants.js';

export class ObjectDragController {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
  }

  // ================================================================================================================================================================================================================================================
  // describeEntity

  describeEntity(entity) {
    if (entity.isPlayer && !entity.isCorpse) return `Player ${entity.id}`;
    if (entity.isCorpse) return 'Cadáver';
    return `Inimigo ${entity.id}`;
  }

  // ================================================================================================================================================================================================================================================
  // getEntitiesAt

  getEntitiesAt(x, y, floor) {
    const { players, enemies, deadBodies } = this.sim;
    return [...players, ...enemies, ...deadBodies].filter(entity =>
      entity.x === x && entity.y === y && entity.z === floor
    );
  }

  // ================================================================================================================================================================================================================================================
  // isPlayerNear
  // O player alcança o objeto: no mesmo sqm ou vizinho, no mesmo andar.

  isPlayerNear(player, obj) {
    if ((player.z || 0) !== (obj.z || 0)) return false;
    return (player.x === obj.x && player.y === obj.y) || isPositionAdjacentTo(player.x, player.y, obj.x, obj.y);
  }

  // ================================================================================================================================================================================================================================================
  // startDragMoveToObject
  // Leva o player até um vizinho do objeto (no andar do objeto, trocando de
  // andar se preciso) e, ao chegar, move o objeto pra (targetX, targetY, targetZ).

  startDragMoveToObject(player, obj, targetX, targetY, targetZ) {
    const { movement: movementController, control } = this.sim;
    const floor = obj.z || 0;
    const adjacents = getAdjacentPositions(obj.x, obj.y);

    let bestTile = null;
    let bestDist = Infinity;

    for (const pos of adjacents) {
      if (!movementController.isInsideMap(pos.x, pos.y)) continue;
      if (movementController.isBlocked(pos.x, pos.y, floor)) continue;
      if (movementController.getPassableStep(pos.x, pos.y, floor) === null) continue;

      const dist = distance(player.x, player.y, pos.x, pos.y) + Math.abs((player.z || 0) - floor);
      if (dist < bestDist) {
        bestDist = dist;
        bestTile = pos;
      }
    }

    if (!bestTile) {
      return;
    }

    player.pendingDrag = { entity: obj, targetX, targetY, targetZ };
    control.setWalkTarget(player, bestTile.x, bestTile.y, floor);
  }

  // ================================================================================================================================================================================================================================================
  // moveObject
  // Move o objeto pro sqm (targetX, targetY) do andar targetZ — pode ser outro
  // andar (o piso visível sob o mouse). Precisa de apoio lá: piso ou pilha.

  moveObject(player, obj, targetX, targetY, targetZ = obj.z || 0) {
    const { movement: movementController, world } = this.sim;

    if (!movementController.isInsideMap(targetX, targetY)) {
      return;
    }

    if (!this.isThrowPathClear(player, obj, targetX, targetY, targetZ)) {
      console.log(`🧱 Arremesso travado: algo intransponível entre o player e (${targetX}, ${targetY}) andar ${targetZ}`);
      return;
    }

    const fromFloor = obj.z || 0;
    const landing = this.resolveFall(targetX, targetY, targetZ);
    targetX = landing.x;
    targetY = landing.y;
    const floor = landing.z;
    if (this.hasOtherBlocker(obj, targetX, targetY, floor)) {
      return;
    }

    const hasSupport = world.hasFloorAt(targetX, targetY, floor) ||
      movementController.getStepHeight(targetX, targetY, floor) > 0;
    if (!hasSupport) {
      return;
    }

    const oldX = obj.x;
    const oldY = obj.y;
    const topStep = movementController.getStepHeight(targetX, targetY, floor);

    world.moveObject(obj, targetX, targetY, floor);
    obj.step = topStep;

    console.log(`📦 ${obj.isCorpse ? 'Cadáver' : 'Objeto ' + obj.id} movido para (${targetX}, ${targetY}) andar=${floor} step=${obj.step} order=${obj.order}`);

    const newTopStep = movementController.getStepHeight(targetX, targetY, floor);
    if (newTopStep > topStep) {
      this.liftSupportedEntities(targetX, targetY, floor, topStep, newTopStep);
    }
    this.dropUnsupportedEntities(oldX, oldY, fromFloor);
  }

  // ================================================================================================================================================================================================================================================
  // isThrowPathClear
  // O objeto vai em linha reta, sqm a sqm, de onde o player aparece até o
  // destino. Trava se algum sqm no caminho (ou o destino) tem algo
  // intransponível (parede etc.) — num passo diagonal, também trava se os dois
  // sqm laterais estão bloqueados (não passa pela quina entre paredes).
  // Em cima de pilha alta o player aparece no andar de cima (toUpperLevel).
  // Andares checados: arremesso pra cima passa por todos entre a origem e o
  // destino (esbarra na parede do prédio); pra baixo, só o de origem (o objeto
  // passa por cima das paredes de baixo).

  isThrowPathClear(player, obj, toX, toY, toZ) {
    const floorHeight = CONFIG.floorHeight || 4;

    let origin = { x: player.x, y: player.y, z: player.z || 0 };
    if ((player.step || 0) >= floorHeight - 1) origin = toUpperLevel(origin.x, origin.y, origin.z);

    const floors = [];
    for (let z = origin.z; z <= Math.max(origin.z, toZ); z++) floors.push(z);

    const isBlocked = (x, y) => floors.some(z => this.hasOtherBlocker(obj, x, y, z));

    // Bresenham: sqm a sqm, da origem (fora) até o destino (dentro).
    let x = origin.x;
    let y = origin.y;
    const dx = Math.abs(toX - x);
    const dy = Math.abs(toY - y);
    const sx = toX > x ? 1 : -1;
    const sy = toY > y ? 1 : -1;
    let err = dx - dy;

    while (x !== toX || y !== toY) {
      const e2 = 2 * err;
      let nx = x;
      let ny = y;
      if (e2 > -dy) { err -= dy; nx += sx; }
      if (e2 < dx) { err += dx; ny += sy; }

      if (nx !== x && ny !== y && isBlocked(nx, y) && isBlocked(x, ny)) return false;
      if (isBlocked(nx, ny)) return false;

      x = nx;
      y = ny;
    }
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // hasOtherBlocker
  // Há algo intransponível no sqm (x, y, z) além do próprio objeto arrastado?

  hasOtherBlocker(obj, x, y, z) {
    const own = obj.blocksMovement && obj.x === x && obj.y === y && (obj.z || 0) === z ? 1 : 0;
    return this.sim.world.countBlockersAt(x, y, z) > own;
  }

  // ================================================================================================================================================================================================================================================
  // resolveFall
  // Objeto solto num buraco (ou topo de escada) cai pro mesmo sqm onde o player
  // cairia (shared/stairs.js); se lá houver outro buraco, continua caindo.
  // Buraco "morto" (sem piso embaixo) não derruba nada.

  resolveFall(x, y, z) {
    const { world } = this.sim;
    for (let i = 0; i < 16; i++) {
      const hole = world.getTransitionAt(x, y, z);
      if (!hole || hole.targetZ >= z || !isValidFloor(hole.targetZ)) break;
      if (!world.hasFloorAt(hole.targetX, hole.targetY, hole.targetZ)) break;
      console.log(`🕳️ Objeto caiu pelo ${hole.id} em (${x},${y}) andar ${z} → (${hole.targetX},${hole.targetY}) andar ${hole.targetZ}`);
      x = hole.targetX;
      y = hole.targetY;
      z = hole.targetZ;
    }
    return { x, y, z };
  }

  // ================================================================================================================================================================================================================================================
  // liftSupportedEntities

  liftSupportedEntities(x, y, floor, oldStep, newStep) {
    for (const entity of this.getEntitiesAt(x, y, floor)) {
      if (Math.abs((entity.step || 0) - oldStep) < 0.5) {
        console.log(`⬆️ ${this.describeEntity(entity)} levantado em (${x}, ${y}) de step=${oldStep} pra step=${newStep}`);
        entity.step = newStep;
      }
    }
  }

  // ================================================================================================================================================================================================================================================
  // dropUnsupportedEntities

  dropUnsupportedEntities(x, y, floor) {
    const { movement: movementController } = this.sim;

    for (const entity of this.getEntitiesAt(x, y, floor)) {
      const newStep = movementController.getPassableStep(x, y, floor, entity.step || 0);
      const safeStep = newStep === null ? 0 : newStep;
      if ((entity.step || 0) > safeStep) {
        console.log(`⬇️ ${this.describeEntity(entity)} desceu em (${x}, ${y}) de step=${entity.step} pra step=${safeStep}`);
        entity.step = safeStep;
      }
    }
  }

  // ================================================================================================================================================================================================================================================
  // checkPendingDrag

  checkPendingDrag(player) {
    if (!player.pendingDrag) return;
    const { entity, targetX, targetY, targetZ } = player.pendingDrag;

    if (this.isPlayerNear(player, entity)) {
      this.moveObject(player, entity, targetX, targetY, targetZ);
      player.pendingDrag = null;
    } else if (!this.sim.control.isWalking(player)) {
      player.pendingDrag = null;
    }
  }
}
