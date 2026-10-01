// shared/vocations.js

// Vocações do Tibia: quem começa não tem (none, a de Rookgaard) e escolhe uma
// no nível VOCATION_LEVEL, com o NPC. Até o nível 8 todo mundo cresce como
// none; dali pra cima, cada nível soma a vida, a mana e o cap da vocação.
// skills: o multiplicador (B) da progressão de cada skill — quanto menor,
// mais rápido sobe (shared/skills.js → triesFor).

export const VOCATION_LEVEL = 8;
export const BASE_STATS = { hp: 150, mana: 55, cap: 400 };

export const VOCATIONS = {
  none: {
    name: 'Sem vocação', words: [],
    gain: { hp: 5, mana: 5, cap: 10 },
    skills: { magic: 4.0, fist: 1.5, club: 2.0, sword: 2.0, axe: 2.0, distance: 2.0, shielding: 1.5, fishing: 1.1 }
  },
  knight: {
    name: 'Knight', words: ['knight', 'cavaleiro'],
    gain: { hp: 15, mana: 5, cap: 25 },
    skills: { magic: 3.0, fist: 1.1, club: 1.1, sword: 1.1, axe: 1.1, distance: 1.4, shielding: 1.1, fishing: 1.1 }
  },
  paladin: {
    name: 'Paladin', words: ['paladin', 'paladino'],
    gain: { hp: 10, mana: 15, cap: 20 },
    skills: { magic: 1.4, fist: 1.2, club: 1.2, sword: 1.2, axe: 1.2, distance: 1.1, shielding: 1.1, fishing: 1.1 }
  },
  sorcerer: {
    name: 'Sorcerer', words: ['sorcerer', 'feiticeiro'],
    gain: { hp: 5, mana: 30, cap: 10 },
    skills: { magic: 1.1, fist: 1.5, club: 2.0, sword: 2.0, axe: 2.0, distance: 2.0, shielding: 1.5, fishing: 1.1 }
  },
  druid: {
    name: 'Druid', words: ['druid', 'druida'],
    gain: { hp: 5, mana: 30, cap: 10 },
    skills: { magic: 1.1, fist: 1.5, club: 2.0, sword: 2.0, axe: 2.0, distance: 2.0, shielding: 1.5, fishing: 1.1 }
  }
};

// ================================================================================================================================================================================================================================================
// vocationOf
// A vocação válida (a chave), ou none.

export function vocationOf(key) {
  return Object.hasOwn(VOCATIONS, key) ? key : 'none';
}

// ================================================================================================================================================================================================================================================
// vocationStats
// Vida, mana e cap máximos no nível, como no Tibia: 150 / 55 / 400 no nível
// 1, +5 / +5 / +10 por nível até o 8 e, depois, o ganho da vocação.

export function vocationStats(level, vocation = 'none') {
  const gain = VOCATIONS[vocationOf(vocation)].gain;
  const early = Math.max(0, Math.min(level, VOCATION_LEVEL) - 1);
  const late = Math.max(0, level - VOCATION_LEVEL);
  const none = VOCATIONS.none.gain;
  return {
    hp: BASE_STATS.hp + early * none.hp + late * gain.hp,
    mana: BASE_STATS.mana + early * none.mana + late * gain.mana,
    cap: BASE_STATS.cap + early * none.cap + late * gain.cap
  };
}

// ================================================================================================================================================================================================================================================
// skillGrowth
// O multiplicador da progressão do skill na vocação.

export function skillGrowth(key, vocation = 'none') {
  return VOCATIONS[vocationOf(vocation)].skills[key] ?? VOCATIONS.none.skills.sword;
}
