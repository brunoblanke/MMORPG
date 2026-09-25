// gerador/app/js/picker.js

import { spriteUrl } from './api.js';

// Painel da direita: os itens do Tibia por categoria, com busca pelo número.
// Item com várias variações (chão que muda pelo sqm) abre a lista delas.

const TABS = [
  { id: 'ground', label: 'Chão' },
  { id: 'border', label: 'Bordas' },
  { id: 'all', label: 'Todos' }
];

const picker = {
  items: [],
  byId: new Map(),
  tab: 'ground',
  search: '',
  selectedId: null,
  onPick: () => {},
  onUseAll: () => {}
};

const tabsEl = document.getElementById('pickerTabs');
const gridEl = document.getElementById('pickerGrid');
const searchEl = document.getElementById('pickerSearch');
const countEl = document.getElementById('pickerCount');
const variationsEl = document.getElementById('variations');
const variationsGridEl = document.getElementById('variationsGrid');

// ================================================================================================================================================================================================================================================
// initPicker
// items: [id, categoria, largura, altura, quadros, variações] (api/catalogo).
// onPick(id, variação) e onUseAll(id, total de variações).

export function initPicker(items, { onPick, onUseAll }) {
  picker.items = items;
  picker.byId = new Map(items.map(item => [item[0], item]));
  picker.onPick = onPick;
  picker.onUseAll = onUseAll;

  searchEl.addEventListener('input', () => {
    picker.search = searchEl.value.replace(/\D/g, '');
    renderGrid();
  });
  document.getElementById('useAllVariations').onclick = () => {
    const item = picker.byId.get(picker.selectedId);
    if (item) picker.onUseAll(item[0], item[5]);
  };

  renderTabs();
  renderGrid();
}

// ================================================================================================================================================================================================================================================
// itemCategory
// Categoria do item (ground, border, wall, object, item) ou null se não existe.

export function itemCategory(id) {
  const item = picker.byId.get(id);
  return item ? item[1] : null;
}

// ================================================================================================================================================================================================================================================
// setPickerTab

export function setPickerTab(tab) {
  if (picker.tab === tab) return;
  picker.tab = tab;
  renderTabs();
  renderGrid();
}

// ================================================================================================================================================================================================================================================
// renderTabs

function renderTabs() {
  tabsEl.innerHTML = '';
  for (const tab of TABS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'picker-tab' + (tab.id === picker.tab ? ' active' : '');
    button.textContent = tab.label;
    button.onclick = () => setPickerTab(tab.id);
    tabsEl.appendChild(button);
  }
}

// ================================================================================================================================================================================================================================================
// spriteCell

function spriteCell(id, variation, title, badge) {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'sprite-cell';
  cell.title = title;
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.alt = title;
  img.src = spriteUrl(id, variation);
  cell.appendChild(img);
  if (badge) {
    const tag = document.createElement('span');
    tag.className = 'badge';
    tag.textContent = badge;
    cell.appendChild(tag);
  }
  return cell;
}

// ================================================================================================================================================================================================================================================
// renderGrid

function renderGrid() {
  const visible = picker.items.filter(([id, category]) =>
    (picker.tab === 'all' || category === picker.tab) && (!picker.search || String(id).includes(picker.search)));

  gridEl.innerHTML = '';
  for (const [id, , , , frames, variations] of visible) {
    const extra = [variations > 1 ? `${variations} variações` : '', frames > 1 ? `${frames} quadros` : ''].filter(Boolean).join(' · ');
    const cell = spriteCell(id, 0, `Item ${id}${extra ? ` · ${extra}` : ''}`, variations > 1 ? `×${variations}` : '');
    if (id === picker.selectedId) cell.classList.add('selected');
    cell.onclick = () => {
      picker.selectedId = id;
      picker.onPick(id, 0);
      renderVariations();
      gridEl.querySelectorAll('.sprite-cell.selected').forEach(el => el.classList.remove('selected'));
      cell.classList.add('selected');
    };
    gridEl.appendChild(cell);
  }
  countEl.textContent = `${visible.length} sprites`;
}

// ================================================================================================================================================================================================================================================
// renderVariations
// Lista das variações do item escolhido (só aparece se ele tiver mais de uma).

function renderVariations() {
  const item = picker.byId.get(picker.selectedId);
  const total = item ? item[5] : 0;
  variationsEl.hidden = total < 2;
  if (total < 2) return;

  document.getElementById('variationsTitle').textContent = `Item ${item[0]}: ${total} variações`;
  variationsGridEl.innerHTML = '';
  for (let variation = 0; variation < total; variation++) {
    const cell = spriteCell(item[0], variation, `Variação ${variation + 1}`, String(variation + 1));
    cell.onclick = () => picker.onPick(item[0], variation);
    variationsGridEl.appendChild(cell);
  }
}
