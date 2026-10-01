// js/views/look.js

import { displayName, objectIdType, isItemType } from '../../shared/assets.js';
import { itemInfo, weightOf } from '../../shared/items.js';

// Shift + clique: o que o player vê no item, na criatura ou no player (vai
// pro centro da tela como mensagem verde).

// ================================================================================================================================================================================================================================================
// describeItem
// item: { type, count?, items? } (do inventário, de um container ou do chão).

export function describeItem(item) {
  const info = itemInfo(item.type);
  const name = item.count > 1 ? `${item.count} ${info.name}` : info.name;
  const attrs = [
    info.atk && `Atk ${info.atk}`,
    info.def && `Def ${info.def}`,
    info.ml && `ML +${info.ml}`,
    info.speed && `Speed +${info.speed}`,
    info.size && `Vol ${info.size}`
  ].filter(Boolean);
  const lines = [`${name}${attrs.length ? ` (${attrs.join(', ')})` : ''}`];
  if (info.burn) {
    const left = Math.ceil((item.fuel ?? info.burn * 1000) / 60000);
    lines.push(`${item.lit ? 'Acesa' : 'Apagada'}, queima por mais ${left} min.`);
  }
  if (info.heal && info.heal.hp[1] > 0) lines.push(`Recupera ${info.heal.hp[0]}–${info.heal.hp[1]} de vida.`);
  if (info.heal && info.heal.mana[1] > 0) lines.push(`Recupera ${info.heal.mana[0]}–${info.heal.mana[1]} de mana.`);
  lines.push(`${item.count > 1 ? 'Pesam' : 'Pesa'} ${formatWeight(weightOf(item))} oz.`);
  return lines.join('\n');
}

// ================================================================================================================================================================================================================================================
// formatWeight

function formatWeight(oz) {
  return Number(oz).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

// ================================================================================================================================================================================================================================================
// describeEntity
// Criatura, player (self: o próprio) ou cadáver.

export function describeEntity(entity, self = null) {
  if (entity.isCorpse) {
    const name = entity.isPlayer || entity.corpseIsPlayer ? entity.name : displayName(entity.creature || entity.corpseCreature);
    return `Corpo de ${name || 'alguém'}`;
  }
  if (entity.isPlayer) return `${entity.name} (Level ${entity.lvl})`;
  if (entity.isNpc) return entity.name;
  return `${displayName(entity.creature)}${entity.lvl ? ` (Level ${entity.lvl})` : ''}`;
}

// ================================================================================================================================================================================================================================================
// describeGroundObject
// Objeto do chão: só item (ou cadáver) tem descrição; o resto devolve null.

export function describeGroundObject(obj) {
  if (obj.isCorpse) return describeEntity(obj);
  const type = objectIdType(obj.id);
  if (!isItemType(type)) return null;
  return describeItem(obj.itemData || { type, count: obj.count, lit: obj.lit, fuel: obj.fuel });
}
