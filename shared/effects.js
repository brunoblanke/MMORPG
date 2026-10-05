// shared/effects.js

// Efeitos mágicos do Tibia (animações de um sqm, gerador/saida/efeitos):
// fogo de área, explosão, energia, brilho azul de cura, bola preta da morte,
// veneno e a fumacinha. Cada um tem `frames` quadros de 32 px, um a cada
// EFFECT_FRAME_MS.

export const EFFECTS = {
  poff: { id: 3, frames: 4 },
  explosion: { id: 5, frames: 8 },
  fire: { id: 7, frames: 8 },
  energy: { id: 12, frames: 4 },
  heal: { id: 13, frames: 5 },
  death: { id: 18, frames: 8 },
  poison: { id: 21, frames: 4 }
};
export const EFFECT_FRAME_MS = 100;

// ================================================================================================================================================================================================================================================
// effectUrl

export function effectUrl(name) {
  return EFFECTS[name] ? `/gerador/saida/efeitos/efeito-${EFFECTS[name].id}.png` : null;
}
