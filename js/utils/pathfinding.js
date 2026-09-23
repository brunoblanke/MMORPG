// js/utils/pathfinding.js

import { CONFIG } from '../config.js';
import { distance } from './helpers.js';

export class Pathfinding {
  // ================================================================================================================================================================================================================================================
  // findPath

  static findPath(startX, startY, endX, endY, isBlockedFn, startStep, targetStep, movementController, bounds = null, floor = 0) {
    const minX = bounds ? bounds.minX : 0;
    const maxX = bounds ? bounds.maxX : CONFIG.mapWidth;
    const minY = bounds ? bounds.minY : 0;
    const maxY = bounds ? bounds.maxY : CONFIG.mapHeight;

    const openSet = [{
      x: startX,
      y: startY,
      step: startStep,
      g: 0,
      h: distance(startX, startY, endX, endY),
      parent: null
    }];
    const closedSet = new Set();

    const shouldClimb = targetStep > startStep;
    const shouldDescend = targetStep < startStep;

    while (openSet.length > 0) {
      openSet.sort((a, b) => (a.g + a.h) - (b.g + b.h));
      const current = openSet.shift();

      if (current.x === endX && current.y === endY && Math.abs(current.step - targetStep) < 0.5) {
        const path = [];
        let node = current;
        while (node.parent) {
          path.unshift({ x: node.x, y: node.y, step: node.step });
          node = node.parent;
        }
        return path;
      }

      closedSet.add(`${current.x},${current.y},${Math.floor(current.step * 10)}`);

      const neighbors = [
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
        { dx: -1, dy: -1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
      ];

      for (const { dx, dy } of neighbors) {
        const nx = current.x + dx;
        const ny = current.y + dy;

        if (nx < minX || nx >= maxX || ny < minY || ny >= maxY) continue;
        if (isBlockedFn(nx, ny)) continue;
        // Escada/buraco teleporta: só entra no caminho se for o próprio destino.
        const isDestination = nx === endX && ny === endY;
        if (!isDestination && movementController.world.getTransitionAt(nx, ny, floor)) continue;

        const entityHeight = 1;

        const naturalStep = movementController.getPassableStep(nx, ny, floor, current.step);
        if (naturalStep === null) continue;

        let possibleSteps = [];

        if (Math.abs(naturalStep - current.step) <= 1 &&
            movementController.canMove(current.x, current.y, floor, current.step, nx, ny, entityHeight, naturalStep)) {
          possibleSteps.push({ step: naturalStep, type: 'natural' });
        }

        if (nx === endX && ny === endY && targetStep !== null &&
            Math.abs(targetStep - current.step) <= 1) {
          const canReachTarget = movementController.canMove(current.x, current.y, floor, current.step, nx, ny, entityHeight, targetStep);

          if (canReachTarget && !possibleSteps.some(opt => Math.abs(opt.step - targetStep) < 0.1)) {
            possibleSteps.push({ step: targetStep, type: 'target' });
          }
        }

        for (const option of possibleSteps) {
          const neighborStep = option.step;
          const stepDiff = neighborStep - current.step;

          if (closedSet.has(`${nx},${ny},${Math.floor(neighborStep * 10)}`)) continue;

          let g = current.g + 1;

          if (option.type === 'natural') {
            g -= 0.5;
          } else if (option.type === 'target') {
            g -= 2;
          }

          if (shouldClimb && stepDiff < 0) {
            g += 2;
          } else if (shouldDescend && stepDiff > 0) {
            g += 2;
          } else if (!shouldClimb && !shouldDescend && stepDiff !== 0) {
            g += 3;
          }

          const h = distance(nx, ny, endX, endY) + Math.abs(neighborStep - targetStep);
          const existing = openSet.find(n => n.x === nx && n.y === ny && Math.abs(n.step - neighborStep) < 0.5);

          if (!existing) {
            openSet.push({ x: nx, y: ny, step: neighborStep, g, h, parent: current });
          } else if (g < existing.g) {
            existing.g = g;
            existing.parent = current;
          }
        }
      }
    }

    return [];
  }

  // ================================================================================================================================================================================================================================================
  // findPathAcrossFloors
  // Caminho de start = { x, y, z, step } até o sqm end = { x, y, z }, podendo
  // trocar de andar por pilha, escada e buraco (movementController.simulateMove).
  // Chega quem termina o passo no sqm — ou pisa nele, se for escada/buraco.
  // Cada passo é { dx, dy, x, y, z, step }: a direção andada e onde termina.
  // Devolve [] se não houver caminho (ou se a busca passar de maxNodes).

  static findPathAcrossFloors(start, end, movementController, maxNodes = 20000) {
    const keyOf = (s) => `${s.x},${s.y},${s.z},${s.step}`;
    const isEnd = (s) => s.x === end.x && s.y === end.y && s.z === end.z;
    const heuristic = (s) => {
      const ax = Math.abs(s.x - end.x);
      const ay = Math.abs(s.y - end.y);
      return Math.max(ax, ay) + 0.4 * Math.min(ax, ay) + Math.abs(s.z - end.z);
    };

    const open = [{ x: start.x, y: start.y, z: start.z, step: start.step, g: 0, f: heuristic(start), parent: null, reached: false }];
    const bestG = new Map([[keyOf(start), 0]]);
    const closed = new Set();

    const directions = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
      { dx: -1, dy: -1 }, { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
    ];

    while (open.length > 0 && closed.size < maxNodes) {
      let bestIndex = 0;
      for (let i = 1; i < open.length; i++) {
        if (open[i].f < open[bestIndex].f) bestIndex = i;
      }
      const current = open[bestIndex];
      open[bestIndex] = open[open.length - 1];
      open.pop();

      const currentKey = keyOf(current) + (current.reached ? '!' : '');
      if (closed.has(currentKey)) continue;
      closed.add(currentKey);

      if (current.reached) {
        const path = [];
        for (let node = current; node.parent; node = node.parent) {
          path.unshift({ dx: node.dx, dy: node.dy, x: node.x, y: node.y, z: node.z, step: node.step });
        }
        return path;
      }

      for (const { dx, dy } of directions) {
        const next = movementController.simulateMove(current, dx, dy);
        if (!next) continue;

        const reached = isEnd(next) || (!!next.via && isEnd(next.via));
        const nextKey = keyOf(next) + (reached ? '!' : '');
        if (closed.has(nextKey)) continue;

        const g = current.g + (dx !== 0 && dy !== 0 ? 1.4 : 1) + (next.step !== current.step ? 0.5 : 0);
        if (bestG.has(nextKey) && bestG.get(nextKey) <= g) continue;
        bestG.set(nextKey, g);

        open.push({ x: next.x, y: next.y, z: next.z, step: next.step, dx, dy, g, f: g + (reached ? 0 : heuristic(next)), parent: current, reached });
      }
    }

    return [];
  }
}
