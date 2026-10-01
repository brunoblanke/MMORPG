// js/net/delta.js

// Estado em diferenças: o servidor guarda, por conexão, o último estado que
// mandou e envia só o que mudou (encodeDelta); o navegador guarda o último
// estado montado e aplica a diferença (decodeDelta), chegando ao mesmo
// estado completo de sempre (protocol.js → applyState).
//
// Listas com id (players, enemies, npcs, corpses, items): cada entrada nova
// ou que mudou vai com o id e só os campos alterados ($d: campos que
// sumiram); as que saíram vão em gone. A ordem da lista não importa. O resto do estado (you, doors, dug)
// vai inteiro, só quando muda.

const KEYED = ['players', 'enemies', 'npcs', 'corpses', 'items'];

// ================================================================================================================================================================================================================================================
// same

function same(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

// ================================================================================================================================================================================================================================================
// diffEntity
// Campos de next que mudaram em relação a prev (null se nenhum).

function diffEntity(prev, next) {
  if (!prev) return { ...next };
  let changed = null;
  for (const key of Object.keys(next)) {
    if (next[key] === undefined || same(prev[key], next[key])) continue;
    changed = changed || { id: next.id };
    changed[key] = next[key];
  }
  const gone = Object.keys(prev).filter(key => prev[key] !== undefined && next[key] === undefined);
  if (gone.length) {
    changed = changed || { id: next.id };
    changed.$d = gone;
  }
  return changed;
}

// ================================================================================================================================================================================================================================================
// encodeDelta
// A diferença entre o último estado mandado (prev, ou null na 1ª vez) e o
// atual (next). Sem diferença numa parte, ela nem vai.

export function encodeDelta(prev, next) {
  const delta = {};
  for (const key of Object.keys(next)) {
    if (!KEYED.includes(key)) {
      if (!prev || !same(prev[key], next[key])) delta[key] = next[key];
      continue;
    }
    const before = new Map((prev && prev[key] || []).map(entry => [entry.id, entry]));
    const changed = [];
    for (const entry of next[key]) {
      const diff = diffEntity(before.get(entry.id), entry);
      before.delete(entry.id);
      if (diff) changed.push(diff);
    }
    const gone = [...before.keys()];
    if (changed.length || gone.length) delta[key] = { changed, gone };
  }
  return delta;
}

// ================================================================================================================================================================================================================================================
// decodeDelta
// O estado completo a partir do anterior (prev) e da diferença recebida.

export function decodeDelta(prev, delta) {
  const state = { ...(prev || {}) };
  for (const [key, part] of Object.entries(delta)) {
    if (!KEYED.includes(key)) {
      state[key] = part;
      continue;
    }
    const byId = new Map((state[key] || []).map(entry => [entry.id, entry]));
    for (const id of part.gone) byId.delete(id);
    for (const change of part.changed) {
      const { $d, ...fields } = change;
      const entry = { ...(byId.get(change.id) || {}), ...fields };
      if ($d) for (const field of $d) delete entry[field];
      byId.set(change.id, entry);
    }
    state[key] = [...byId.values()];
  }
  for (const key of KEYED) if (!state[key]) state[key] = [];
  return state;
}
