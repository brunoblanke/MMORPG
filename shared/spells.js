// shared/spells.js

import { normalizeSpeech } from './npcs.js';

// Magias do Tibia 7.6, ditas no chat: palavras, nível mínimo, mana, vocações
// e o que fazem (js/systems/spells.js). As de runa (conjure) transformam uma
// blank rune carregada pelo player na runa, com as cargas dela. As fórmulas
// de cura e dano usam o nível e o magic level de quem usa: min/max =
// nível / 5 + magic level × fator + base.

export const BLANK_RUNE = 'itens/runas/blank-rune';
export const SPELL_COOLDOWN_MS = 1000;
export const SPELL_RANGE = 3;
export const RUNE_RANGE = 7;
export const LIGHT_SPELL = { light: 6, ms: 6 * 60 * 1000 };

const ALL = ['knight', 'paladin', 'sorcerer', 'druid'];
const MAGES = ['sorcerer', 'druid'];

export const SPELLS = [
  { words: 'utevo lux', name: 'Light', lvl: 8, mana: 20, vocations: ALL, kind: 'light' },
  { words: 'exura', name: 'Light Healing', lvl: 9, mana: 20, vocations: ALL, kind: 'heal', formula: { min: [1.4, 8], max: [1.795, 11] } },
  { words: 'exana pox', name: 'Antidote', lvl: 10, mana: 30, vocations: ALL, kind: 'cure' },
  { words: 'exura gran', name: 'Intense Healing', lvl: 11, mana: 70, vocations: ['paladin', ...MAGES], kind: 'heal', formula: { min: [3.184, 20], max: [5.59, 35] } },
  { words: 'exori vis', name: 'Energy Strike', lvl: 12, mana: 20, vocations: MAGES, kind: 'strike', element: 'energy', formula: { min: [1.4, 8], max: [2.2, 14] } },
  { words: 'exori flam', name: 'Flame Strike', lvl: 12, mana: 20, vocations: MAGES, kind: 'strike', element: 'fire', formula: { min: [1.4, 8], max: [2.2, 14] } },
  { words: 'utani hur', name: 'Haste', lvl: 14, mana: 60, vocations: ALL, kind: 'haste', speed: [0.3, -24], ms: 33000 },
  { words: 'exura vita', name: 'Ultimate Healing', lvl: 20, mana: 160, vocations: MAGES, kind: 'heal', formula: { min: [7.3, 42], max: [12.4, 90] } },
  { words: 'utani gran hur', name: 'Strong Haste', lvl: 20, mana: 100, vocations: MAGES, kind: 'haste', speed: [0.7, -56], ms: 22000 },
  { words: 'exori', name: 'Berserk', lvl: 35, mana: 115, vocations: ['knight'], kind: 'around', formula: { min: [1.2, 20], max: [2.4, 40] } },
  { words: 'adori', name: 'Light Magic Missile', lvl: 15, mana: 120, vocations: MAGES, kind: 'conjure', rune: 'itens/runas/light-magic-missile-rune' },
  { words: 'adori gran', name: 'Heavy Magic Missile', lvl: 25, mana: 350, vocations: MAGES, kind: 'conjure', rune: 'itens/runas/heavy-magic-missile-rune' },
  { words: 'adura gran', name: 'Intense Healing Rune', lvl: 15, mana: 120, vocations: ['druid'], kind: 'conjure', rune: 'itens/runas/intense-healing-rune' },
  { words: 'adura vita', name: 'Ultimate Healing Rune', lvl: 24, mana: 400, vocations: ['druid'], kind: 'conjure', rune: 'itens/runas/ultimate-healing-rune' },
  { words: 'adana pox', name: 'Antidote Rune', lvl: 15, mana: 100, vocations: ['druid'], kind: 'conjure', rune: 'itens/runas/cure-poison-rune' },
  { words: 'adevo grav pox', name: 'Poison Field', lvl: 14, mana: 50, vocations: MAGES, kind: 'conjure', rune: 'itens/runas/poison-field-rune' },
  { words: 'adevo grav flam', name: 'Fire Field', lvl: 15, mana: 60, vocations: MAGES, kind: 'conjure', rune: 'itens/runas/fire-field-rune' },
  { words: 'adevo grav vis', name: 'Energy Field', lvl: 18, mana: 80, vocations: MAGES, kind: 'conjure', rune: 'itens/runas/energy-field-rune' },
  { words: 'adori flam', name: 'Fireball', lvl: 27, mana: 160, vocations: ['sorcerer'], kind: 'conjure', rune: 'itens/runas/fireball-rune' },
  { words: 'adevo mas flam', name: 'Fire Bomb', lvl: 27, mana: 150, vocations: MAGES, kind: 'conjure', rune: 'itens/runas/fire-bomb-rune' },
  { words: 'adori gran flam', name: 'Great Fireball', lvl: 30, mana: 240, vocations: MAGES, kind: 'conjure', rune: 'itens/runas/great-fireball-rune' },
  { words: 'adevo mas hur', name: 'Explosion', lvl: 31, mana: 180, vocations: MAGES, kind: 'conjure', rune: 'itens/runas/explosion-rune' },
  { words: 'adevo grav tera', name: 'Magic Wall', lvl: 32, mana: 250, vocations: ['sorcerer'], kind: 'conjure', rune: 'itens/runas/magic-wall-rune' },
  { words: 'adori gran mort', name: 'Sudden Death', lvl: 45, mana: 220, vocations: ['sorcerer'], kind: 'conjure', rune: 'itens/runas/sudden-death-rune' }
];

// Runas: o que faz ao usar com a mira, quantas cargas a conjuração dá e o
// magic level pra usar. heal cura o player do sqm; attack fere a criatura do
// sqm (element: o tipo do dano); area fere as criaturas da área em volta do
// sqm (AREAS); field cria o campo (nos sqms da área); cure tira o veneno do
// player do sqm.
export const RUNES = {
  'itens/runas/light-magic-missile-rune': { kind: 'attack', element: 'energy', charges: 5, ml: 0, formula: { min: [0.4, 2], max: [0.81, 4] } },
  'itens/runas/heavy-magic-missile-rune': { kind: 'attack', element: 'energy', charges: 5, ml: 1, formula: { min: [0.8, 5], max: [1.6, 9] } },
  'itens/runas/fireball-rune': { kind: 'attack', element: 'fire', charges: 5, ml: 5, formula: { min: [1.81, 10], max: [3, 18] } },
  'itens/runas/sudden-death-rune': { kind: 'attack', element: 'death', charges: 3, ml: 15, formula: { min: [4.605, 28], max: [7.395, 46] } },
  'itens/runas/great-fireball-rune': { kind: 'area', area: 'circle', element: 'fire', charges: 4, ml: 4, formula: { min: [1.2, 7], max: [2.85, 16] } },
  'itens/runas/explosion-rune': { kind: 'area', area: 'cross', element: 'physical', charges: 6, ml: 6, formula: { min: [1.6, 9], max: [3.2, 19] } },
  'itens/runas/intense-healing-rune': { kind: 'heal', charges: 1, ml: 1, formula: { min: [3.2, 20], max: [5.4, 40] } },
  'itens/runas/ultimate-healing-rune': { kind: 'heal', charges: 1, ml: 4, formula: { min: [7.3, 42], max: [12.4, 90] } },
  'itens/runas/cure-poison-rune': { kind: 'cure', charges: 1, ml: 0 },
  'itens/runas/poison-field-rune': { kind: 'field', field: 'itens/itens-encantados/poison-field', area: 'single', charges: 3, ml: 0 },
  'itens/runas/fire-field-rune': { kind: 'field', field: 'itens/itens-encantados/fire-field', area: 'single', charges: 3, ml: 1 },
  'itens/runas/energy-field-rune': { kind: 'field', field: 'itens/itens-encantados/energy-field', area: 'single', charges: 3, ml: 3 },
  'itens/runas/fire-bomb-rune': { kind: 'field', field: 'itens/itens-encantados/fire-field', area: 'square', charges: 2, ml: 5 },
  'itens/runas/magic-wall-rune': { kind: 'field', field: 'itens/itens-encantados/magic-wall', area: 'single', charges: 4, ml: 9 }
};

// Áreas das runas em volta do sqm mirado: [dx, dy].
export const AREAS = {
  single: [[0, 0]],
  cross: [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]],
  square: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
  circle: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, -2], [0, 2], [-2, 0], [2, 0]]
};

// ================================================================================================================================================================================================================================================
// findSpell
// A magia cujas palavras são exatamente o que foi dito (sem acento nem
// pontuação, como no Tibia), ou null.

export function findSpell(text) {
  const said = normalizeSpeech(text);
  return SPELLS.find(spell => spell.words === said) || null;
}

// ================================================================================================================================================================================================================================================
// spellRange
// A faixa [min, max] da fórmula no nível e no magic level.

export function spellRange(formula, level, magicLevel) {
  const value = ([factor, base]) => Math.max(0, Math.floor(level / 5 + magicLevel * factor + base));
  const min = value(formula.min);
  return [min, Math.max(min, value(formula.max))];
}
