// js/core/pathfinding.js

import { DIRECTIONS, resolveStep } from './movement.js';

// ================================================================================================================================================================================================================================================
// heapPush

function heapPush(heap, node) {
  heap.push(node);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (heap[parent].f <= heap[i].f) break;
    [heap[parent], heap[i]] = [heap[i], heap[parent]];
    i = parent;
  }
}

// ================================================================================================================================================================================================================================================
// heapPop

function heapPop(heap) {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length === 0) return top;
  heap[0] = last;
  let i = 0;
  for (;;) {
    const left = i * 2 + 1;
    const right = left + 1;
    let smallest = i;
    if (left < heap.length && heap[left].f < heap[smallest].f) smallest = left;
    if (right < heap.length && heap[right].f < heap[smallest].f) smallest = right;
    if (smallest === i) break;
    [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
    i = smallest;
  }
  return top;
}

// ================================================================================================================================================================================================================================================
// isInsideBounds

function isInsideBounds(bounds, x, y) {
  return !bounds || (x >= bounds.minX && x < bounds.maxX && y >= bounds.minY && y < bounds.maxY);
}

// ================================================================================================================================================================================================================================================
// findPath
// A busca de caminho (A*), feita passo a passo pela mesma regra de passo
// (resolveStep). Caminho de start = { x, y, z, step } até o sqm end = { x, y, z }.
// Chega quem termina o passo no sqm — ou pisa nele, se for escada/buraco.
// Cada passo do caminho é { dx, dy, x, y, z, step }: a direção andada e onde
// termina. Já estando no destino, o caminho é vazio. Opções:
//   - sameFloor: fica no andar de start, sem pilha entre andares, e só pisa
//     em escada/buraco se for o destino (inimigos);
//   - bounds: { minX, maxX, minY, maxY } — só procura dentro dessa área;
//   - enemiesPassable: inimigos não bloqueiam (uma hora eles saem do lugar);
//   - maxNodes: desiste depois de expandir tantos nós.
// Devolve [] se não houver caminho.

export function findPath(world, start, end, options = {}) {
  const { sameFloor = false, bounds = null, enemiesPassable = false, maxNodes = 20000 } = options;
  const stepOptions = { sameFloor, transitions: !sameFloor, enemiesPassable };
  const origin = { x: start.x, y: start.y, z: start.z || 0, step: start.step || 0 };
  if (origin.x === end.x && origin.y === end.y && origin.z === end.z) return [];

  const keyOf = (s, reached) => `${s.x},${s.y},${s.z},${s.step}${reached ? '!' : ''}`;
  const isEnd = (s) => s.x === end.x && s.y === end.y && s.z === end.z;
  const heuristic = (s) => {
    const ax = Math.abs(s.x - end.x);
    const ay = Math.abs(s.y - end.y);
    return Math.max(ax, ay) + 0.4 * Math.min(ax, ay) + Math.abs(s.z - end.z);
  };

  const open = [];
  heapPush(open, { ...origin, g: 0, f: heuristic(origin), parent: null, reached: false });
  const bestG = new Map([[keyOf(origin, false), 0]]);
  const closed = new Set();

  while (open.length > 0 && closed.size < maxNodes) {
    const current = heapPop(open);
    const currentKey = keyOf(current, current.reached);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    if (current.reached) {
      const path = [];
      for (let node = current; node.parent; node = node.parent) {
        path.unshift({ dx: node.dx, dy: node.dy, x: node.x, y: node.y, z: node.z, step: node.step });
      }
      return path;
    }

    for (const { dx, dy } of DIRECTIONS) {
      const next = resolveStep(world, current, dx, dy, stepOptions);
      if (!next) continue;

      const entered = next.via || next;
      if (!isInsideBounds(bounds, entered.x, entered.y)) continue;

      const reached = isEnd(next) || (!!next.via && isEnd(next.via));
      if (sameFloor && !reached && world.getTransitionAt(next.x, next.y, next.z)) continue;

      const nextKey = keyOf(next, reached);
      if (closed.has(nextKey)) continue;

      const g = current.g + (dx !== 0 && dy !== 0 ? 1.4 : 1) + (next.step !== current.step ? 0.5 : 0);
      if (bestG.has(nextKey) && bestG.get(nextKey) <= g) continue;
      bestG.set(nextKey, g);

      heapPush(open, { x: next.x, y: next.y, z: next.z, step: next.step, dx, dy, g, f: g + (reached ? 0 : heuristic(next)), parent: current, reached });
    }
  }

  return [];
}
