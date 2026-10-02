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
  { words: 'exura gran', name: 'Intense Healing', lvl: 11, mana: 70, vocations: ['paladin', ...MAGES], kind: 'heal', formula: { min: [3.184, 20], max: [5.59, 35] } },
  { words: 'exori vis', name: 'Energy Strike', lvl: 12, mana: 20, vocations: MAGES, kind: 'strike', formula: { min: [1.4, 8], max: [2.2, 14] } },
  { words: 'exori', name: 'Berserk', lvl: 35, mana: 115, vocations: ['knight'], kind: 'around', formula: { min: [1.2, 20], max: [2.4, 40] } },
  { words: 'adori', name: 'Light Magic Missile', lvl: 15, mana: 120, vocations: MAGES, kind: 'conjure', rune: 'itens/runas/light-magic-missile-rune' },
  { words: 'adori gran', name: 'Heavy Magic Missile', lvl: 25, mana: 350, vocations: MAGES, kind: 'conjure', rune: 'itens/runas/heavy-magic-missile-rune' },
  { words: 'adura gran', name: 'Intense Healing Rune', lvl: 15, mana: 120, vocations: ['druid'], kind: 'conjure', rune: 'itens/runas/intense-healing-rune' },
  { words: 'adura vita', name: 'Ultimate Healing Rune', lvl: 24, mana: 400, vocations: ['druid'], kind: 'conjure', rune: 'itens/runas/ultimate-healing-rune' }
];

// Runas: o que faz ao usar com a mira (heal em player, attack em criatura),
// quantas cargas a conjuração dá e o magic level pra usar.
export const RUNES = {
  'itens/runas/light-magic-missile-rune': { kind: 'attack', charges: 5, ml: 0, formula: { min: [0.4, 2], max: [0.81, 4] } },
  'itens/runas/heavy-magic-missile-rune': { kind: 'attack', charges: 5, ml: 1, formula: { min: [0.8, 5], max: [1.6, 9] } },
  'itens/runas/intense-healing-rune': { kind: 'heal', charges: 1, ml: 1, formula: { min: [3.2, 20], max: [5.4, 40] } },
  'itens/runas/ultimate-healing-rune': { kind: 'heal', charges: 1, ml: 4, formula: { min: [7.3, 42], max: [12.4, 90] } }
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
