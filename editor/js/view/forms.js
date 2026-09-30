// js/view/forms.js

import { getAsset, listAssets, displayName, objectUse } from '../../../shared/assets.js';
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

// ================================================================================================================================================================================================================================================
// openObjectDataForm
// Botão direito num sqm com placa, livro ou baú de quest: escreve o texto
// (placa, livro) ou escolhe os itens (baú). Fica no objeto, no mapa.
// Devolve false se o sqm não tem nenhum desses.

const objectDataForm = document.getElementById('objectDataForm');
let pendingObject = null;
let pendingItems = [];

export function openObjectDataForm(x, y, clientX, clientY) {
  const cell = state.layers[state.activeZ][`${x},${y}`];
  const obj = [...cell.objects].reverse().find(o => ['placa', 'livro', 'bau-quest'].includes(objectUse(o.type)));
  if (!obj) return false;
  pendingObject = obj;
  const use = objectUse(obj.type);
  const data = obj.dados || {};
  document.getElementById('objectDataTitle').textContent = `${displayName(obj.type)} · ${use === 'placa' ? 'placa' : use === 'livro' ? 'livro' : 'baú de quest'}`;
  document.getElementById('objectDataTextField').hidden = use === 'bau-quest';
  document.getElementById('objectDataItemsField').hidden = use !== 'bau-quest';
  document.getElementById('objectDataText').value = data.texto || '';
  pendingItems = Array.isArray(data.itens) ? data.itens.map(it => ({ tipo: it.tipo, count: it.count || 1 })) : [];
  renderObjectDataItems();
  positionFloatPanel(objectDataForm, clientX, clientY);
  objectDataForm.classList.add('show');
  return true;
}

// ================================================================================================================================================================================================================================================
// renderObjectDataItems

function renderObjectDataItems() {
  const box = document.getElementById('objectDataItems');
  box.innerHTML = '';
  const items = listAssets('objetos', asset => asset.grupo === 'itens').map(asset => asset.id);
  pendingItems.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'row';
    const select = document.createElement('select');
    select.innerHTML = '<option value="">— item —</option>' + items.map(id => `<option value="${id}">${id.replace(/^itens\//, '')}</option>`).join('');
    select.value = entry.tipo || '';
    select.onchange = () => { entry.tipo = select.value; };
    const count = document.createElement('input');
    Object.assign(count, { type: 'number', min: 1, max: 100, value: entry.count, title: 'Quantidade' });
    count.oninput = () => { entry.count = Math.max(1, Math.min(100, Math.floor(Number(count.value)) || 1)); };
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.onclick = () => { pendingItems.splice(index, 1); renderObjectDataItems(); };
    row.append(select, count, remove);
    box.appendChild(row);
  });
}

document.getElementById('objectDataAddItem').onclick = () => {
  pendingItems.push({ tipo: '', count: 1 });
  renderObjectDataItems();
};

document.getElementById('objectDataCancel').onclick = () => {
  objectDataForm.classList.remove('show');
  pendingObject = null;
};

document.getElementById('objectDataConfirm').onclick = () => {
  if (!pendingObject) return;
  const use = objectUse(pendingObject.type);
  if (use === 'bau-quest') {
    const itens = pendingItems.filter(it => it.tipo).map(it => ({ tipo: it.tipo, count: it.count || 1 }));
    pendingObject.dados = itens.length ? { itens } : undefined;
  } else {
    const texto = document.getElementById('objectDataText').value.trim();
    pendingObject.dados = texto ? { texto } : undefined;
  }
  if (!pendingObject.dados) delete pendingObject.dados;
  objectDataForm.classList.remove('show');
  pendingObject = null;
  scheduleRender();
};

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