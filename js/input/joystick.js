// js/input/joystick.js

// Controle de movimento de toque, invisível: encostar o dedo em qualquer lugar
// da tela (menos num item arrastável) e arrastar vira um joystick que começa onde o dedo encostou. A
// direção do arraste (8 direções) é pra onde o personagem anda; soltar para.
// Toque rápido continua indo até o ponto, e o que começa em janela ou em item
// arrastável segue o comportamento de sempre. Só em aparelho de toque
// (celular e tablet); no PC, mesmo com tela de toque, não liga.

const START_DISTANCE = 20;
const REACH = 60;
const DEAD_ZONE = 0.3;
const DIAGONAL_RATIO = Math.tan(Math.PI / 8);

// ================================================================================================================================================================================================================================================
// directionFromOffset
// A direção { dx, dy } (uma das 8) de um arraste de (offsetX, offsetY) a partir
// do centro, ou null se ele ficou perto demais do centro (radius é o alcance
// de referência).

export function directionFromOffset(offsetX, offsetY, radius) {
  if (Math.hypot(offsetX, offsetY) < radius * DEAD_ZONE) return null;
  const absX = Math.abs(offsetX);
  const absY = Math.abs(offsetY);
  if (Math.min(absX, absY) / Math.max(absX, absY) > DIAGONAL_RATIO) return { dx: Math.sign(offsetX), dy: Math.sign(offsetY) };
  if (absX > absY) return { dx: Math.sign(offsetX), dy: 0 };
  return { dx: 0, dy: Math.sign(offsetY) };
}

// ================================================================================================================================================================================================================================================
// followAnchor
// O centro do joystick acompanha o dedo quando ele passa de reach: assim, ao
// inverter o arraste, a direção responde na hora. Devolve o novo { x, y }.

export function followAnchor(anchor, point, reach) {
  const distance = Math.hypot(point.x - anchor.x, point.y - anchor.y);
  if (distance <= reach) return anchor;
  const pull = (distance - reach) / distance;
  return { x: anchor.x + (point.x - anchor.x) * pull, y: anchor.y + (point.y - anchor.y) * pull };
}

export class Joystick {

  // ================================================================================================================================================================================================================================================
  // constructor
  // input: o InputController, que recebe a direção (joystickDir); canvas: onde
  // o dedo encosta.

  constructor(input, canvas) {
    this.input = input;
    this.pointerId = null;
    this.anchor = null;
    this.dragging = false;
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => this.start(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.end(e));
    canvas.addEventListener('pointercancel', (e) => this.end(e));
  }

  // ================================================================================================================================================================================================================================================
  // start
  // O dedo encostou: guarda o ponto e atualiza o que está sob ele (o arraste só
  // começa depois de START_DISTANCE, fora de item arrastável).

  start(e) {
    if (e.pointerType !== 'touch') return;
    this.input.suppressNextClick = false;
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.anchor = { x: e.clientX, y: e.clientY };
    this.dragging = false;
    this.input.handleMouseMove(e);
  }

  // ================================================================================================================================================================================================================================================
  // hasDraggable
  // Há um item ou cadáver arrastável sob o dedo que encostou (o arraste dele
  // tem prioridade).

  hasDraggable() {
    return !!this.input.hoverMovable;
  }

  // ================================================================================================================================================================================================================================================
  // move

  move(e) {
    if (e.pointerId !== this.pointerId) return;
    const point = { x: e.clientX, y: e.clientY };
    if (!this.dragging) {
      if (Math.hypot(point.x - this.anchor.x, point.y - this.anchor.y) < START_DISTANCE) return;
      if (this.hasDraggable()) {
        this.pointerId = null;
        return;
      }
      this.dragging = true;
    }
    this.anchor = followAnchor(this.anchor, point, REACH);
    this.setDirection(directionFromOffset(point.x - this.anchor.x, point.y - this.anchor.y, START_DISTANCE));
  }

  // ================================================================================================================================================================================================================================================
  // end

  end(e) {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    if (this.dragging) this.input.suppressNextClick = true;
    this.dragging = false;
    this.setDirection(null);
  }

  // ================================================================================================================================================================================================================================================
  // setDirection

  setDirection(direction) {
    this.input.joystickDir = direction;
    this.input.sendWalkDir(false);
  }
}
