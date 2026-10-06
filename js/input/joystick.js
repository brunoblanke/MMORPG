// js/input/joystick.js

// Controle de movimento pro celular: um círculo com o fundo das janelas e,
// dentro, o círculo menor com a cor dos espaços de um recipiente. Arrastar o
// círculo menor anda na direção dele (4 direções, como as setas); soltar para.
// Só aparece em tela de toque.

const BASE_SIZE = 120;
const KNOB_SIZE = 48;
const DEAD_ZONE = 0.3;

// ================================================================================================================================================================================================================================================
// directionFromOffset
// A direção { dx, dy } de um arraste de (offsetX, offsetY) a partir do centro,
// ou null se ele ficou perto demais do centro (radius é o alcance máximo).

export function directionFromOffset(offsetX, offsetY, radius) {
  if (Math.hypot(offsetX, offsetY) < radius * DEAD_ZONE) return null;
  if (Math.abs(offsetX) > Math.abs(offsetY)) return { dx: Math.sign(offsetX), dy: 0 };
  return { dx: 0, dy: Math.sign(offsetY) };
}

export class Joystick {

  // ================================================================================================================================================================================================================================================
  // constructor
  // input: o InputController, que recebe a direção (joystickDir).

  constructor(input) {
    this.input = input;
    this.pointerId = null;
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    this.base = document.createElement('div');
    this.base.className = 'joystick';
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    this.base.appendChild(this.knob);
    document.body.appendChild(this.base);
    this.base.addEventListener('pointerdown', (e) => this.start(e));
    this.base.addEventListener('pointermove', (e) => this.move(e));
    this.base.addEventListener('pointerup', (e) => this.end(e));
    this.base.addEventListener('pointercancel', (e) => this.end(e));
  }

  // ================================================================================================================================================================================================================================================
  // start

  start(e) {
    if (this.pointerId !== null) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.base.setPointerCapture(e.pointerId);
    this.move(e);
  }

  // ================================================================================================================================================================================================================================================
  // move
  // Põe o círculo menor sob o dedo (preso ao círculo grande) e manda a direção.

  move(e) {
    if (e.pointerId !== this.pointerId) return;
    const rect = this.base.getBoundingClientRect();
    const reach = (BASE_SIZE - KNOB_SIZE) / 2;
    let offsetX = e.clientX - (rect.left + rect.width / 2);
    let offsetY = e.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(offsetX, offsetY);
    if (distance > reach) {
      offsetX = offsetX * reach / distance;
      offsetY = offsetY * reach / distance;
    }
    this.knob.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    this.setDirection(directionFromOffset(offsetX, offsetY, reach));
  }

  // ================================================================================================================================================================================================================================================
  // end

  end(e) {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.knob.style.transform = '';
    this.setDirection(null);
  }

  // ================================================================================================================================================================================================================================================
  // setDirection

  setDirection(direction) {
    this.input.joystickDir = direction;
    this.input.sendWalkDir(false);
  }
}
