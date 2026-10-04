// js/systems/quests.js

import { displayName } from '../../shared/assets.js';
import { countInBag, sell, give, giveItem } from './trade.js';

// Missões dadas por NPC (shared/npcs.js → questsFrom). O player aceita na
// conversa e o progresso fica nele (player.missions[id]: { state 'active'
// ou 'done', name, kind, target, need, count }), guardado com o personagem.
// Trazer item: conta o que está na mochila na hora de entregar. Matar: cada
// criatura do tipo que morre conta pra quem bateu nela (countKill). Ao
// entregar, o NPC fica com os itens e dá a recompensa (item, XP e moedas).

// ================================================================================================================================================================================================================================================
// questState

export function questState(player, quest) {
  return (player.missions && player.missions[quest.id]) || null;
}

// ================================================================================================================================================================================================================================================
// startQuest

export function startQuest(sim, player, quest) {
  player.missions = player.missions || {};
  player.missions[quest.id] = { state: 'active', name: quest.name, kind: quest.kind, target: quest.target, need: quest.amount, count: 0 };
  sim.emit({ type: 'message', playerId: player.id, text: `Missão: ${quest.name} (${progressText(player, quest)}).`, kind: 'info' });
}

// ================================================================================================================================================================================================================================================
// progressOf
// Quanto o player já tem da missão (itens na mochila ou criaturas mortas).

export function progressOf(player, quest) {
  const state = questState(player, quest);
  if (quest.kind === 'item') return Math.min(quest.amount, countInBag(player, quest.target));
  return state ? Math.min(quest.amount, state.count) : 0;
}

// ================================================================================================================================================================================================================================================
// progressText

export function progressText(player, quest) {
  return `${progressOf(player, quest)}/${quest.amount} ${displayName(quest.target)}`;
}

// ================================================================================================================================================================================================================================================
// completeQuest
// Entrega: tira os itens pedidos, dá a recompensa e marca como feita.

export function completeQuest(sim, player, quest) {
  if (quest.kind === 'item') sell(sim, player, quest.target, 0, quest.amount);
  player.missions[quest.id].state = 'done';
  if (quest.reward) giveItem(sim, player, quest.reward.type, quest.reward.count);
  if (quest.money) give(sim, player, quest.money);
  if (quest.xp) {
    const levels = player.gainXp(quest.xp);
    sim.emit({ type: 'xp', playerId: player.id, x: player.x, y: player.y, amount: quest.xp });
    if (levels > 0) sim.emit({ type: 'levelUp', playerId: player.id, lvl: player.lvl });
  }
  sim.emit({ type: 'message', playerId: player.id, text: `Missão concluída: ${quest.name}.`, kind: 'info' });
}

// ================================================================================================================================================================================================================================================
// countKill
// A criatura morreu: conta nas missões de matar de cada player que bateu nela.

export function countKill(sim, enemy) {
  for (const playerId of (enemy.damageBy || new Map()).keys()) {
    const player = sim.getPlayer(playerId);
    if (!player || !player.missions) continue;
    for (const mission of Object.values(player.missions)) {
      if (mission.state !== 'active' || mission.kind !== 'kill' || mission.target !== enemy.creature || mission.count >= mission.need) continue;
      mission.count++;
      sim.emit({ type: 'message', playerId: player.id, text: `${mission.name}: ${mission.count}/${mission.need} ${displayName(mission.target)}.`, kind: 'info' });
    }
  }
}
