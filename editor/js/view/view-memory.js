// editor/js/view/view-memory.js

import { state } from '../model/state.js';
import { isValidFloor } from '../../../shared/constants.js';
import { canvasWrap } from './canvas-renderer.js';

// Onde o editor estava (andar e rolagem do mapa) fica guardado no navegador:
// ao atualizar a página, ele volta pro mesmo lugar.

const KEY = 'editor-vista';
const SAVE_DELAY_MS = 200;
let timer = null;

// ================================================================================================================================================================================================================================================
// rememberView

export function rememberView() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ z: state.activeZ, left: canvasWrap.scrollLeft, top: canvasWrap.scrollTop }));
    } catch (error) {
      timer = null;
    }
  }, SAVE_DELAY_MS);
}

// ================================================================================================================================================================================================================================================
// restoreFloor / restoreScroll
// restoreFloor antes de desenhar as abas (volta pro andar); restoreScroll
// depois que o mapa está na tela (volta pra rolagem).

function savedView() {
  try {
    const view = JSON.parse(localStorage.getItem(KEY) || 'null');
    return view && typeof view === 'object' ? view : null;
  } catch (error) {
    return null;
  }
}

export function restoreFloor() {
  const view = savedView();
  if (view && isValidFloor(view.z)) state.activeZ = view.z;
}

export function restoreScroll() {
  const view = savedView();
  if (!view) return;
  requestAnimationFrame(() => {
    canvasWrap.scrollLeft = Number(view.left) || 0;
    canvasWrap.scrollTop = Number(view.top) || 0;
  });
}

canvasWrap.addEventListener('scroll', rememberView);
