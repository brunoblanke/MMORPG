// js/systems/effect-command.js

import { EFFECTS } from '../../shared/effects.js';
import { newItem } from '../../shared/items.js';

const AHEAD = { norte: [0, -1], sul: [0, 1], leste: [1, 0], oeste: [-1, 0] };
const TEST_FISH = 'itens/peixes/fish';

// ================================================================================================================================================================================================================================================
// effectCommand
// O player diz !efeito nome: o efeito aparece no sqm na frente dele e um peixe cai ali (pra conferir como cada efeito fica no drop). Devolve true se o texto era o comando.

export function effectCommand(sim, player, text) {
  const [word, name] = String(text || '').trim().split(/\s+/);
  if (!word || word.toLowerCase() !== '!efeito') return false;
  if (!name || !EFFECTS[name]) return true;
  const [dx, dy] = AHEAD[player.direction] || AHEAD.sul;
  const x = player.x + dx;
  const y = player.y + dy;
  const z = player.z || 0;
  if (!sim.movement.isInsideMap(x, y)) return true;
  sim.spells.showEffect(x, y, name, undefined, z);
  const { inventory } = sim;
  inventory.mergeGroundStack(inventory.spawnGroundItem(newItem(inventory.nextUid(), TEST_FISH, 1), x, y, z));
  return true;
}
