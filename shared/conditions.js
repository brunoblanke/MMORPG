// shared/conditions.js

// Estados (condições) de player e criatura, como no Tibia: os de dano tiram
// `damage` de vida a cada `interval`, `ticks` vezes (envenenado, queimando,
// eletrificado); os de velocidade somam `speed` até acabar o tempo (lento,
// rápido). icon e color: o ícone na janela de vida e a cor do dano.

export const CONDITIONS = {
  poison: { name: 'Envenenado', icon: '☠', color: '#4ade80', interval: 4000 },
  fire: { name: 'Queimando', icon: '♨', color: '#fb923c', interval: 4000 },
  energy: { name: 'Eletrificado', icon: 'ϟ', color: '#c084fc', interval: 4000 },
  slow: { name: 'Lento', icon: '◔', color: '#94a3b8' },
  haste: { name: 'Rápido', icon: '»', color: '#facc15' }
};

// Campos no chão: pisar dá `hit` de dano na hora e o estado do campo
// (`damage` × `ticks`). Os criados por runa ou criatura somem em `ms`; os
// postos no mapa pelo editor ficam.
export const FIELDS = {
  'itens/itens-encantados/fire-field': { kind: 'fire', hit: 20, damage: 10, ticks: 7, ms: 45000 },
  'itens/itens-encantados/poison-field': { kind: 'poison', hit: 5, damage: 5, ticks: 8, ms: 45000 },
  'itens/itens-encantados/energy-field': { kind: 'energy', hit: 30, damage: 25, ticks: 3, ms: 30000 }
};

// Munição que deixa estado no alvo atingido.
export const AMMO_CONDITIONS = {
  'itens/municao/poison-arrow': { kind: 'poison', damage: 3, ticks: 6 }
};

// ================================================================================================================================================================================================================================================
// damageColor
// Cor do número de dano do tipo (vermelho sem tipo).

export function damageColor(kind) {
  return (CONDITIONS[kind] && CONDITIONS[kind].color) || null;
}
