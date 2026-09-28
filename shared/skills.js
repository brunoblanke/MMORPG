// shared/skills.js

// Skills do Tibia 7.6: magic level e os sete de combate/pesca, com o % até o
// próximo. Por enquanto só guardam e aparecem; o ganho vem depois.

export const SKILL_KEYS = ['fist', 'club', 'sword', 'axe', 'distance', 'shielding', 'fishing'];
export const SKILL_START = 10;
export const MAGIC_START = 0;

// ================================================================================================================================================================================================================================================
// newSkills
// Skills de quem começa: todos em 10, magic level 0, 0% até o próximo.

export function newSkills() {
  const skills = { magic: { lvl: MAGIC_START, pct: 0 } };
  for (const key of SKILL_KEYS) skills[key] = { lvl: SKILL_START, pct: 0 };
  return skills;
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
    const pct = Number.isInteger(entry.pct) ? Math.min(99, Math.max(0, entry.pct)) : 0;
    skills[key] = { lvl: entry.lvl, pct };
  }
  return skills;
}
