// editor/js/view/kit-form.js

import { state } from '../model/state.js';
import { listAssets } from '../../../shared/assets.js';
import { EQUIP_SLOTS, fitsSlot, starterKit } from '../../../shared/items.js';
import { positionFloatPanel } from './forms.js';

// Kit inicial (botão na barra da esquerda): um item por espaço do
// inventário e os itens dentro da mochila. Fica no mapa (kitInicial) e vale
// pra todo personagem novo; sem ele, o jogo usa o kit padrão (DEFAULT_KIT).
// Aplicar muda o mapa do editor; Salvar grava.

const SLOT_NAMES = {
  amuleto: 'Amuleto', cabeca: 'Cabeça', mochila: 'Mochila', arma: 'Arma', corpo: 'Corpo',
  escudo: 'Escudo', anel: 'Anel', pernas: 'Pernas', municao: 'Munição', pes: 'Pés'
};

const kitForm = document.getElementById('kitForm');
let pendingEquip = {};
let pendingBag = [];

// ================================================================================================================================================================================================================================================
// itemTypes

function itemTypes() {
  return listAssets('objetos', asset => asset.grupo === 'itens').map(asset => asset.id);
}

// ================================================================================================================================================================================================================================================
// options

function options(types, current) {
  const list = current && !types.includes(current) ? [current, ...types] : types;
  return '<option value="">— nada —</option>' + list.map(id => `<option value="${id}">${id.replace(/^itens\//, '')}</option>`).join('');
}

// ================================================================================================================================================================================================================================================
// openKitForm

function openKitForm() {
  const kit = starterKit(state.kit);
  pendingEquip = { ...kit.equip };
  pendingBag = kit.mochila.map(e => ({ ...e }));
  renderSlots();
  renderBag();
  positionFloatPanel(kitForm, null, null);
  kitForm.style.top = '40px';
  kitForm.classList.add('show');
}

// ================================================================================================================================================================================================================================================
// renderSlots
// Um seletor por espaço, só com os itens que cabem nele.

function renderSlots() {
  const box = document.getElementById('kitSlots');
  box.innerHTML = '';
  const types = itemTypes();
  for (const key of EQUIP_SLOTS) {
    const row = document.createElement('div');
    row.className = 'row';
    const label = document.createElement('label');
    label.textContent = SLOT_NAMES[key];
    const select = document.createElement('select');
    select.innerHTML = options(types.filter(type => fitsSlot(type, key)), pendingEquip[key]);
    select.value = pendingEquip[key] || '';
    select.onchange = () => {
      if (select.value) pendingEquip[key] = select.value;
      else delete pendingEquip[key];
    };
    row.append(label, select);
    box.appendChild(row);
  }
}

// ================================================================================================================================================================================================================================================
// renderBag

function renderBag() {
  const box = document.getElementById('kitBagItems');
  box.innerHTML = '';
  const types = itemTypes();
  pendingBag.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'row';
    const select = document.createElement('select');
    select.innerHTML = options(types, entry.tipo);
    select.value = entry.tipo || '';
    select.onchange = () => { entry.tipo = select.value; };
    const count = document.createElement('input');
    Object.assign(count, { type: 'number', min: 1, max: 100, value: entry.count, title: 'Quantidade' });
    count.oninput = () => { entry.count = Math.max(1, Math.min(100, Math.floor(Number(count.value)) || 1)); };
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.onclick = () => { pendingBag.splice(index, 1); renderBag(); };
    row.append(select, count, remove);
    box.appendChild(row);
  });
}

document.getElementById('kitBtn').onclick = () => openKitForm();

document.getElementById('kitAddItem').onclick = () => {
  pendingBag.push({ tipo: '', count: 1 });
  renderBag();
};

document.getElementById('kitCancel').onclick = () => kitForm.classList.remove('show');

document.getElementById('kitConfirm').onclick = () => {
  state.kit = { equip: { ...pendingEquip }, mochila: pendingBag.filter(e => e.tipo).map(e => ({ tipo: e.tipo, count: e.count || 1 })) };
  kitForm.classList.remove('show');
};
