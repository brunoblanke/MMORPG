// shared/effects.js

// Efeitos mágicos do Tibia (gerador/saida/efeitos, gerados por
// ferramentas/efeitos.js): `frames` quadros de `size` px lado a lado, um a
// cada `ms`. Os de 64 px saem do sqm pra cima e pra esquerda.
export const EFFECTS = {
  poff: { id: 3, frames: 8, size: 32, ms: 50 },
  explosion: { id: 7, frames: 14, size: 64, ms: 59 },
  fire: { id: 16, frames: 9, size: 64, ms: 100 },
  energy: { id: 12, frames: 17, size: 32, ms: 40 },
  heal: { id: 13, frames: 22, size: 32, ms: 40 },
  death: { id: 18, frames: 11, size: 32, ms: 81 },
  poison: { id: 21, frames: 12, size: 32, ms: 50 },
  ice: { id: 43, frames: 15, size: 64, ms: 75 },
  earth: { id: 46, frames: 12, size: 64, ms: 86 },
  holy: { id: 40, frames: 7, size: 64, ms: 100 }
};

// Projéteis do Tibia (gerador/saida/projeteis): as 9 direções em 3×3 de
// `size` px. A chave é o tipo do dano, a munição ou a runa.
export const MISSILES = {
  spear: { id: 1, size: 64 },
  bolt: { id: 2, size: 32 },
  arrow: { id: 3, size: 32 },
  fire: { id: 4, size: 32 },
  energy: { id: 5, size: 32 },
  'poison-arrow': { id: 6, size: 32 },
  'burst-arrow': { id: 7, size: 32 },
  physical: { id: 10, size: 32 },
  death: { id: 11, size: 32 },
  poison: { id: 15, size: 32 },
  'sudden-death': { id: 32, size: 32 },
  ice: { id: 37, size: 32 },
  holy: { id: 38, size: 32 },
  earth: { id: 39, size: 32 },
  explosion: { id: 41, size: 32 }
};

// ================================================================================================================================================================================================================================================
// effectUrl

export function effectUrl(name) {
  return EFFECTS[name] ? `/gerador/saida/efeitos/efeito-${EFFECTS[name].id}.png` : null;
}

// ================================================================================================================================================================================================================================================
// missileUrl

export function missileUrl(name) {
  return MISSILES[name] ? `/gerador/saida/projeteis/projetil-${MISSILES[name].id}.png` : null;
}

// ================================================================================================================================================================================================================================================
// missileDirection
// A direção do projétil no 3×3 da imagem (coluna, linha), como no Tibia: reto
// quando o desvio é pequeno, na diagonal quando é perto de 45°.

export function missileDirection(dx, dy) {
  if (!dx && !dy) return [1, 1];
  const angle = Math.atan2(dy, dx);
  const step = Math.round(angle / (Math.PI / 4));
  const col = [2, 2, 1, 0, 0, 0, 1, 2][(step + 8) % 8];
  const row = [1, 2, 2, 2, 1, 0, 0, 0][(step + 8) % 8];
  return [col, row];
}
