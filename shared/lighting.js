// shared/lighting.js

// Luz como no Tibia: dia e noite no chão (andar 0 pra cima) e escuro total
// no subsolo. A luz geral (ambient) vai de 0 (breu) a 1 (dia claro); fontes
// de luz (player, tocha, objetos com Luz no gerador) clareiam em volta, com
// queda suave até o raio.

// Dia e noite do Tibia (TFS, game.cpp): um dia do jogo dura 1 hora real,
// acompanhando os minutos do relógio (cada minuto do jogo são 2,5 s). A luz
// vai de LIGHT_NIGHT (noite) a LIGHT_DAY (dia): amanhece das 6h às 8h e
// anoitece das 18h às 20h, em linha reta; o resto é dia ou noite cheia.
export const DAY_MS = 60 * 60 * 1000;
export const LIGHT_DAY = 250;
export const LIGHT_NIGHT = 40;
export const SUNRISE = 360;
export const DAYTIME = 480;
export const SUNSET = 1080;
export const NIGHTTIME = 1200;
export const NIGHT_AMBIENT = LIGHT_NIGHT / LIGHT_DAY;
export const UNDERGROUND_AMBIENT = 0;
export const PLAYER_LIGHT = 2;
export const VISIBLE_LIGHT = 0.35;

// ================================================================================================================================================================================================================================================
// worldTime
// A hora do jogo em minutos (0 = meia-noite, 720 = meio-dia) no relógio
// timeMs. Todos os jogadores usam o relógio real, então veem a mesma hora.

export function worldTime(timeMs) {
  return (((timeMs % DAY_MS) + DAY_MS) % DAY_MS) / DAY_MS * 1440;
}

// ================================================================================================================================================================================================================================================
// ambientLight
// Luz geral no andar z: no subsolo, UNDERGROUND_AMBIENT; no chão, a luz do
// Tibia na hora do jogo, de NIGHT_AMBIENT a 1.

export function ambientLight(timeMs, z) {
  if (z < 0) return UNDERGROUND_AMBIENT;
  const time = worldTime(timeMs);
  let level = LIGHT_DAY;
  if (time >= SUNRISE && time <= DAYTIME) level = LIGHT_NIGHT + (time - SUNRISE) / (DAYTIME - SUNRISE) * (LIGHT_DAY - LIGHT_NIGHT);
  else if (time >= SUNSET && time <= NIGHTTIME) level = LIGHT_DAY - (time - SUNSET) / (NIGHTTIME - SUNSET) * (LIGHT_DAY - LIGHT_NIGHT);
  else if (time > NIGHTTIME || time < SUNRISE) level = LIGHT_NIGHT;
  return level / LIGHT_DAY;
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
