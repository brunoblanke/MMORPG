// shared/stairs.js
//
// Geometria da escada, pelo tipo (assets.js → stairKind: com altura,
// normal; sem, reta) e pra onde ela sobe (facing: 'norte', o padrão, 'leste',
// 'sul' ou 'oeste'; o exemplo abaixo é a virada pro norte). Numa escada em
// (x, y, z):
//   - o sqm (x-1, y-1, z+1), logo acima do pé, é o TOPO da escada: vira um
//     buraco (sem piso, coberto pelo próprio sprite) que leva de volta pra
//     baixo: na normal, em (x, y+1, z), logo à frente do pé; na reta, no
//     próprio pé (x, y, z), que não sobe sozinho;
//   - a normal sobe ao pisar e sai atrás do topo, (x-1, y-2, z+1); a reta
//     só sobe quando usada (duplo clique) e sai na frente dele, (x-1, y, z+1).
// Buraco comum em (x, y, z) leva pro mesmo sqm no andar de baixo, (x, y, z-1).
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
// facingStep
// O passo [dx, dy] pra onde a escada sobe.

const FACING_STEPS = { norte: [0, -1], leste: [1, 0], sul: [0, 1], oeste: [-1, 0] };

function facingStep(facing) {
  return FACING_STEPS[facing] || FACING_STEPS.norte;
}

// ================================================================================================================================================================================================================================================
// getStairTarget

export function getStairTarget(x, y, z, kind = 'normal', facing = 'norte') {
  const [dx, dy] = facingStep(facing);
  return kind === 'reta' ? toUpperLevel(x - dx, y - dy, z) : toUpperLevel(x + dx, y + dy, z);
}

// ================================================================================================================================================================================================================================================
// getStairTop

export function getStairTop(x, y, z) {
  return toUpperLevel(x, y, z);
}

// ================================================================================================================================================================================================================================================
// getStairTopTarget

export function getStairTopTarget(x, y, z, kind = 'normal', facing = 'norte') {
  const [dx, dy] = facingStep(facing);
  return kind === 'reta' ? { x, y, z } : { x: x - dx, y: y - dy, z };
}

// ================================================================================================================================================================================================================================================
// getHoleTarget

export function getHoleTarget(x, y, z) {
  return toLowerLevel(x, y, z);
}
