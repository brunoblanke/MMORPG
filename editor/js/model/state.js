// js/model/state.js

import { GRID } from '../config.js';

// ================================================================================================================================================================================================================================================
// makeEmptyLayer

export function makeEmptyLayer() {
  const cells = {};
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      cells[`${x},${y}`] = { floor: null, floorTop: null, hole: false, objects: [], enemy: null, spawn: false };
    }
  }
  return cells;
}

export const state = {
  layers: { 0: makeEmptyLayer(), 1: makeEmptyLayer(), 2: makeEmptyLayer() },
  layerOrder: [0, 1, 2],
  activeZ: 0,
  tool: 'floor',
  floorPaint: 'Floor',
  itemPaint: 'Parcel',
  floorAccordionOpen: false,
  itemAccordionOpen: false,
  showBorders: false,
  painting: false,
  strokeTouched: new Set(),
  ghost: true
};

export const TOOLS = [
  { id:'floor', label:'Piso', hasSub:true },
  { id:'wall-x', label:'Parede X', obj:'Wall-X' },
  { id:'wall-y', label:'Parede Y', obj:'Wall-Y' },
  { id:'wall-xy', label:'Parede XY (canto)', obj:'Wall-XY' },
  { id:'wall-yx', label:'Parede YX (canto)', obj:'Wall-YX' },
  { id:'stairs', label:'Escada', obj:'Stairs' },
  { id:'hole', label:'Buraco / vão', obj:'Hole' },
  { id:'item', label:'Item', hasSub:true },
  { id:'enemy', label:'Criatura' },
  { id:'spawn', label:'Respawn do jogador' },
  { id:'eraser', label:'Borracha (tira o do topo)' }
];