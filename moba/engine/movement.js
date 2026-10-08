// moba/engine/movement.js

import { ARENA } from './config.js';
import { clamp, normalize, pushOutOfRect, distance } from './geometry.js';
import { WALLS } from './map.js';

// ================================================================================================================================================================================================================================================
// speedOf
// A velocidade do herói agora (base, com haste e lentidão).

export function speedOf(sim, hero, base) {
  let speed = base;
  if (sim.time < hero.hasteUntil) speed *= hero.hasteFactor;
  if (sim.time < hero.slowUntil) speed *= hero.slowFactor;
  return speed;
}

// ================================================================================================================================================================================================================================================
// resolveTerrain
// Põe o círculo dentro do campo e fora das paredes e das estruturas inimigas (as do próprio time ele atravessa).

export function resolveTerrain(sim, unit) {
  let { x, y } = unit;
  for (const wall of WALLS) ({ x, y } = pushOutOfRect(x, y, unit.radius, wall));
  if (unit.kind !== 'structure') {
    for (const structure of sim.structures) {
      if (!structure.alive || structure.team === unit.team) continue;
      const dx = x - structure.x;
      const dy = y - structure.y;
      const gapToStructure = Math.hypot(dx, dy) - structure.radius - unit.radius;
      if (gapToStructure < 0) {
        const away = normalize(dx, dy);
        x -= away.x * gapToStructure;
        y -= away.y * gapToStructure;
      }
    }
  }
  unit.x = clamp(x, unit.radius, ARENA.width - unit.radius);
  unit.y = clamp(y, unit.radius, ARENA.height - unit.radius);
}

// ================================================================================================================================================================================================================================================
// moveToward
// Anda em direção a (tx, ty) com a velocidade dada por dt segundos, sem passar do ponto. Devolve se chegou.

export function moveToward(sim, unit, tx, ty, speed, dt) {
  const gapToPoint = distance(unit.x, unit.y, tx, ty);
  if (gapToPoint < 0.05) return true;
  const direction = normalize(tx - unit.x, ty - unit.y);
  const step = Math.min(gapToPoint, speed * dt);
  unit.x += direction.x * step;
  unit.y += direction.y * step;
  unit.facing = direction;
  resolveTerrain(sim, unit);
  return gapToPoint - step < 0.05;
}

// ================================================================================================================================================================================================================================================
// separate
// Afasta as unidades que se sobrepõem (não as estruturas), meio a meio.

export function separate(sim) {
  const movers = sim.units().filter(unit => unit.kind !== 'structure');
  for (let i = 0; i < movers.length; i++) {
    for (let j = i + 1; j < movers.length; j++) {
      const a = movers[i];
      const b = movers[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const overlap = a.radius + b.radius - Math.hypot(dx, dy);
      if (overlap <= 0) continue;
      const away = Math.hypot(dx, dy) > 1e-9 ? normalize(dx, dy) : { x: 1, y: 0 };
      a.x -= away.x * overlap / 2;
      a.y -= away.y * overlap / 2;
      b.x += away.x * overlap / 2;
      b.y += away.y * overlap / 2;
    }
  }
  for (const unit of movers) resolveTerrain(sim, unit);
}
