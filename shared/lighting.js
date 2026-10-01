// shared/lighting.js

// Luz como no Tibia: dia e noite no chão (andar 0 pra cima) e escuro total
// no subsolo. A luz geral (ambient) vai de 0 (breu) a 1 (dia claro); fontes
// de luz (player, tocha, objetos com Luz no gerador) clareiam em volta, com
// queda suave até o raio.

export const DAY_MS = 10 * 60 * 1000;
export const NIGHT_AMBIENT = 0.08;
export const UNDERGROUND_AMBIENT = 0;
export const PLAYER_LIGHT = 2;
export const VISIBLE_LIGHT = 0.35;

// ================================================================================================================================================================================================================================================
// dayPhase
// Momento do dia (0 = meia-noite, 0,5 = meio-dia) no relógio timeMs. Todos
// os jogadores usam o relógio real, então veem a mesma hora.

export function dayPhase(timeMs) {
  return ((timeMs % DAY_MS) + DAY_MS) % DAY_MS / DAY_MS;
}

// ================================================================================================================================================================================================================================================
// ambientLight
// Luz geral no andar z: no subsolo, UNDERGROUND_AMBIENT; no chão, de
// NIGHT_AMBIENT (noite) a 1 (dia), passando pelo amanhecer e o entardecer.

export function ambientLight(timeMs, z) {
  if (z < 0) return UNDERGROUND_AMBIENT;
  const sun = -Math.cos(2 * Math.PI * dayPhase(timeMs));
  const t = Math.max(0, Math.min(1, (sun + 0.2) / 0.45));
  const smooth = t * t * (3 - 2 * t);
  return NIGHT_AMBIENT + (1 - NIGHT_AMBIENT) * smooth;
}

// ================================================================================================================================================================================================================================================
// lightAt
// Luz no sqm (x, y): a geral ou a da fonte mais forte ali (queda linear até
// o raio). sources: [{ x, y, radius }].

export function lightAt(x, y, ambient, sources) {
  let light = ambient;
  for (const source of sources) {
    const reach = source.radius + 0.5;
    const d = Math.hypot(x - source.x, y - source.y);
    if (d < reach) light = Math.max(light, 1 - d / reach);
  }
  return Math.min(1, light);
}
