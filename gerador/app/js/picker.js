// gerador/app/js/picker.js

import { spriteUrl } from './api.js';

// Painel da direita: os sprites do Tibia, com busca pelo número. As abas
// mudam com a categoria aberta (pisos: chão, bordas, todos os itens;
// criaturas: as criaturas e os itens, pro cadáver; paredes: paredes e todos
// os itens; objetos: objetos, itens e todos) e cada categoria lembra a
// última aba usada. Item com várias variações (chão que muda pelo sqm) abre a
// lista delas.

const MODES = {
  floors: [
    { id: 'ground', label: 'Chão' },
    { id: 'border', label: 'Bordas' },
    { id: 'all', label: 'Todos' }
  ],
  creatures: [
    { id: 'creature', label: 'Criaturas' },
    { id: 'all', label: 'Itens' }
  ],
  walls: [
    { id: 'wall', label: 'Paredes' },
    { id: 'all', label: 'Todos' }
  ],
  objects: [
    { id: 'object', label: 'Objetos' },
    { id: 'item', label: 'Itens' },
    { id: 'all', label: 'Todos' }
  ]
};

const picker = {
  items: [],
  creatures: [],
  itemsById: new Map(),
  creaturesById: new Map(),
  mode: 'floors',
  tabByMode: { floors: 'ground', creatures: 'creature', walls: 'wall', objects: 'object' },
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
const useAllEl = document.getElementById('useAllVariations');

// ================================================================================================================================================================================================================================================
// initPicker
// catalog: { items: [id, categoria, largura, altura, quadros, variações],
// creatures: [id, largura, altura, quadros, tem cores, addons] } (api/catalogo).
// onPick(tipo, id, variação) — tipo 'item' ou 'creature'; onUseAll(id, total).

export function initPicker(catalog, { onPick, onUseAll }) {
  picker.items = catalog.items;
  picker.creatures = catalog.creatures;
  picker.itemsById = new Map(catalog.items.map(item => [item[0], item]));
  picker.creaturesById = new Map(catalog.creatures.map(creature => [creature[0], creature]));
  picker.onPick = onPick;
  picker.onUseAll = onUseAll;

  searchEl.addEventListener('input', () => {
    picker.search = searchEl.value.replace(/\D/g, '');
    renderGrid();
  });
  useAllEl.onclick = () => {
    const item = picker.itemsById.get(picker.selectedId);
    if (item) picker.onUseAll(item[0], item[5]);
  };

  renderTabs();
  renderGrid();
}

// ================================================================================================================================================================================================================================================
// itemCategory
// Categoria do item (ground, border, wall, object, item) ou null se não existe.

export function itemCategory(id) {
  const item = picker.itemsById.get(id);
  return item ? item[1] : null;
}

// ================================================================================================================================================================================================================================================
// itemFrames
// Quantos quadros de animação o item tem (1 se não existe).

export function itemFrames(id) {
  const item = picker.itemsById.get(id);
  return item ? item[4] : 1;
}

// ================================================================================================================================================================================================================================================
// creatureInfo
// { id, size, frames, colors, addons } da criatura, ou null.

export function creatureInfo(id) {
  const creature = picker.creaturesById.get(id);
  if (!creature) return null;
  const [, w, h, frames, colors, addons] = creature;
  return { id, size: Math.max(w, h) * 32, frames, colors, addons };
}

// ================================================================================================================================================================================================================================================
// setPickerMode
// 'floors', 'creatures', 'walls' ou 'objects': troca as abas, voltando pra última usada nesse
// modo, e limpa a busca.

export function setPickerMode(mode) {
  if (picker.mode === mode) return;
  picker.mode = mode;
  picker.selectedId = null;
  picker.search = '';
  searchEl.value = '';
  variationsEl.hidden = true;
  renderTabs();
  renderGrid();
}

// ================================================================================================================================================================================================================================================
// currentTab

function currentTab() {
  return picker.tabByMode[picker.mode];
}

// ================================================================================================================================================================================================================================================
// renderTabs

function renderTabs() {
  tabsEl.innerHTML = '';
  tabsEl.style.gridTemplateColumns = `repeat(${MODES[picker.mode].length}, 1fr)`;
  for (const tab of MODES[picker.mode]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'picker-tab' + (tab.id === currentTab() ? ' active' : '');
    button.textContent = tab.label;
    button.onclick = () => {
      picker.tabByMode[picker.mode] = tab.id;
      renderTabs();
      renderGrid();
    };
    tabsEl.appendChild(button);
  }
}

// ================================================================================================================================================================================================================================================
// spriteCell

function spriteCell(src, title, badge) {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'sprite-cell';
  cell.title = title;
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.alt = title;
  img.src = src;
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
// markSelected

function markSelected(cell) {
  gridEl.querySelectorAll('.sprite-cell.selected').forEach(el => el.classList.remove('selected'));
  cell.classList.add('selected');
}

// ================================================================================================================================================================================================================================================
// renderGrid

function renderGrid() {
  gridEl.innerHTML = '';
  const matches = (id) => !picker.search || String(id).includes(picker.search);

  if (currentTab() === 'creature') {
    const visible = picker.creatures.filter(([id]) => matches(id));
    for (const [id, w, h, frames, colors, addons] of visible) {
      const extra = [`${Math.max(w, h) * 32} px`, `${frames} quadros`, colors ? 'cores' : '', addons ? `${addons} addons` : ''].filter(Boolean).join(' · ');
      const cell = spriteCell(`/api/criatura/${id}/miniatura`, `Criatura ${id} · ${extra}`, colors ? 'cor' : '');
      cell.onclick = () => {
        markSelected(cell);
        picker.onPick('creature', id, 0);
      };
      gridEl.appendChild(cell);
    }
    countEl.textContent = `${visible.length} criaturas`;
    return;
  }

  const tab = currentTab();
  const visible = picker.items.filter(([id, category]) => (tab === 'all' || category === tab) && matches(id));
  for (const [id, , , , frames, variations] of visible) {
    const extra = [variations > 1 ? `${variations} variações` : '', frames > 1 ? `${frames} quadros` : ''].filter(Boolean).join(' · ');
    const cell = spriteCell(spriteUrl(id, 0), `Item ${id}${extra ? ` · ${extra}` : ''}`, variations > 1 ? `×${variations}` : '');
    if (id === picker.selectedId) cell.classList.add('selected');
    cell.onclick = () => {
      picker.selectedId = id;
      markSelected(cell);
      picker.onPick('item', id, 0);
      renderVariations();
    };
    gridEl.appendChild(cell);
  }
  countEl.textContent = `${visible.length} sprites`;
}

// ================================================================================================================================================================================================================================================
// renderVariations
// Lista das variações do item escolhido (só aparece se ele tiver mais de uma).

function renderVariations() {
  const item = picker.itemsById.get(picker.selectedId);
  const total = item ? item[5] : 0;
  variationsEl.hidden = total < 2;
  if (total < 2) return;

  useAllEl.hidden = picker.mode !== 'floors';
  document.getElementById('variationsTitle').textContent = `Item ${item[0]}: ${total} variações`;
  variationsGridEl.innerHTML = '';
  for (let variation = 0; variation < total; variation++) {
    const cell = spriteCell(spriteUrl(item[0], variation), `Variação ${variation + 1}`, String(variation + 1));
    cell.onclick = () => picker.onPick('item', item[0], variation);
    variationsGridEl.appendChild(cell);
  }
}
