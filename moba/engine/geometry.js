// moba/engine/geometry.js

// ================================================================================================================================================================================================================================================
// distance

export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

// ================================================================================================================================================================================================================================================
// clamp

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// ================================================================================================================================================================================================================================================
// normalize
// O vetor unitário de (dx, dy); (0, 0) se for nulo.

export function normalize(dx, dy) {
  const length = Math.hypot(dx, dy);
  return length > 1e-9 ? { x: dx / length, y: dy / length } : { x: 0, y: 0 };
}

// ================================================================================================================================================================================================================================================
// pushOutOfRect
// Empurra o círculo (x, y, radius) pra fora do retângulo { x, y, w, h }: devolve a posição corrigida.

export function pushOutOfRect(x, y, radius, rect) {
  const nearestX = clamp(x, rect.x, rect.x + rect.w);
  const nearestY = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - nearestX;
  const dy = y - nearestY;
  const gap = Math.hypot(dx, dy);
  if (gap >= radius) return { x, y };
  if (gap > 1e-9) return { x: nearestX + (dx / gap) * radius, y: nearestY + (dy / gap) * radius };
  const toLeft = x - rect.x;
  const toRight = rect.x + rect.w - x;
  const toTop = y - rect.y;
  const toBottom = rect.y + rect.h - y;
  const least = Math.min(toLeft, toRight, toTop, toBottom);
  if (least === toLeft) return { x: rect.x - radius, y };
  if (least === toRight) return { x: rect.x + rect.w + radius, y };
  if (least === toTop) return { x, y: rect.y - radius };
  return { x, y: rect.y + rect.h + radius };
}

// ================================================================================================================================================================================================================================================
// distanceToSegment
// A distância do ponto (px, py) ao segmento (ax, ay)–(bx, by) e o quanto ao longo dele (0 a 1).

export function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const along = lengthSquared > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1) : 0;
  return { distance: Math.hypot(px - (ax + dx * along), py - (ay + dy * along)), along };
}

// ================================================================================================================================================================================================================================================
// inCone
// O círculo (x, y, radius) está no leque de origem (ox, oy), direção (dirX, dirY) unitária, comprimento length e meio-ângulo halfAngle.

export function inCone(ox, oy, dirX, dirY, length, halfAngle, x, y, radius) {
  const dx = x - ox;
  const dy = y - oy;
  const gap = Math.hypot(dx, dy);
  if (gap > length + radius) return false;
  if (gap <= radius) return true;
  const angle = Math.acos(clamp((dx * dirX + dy * dirY) / gap, -1, 1));
  const slack = Math.asin(clamp(radius / gap, 0, 1));
  return angle <= halfAngle + slack;
}
