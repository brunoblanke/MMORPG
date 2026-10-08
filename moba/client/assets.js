// moba/client/assets.js

// ================================================================================================================================================================================================================================================
// As sprites do jogo que o MOBA usa (o servidor serve gerador/saida): o herói é a folha do player (64 px,
// 9 quadros por direção: sul, norte, leste, oeste) e os minions, folhas de criatura do gerador.

export const SHEETS = {
  hero: { url: '/gerador/saida/personagens/players/player-masculino.png', size: 64, frames: 9 },
  melee: { url: '/gerador/saida/criaturas/humanoides/troll.png', size: 64, frames: 9 },
  ranged: { url: '/gerador/saida/criaturas/humanoides/orc.png', size: 64, frames: 9 }
};
export const FLOOR = '/gerador/saida/estrutura/pisos/piso-grama-2.png';
export const DIRECTION_ROW = { south: 0, north: 1, east: 2, west: 3 };

const images = new Map();

// ================================================================================================================================================================================================================================================
// image
// A imagem da url (carrega na 1ª vez).

export function image(url) {
  if (!images.has(url)) {
    const item = new Image();
    item.src = url;
    images.set(url, item);
  }
  return images.get(url);
}

// ================================================================================================================================================================================================================================================
// ready
// A imagem já carregou.

export function ready(item) {
  return !!item && item.complete && item.naturalWidth > 0;
}

// ================================================================================================================================================================================================================================================
// directionOf
// A linha da folha pelo vetor de direção (leste/oeste/norte/sul).

export function directionOf(facing) {
  if (Math.abs(facing.x) >= Math.abs(facing.y)) return facing.x >= 0 ? DIRECTION_ROW.east : DIRECTION_ROW.west;
  return facing.y >= 0 ? DIRECTION_ROW.south : DIRECTION_ROW.north;
}
