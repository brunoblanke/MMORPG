// js/view/forms.js

import { CREATURE_TYPES } from '../model/catalog.js';
import { state } from '../model/state.js';
import { scheduleRender } from './canvas-renderer.js';
import { updateStats } from './tools-panel.js';

// ================================================================================================================================================================================================================================================
// positionFloatPanel

export function positionFloatPanel(panel, clientX, clientY) {
  const left = clientX != null ? Math.min(clientX + 16, window.innerWidth - 280) : window.innerWidth / 2 - 120;
  const top = clientY != null ? Math.min(clientY, window.innerHeight - 260) : window.innerHeight / 2 - 130;
  panel.style.left = left + 'px';
  panel.style.top = top + 'px';
}

const enemyForm = document.getElementById('enemyForm');
let pendingEnemy = null;

// ================================================================================================================================================================================================================================================
// openEnemyForm

export function openEnemyForm(x, y, clientX, clientY) {
  pendingEnemy = { x, y };
  const layer = state.layers[state.activeZ];
  const existing = layer[`${x},${y}`].enemy;
  const type = existing ? existing.type : 'Cave Rat';
  document.getElementById('enemyType').value = type;
  document.getElementById('enemyLvl').value = existing ? existing.lvl : CREATURE_TYPES[type].defaultLvl;

  positionFloatPanel(enemyForm, clientX, clientY);
  enemyForm.classList.add('show');
}

document.getElementById('enemyType').onchange = (evt) => {
  const def = CREATURE_TYPES[evt.target.value];
  document.getElementById('enemyLvl').value = def.defaultLvl;
};

document.getElementById('enemyCancel').onclick = () => {
  enemyForm.classList.remove('show');
  pendingEnemy = null;
  state.painting = false;
};

document.getElementById('enemyConfirm').onclick = () => {
  if (!pendingEnemy) return;
  const layer = state.layers[state.activeZ];
  const key = `${pendingEnemy.x},${pendingEnemy.y}`;
  const type = document.getElementById('enemyType').value;
  layer[key].enemy = {
    type,
    lvl: parseInt(document.getElementById('enemyLvl').value || '1', 10),
    // O tamanho do sprite vem do tipo; não é escolha de quem edita.
    spriteSize: CREATURE_TYPES[type].spriteSize
  };
  enemyForm.classList.remove('show');
  pendingEnemy = null;
  state.painting = false;
  updateStats();
  scheduleRender();
};