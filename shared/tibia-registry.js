// shared/tibia-registry.js

// Sprites do Tibia já gerados pelo editor (server/tibia-assets.js), lidos de
// data/tibia.json:
//   items: { [id]: { file, kind, fw, fh, frames, patterns, blocks, movable, hasVolume } }
//   creatures: { [nome]: { outfit, file, spriteSize, frames, color, defaultLvl, corpse, corpseSize, corpseFrames } }
// No mapa, um item vira o tipo 'Tibia:<id>' e um chão 'TibiaGround:<id>'.

export const TIBIA_REGISTRY_URL = 'data/tibia.json';
export const TIBIA_ITEM_PREFIX = 'Tibia:';
export const TIBIA_GROUND_PREFIX = 'TibiaGround:';
export const TIBIA_FRAME_MS = 500;

let registry = { items: {}, creatures: {} };

// ================================================================================================================================================================================================================================================
// setTibiaRegistry

export function setTibiaRegistry(data) {
  registry = {
    items: (data && data.items) || {},
    creatures: (data && data.creatures) || {}
  };
}

// ================================================================================================================================================================================================================================================
// getTibiaRegistry

export function getTibiaRegistry() {
  return registry;
}

// ================================================================================================================================================================================================================================================
// loadTibiaRegistry
// Busca o registro (sem ele, fica vazio: o jogo roda só com os sprites próprios).

export async function loadTibiaRegistry(url = TIBIA_REGISTRY_URL) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    setTibiaRegistry(response.ok ? await response.json() : null);
  } catch {
    setTibiaRegistry(null);
  }
  return registry;
}

// ================================================================================================================================================================================================================================================
// tibiaItemType
// Tipo no mapa de um item do Tibia: chão ou item comum.

export function tibiaItemType(id, kind) {
  return (kind === 'ground' ? TIBIA_GROUND_PREFIX : TIBIA_ITEM_PREFIX) + id;
}

// ================================================================================================================================================================================================================================================
// parseTibiaType
// 'Tibia:123' ou 'TibiaGround:123' (com ou sem o '_N' do id no jogo) →
// { id, ground }; qualquer outro tipo → null.

export function parseTibiaType(type) {
  if (typeof type !== 'string') return null;
  const ground = type.startsWith(TIBIA_GROUND_PREFIX);
  if (!ground && !type.startsWith(TIBIA_ITEM_PREFIX)) return null;
  const id = parseInt(type.slice(ground ? TIBIA_GROUND_PREFIX.length : TIBIA_ITEM_PREFIX.length), 10);
  return Number.isInteger(id) ? { id, ground } : null;
}

// ================================================================================================================================================================================================================================================
// isTibiaGround

export function isTibiaGround(type) {
  const parsed = parseTibiaType(type);
  return !!parsed && parsed.ground;
}

// ================================================================================================================================================================================================================================================
// getTibiaItem
// Definição do item pelo tipo do mapa ('Tibia:123') ou id de jogo ('Tibia:123_4').

export function getTibiaItem(type) {
  const parsed = parseTibiaType(type);
  return parsed ? registry.items[parsed.id] || null : null;
}

// ================================================================================================================================================================================================================================================
// getTibiaCreature

export function getTibiaCreature(name) {
  return registry.creatures[name] || null;
}

// ================================================================================================================================================================================================================================================
// tibiaFrameRect
// Recorte do quadro do item no sqm (x, y, z) no instante `timestamp`: a linha
// é a variação daquela posição (como no Tibia, o chão alterna pelo sqm) e a
// coluna, o quadro da animação.

export function tibiaFrameRect(def, x, y, z, timestamp) {
  const [px, py, pz] = def.patterns || [1, 1, 1];
  const mod = (value, n) => ((value % n) + n) % n;
  const row = (mod(z, pz) * py + mod(y, py)) * px + mod(x, px);
  const frame = def.frames > 1 ? Math.floor(timestamp / TIBIA_FRAME_MS) % def.frames : 0;
  return { sx: frame * def.fw, sy: row * def.fh, sw: def.fw, sh: def.fh };
}
