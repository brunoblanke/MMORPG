// moba/engine/map.js

import { ARENA } from './config.js';

// ================================================================================================================================================================================================================================================
// Mapa do campo (aberto, 100 × 30 tiles): as bases nas pontas, a lane no meio (y = 15) e
// pilares de pedra como obstáculos.

export const SPAWNS = { blue: { x: 4.5, y: 15 }, red: { x: ARENA.width - 4.5, y: 15 } };
export const WALLS = [
  { x: 30, y: 6, w: 2, h: 5 }, { x: 30, y: 19, w: 2, h: 5 },
  { x: 68, y: 6, w: 2, h: 5 }, { x: 68, y: 19, w: 2, h: 5 },
  { x: 48, y: 3, w: 4, h: 3 }, { x: 48, y: 24, w: 4, h: 3 }
];
const STRUCTURE_SPOTS = {
  blue: { nexus: { x: 6, y: 15 }, towers: [{ x: 26, y: 15 }, { x: 14, y: 15 }] },
  red: { nexus: { x: ARENA.width - 6, y: 15 }, towers: [{ x: ARENA.width - 26, y: 15 }, { x: ARENA.width - 14, y: 15 }] }
};

// ================================================================================================================================================================================================================================================
// structureLayout
// As estruturas do time: [{ id, kind, team, x, y, order }] (a torre de fora é a order 0; o nexus só cai depois das duas).

export function structureLayout(team) {
  const spots = STRUCTURE_SPOTS[team];
  return [
    ...spots.towers.map((spot, index) => ({ id: `${team}-tower-${index + 1}`, kind: 'tower', team, x: spot.x, y: spot.y, order: index })),
    { id: `${team}-nexus`, kind: 'nexus', team, x: spots.nexus.x, y: spots.nexus.y, order: 2 }
  ];
}

// ================================================================================================================================================================================================================================================
// lanePath
// Os pontos que os minions do time seguem, da base dele até o nexus inimigo.

export function lanePath(team) {
  const forward = [[10, 15], [26, 15], [42, 15], [58, 15], [74, 15], [ARENA.width - 10, 15]];
  const points = team === 'blue' ? forward : [...forward].reverse();
  return points.map(([x, y]) => ({ x, y }));
}
