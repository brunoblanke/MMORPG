// editor/js/view/goto-field.js

import { state } from '../model/state.js';
import { TILE } from '../config.js';
import { isValidFloor } from '../../../shared/constants.js';
import { canvas, canvasWrap, scheduleRender } from './canvas-renderer.js';
import { onLayerChange } from './tools-panel.js';

// Campo "x, y, z" da barra do topo: Enter vai pro andar, centraliza o sqm na
// tela e marca ele (aceita colar direto do aviso do servidor: 146,154,0).

const input = document.getElementById('gotoInput');

// ================================================================================================================================================================================================================================================
// goTo

function goTo(text) {
  const [x, y, z = state.activeZ] = (text.match(/-?\d+/g) || []).map(Number);
  if (!Number.isInteger(x) || !Number.isInteger(y) || !isValidFloor(z)) {
    input.classList.add('invalid');
    return;
  }
  input.classList.remove('invalid');
  state.focus = { x, y, z };
  if (state.activeZ !== z) {
    state.activeZ = z;
    onLayerChange();
  }
  const rect = canvas.getBoundingClientRect();
  const wrapRect = canvasWrap.getBoundingClientRect();
  const scale = rect.width / canvas.width;
  canvasWrap.scrollLeft += rect.left - wrapRect.left + (x + 0.5) * TILE * scale - canvasWrap.clientWidth / 2;
  canvasWrap.scrollTop += rect.top - wrapRect.top + (y + 0.5) * TILE * scale - canvasWrap.clientHeight / 2;
  scheduleRender();
}

input.addEventListener('keydown', (evt) => {
  if (evt.key === 'Enter') goTo(input.value);
});
input.addEventListener('input', () => input.classList.remove('invalid'));
