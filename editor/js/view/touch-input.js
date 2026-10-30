// editor/js/view/touch-input.js

import { canvas, canvasWrap } from './canvas-renderer.js';
import { zoomBy } from './zoom.js';

// Celular: o dedo no mapa vira o mouse. Um dedo: arrastar pinta (por onde passa ou a área, como o mouse), toque rápido
// é um clique; dois dedos movem o mapa e a pinça dá zoom. O traço só começa depois de mexer TOUCH_SLOP px ou segurar
// TOUCH_HOLD_MS, então pôr o 2º dedo logo em seguida move o mapa sem pintar.

const TOUCH_SLOP = 8;
const TOUCH_HOLD_MS = 150;

let pending = null;
let stroking = false;
let pan = null;

// ================================================================================================================================================================================================================================================
// mouse
// Manda pro canvas o evento de mouse equivalente.

function mouse(type, point) {
  canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: type === 'mouseup' ? 0 : 1, clientX: point.clientX, clientY: point.clientY }));
}

// ================================================================================================================================================================================================================================================
// startStroke

function startStroke() {
  if (!pending) return;
  clearTimeout(pending.timer);
  const { start, last } = pending;
  pending = null;
  stroking = true;
  mouse('mousemove', start);
  mouse('mousedown', start);
  if (last !== start) mouse('mousemove', last);
}

// ================================================================================================================================================================================================================================================
// endStroke

function endStroke(point) {
  if (!stroking) return;
  stroking = false;
  mouse('mouseup', point);
  mouse('mouseleave', point);
}

// ================================================================================================================================================================================================================================================
// pinchOf
// O meio e a distância dos dois primeiros dedos.

function pinchOf(touches) {
  const a = touches[0];
  const b = touches[1];
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2, dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1 };
}

// ================================================================================================================================================================================================================================================
// onTouchStart

function onTouchStart(evt) {
  evt.preventDefault();
  if (evt.touches.length >= 2) {
    if (pending) clearTimeout(pending.timer);
    pending = null;
    endStroke(evt.touches[0]);
    pan = pinchOf(evt.touches);
    return;
  }
  if (pan) return;
  const touch = evt.touches[0];
  const point = { clientX: touch.clientX, clientY: touch.clientY };
  pending = { start: point, last: point, timer: setTimeout(startStroke, TOUCH_HOLD_MS) };
}

// ================================================================================================================================================================================================================================================
// onTouchMove

function onTouchMove(evt) {
  evt.preventDefault();
  if (pan && evt.touches.length >= 2) {
    const next = pinchOf(evt.touches);
    canvasWrap.scrollLeft -= next.x - pan.x;
    canvasWrap.scrollTop -= next.y - pan.y;
    zoomBy(next.dist / pan.dist, next.x, next.y);
    pan = next;
    return;
  }
  const touch = evt.touches[0];
  if (!touch || pan) return;
  const point = { clientX: touch.clientX, clientY: touch.clientY };
  if (pending) {
    pending.last = point;
    if (Math.hypot(point.clientX - pending.start.clientX, point.clientY - pending.start.clientY) >= TOUCH_SLOP) startStroke();
    return;
  }
  if (stroking) mouse('mousemove', point);
}

// ================================================================================================================================================================================================================================================
// onTouchEnd

function onTouchEnd(evt) {
  evt.preventDefault();
  const touch = evt.changedTouches[0];
  const point = { clientX: touch.clientX, clientY: touch.clientY };
  if (pending) {
    clearTimeout(pending.timer);
    pending = null;
    mouse('mousemove', point);
    mouse('mousedown', point);
    mouse('mouseup', point);
    mouse('click', point);
    mouse('mouseleave', point);
    return;
  }
  endStroke(point);
  if (evt.touches.length === 0) pan = null;
}

canvasWrap.addEventListener('touchstart', onTouchStart, { passive: false });
canvasWrap.addEventListener('touchmove', onTouchMove, { passive: false });
canvasWrap.addEventListener('touchend', onTouchEnd, { passive: false });
canvasWrap.addEventListener('touchcancel', onTouchEnd, { passive: false });
