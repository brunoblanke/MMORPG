// js/views/inventory-ui/common.js

import { fichaDe } from '../../../shared/ficha.js';
import { itemInfo } from '../../../shared/items.js';
import { RUNES } from '../../../shared/spells.js';

// Constantes e ajudantes que as partes da janela do inventário
// (js/views/inventory-ui.js e inventory-ui/) usam juntas.

export const EQUIP_LAYOUT = [
  ['amuleto', 'Amuleto'], ['cabeca', 'Cabeça'], ['mochila', 'Mochila'],
  ['arma', 'Mão (arma)'], ['corpo', 'Corpo'], ['escudo', 'Mão (escudo)'],
  ['anel', 'Anel'], ['pernas', 'Pernas'], ['municao', 'Munição'],
  [null], ['pes', 'Pés'], [null]
];

export const SKILL_NAMES = {
  magic: 'Magic', fist: 'Fist', club: 'Club', sword: 'Sword', axe: 'Axe',
  distance: 'Distance', shielding: 'Shielding', fishing: 'Fishing'
};
export const SKILL_ORDER = ['magic', 'fist', 'club', 'sword', 'axe', 'distance', 'shielding', 'fishing'];
export const PITCH = 40;
export const SAVE_DELAY_MS = 600;
export const LONG_PRESS_MS = 500;
export const LAYOUT_COLS = ['left', 'right', 'free'];
export const LAYOUT_VERSION = 2;
export const REACH_CHECK_MS = 500;

// ================================================================================================================================================================================================================================================
// freePosition
// Onde a janela solta aparece: a posição guardada (que vale pra todos os aparelhos), puxada pra dentro da tela de
// viewW × viewH (a janela inteira na largura, o título na altura), sem mudar o que está guardado.

export const FREE_WINDOW_W = 170;
export const FREE_HEADER_H = 40;

export function freePosition(x, y, viewW, viewH) {
  return {
    x: Math.round(Math.max(0, Math.min(x, viewW - FREE_WINDOW_W))),
    y: Math.round(Math.max(0, Math.min(y, viewH - FREE_HEADER_H)))
  };
}

// ================================================================================================================================================================================================================================================
// aimsWith
// Item usado com a mira: potion (em player ou no chão), runa, as ferramentas (corda, pá, picareta, machete, foice, chave, vara de pescar) e o que se planta (semente).

export function aimsWith(type) {
  const sheet = fichaDe(type);
  return !!itemInfo(type).heal || !!RUNES[type] || !!(sheet && ((sheet.tracos.capacidade && sheet.tracos.capacidade.length) || sheet.tracos.planta));
}
