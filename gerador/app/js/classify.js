// gerador/app/js/classify.js

import { fetchCatalog, fetchTaxonomy, fetchClassification, classify, spriteUrl } from './api.js';

// Página Classificar: todos os sprites do Tibia (itens ou criaturas) numa
// grade só, pra pôr cada um numa pasta (gerador/taxonomia.json). Clique marca,
// Shift+clique marca o intervalo desde o último clicado, Ctrl+A marca tudo o
// que está na tela e Esc limpa. A classificação fica em classificacao.json.

const page = {
  type: 'itens',
  items: [],
  creatures: [],
  taxonomy: { grupos: [] },
  classification: { itens: {}, criaturas: {} },
  selected: new Set(),
  anchor: null,
  visible: [],
  cells: { itens: new Map(), criaturas: new Map() },
  busy: false
};

const gridEl = document.getElementById('classifyGrid');
const showEl = document.getElementById('showFilter');
const tibiaEl = document.getElementById('tibiaFilter');
const tibiaFieldEl = document.getElementById('tibiaFilterField');
const targetEl = document.getElementById('targetFolder');
const countEl = document.getElementById('classifyCount');
const statusEl = document.getElementById('classifyStatus');

// ================================================================================================================================================================================================================================================
// boot

async function boot() {
  try {
    const [catalog, taxonomy, classification] = await Promise.all([fetchCatalog(), fetchTaxonomy(), fetchClassification()]);
    page.items = catalog.items;
    page.creatures = catalog.creatures;
    page.taxonomy = taxonomy;
    page.classification = classification;
  } catch (error) {
    status(`Não deu pra ler os sprites: ${error.message}. O gerador está rodando?`, 'error');
    return;
  }
  for (const button of document.querySelectorAll('.category[data-type]')) {
    button.onclick = () => setType(button.dataset.type);
  }
  showEl.onchange = () => { clearSelection(); render(); };
  tibiaEl.onchange = () => { clearSelection(); render(); };
  gridEl.addEventListener('click', onGridClick);
  document.getElementById('applyBtn').onclick = () => apply(targetEl.value || null, true);
  document.getElementById('unclassifyBtn').onclick = () => apply(null, false);
  document.getElementById('clearSelectionBtn').onclick = () => { clearSelection(); updateCells(); };
  document.addEventListener('keydown', onKey);
  setType('itens');
}

// ================================================================================================================================================================================================================================================
// status

function status(text, kind = '') {
  statusEl.textContent = text;
  statusEl.className = `status${kind ? ` ${kind}` : ''}`;
}

// ================================================================================================================================================================================================================================================
// setType
// Troca entre itens e criaturas (cada um tem as suas pastas).

function setType(type) {
  page.type = type;
  for (const button of document.querySelectorAll('.category[data-type]')) {
    button.classList.toggle('active', button.dataset.type === type);
  }
  tibiaFieldEl.hidden = type !== 'itens';
  fillFolders(showEl, [['pending', 'Não classificados'], ['all', 'Todos']]);
  fillFolders(targetEl, [['', 'Escolha a pasta…']]);
  clearSelection();
  render();
}

// ================================================================================================================================================================================================================================================
// fillFolders
// Pastas do tipo aberto no <select>, agrupadas (grupo · seção), depois das
// opções fixas [valor, texto].

function fillFolders(select, fixed) {
  select.innerHTML = '';
  for (const [value, text] of fixed) select.appendChild(new Option(text, value));
  for (const group of page.taxonomy.grupos) {
    for (const section of group.secoes) {
      const folders = section.pastas.filter(folder => (folder.ferramenta === 'criaturas') === (page.type === 'criaturas'));
      if (!folders.length) continue;
      const optgroup = document.createElement('optgroup');
      optgroup.label = section.nome ? `${group.nome} · ${section.nome}` : group.nome;
      for (const folder of folders) optgroup.appendChild(new Option(folder.nome, `${group.id}/${folder.id}`));
      select.appendChild(optgroup);
    }
  }
}

// ================================================================================================================================================================================================================================================
// folderInfo
// { label: 'Itens › Espadas', short: 'Espadas' } da pasta 'grupo/pasta', ou null.

function folderInfo(value) {
  if (!value) return null;
  const [groupId, folderId] = value.split('/');
  const group = page.taxonomy.grupos.find(item => item.id === groupId);
  if (!group) return null;
  for (const section of group.secoes) {
    const folder = section.pastas.find(item => item.id === folderId);
    if (folder) return { label: `${group.nome} › ${folder.nome}`, short: folder.nome };
  }
  return null;
}

// ================================================================================================================================================================================================================================================
// folderColor
// Uma cor fixa por pasta, pra dar pra ver de longe o que foi junto.

function folderColor(value) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return `hsl(${hash}, 65%, 60%)`;
}

// ================================================================================================================================================================================================================================================
// visibleIds
// Os ids que passam nos filtros, na ordem do Tibia.

function visibleIds() {
  const assigned = page.classification[page.type];
  const show = showEl.value;
  let list = page.type === 'itens'
    ? page.items.filter(([, category]) => !tibiaEl.value || category === tibiaEl.value).map(([id]) => id)
    : page.creatures.map(([id]) => id);
  if (show === 'pending') list = list.filter(id => !assigned[id]);
  else if (show !== 'all') list = list.filter(id => assigned[id] === show);
  return list;
}

// ================================================================================================================================================================================================================================================
// cellFor
// O quadradinho do sprite (criado uma vez e reaproveitado, pra não baixar a
// imagem de novo).

function cellFor(id) {
  const cells = page.cells[page.type];
  if (cells.has(id)) return cells.get(id);
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'sprite-tile';
  cell.dataset.id = id;
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.alt = '';
  img.src = page.type === 'itens' ? spriteUrl(id) : `/api/criatura/${id}/miniatura`;
  const tag = document.createElement('span');
  tag.className = 'tile-tag';
  cell.append(img, tag);
  cells.set(id, cell);
  return cell;
}

// ================================================================================================================================================================================================================================================
// updateCell
// Marcação e pasta do quadradinho.

function updateCell(cell) {
  const id = Number(cell.dataset.id);
  const folder = page.classification[page.type][id];
  const info = folderInfo(folder);
  cell.classList.toggle('selected', page.selected.has(id));
  cell.title = `#${id}${info ? ` · ${info.label}` : ''}`;
  const tag = cell.querySelector('.tile-tag');
  tag.hidden = !info;
  if (info) {
    tag.textContent = info.short;
    tag.style.background = folderColor(folder);
  }
}

// ================================================================================================================================================================================================================================================
// updateCells

function updateCells() {
  for (const id of page.visible) updateCell(cellFor(id));
  updateCount();
}

// ================================================================================================================================================================================================================================================
// updateCount

function updateCount() {
  const noun = page.type === 'itens' ? 'sprites' : 'criaturas';
  countEl.textContent = `${page.visible.length} ${noun} na tela · ${page.selected.size} marcados`;
}

// ================================================================================================================================================================================================================================================
// render

function render() {
  page.visible = visibleIds();
  gridEl.replaceChildren(...page.visible.map(cellFor));
  updateCells();
}

// ================================================================================================================================================================================================================================================
// clearSelection

function clearSelection() {
  page.selected.clear();
  page.anchor = null;
}

// ================================================================================================================================================================================================================================================
// onGridClick
// Clique marca/desmarca; com Shift, marca tudo entre o último clicado e este.

function onGridClick(evt) {
  const cell = evt.target.closest('.sprite-tile');
  if (!cell) return;
  const id = Number(cell.dataset.id);
  const from = page.visible.indexOf(page.anchor);
  if (evt.shiftKey && from >= 0) {
    const to = page.visible.indexOf(id);
    const [start, end] = from < to ? [from, to] : [to, from];
    for (const other of page.visible.slice(start, end + 1)) page.selected.add(other);
  } else if (page.selected.has(id)) {
    page.selected.delete(id);
  } else {
    page.selected.add(id);
  }
  page.anchor = id;
  updateCells();
}

// ================================================================================================================================================================================================================================================
// onKey
// Esc limpa a seleção; Ctrl+A marca tudo o que está na tela.

function onKey(evt) {
  if (evt.target.closest('select, input')) return;
  if (evt.key === 'Escape') {
    clearSelection();
    updateCells();
  } else if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === 'a') {
    evt.preventDefault();
    for (const id of page.visible) page.selected.add(id);
    updateCells();
  }
}

// ================================================================================================================================================================================================================================================
// apply
// Põe os marcados na pasta (ou tira da pasta, com folder null).

async function apply(folder, needsFolder) {
  if (page.busy) return;
  if (!page.selected.size) {
    status('Marque os sprites primeiro.', 'error');
    return;
  }
  if (needsFolder && !folder) {
    status('Escolha a pasta em "Pôr na pasta".', 'error');
    return;
  }
  const ids = [...page.selected];
  page.busy = true;
  try {
    page.classification = await classify(page.type, ids, folder);
    const info = folderInfo(folder);
    status(info ? `${ids.length} em ${info.label}.` : `${ids.length} tirados da pasta.`, 'ok');
    clearSelection();
    render();
  } catch (error) {
    status(`Não deu pra salvar: ${error.message}`, 'error');
  } finally {
    page.busy = false;
  }
}

boot();
