// js/model/state.js

import { GRID } from '../config.js';
import { getAllFloors, GROUND_FLOOR } from '../../../shared/constants.js';

// ================================================================================================================================================================================================================================================
// makeEmptyLayer

export function makeEmptyLayer() {
  const cells = {};
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      cells[`${x},${y}`] = { floor: null, floorTop: null, hole: null, borders: [], objects: [], enemy: null, npc: null, spawn: false, safe: false, house: null };
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

// O que cada ferramenta pinta é uma folha do gerador (shared/assets.js):
// floorPaint/stairsPaint/holePaint/itemPaint são o id da folha, wallPaint é
// '<folha>#<peça>' e borderPaint { type: folha do piso, variant }. Ficam null
// até a lista das folhas chegar (choosePaintDefaults).

export const state = {
  layers: makeAllLayers(),
  layerOrder: getAllFloors(),
  activeZ: GROUND_FLOOR,
  tool: 'floor',
  floorPaint: null,
  wallPaint: null,
  stairsPaint: null,
  holePaint: null,
  itemPaint: null,
  decoPaint: null,
  enemyPaint: null,
  npcPaint: null,
  borderPaint: null,
  housePaint: { name: '', price: 0 },
  safePaintValue: false,
  openAccordion: null,
  showBorders: true,
  painting: false,
  brushSize: 1,
  hoverCell: null,
  selected: null,
  focus: null,
  strokeTouched: new Set(),
  ghost: true
};

// paint: campo do state com o que a ferramenta pinta (as que têm lista).
export const TOOLS = [
  { id:'select', label:'Selecionar', quick:true },
  { id:'floor', label:'Piso', paint:'floorPaint' },
  { id:'wall', label:'Parede', paint:'wallPaint' },
  { id:'stairs', label:'Escada', paint:'stairsPaint' },
  { id:'hole', label:'Buraco / entrada', paint:'holePaint' },
  { id:'border', label:'Borda', paint:'borderPaint' },
  { id:'border-eraser', label:'Tirar borda', quick:true },
  { id:'deco', label:'Decoração', paint:'decoPaint' },
  { id:'item', label:'Item', paint:'itemPaint' },
  { id:'enemy', label:'Criatura', paint:'enemyPaint' },
  { id:'npc', label:'NPC', paint:'npcPaint' },
  { id:'spawn', label:'Respawn', quick:true },
  { id:'safe', label:'Zona segura (liga/desliga)' },
  { id:'house', label:'Casa (liga/desliga)' },
  { id:'eraser', label:'Borracha', quick:true }
];