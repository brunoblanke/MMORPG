// js/view/forms.js

import { getCreatureType, getCreatureNames, hasCreatureType } from '../../../shared/catalog.js';
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
  const type = existing ? existing.type : (hasCreatureType(state.enemyPaint) ? state.enemyPaint : 'Cave Rat');
  refreshCreatureOptions();
  document.getElementById('enemyType').value = type;
  document.getElementById('enemyLvl').value = existing ? existing.lvl : getCreatureType(type).defaultLvl;

  positionFloatPanel(enemyForm, clientX, clientY);
  enemyForm.classList.add('show');
}

// ================================================================================================================================================================================================================================================
// refreshCreatureOptions
// Lista do tipo de criatura: as do jogo e as geradas do Tibia.

export function refreshCreatureOptions() {
  const select = document.getElementById('enemyType');
  const current = select.value;
  select.innerHTML = '';
  for (const name of getCreatureNames()) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }
  if (hasCreatureType(current)) select.value = current;
}

document.getElementById('enemyType').onchange = (evt) => {
  document.getElementById('enemyLvl').value = getCreatureType(evt.target.value).defaultLvl;
  state.enemyPaint = evt.target.value;
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
    spriteSize: getCreatureType(type).spriteSize
  };
  enemyForm.classList.remove('show');
  pendingEnemy = null;
  state.painting = false;
  updateStats();
  scheduleRender();
};