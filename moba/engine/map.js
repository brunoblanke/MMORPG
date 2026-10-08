// moba/engine/map.js

import { ARENA, CAMPS, NEUTRALS } from './config.js';

export const LANE_Y = ARENA.height / 2;
export const SPAWNS = { blue: { x: 6, y: LANE_Y }, red: { x: ARENA.width - 6, y: LANE_Y } };

// ================================================================================================================================================================================================================================================
// WALLS
// O mapa (120 × 60): a lane no meio (y = 30) entre dois muros de pedra com aberturas pra selva; selva de cima e de baixo com os acampamentos; blocos de pedra nas pontas e no centro dos bosques.

export const WALLS = [
  { x: 20, y: 22, w: 18, h: 2.5 }, { x: 46, y: 22, w: 28, h: 2.5 }, { x: 82, y: 22, w: 18, h: 2.5 },
  { x: 20, y: 35.5, w: 18, h: 2.5 }, { x: 46, y: 35.5, w: 28, h: 2.5 }, { x: 82, y: 35.5, w: 18, h: 2.5 },
  { x: 0, y: 0, w: 20, h: 7 }, { x: 100, y: 0, w: 20, h: 7 }, { x: 0, y: 53, w: 20, h: 7 }, { x: 100, y: 53, w: 20, h: 7 },
  { x: 38, y: 10, w: 3, h: 3 }, { x: 79, y: 10, w: 3, h: 3 }, { x: 38, y: 47, w: 3, h: 3 }, { x: 79, y: 47, w: 3, h: 3 },
  { x: 58, y: 14, w: 4, h: 3 }, { x: 58, y: 43, w: 4, h: 3 }
];
const STRUCTURE_SPOTS = {
  blue: { nexus: { x: 8, y: LANE_Y }, towers: [{ x: 28, y: LANE_Y }, { x: 17, y: LANE_Y }] },
  red: { nexus: { x: ARENA.width - 8, y: LANE_Y }, towers: [{ x: ARENA.width - 28, y: LANE_Y }, { x: ARENA.width - 17, y: LANE_Y }] }
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
  const forward = [[14, LANE_Y], [30, LANE_Y], [46, LANE_Y], [60, LANE_Y], [74, LANE_Y], [90, LANE_Y], [ARENA.width - 12, LANE_Y]];
  const points = team === 'blue' ? forward : [...forward].reverse();
  return points.map(([x, y]) => ({ x, y }));
}

// ================================================================================================================================================================================================================================================
// campSlots
// Os lugares dos neutros: [{ id, type, x, y }] (um por criatura do acampamento, lado a lado).

export function campSlots() {
  return CAMPS.flatMap(camp => Array.from({ length: camp.count }, (_, index) => ({
    id: `${camp.id}-${index + 1}`, camp: camp.id, type: camp.type, x: camp.x + (index - (camp.count - 1) / 2) * 1.6, y: camp.y, boss: !!NEUTRALS[camp.type].buff
  })));
}
