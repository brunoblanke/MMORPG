// shared/skills.js

// Skills do Tibia 7.6: magic level e os sete de combate/pesca, com o % até o
// próximo. Sobem com o uso (tries): cada golpe treina o skill da arma na mão,
// cada ataque recebido com escudo treina shielding. Magic level e fishing
// ainda não sobem (magia e pesca vêm depois).

export const SKILL_KEYS = ['fist', 'club', 'sword', 'axe', 'distance', 'shielding', 'fishing'];
export const SKILL_START = 10;
export const MAGIC_START = 0;
export const TRIES_BASE = 50;
export const TRIES_GROWTH = 1.1;

// ================================================================================================================================================================================================================================================
// newSkills
// Skills de quem começa: todos em 10, magic level 0, 0% até o próximo.

export function newSkills() {
  const skills = { magic: { lvl: MAGIC_START, pct: 0, tries: 0 } };
  for (const key of SKILL_KEYS) skills[key] = { lvl: SKILL_START, pct: 0, tries: 0 };
  return skills;
}

// ================================================================================================================================================================================================================================================
// triesFor
// Quantos usos pra passar do nível lvl pro seguinte (cresce 10% por nível).

export function triesFor(lvl) {
  return Math.round(TRIES_BASE * Math.pow(TRIES_GROWTH, Math.max(0, lvl - SKILL_START)));
}

// ================================================================================================================================================================================================================================================
// addSkillTry
// Um uso do skill: soma a tentativa, sobe de nível quando completa e acerta o
// % até o próximo. Devolve true se subiu.

export function addSkillTry(skills, key) {
  const entry = skills[key];
  if (!entry) return false;
  entry.tries = (entry.tries || 0) + 1;
  let advanced = false;
  while (entry.tries >= triesFor(entry.lvl)) {
    entry.tries -= triesFor(entry.lvl);
    entry.lvl++;
    advanced = true;
  }
  entry.pct = Math.min(99, Math.floor(entry.tries / triesFor(entry.lvl) * 100));
  return advanced;
}

// ================================================================================================================================================================================================================================================
// loadSkills
// Skills guardados de volta; o que faltar ou vier fora do lugar volta ao começo.

export function loadSkills(saved) {
  const skills = newSkills();
  if (!saved || typeof saved !== 'object') return skills;
  for (const key of ['magic', ...SKILL_KEYS]) {
    const entry = saved[key];
    if (!entry || !Number.isInteger(entry.lvl) || entry.lvl < 0) continue;
    const tries = Number.isInteger(entry.tries) && entry.tries >= 0 ? Math.min(entry.tries, triesFor(entry.lvl) - 1) : 0;
    skills[key] = { lvl: entry.lvl, tries, pct: Math.min(99, Math.floor(tries / triesFor(entry.lvl) * 100)) };
  }
  return skills;
}
