// js/systems/effect-command.js

import { EFFECTS, isEffect } from '../../shared/effects.js';

// ================================================================================================================================================================================================================================================
// effectCommand
// O player diz !efeito nome: o efeito aparece no sqm dele (pra conferir como cada efeito fica). Devolve true se o texto era o comando.

export function effectCommand(sim, player, text) {
  const [word, name] = String(text || '').trim().split(/\s+/);
  if (!word || word.toLowerCase() !== '!efeito') return false;
  if (name && EFFECTS[name] && isEffect(name)) sim.spells.showEffect(player.x, player.y, name, undefined, player.z || 0);
  return true;
}
