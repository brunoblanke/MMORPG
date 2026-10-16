// js/view/forms.js

import { getAsset, listAssets, displayName, objectUse, objectDirections, objectDirection, rotateType, doorState } from '../../../shared/assets.js';
import { state } from '../model/state.js';
import { scheduleRender } from './canvas-renderer.js';
import { updateStats } from './tools-panel.js';
import { setThumb } from './sprite-thumb.js';
import { itemInfo } from '../../../shared/items.js';
import { restackItems } from '../../../shared/map-format.js';

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
// Coloca a criatura escolhida na lista (Criatura): só falta o level.

export function openEnemyForm(x, y, clientX, clientY) {
  if (!getAsset(state.enemyPaint)) {
    state.painting = false;
    return;
  }
  pendingEnemy = { x, y };
  const existing = state.layers[state.activeZ][`${x},${y}`].enemy;
  document.getElementById('enemyName').textContent = displayName(state.enemyPaint);
  if (existing && existing.type === state.enemyPaint) document.getElementById('enemyLvl').value = existing.lvl;
  positionFloatPanel(enemyForm, clientX, clientY);
  enemyForm.classList.add('show');
  document.getElementById('enemyLvl').select();
}

// ================================================================================================================================================================================================================================================
// openSelectPanel
// Ferramenta Selecionar: lista o que está no sqm, só no andar ativo, de cima
// pra baixo. ▲/▼ mudam a ordem na pilha; Editar abre o texto (placa, livro)
// ou os itens (baú de quest ou qualquer container).

const selectPanel = document.getElementById('selectPanel');

export function openSelectPanel(x, y, clientX, clientY) {
  state.selected = { x, y, z: state.activeZ };
  renderSelectPanel();
  positionFloatPanel(selectPanel, clientX, clientY);
  selectPanel.classList.add('show');
  scheduleRender();
}

// ================================================================================================================================================================================================================================================
// closeSelectPanel

export function closeSelectPanel() {
  const panel = document.getElementById('selectPanel');
  const form = document.getElementById('objectDataForm');
  if (panel) panel.classList.remove('show');
  if (form) form.classList.remove('show');
  pendingObject = null;
  if (!state.selected) return;
  state.selected = null;
  scheduleRender();
}

// ================================================================================================================================================================================================================================================
// selectedCell

function selectedCell() {
  const selected = state.selected;
  if (!selected || !state.layers[selected.z]) return null;
  return state.layers[selected.z][`${selected.x},${selected.y}`] || null;
}

// ================================================================================================================================================================================================================================================
// editableKind
// 'texto' (placa, livro), 'itens' (baú de quest, container), 'destino' (teletransporte), 'porta'
// (chave, nível e quest), 'chave' (o número), 'alvos' (alavanca) ou null.

const EDIT_TITLES = { texto: 'Escrever o texto', destino: 'Escolher o destino', itens: 'Escolher os itens', porta: 'Regras da porta', chave: 'Número da chave', alvos: 'Escolher os alvos' };

function editableKind(type) {
  const use = objectUse(type);
  if (use === 'placa' || use === 'livro') return 'texto';
  if (use === 'teleporte') return 'destino';
  if (doorState(type)) return 'porta';
  if (use === 'ferramenta-chave') return 'chave';
  if (use === 'alavanca') return 'alvos';
  if (use === 'bau-quest' || itemInfo(type).size > 0) return 'itens';
  return null;
}

// ================================================================================================================================================================================================================================================
// renderSelectPanel

function renderSelectPanel() {
  const cell = selectedCell();
  const { x, y, z } = state.selected;
  document.getElementById('selectTitle').textContent = `Sqm ${x},${y} · andar ${z}`;
  const list = document.getElementById('selectList');
  list.innerHTML = '';
  const objects = cell ? cell.objects : [];
  if (!objects.length) {
    const empty = document.createElement('div');
    empty.className = 'select-empty';
    empty.textContent = 'Nenhum objeto neste sqm.';
    list.appendChild(empty);
    return;
  }
  for (let index = objects.length - 1; index >= 0; index--) {
    const obj = objects[index];
    const row = document.createElement('div');
    row.className = 'select-row';
    const thumb = document.createElement('div');
    thumb.className = 'select-thumb';
    setThumb(thumb, obj.type, 24);
    const name = document.createElement('span');
    name.className = 'select-name';
    const rotates = objectDirections(obj.type).length > 1;
    name.textContent = displayName(obj.type) + (rotates ? ` · ${objectDirection(obj.type)}` : '') + (obj.count > 1 ? ` ×${obj.count}` : '') + (obj.dados ? ' •' : '');
    name.title = obj.type;
    const up = selectButton('▲', 'Subir na pilha', index === objects.length - 1, () => moveInStack(index, 1));
    const down = selectButton('▼', 'Descer na pilha', index === 0, () => moveInStack(index, -1));
    row.append(thumb, name, up, down);
    if (rotates) row.appendChild(selectButton('⟳', 'Girar (R)', false, () => rotateObject(obj, 1)));
    const kind = editableKind(obj.type);
    if (kind) row.appendChild(selectButton('✎', EDIT_TITLES[kind], false, (evt) => openObjectDataForm(obj, evt.clientX, evt.clientY)));
    list.appendChild(row);
  }
}

// ================================================================================================================================================================================================================================================
// selectButton

function selectButton(text, title, disabled, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.title = title;
  button.disabled = disabled;
  button.onclick = onClick;
  return button;
}

// ================================================================================================================================================================================================================================================
// rotateObject / rotateSelected
// Vira o objeto pra próxima direção que ele tem. R com um sqm selecionado
// gira o objeto que gira mais em cima dele; false se não tem nenhum.

function rotateObject(obj, step) {
  obj.type = rotateType(obj.type, step);
  renderSelectPanel();
  updateStats();
  scheduleRender();
}

export function rotateSelected(step = 1) {
  const cell = state.selected && selectedCell();
  const obj = cell && [...cell.objects].reverse().find(o => objectDirections(o.type).length > 1);
  if (!obj) return false;
  rotateObject(obj, step);
  return true;
}

// ================================================================================================================================================================================================================================================
// moveInStack
// Troca o objeto de lugar com o vizinho na pilha (delta 1 = pra cima).

function moveInStack(index, delta) {
  const cell = selectedCell();
  const other = index + delta;
  if (!cell || other < 0 || other >= cell.objects.length) return;
  [cell.objects[index], cell.objects[other]] = [cell.objects[other], cell.objects[index]];
  restackItems(cell.objects);
  renderSelectPanel();
  updateStats();
  scheduleRender();
}

// ================================================================================================================================================================================================================================================
// openObjectDataForm
// Texto (placa, livro; a placa também tem a cor da mensagem: verde, amarelo,
// vermelho ou azul), destino (teletransporte: x, y e andar) ou itens (baú de quest: cada player pega uma vez; container:
// começa com eles dentro). Fica no objeto, no mapa.

const objectDataForm = document.getElementById('objectDataForm');
const MESSAGE_KINDS = ['info', 'warn', 'danger', 'blue'];
let pendingObject = null;
let pendingItems = [];
let pendingTargets = [];

export function openObjectDataForm(obj, clientX, clientY) {
  const kind = editableKind(obj.type);
  if (!kind) return false;
  pendingObject = obj;
  const use = objectUse(obj.type);
  const data = obj.dados || {};
  const size = itemInfo(obj.type).size;
  const label = { placa: 'placa', livro: 'livro', teleporte: 'teletransporte', 'bau-quest': 'baú de quest', 'ferramenta-chave': 'chave', alavanca: 'alavanca' }[use] || (kind === 'porta' ? 'porta' : `container (${size} espaços)`);
  document.getElementById('objectDataTitle').textContent = `${displayName(obj.type)} · ${label}`;
  document.getElementById('objectDataItemsLabel').textContent = use === 'bau-quest' ? 'Itens do baú (cada player pega uma vez)' : 'Itens dentro';
  document.getElementById('objectDataTextField').hidden = kind !== 'texto';
  document.getElementById('objectDataItemsField').hidden = kind !== 'itens';
  document.getElementById('objectDataDestField').hidden = kind !== 'destino';
  document.getElementById('objectDataDoorField').hidden = kind !== 'porta';
  document.getElementById('objectDataKeyField').hidden = kind !== 'chave';
  document.getElementById('objectDataTargetsField').hidden = kind !== 'alvos';
  document.getElementById('objectDataDoorKey').value = data.chave || '';
  document.getElementById('objectDataDoorLevel').value = data.nivel || '';
  document.getElementById('objectDataDoorQuest').value = data.quest || '';
  document.getElementById('objectDataKeyNumber').value = data.chave || '';
  pendingTargets = Array.isArray(data.alvos) ? data.alvos.map(t => ({ x: t.x, y: t.y, z: t.z })) : [];
  renderObjectDataTargets();
  const dest = data.destino || {};
  document.getElementById('objectDataDestX').value = Number.isInteger(dest.x) ? dest.x : '';
  document.getElementById('objectDataDestY').value = Number.isInteger(dest.y) ? dest.y : '';
  document.getElementById('objectDataDestZ').value = Number.isInteger(dest.z) ? dest.z : (state.selected ? state.selected.z : 0);
  document.getElementById('objectDataText').value = data.texto || '';
  document.getElementById('objectDataColorField').hidden = use !== 'placa';
  document.getElementById('objectDataColor').value = MESSAGE_KINDS.includes(data.cor) ? data.cor : 'info';
  pendingItems = Array.isArray(data.itens) ? data.itens.map(it => ({ tipo: it.tipo, count: it.count || 1, chave: it.chave })) : [];
  renderObjectDataItems();
  positionFloatPanel(objectDataForm, clientX, clientY);
  objectDataForm.classList.add('show');
  return true;
}

// ================================================================================================================================================================================================================================================
// renderObjectDataTargets

function renderObjectDataTargets() {
  const box = document.getElementById('objectDataTargets');
  box.innerHTML = '';
  pendingTargets.forEach((target, index) => {
    const row = document.createElement('div');
    row.className = 'row';
    for (const [axis, label] of [['x', 'x'], ['y', 'y'], ['z', 'andar']]) {
      const input = document.createElement('input');
      Object.assign(input, { type: 'number', placeholder: label, title: label, value: Number.isInteger(target[axis]) ? target[axis] : '' });
      input.oninput = () => { target[axis] = input.value === '' ? undefined : Math.floor(Number(input.value)); };
      row.appendChild(input);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.onclick = () => { pendingTargets.splice(index, 1); renderObjectDataTargets(); };
    row.appendChild(remove);
    box.appendChild(row);
  });
}

document.getElementById('objectDataAddTarget').onclick = () => {
  const here = state.selected || { z: 0 };
  pendingTargets.push({ x: undefined, y: undefined, z: here.z });
  renderObjectDataTargets();
};

// ================================================================================================================================================================================================================================================
// renderObjectDataItems

function renderObjectDataItems() {
  const box = document.getElementById('objectDataItems');
  box.innerHTML = '';
  const items = listAssets('objetos', asset => asset.grupo === 'itens').map(asset => asset.id).sort((a, b) => displayName(a).localeCompare(displayName(b), 'pt', { numeric: true, sensitivity: 'base' }));
  pendingItems.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'row';
    const select = document.createElement('select');
    select.innerHTML = '<option value="">— item —</option>' + items.map(id => `<option value="${id}">${id.replace(/^itens\//, '')}</option>`).join('');
    select.value = entry.tipo || '';
    select.onchange = () => { entry.tipo = select.value; };
    const key = document.createElement('input');
    Object.assign(key, { type: 'number', min: 1, placeholder: 'chave', value: entry.chave || '', title: 'Número da chave (só pra chave)' });
    key.oninput = () => { entry.chave = Math.max(0, Math.floor(Number(key.value)) || 0) || undefined; };
    const count = document.createElement('input');
    Object.assign(count, { type: 'number', min: 1, max: 100, value: entry.count, title: 'Quantidade' });
    count.oninput = () => { entry.count = Math.max(1, Math.min(100, Math.floor(Number(count.value)) || 1)); };
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.onclick = () => { pendingItems.splice(index, 1); renderObjectDataItems(); };
    row.append(select, count, key, remove);
    box.appendChild(row);
  });
}

document.getElementById('objectDataAddItem').onclick = () => {
  const size = pendingObject && objectUse(pendingObject.type) !== 'bau-quest' ? itemInfo(pendingObject.type).size : 0;
  if (size && pendingItems.length >= size) return;
  pendingItems.push({ tipo: '', count: 1 });
  renderObjectDataItems();
};

document.getElementById('objectDataCancel').onclick = () => {
  objectDataForm.classList.remove('show');
  pendingObject = null;
};

document.getElementById('objectDataConfirm').onclick = () => {
  if (!pendingObject) return;
  if (editableKind(pendingObject.type) === 'destino') {
    const [x, y, z] = ['X', 'Y', 'Z'].map(axis => document.getElementById(`objectDataDest${axis}`).value).map(Number);
    pendingObject.dados = [x, y, z].every(Number.isInteger) && document.getElementById('objectDataDestX').value !== '' && document.getElementById('objectDataDestY').value !== '' ? { destino: { x, y, z } } : undefined;
  } else if (editableKind(pendingObject.type) === 'porta') {
    const number = (id) => Math.max(0, Math.floor(Number(document.getElementById(id).value)) || 0);
    const quest = document.getElementById('objectDataDoorQuest').value.trim();
    const rules = { chave: number('objectDataDoorKey'), nivel: number('objectDataDoorLevel'), quest };
    const kept = Object.fromEntries(Object.entries(rules).filter(([, value]) => value));
    pendingObject.dados = Object.keys(kept).length ? kept : undefined;
  } else if (editableKind(pendingObject.type) === 'chave') {
    const chave = Math.max(0, Math.floor(Number(document.getElementById('objectDataKeyNumber').value)) || 0);
    pendingObject.dados = chave ? { chave } : undefined;
  } else if (editableKind(pendingObject.type) === 'alvos') {
    const alvos = pendingTargets.filter(t => [t.x, t.y, t.z].every(Number.isInteger)).map(t => ({ x: t.x, y: t.y, z: t.z }));
    pendingObject.dados = alvos.length ? { alvos } : undefined;
  } else if (editableKind(pendingObject.type) === 'itens') {
    const itens = pendingItems.filter(it => it.tipo).map(it => (it.chave ? { tipo: it.tipo, count: it.count || 1, chave: it.chave } : { tipo: it.tipo, count: it.count || 1 }));
    pendingObject.dados = itens.length ? { itens } : undefined;
  } else {
    const texto = document.getElementById('objectDataText').value.trim();
    const cor = document.getElementById('objectDataColor').value;
    pendingObject.dados = texto ? (objectUse(pendingObject.type) === 'placa' && cor !== 'info' ? { texto, cor } : { texto }) : undefined;
  }
  if (!pendingObject.dados) delete pendingObject.dados;
  objectDataForm.classList.remove('show');
  pendingObject = null;
  if (state.selected) renderSelectPanel();
  scheduleRender();
};

document.getElementById('selectClose').onclick = () => closeSelectPanel();

document.getElementById('enemyCancel').onclick = () => {
  enemyForm.classList.remove('show');
  pendingEnemy = null;
  state.painting = false;
};

document.getElementById('enemyConfirm').onclick = () => {
  if (!pendingEnemy) return;
  const layer = state.layers[state.activeZ];
  const key = `${pendingEnemy.x},${pendingEnemy.y}`;
  const type = state.enemyPaint;
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

document.getElementById('enemyLvl').addEventListener('keydown', (evt) => {
  if (evt.key === 'Enter') document.getElementById('enemyConfirm').click();
});
