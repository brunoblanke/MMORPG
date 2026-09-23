// shared/constants.js

export const TILE = 32;
export const GRID_WIDTH = 250;
export const GRID_HEIGHT = 250;

// Deslocamento visual (px) por nível de "step" ao empilhar itens/objetos no mesmo tile.
export const STACK_OFFSET = 7;

// Duração (ms) de um tick da simulação: tudo no jogo (passos, ataques) acontece
// de TICK_MS em TICK_MS.
export const TICK_MS = 50;

// Duração (ms) de um ciclo completo de animação de objeto/parede com múltiplos frames.
export const ANIMATION_CYCLE_MS = 1000;

// Andares do mapa: 0 é o térreo, FLOOR_MAX andares pra cima e FLOOR_MIN pra
// baixo. Pra cima ou pra baixo, as regras são as mesmas (pilha, escada,
// buraco); fora dessa faixa não existe andar.
export const FLOOR_MIN = -5;
export const FLOOR_MAX = 5;
export const GROUND_FLOOR = 0;

// ================================================================================================================================================================================================================================================
// isValidFloor

export function isValidFloor(z) {
  return Number.isInteger(z) && z >= FLOOR_MIN && z <= FLOOR_MAX;
}

// ================================================================================================================================================================================================================================================
// getAllFloors
// Todos os andares, do mais baixo pro mais alto.

export function getAllFloors() {
  const floors = [];
  for (let z = FLOOR_MIN; z <= FLOOR_MAX; z++) floors.push(z);
  return floors;
}
