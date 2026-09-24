// js/model/state.js

import { GRID } from '../config.js';
import { getAllFloors, GROUND_FLOOR } from '../../../shared/constants.js';

// ================================================================================================================================================================================================================================================
// makeEmptyLayer

export function makeEmptyLayer() {
  const cells = {};
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      cells[`${x},${y}`] = { floor: null, floorTop: null, hole: false, objects: [], enemy: null, spawn: false, safe: false };
    }
  }
  return cells;
}

// ================================================================================================================================================================================================================================================
// makeAllLayers
// Todos os andares (FLOOR_MIN..FLOOR_MAX em shared/constants.js) já existem;
// o editor só escolhe em qual trabalhar.

export function makeAllLayers(existing = {}) {
  const layers = {};
  for (const z of getAllFloors()) layers[z] = existing[z] || makeEmptyLayer();
  return layers;
}

export const state = {
  layers: makeAllLayers(),
  layerOrder: getAllFloors(),
  activeZ: GROUND_FLOOR,
  tool: 'floor',
  floorPaint: 'Floor',
  itemPaint: 'Parcel',
  tibiaPaint: null,
  enemyPaint: null,
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
  { id:'safe', label:'Zona segura (liga/desliga)' },
  { id:'eraser', label:'Borracha (tira o do topo)' }
];