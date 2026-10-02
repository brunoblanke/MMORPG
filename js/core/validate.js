// js/core/validate.js

import { getAsset, splitType, objectIdType, objectUse, creatureBehavior } from '../../shared/assets.js';
import { STARTER_KIT } from '../../shared/items.js';
import { npcDefFromAsset } from '../../shared/npcs.js';
import { RUNES, BLANK_RUNE } from '../../shared/spells.js';

// Conferência do mundo ao subir o servidor: o que está no mapa e no gerador
// e não vai funcionar no jogo (objeto ou criatura sem folha no gerador,
// escada ou buraco sem piso no destino, placa sem texto, baú sem itens, NPC
// que não é NPC ou que leva pra lugar sem piso, item vendido ou do loot que
// não existe, item do kit inicial ou runa que falta). Devolve os avisos, um por
// linha; não muda nada.

const MAX_PLACES = 5;

// ================================================================================================================================================================================================================================================
// hasAsset

function hasAsset(type) {
  return !!getAsset(splitType(type).asset);
}

// ================================================================================================================================================================================================================================================
// places
// "x,y,z" dos primeiros lugares e quantos mais há.

function places(list) {
  const shown = list.slice(0, MAX_PLACES).map(([x, y, z]) => `${x},${y},${z}`).join(' · ');
  return list.length > MAX_PLACES ? `${shown} · e mais ${list.length - MAX_PLACES}` : shown;
}

// ================================================================================================================================================================================================================================================
// groupBy
// Agrupa [chave, x, y, z] por chave: Map(chave → [[x, y, z]…]).

function groupBy(entries) {
  const groups = new Map();
  for (const [key, x, y, z] of entries) {
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push([x, y, z]);
  }
  return groups;
}

// ================================================================================================================================================================================================================================================
// validateWorld

export function validateWorld(sim) {
  const warnings = [];
  const mapData = sim.mapData || {};

  const missing = (mapData.objetosData || [])
    .filter(([type]) => typeof type === 'string' && !type.startsWith('Border:') && !hasAsset(type))
    .map(([type, x, y, z]) => [type, x, y, z]);
  for (const [type, at] of groupBy(missing)) warnings.push(`Objeto sem folha no gerador: ${type} (${at.length}×) em ${places(at)}`);

  const missingEnemies = (mapData.enemyData || []).filter(e => e[5] && !hasAsset(e[5])).map(e => [e[5], e[0], e[1], e[2]]);
  for (const [type, at] of groupBy(missingEnemies)) warnings.push(`Criatura sem folha no gerador: ${type} em ${places(at)}`);

  const deadEnds = [...sim.world.transitions.values()]
    .filter(obj => Number.isInteger(obj.targetZ) && !sim.world.hasFloorAt(obj.targetX, obj.targetY, obj.targetZ))
    .map(obj => [objectIdType(obj.id), obj.x, obj.y, obj.z || 0]);
  for (const [type, at] of groupBy(deadEnds)) warnings.push(`Escada ou buraco sem piso no destino: ${type} em ${places(at)}`);

  for (const obj of sim.objects) {
    const type = objectIdType(obj.id);
    const use = objectUse(type);
    const where = `${obj.x},${obj.y},${obj.z || 0}`;
    if ((use === 'placa' || use === 'livro') && !(obj.data && obj.data.texto) && !(obj.itemData && obj.itemData.texto)) {
      warnings.push(`${use === 'placa' ? 'Placa' : 'Livro'} sem texto: ${type} em ${where}`);
    }
    if (use === 'bau-quest' && !(obj.data && Array.isArray(obj.data.itens) && obj.data.itens.length)) {
      warnings.push(`Baú de quest sem itens: ${type} em ${where}`);
    }
    for (const entry of (obj.data && Array.isArray(obj.data.itens) ? obj.data.itens : [])) {
      if (entry && entry.tipo && !hasAsset(entry.tipo)) warnings.push(`Item que não existe dentro de ${type} em ${where}: ${entry.tipo}`);
    }
  }

  for (const [type, x, y, z = 0] of mapData.npcData || []) {
    const where = `${x},${y},${z}`;
    if (!hasAsset(type)) {
      warnings.push(`NPC sem folha no gerador: ${type} em ${where}`);
      continue;
    }
    if (creatureBehavior(type) !== 'npc') {
      warnings.push(`NPC posto no mapa sem comportamento NPC no gerador: ${type} em ${where}`);
      continue;
    }
    const def = npcDefFromAsset(type, { x, y, z });
    const dest = def.vocation && def.vocation.destination;
    if (def.vocation && !dest) warnings.push(`NPC de vocação sem destino: ${type}`);
    if (dest && !sim.world.hasFloorAt(dest.x, dest.y, dest.z)) warnings.push(`NPC de vocação leva pra lugar sem piso: ${type} → ${dest.x},${dest.y},${dest.z}`);
    const asset = getAsset(type);
    const sold = (asset.propriedades && asset.propriedades.conversa && asset.propriedades.conversa.vende) || [];
    for (const entry of sold) {
      if (entry && entry.tipo && !hasAsset(entry.tipo)) warnings.push(`NPC vende item que não existe: ${type} → ${entry.tipo}`);
    }
  }

  const creatures = new Set([...(mapData.enemyData || []).map(e => e[5]).filter(Boolean)]);
  for (const creature of creatures) {
    const loot = (getAsset(creature) && getAsset(creature).propriedades && getAsset(creature).propriedades.loot) || [];
    for (const entry of loot) {
      if (entry && entry.tipo && !hasAsset(entry.tipo)) warnings.push(`Loot com item que não existe: ${creature} → ${entry.tipo}`);
    }
  }

  const kitTypes = [...Object.values(STARTER_KIT.equip), ...STARTER_KIT.mochila.map(e => e.tipo)];
  const missingKit = kitTypes.filter(type => !hasAsset(type));
  if (missingKit.length) warnings.push(`Kit inicial: falta criar no gerador ${missingKit.join(', ')}`);

  const missingRunes = [BLANK_RUNE, ...Object.keys(RUNES)].filter(type => !hasAsset(type));
  if (missingRunes.length) warnings.push(`Runas: falta criar no gerador ${missingRunes.join(', ')}`);

  return warnings;
}
