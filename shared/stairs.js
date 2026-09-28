// shared/stairs.js
//
// Geometria da escada (virada pro norte), pelo tipo da folha (gerador →
// Objetos → Tipo de escada). Numa escada em (x, y, z):
//   - o sqm (x-1, y-1, z+1), logo acima do pé, é o TOPO da escada: vira um
//     buraco (sem piso, coberto pelo próprio sprite) que leva de volta pra
//     baixo, em (x, y+1, z), logo à frente do pé;
//   - pisar nela leva pro andar de cima: a normal sai atrás do topo,
//     (x-1, y-2, z+1); a reta sai na frente dele, (x-1, y, z+1).
// Buraco comum em (x, y, z) leva pra (x+1, y+1, z-1).
//
// Nenhum dos dois impede borda: o piso vizinho solta borda normalmente no
// sqm. O buraco comum é um item sobre o chão (em geral ord 1); o topo de
// escada é invisível (o sprite da escada o cobre).

// ================================================================================================================================================================================================================================================
// toUpperLevel / toLowerLevel
//
// O andar de cima é montado deslocado 1 sqm pra cima e 1 pra esquerda (dá a
// impressão isométrica): o sqm (x, y, z+1) fica visualmente sobre o sqm
// (x+1, y+1, z). Converte uma posição pro sqm correspondente no andar vizinho.

export function toUpperLevel(x, y, z) {
  return { x: x - 1, y: y - 1, z: z + 1 };
}

export function toLowerLevel(x, y, z) {
  return { x: x + 1, y: y + 1, z: z - 1 };
}

// ================================================================================================================================================================================================================================================
// getStairTarget

export function getStairTarget(x, y, z, kind = 'normal') {
  return kind === 'reta' ? { x: x - 1, y, z: z + 1 } : { x: x - 1, y: y - 2, z: z + 1 };
}

// ================================================================================================================================================================================================================================================
// getStairTop

export function getStairTop(x, y, z) {
  return toUpperLevel(x, y, z);
}

// ================================================================================================================================================================================================================================================
// getStairTopTarget

export function getStairTopTarget(x, y, z) {
  return { x: x, y: y + 1, z: z };
}

// ================================================================================================================================================================================================================================================
// getHoleTarget

export function getHoleTarget(x, y, z) {
  return toLowerLevel(x, y, z);
}
