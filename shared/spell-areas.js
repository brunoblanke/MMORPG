// shared/spell-areas.js

// A forma das magias de área, só em deslocamentos (dx, dy) a partir de quem
// lança: usada pelo jogo (systems/creature-powers.js, que ainda corta pelo mapa
// e pelas paredes) e pelo simulador (shared/spell-plan.js).

export const FACING = { norte: [0, -1], sul: [0, 1], leste: [1, 0], oeste: [-1, 0] };
export const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

// ================================================================================================================================================================================================================================================
// ringArea
// O aro de raio r (os sqms a r sqm do centro, sem o miolo).

export function ringArea(r) {
  const tiles = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.hypot(dx, dy);
      if (d >= r - 0.5 && d < r + 0.5) tiles.push([dx, dy]);
    }
  }
  return tiles;
}

// ================================================================================================================================================================================================================================================
// lineTiles
// Os sqms da linha reta de a até b (sem o de a, com o de b).

export function lineTiles(a, b) {
  const tiles = [];
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - x);
  const dy = Math.abs(b.y - y);
  const sx = b.x > x ? 1 : -1;
  const sy = b.y > y ? 1 : -1;
  let err = dx - dy;
  while (x !== b.x || y !== b.y) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
    tiles.push([x, y]);
  }
  return tiles;
}

// ================================================================================================================================================================================================================================================
// facingOf
// Pra onde quem está virado (norte, sul, leste ou oeste) aponta: [ux, uy] e o passo (em 45°).

export function facingOf(direction) {
  const [ux, uy] = FACING[direction] || FACING.sul;
  return { step: Math.round(Math.atan2(uy, ux) / (Math.PI / 4)), ux, uy };
}

// ================================================================================================================================================================================================================================================
// waveOffsets
// O leque pra frente: a largura de cada fileira vem de attack.widths (ex. 1-3-3-5) ou, sem
// elas, vai de 1 sqm perto até 2 × abertura + 1.

export function waveOffsets(attack, direction) {
  const { ux, uy } = facingOf(direction);
  const widths = attack.widths || [];
  const half = (along) => widths.length
    ? (widths[Math.min(widths.length, Math.max(1, Math.round(along))) - 1] - 1) / 2
    : Math.min(attack.spread, Math.floor(along / 2));
  const tiles = [];
  for (let ry = -attack.length; ry <= attack.length; ry++) {
    for (let rx = -attack.length; rx <= attack.length; rx++) {
      const along = rx * ux + ry * uy;
      const across = Math.abs(rx * uy - ry * ux);
      if (along < 1 || along > attack.length || across > half(along) + 0.5) continue;
      tiles.push([rx, ry]);
    }
  }
  return tiles;
}

// ================================================================================================================================================================================================================================================
// beamOffsets
// A linha reta de attack.length sqm pra frente.

export function beamOffsets(attack, direction) {
  const { ux, uy } = facingOf(direction);
  return Array.from({ length: attack.length }, (_, i) => [ux * (i + 1), uy * (i + 1)]);
}

// ================================================================================================================================================================================================================================================
// sweepOffsets
// Os 3 sqms colados na frente (a direção e as duas do lado).

export function sweepOffsets(direction) {
  const { step } = facingOf(direction);
  return [-1, 0, 1].map(turn => [Math.round(Math.cos((step + turn) * Math.PI / 4)), Math.round(Math.sin((step + turn) * Math.PI / 4))]);
}
