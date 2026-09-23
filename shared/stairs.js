// shared/stairs.js
//
// Geometria fixa da escada (por enquanto só virada pro norte). Numa escada
// em (x, y, z):
//   - pisar nela leva pra (x-1, y-2, z+1), o piso logo depois do topo;
//   - o sqm (x-1, y-1, z+1) é o TOPO da escada: vira um buraco (sem piso,
//     coberto pelo próprio sprite da escada) que leva de volta pra baixo,
//     em (x, y+1, z), logo à frente do pé da escada.
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

export function getStairTarget(x, y, z) {
  return { x: x - 1, y: y - 2, z: z + 1 };
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
