// js/views/inventory-ui/common.js

import { objectUse } from '../../../shared/assets.js';
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

export const MAP_USES = ['placa', 'livro', 'bau-quest', 'corda', 'pa', 'descer'];

// ================================================================================================================================================================================================================================================
// aimsWith
// Item usado com a mira: potion (em player ou no chão), runa, corda e pá.

export function aimsWith(type) {
  const use = objectUse(type);
  return !!itemInfo(type).heal || !!RUNES[type] || use === 'ferramenta-corda' || use === 'ferramenta-pa';
}
