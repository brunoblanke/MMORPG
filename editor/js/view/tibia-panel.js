// editor/js/view/tibia-panel.js

import { state } from '../model/state.js';
import { getTibiaRegistry, setTibiaRegistry, tibiaItemType } from '../../../shared/tibia-registry.js';
import { renderTools } from './tools-panel.js';
import { refreshCreatureOptions } from './forms.js';
import { scheduleRender } from './canvas-renderer.js';

// Painel "Sprites Tibia" (à direita do mapa): tudo do Tibia.spr/Tibia.dat de
// img/780, separado por categoria. Clicar num item gera o PNG dele no
// servidor (se ainda não foi gerado) e já deixa pronto pra pintar no mapa;
// clicar numa criatura pede nome e level e gera a criatura.

const CATEGORIES = [
  { id: 'ground', label: 'Chão' },
  { id: 'border', label: 'Bordas' },
  { id: 'wall', label: 'Paredes' },
  { id: 'object', label: 'Objetos' },
  { id: 'item', label: 'Itens' },
  { id: 'creature', label: 'Criaturas' }
];

const panel = {
  catalog: null,
  category: 'ground',
  search: '',
  onlyReady: false,
  pendingCreature: null,
  busy: false
};

const tabsEl = document.getElementById('tibiaTabs');
const gridEl = document.getElementById('tibiaGrid');
const statusEl = document.getElementById('tibiaStatus');
const searchEl = document.getElementById('tibiaSearch');
const onlyReadyEl = document.getElementById('tibiaOnlyReady');
const formEl = document.getElementById('tibiaCreatureForm');

// ================================================================================================================================================================================================================================================
// initTibiaPanel
// Busca o catálogo no servidor e monta o painel. Resposta que não é JSON vem
// de um servidor sem essa rota (aberto antes da atualização).

export async function initTibiaPanel() {
  renderTabs();
  setStatus('Lendo Tibia.spr e Tibia.dat…');
  try {
    const response = await fetch('/api/tibia/catalog');
    if (!(response.headers.get('content-type') || '').includes('json')) {
      setStatus('O servidor aberto é de antes desta versão: feche a janela do init-server.bat e abra de novo.', true);
      return;
    }
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.message || `HTTP ${response.status}`);
    panel.catalog = data;
    setTibiaRegistry(data.registry);
    refreshCreatureOptions();
    setStatus('');
    renderGrid();
  } catch (error) {
    setStatus(`Sprites do Tibia indisponíveis: ${error.message}. O servidor (init-server.bat) está rodando?`, true);
  }
}

// ================================================================================================================================================================================================================================================
// setStatus

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
  statusEl.hidden = !text;
}

// ================================================================================================================================================================================================================================================
// renderTabs

function renderTabs() {
  tabsEl.innerHTML = '';
  for (const category of CATEGORIES) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tibia-tab' + (category.id === panel.category ? ' active' : '');
    tab.textContent = category.label;
    tab.onclick = () => {
      panel.category = category.id;
      closeCreatureForm();
      renderTabs();
      renderGrid();
    };
    tabsEl.appendChild(tab);
  }
}

// ================================================================================================================================================================================================================================================
// visibleEntries
// O que aparece na aba: [id, largura, altura, quadros], filtrado pela busca
// (número) e, se marcado, só pelo que já foi gerado.

function visibleEntries() {
  if (!panel.catalog) return [];
  const registry = getTibiaRegistry();
  const isCreature = panel.category === 'creature';
  const generatedOutfits = new Set(Object.values(registry.creatures).map(c => c.outfit));

  const entries = isCreature
    ? panel.catalog.creatures
    : panel.catalog.items.filter(([, category]) => category === panel.category).map(([id, , w, h, frames]) => [id, w, h, frames]);

  return entries.filter(([id]) => {
    if (panel.search && !String(id).includes(panel.search)) return false;
    if (!panel.onlyReady) return true;
    return isCreature ? generatedOutfits.has(id) : !!registry.items[id];
  });
}

// ================================================================================================================================================================================================================================================
// renderGrid

export function renderGrid() {
  gridEl.innerHTML = '';
  if (!panel.catalog) return;

  const registry = getTibiaRegistry();
  const isCreature = panel.category === 'creature';
  const generatedOutfits = new Set(Object.values(registry.creatures).map(c => c.outfit));
  const entries = visibleEntries();

  for (const [id, w, h, frames] of entries) {
    const cell = document.createElement('button');
    cell.type = 'button';
    const ready = isCreature ? generatedOutfits.has(id) : !!registry.items[id];
    const selected = isCreature
      ? panel.pendingCreature === id
      : state.tool === 'tibia' && state.tibiaPaint === tibiaItemType(id, panel.category);
    cell.className = 'tibia-cell' + (ready ? ' ready' : '') + (selected ? ' selected' : '') + (w > 1 || h > 1 ? ' big' : '');
    cell.title = `${isCreature ? 'Criatura' : 'Item'} ${id}${frames > 1 ? ` · ${frames} quadros` : ''}${ready ? ' · já gerado' : ''}`;

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = String(id);
    img.src = `/api/tibia/thumb/${isCreature ? 'creature' : 'item'}/${id}`;
    cell.appendChild(img);

    cell.onclick = () => (isCreature ? openCreatureForm(id) : pickItem(id));
    gridEl.appendChild(cell);
  }

  const total = entries.length;
  document.getElementById('tibiaCount').textContent = `${total} ${total === 1 ? 'sprite' : 'sprites'}`;
}

// ================================================================================================================================================================================================================================================
// pickItem
// Gera o PNG (se preciso) e seleciona o item como ferramenta de pintura.

async function pickItem(id) {
  if (panel.busy) return;
  const category = panel.category;
  if (!getTibiaRegistry().items[id]) {
    const result = await requestImport({ kind: 'item', id }, `Gerando item ${id}…`);
    if (!result) return;
    getTibiaRegistry().items[id] = result.item;
  }
  state.tool = 'tibia';
  state.tibiaPaint = tibiaItemType(id, category);
  state.floorAccordionOpen = false;
  state.itemAccordionOpen = false;
  state.borderAccordionOpen = false;
  renderTools();
  setStatus(`Pintando ${category === 'ground' ? 'chão' : 'item'} ${id}. A borracha tira o que está por cima.`);
}

// ================================================================================================================================================================================================================================================
// requestImport
// Pede ao servidor pra gerar o PNG. Devolve a resposta ou null (erro já mostrado).

async function requestImport(body, busyText) {
  panel.busy = true;
  setStatus(busyText);
  try {
    const response = await fetch('/api/tibia/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);
    return result;
  } catch (error) {
    setStatus(`Não deu pra gerar: ${error.message}`, true);
    return null;
  } finally {
    panel.busy = false;
  }
}

// ================================================================================================================================================================================================================================================
// openCreatureForm
// Criatura escolhida: pede nome, level padrão e (opcional) o item do cadáver.

function openCreatureForm(outfitId) {
  panel.pendingCreature = outfitId;
  const existing = Object.entries(getTibiaRegistry().creatures).find(([, def]) => def.outfit === outfitId);
  document.getElementById('tibiaCreatureTitle').textContent = `Criatura ${outfitId}`;
  document.getElementById('tibiaCreatureName').value = existing ? existing[0] : '';
  document.getElementById('tibiaCreatureLvl').value = existing ? existing[1].defaultLvl : 5;
  document.getElementById('tibiaCreatureCorpse').value = '';
  formEl.hidden = false;
  renderGrid();
  document.getElementById('tibiaCreatureName').focus();
}

// ================================================================================================================================================================================================================================================
// closeCreatureForm

function closeCreatureForm() {
  panel.pendingCreature = null;
  formEl.hidden = true;
}

// ================================================================================================================================================================================================================================================
// submitCreatureForm
// Gera a criatura e deixa a ferramenta Criatura pronta com ela.

async function submitCreatureForm(evt) {
  evt.preventDefault();
  if (panel.busy || panel.pendingCreature === null) return;
  const body = {
    kind: 'creature',
    id: panel.pendingCreature,
    name: document.getElementById('tibiaCreatureName').value,
    lvl: document.getElementById('tibiaCreatureLvl').value,
    corpse: document.getElementById('tibiaCreatureCorpse').value.trim() || null
  };
  const result = await requestImport(body, 'Gerando criatura…');
  if (!result) return;

  getTibiaRegistry().creatures[result.name] = result.creature;
  if (result.creature.corpse) await refreshRegistry();
  refreshCreatureOptions();
  state.tool = 'enemy';
  state.enemyPaint = result.name;
  closeCreatureForm();
  renderTools();
  scheduleRender();
  setStatus(`Criatura "${result.name}" pronta: clique no mapa pra colocar.`);
}

// ================================================================================================================================================================================================================================================
// refreshRegistry
// Relê o registro do servidor (depois de gerar algo junto, como o cadáver).

async function refreshRegistry() {
  const response = await fetch('/api/tibia/catalog');
  const data = await response.json().catch(() => null);
  if (data && data.success) setTibiaRegistry(data.registry);
}

searchEl.addEventListener('input', () => {
  panel.search = searchEl.value.replace(/\D/g, '');
  renderGrid();
});

onlyReadyEl.addEventListener('change', () => {
  panel.onlyReady = onlyReadyEl.checked;
  renderGrid();
});

formEl.addEventListener('submit', submitCreatureForm);
window.addEventListener('toolchange', () => renderGrid());
document.getElementById('tibiaCreatureCancel').onclick = () => {
  closeCreatureForm();
  renderGrid();
};
