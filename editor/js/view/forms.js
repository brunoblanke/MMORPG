// js/view/forms.js

import { getAsset, listAssets, displayName } from '../../../shared/assets.js';
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
  refreshCreatureOptions();
  const select = document.getElementById('enemyType');
  if (!select.options.length) {
    window.alert('Nenhuma criatura gerada ainda. Gere no gerador de sprites (Criaturas).');
    pendingEnemy = null;
    state.painting = false;
    return;
  }
  const type = existing && getAsset(existing.type) ? existing.type : (getAsset(state.enemyPaint) ? state.enemyPaint : select.options[0].value);
  select.value = type;
  if (existing) document.getElementById('enemyLvl').value = existing.lvl;

  positionFloatPanel(enemyForm, clientX, clientY);
  enemyForm.classList.add('show');
}

// ================================================================================================================================================================================================================================================
// refreshCreatureOptions
// As criaturas geradas, agrupadas pela pasta (Criaturas › Demônios…).

export function refreshCreatureOptions() {
  const select = document.getElementById('enemyType');
  const current = select.value;
  select.innerHTML = '';
  const groups = new Map();
  for (const asset of listAssets('criaturas')) {
    const label = asset.rotulo.split(' › ').pop();
    if (!groups.has(label)) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = label;
      groups.set(label, optgroup);
      select.appendChild(optgroup);
    }
    groups.get(label).appendChild(new Option(displayName(asset.id), asset.id));
  }
  if (getAsset(current)) select.value = current;
}

document.getElementById('enemyType').onchange = (evt) => {
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
    // O tamanho do sprite vem da folha; não é escolha de quem edita.
    spriteSize: (getAsset(type) || {}).quadro || 32
  };
  enemyForm.classList.remove('show');
  pendingEnemy = null;
  state.painting = false;
  updateStats();
  scheduleRender();
};