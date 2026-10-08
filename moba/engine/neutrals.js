// moba/engine/neutrals.js

import { NEUTRALS } from './config.js';
import { distance } from './geometry.js';
import { moveToward } from './movement.js';
import { gap, attack } from './combat.js';

const AGGRO = 6.5;
const LEASH = 15;
const HOME_REGEN = 0.2;

// ================================================================================================================================================================================================================================================
// pickTarget
// O herói que o neutro persegue: o que já está atrás dele, senão o mais perto que entrou no raio de aggro dentro da área do acampamento.

function pickTarget(sim, neutral) {
  const current = neutral.targetId ? sim.getUnit(neutral.targetId) : null;
  if (current && current.alive && current.kind === 'hero' && distance(neutral.home.x, neutral.home.y, current.x, current.y) <= LEASH) return current;
  return sim.heroes.filter(hero => hero.alive && distance(neutral.x, neutral.y, hero.x, hero.y) <= AGGRO && distance(neutral.home.x, neutral.home.y, hero.x, hero.y) <= LEASH)
    .sort((a, b) => distance(neutral.x, neutral.y, a.x, a.y) - distance(neutral.x, neutral.y, b.x, b.y))[0] || null;
}

// ================================================================================================================================================================================================================================================
// updateNeutral
// Um neutro vivo: persegue e ataca o herói que o provocou; sem alvo, volta pra casa e se cura.

function updateNeutral(sim, neutral, dt) {
  if (sim.time < neutral.stunUntil) return;
  const stats = NEUTRALS[neutral.type];
  const target = pickTarget(sim, neutral);
  neutral.targetId = target ? target.id : null;
  if (target) {
    if (gap(neutral, target) <= stats.range) {
      if (sim.time >= neutral.attackReadyAt) attack(sim, neutral, target, stats.damage, stats.cooldown, stats.missile, stats.missile === 'fire' ? 'fire' : 'physical');
    } else {
      moveToward(sim, neutral, target.x, target.y, stats.speed, dt);
    }
    return;
  }
  if (distance(neutral.x, neutral.y, neutral.home.x, neutral.home.y) > 0.2) moveToward(sim, neutral, neutral.home.x, neutral.home.y, stats.speed * 1.5, dt);
  neutral.hp = Math.min(neutral.maxHp, neutral.hp + neutral.maxHp * HOME_REGEN * dt);
}

// ================================================================================================================================================================================================================================================
// updateNeutrals
// Todos os neutros: renascem no tempo certo e agem.

export function updateNeutrals(sim, dt) {
  for (const neutral of sim.neutrals) {
    if (!neutral.alive) {
      if (sim.time >= neutral.respawnAt) {
        neutral.alive = true;
        neutral.hp = neutral.maxHp;
        neutral.x = neutral.home.x;
        neutral.y = neutral.home.y;
        neutral.targetId = null;
        if (neutral.boss) sim.emit({ type: 'feed', kind: 'bossSpawn', name: neutral.type });
      }
      continue;
    }
    updateNeutral(sim, neutral, dt);
  }
}
