// gerador/app/js/creatures.js

import { saveProject } from './api.js';
import { creatureInfo, itemCategory } from './picker.js';
import { sourceUrl, sourceLabel, loadImage, isReady, drawAnchored, readPngFile, normalizeName, setStatus } from './common.js';
import { refreshProjects } from './projects.js';

// Folha de criatura (quadros de 32 ou 64 px, o maior entre criatura e cadáver):
//   linhas 1–4  sul, norte, leste, oeste — 1º quadro parado, depois andando
//   linha 5     cadáver: fresco, apodrecendo, ossos
// A criatura vem do Tibia (roupa de humano com as cores e addons escolhidos,
// já no lugar certo do sqm); cada estágio do cadáver vem de um item do Tibia
// ou de um PNG enviado.

const CATEGORY = 'criaturas';
const DIRECTIONS = ['Sul', 'Norte', 'Leste', 'Oeste'];
const COLOR_PARTS = ['Cabeça', 'Corpo', 'Pernas', 'Pés'];
const DEFAULT_COLORS = [78, 69, 58, 76];
const CORPSE_STAGES = [
  { key: 'fresco', name: 'Fresco' },
  { key: 'apodrecendo', name: 'Apodrecendo' },
  { key: 'ossos', name: 'Ossos' }
];
const PREVIEW_CELL = 64;
const WALK_FRAME_MS = 160;

const creatures = {
  outfit: null,
  colors: [...DEFAULT_COLORS],
  addons: [],
  sheetImage: null,
  corpse: {},
  corpseImages: new Map(),
  selectedStage: 'fresco',
  selectedPart: 0,
  palette: [],
  frame: 0,
  name: '',
  dirty: false,
  saving: false
};

const statusEl = document.getElementById('creatureStatus');
const nameEl = document.getElementById('creatureName');
const infoEl = document.getElementById('creatureInfo');
const thumbCanvas = document.getElementById('creatureThumb');
const walkCanvas = document.getElementById('walkPreview');
const sheetCanvas = document.getElementById('creatureSheet');
const slotsEl = document.getElementById('corpseSlots');

// ================================================================================================================================================================================================================================================
// initCreatures

function initCreatures() {
  renderCorpseSlots();
  document.getElementById('creatureSaveForm').addEventListener('submit', (evt) => {
    evt.preventDefault();
    save();
  });
  document.getElementById('corpseClear').onclick = () => setCorpse(creatures.selectedStage, null);
  document.getElementById('corpseUpload').addEventListener('change', async (evt) => {
    const file = evt.target.files[0];
    evt.target.value = '';
    if (file) setCorpse(creatures.selectedStage, { png: await readPngFile(file) });
  });
  nameEl.addEventListener('input', () => { creatures.dirty = true; });
  fetch('/api/paleta').then(r => r.json()).then(data => {
    creatures.palette = data.cores || [];
    renderColors();
  });
  setInterval(() => {
    creatures.frame++;
    drawWalkPreview();
  }, WALK_FRAME_MS);
  render();
}

// ================================================================================================================================================================================================================================================
// status

function status(text, kind) {
  setStatus(statusEl, text, kind);
}

// ================================================================================================================================================================================================================================================
// pick
// Da lista da direita: criatura escolhe a criatura; item vai pro estágio do
// cadáver selecionado (com "Preencher em sequência", os seguintes recebem
// id+1, id+2 enquanto forem itens da mesma categoria).

function pick(kind, id, variation) {
  if (kind === 'creature') {
    setOutfit(id);
    return;
  }
  const keys = CORPSE_STAGES.map(stage => stage.key);
  const start = keys.indexOf(creatures.selectedStage);
  const sequence = document.getElementById('corpseSequence').checked && variation === 0;
  const category = itemCategory(id);
  let filled = 0;
  for (const key of sequence ? keys.slice(start) : [creatures.selectedStage]) {
    if (filled > 0 && itemCategory(id + filled) !== category) break;
    setCorpse(key, { tibia: { id: id + filled, variacao: filled === 0 ? variation : 0 } }, false);
    filled++;
  }
  creatures.selectedStage = keys[Math.min(start + filled, keys.length - 1)];
  render();
}

// ================================================================================================================================================================================================================================================
// setOutfit
// Troca a criatura (as cores continuam; os addons zeram).

function setOutfit(id) {
  const info = creatureInfo(id);
  if (!info) return;
  creatures.outfit = info;
  creatures.addons = [];
  creatures.dirty = true;
  reloadSheet();
  renderColors();
  renderAddons();
  render();
}

// ================================================================================================================================================================================================================================================
// reloadSheet
// Pede ao servidor a folha da criatura (direções × quadros) com as cores e
// addons atuais.

function reloadSheet() {
  if (!creatures.outfit) {
    creatures.sheetImage = null;
    return;
  }
  const params = new URLSearchParams();
  if (creatures.outfit.colors) params.set('cores', creatures.colors.join(','));
  if (creatures.addons.length) params.set('addons', creatures.addons.join(','));
  const url = `/api/criatura/${creatures.outfit.id}/folha?${params}`;
  const img = loadImage(url, () => {
    if (creatures.sheetImage === img) render();
  });
  creatures.sheetImage = img;
}

// ================================================================================================================================================================================================================================================
// renderColors
// Partes da roupa (cabeça, corpo, pernas, pés) e a paleta do Tibia; só pra
// criatura que tem cores (roupa de humano).

function renderColors() {
  const box = document.getElementById('outfitColors');
  box.hidden = !(creatures.outfit && creatures.outfit.colors);
  if (box.hidden || !creatures.palette.length) return;

  const partsEl = document.getElementById('colorParts');
  partsEl.innerHTML = '';
  COLOR_PARTS.forEach((label, part) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'color-part' + (part === creatures.selectedPart ? ' selected' : '');
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = creatures.palette[creatures.colors[part]];
    button.append(swatch, label);
    button.onclick = () => {
      creatures.selectedPart = part;
      renderColors();
    };
    partsEl.appendChild(button);
  });

  const paletteEl = document.getElementById('palette');
  paletteEl.innerHTML = '';
  creatures.palette.forEach((color, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = `Cor ${index}`;
    button.style.background = color;
    if (index === creatures.colors[creatures.selectedPart]) button.className = 'selected';
    button.onclick = () => {
      creatures.colors[creatures.selectedPart] = index;
      creatures.dirty = true;
      reloadSheet();
      renderColors();
    };
    paletteEl.appendChild(button);
  });
}

// ================================================================================================================================================================================================================================================
// renderAddons

function renderAddons() {
  const box = document.getElementById('outfitAddons');
  const total = creatures.outfit ? creatures.outfit.addons : 0;
  box.hidden = total < 1;
  const list = document.getElementById('addonList');
  list.innerHTML = '';
  for (let addon = 1; addon <= total; addon++) {
    const label = document.createElement('label');
    label.className = 'checkline';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = creatures.addons.includes(addon);
    input.onchange = () => {
      creatures.addons = input.checked ? [...creatures.addons, addon].sort() : creatures.addons.filter(a => a !== addon);
      creatures.dirty = true;
      reloadSheet();
    };
    label.append(input, `Addon ${addon}`);
    list.appendChild(label);
  }
}

// ================================================================================================================================================================================================================================================
// renderCorpseSlots

function renderCorpseSlots() {
  slotsEl.innerHTML = '';
  for (const stage of CORPSE_STAGES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'slot';
    button.dataset.key = stage.key;
    const canvas = document.createElement('canvas');
    canvas.width = PREVIEW_CELL;
    canvas.height = PREVIEW_CELL;
    const label = document.createElement('span');
    label.className = 'slot-name';
    label.textContent = stage.name;
    const source = document.createElement('span');
    source.className = 'slot-source';
    button.append(canvas, label, source);
    button.onclick = () => {
      creatures.selectedStage = stage.key;
      render();
    };
    slotsEl.appendChild(button);
  }
}

// ================================================================================================================================================================================================================================================
// setCorpse

function setCorpse(key, source, redraw = true) {
  if (source) {
    creatures.corpse[key] = source;
    const img = loadImage(sourceUrl(source), () => {
      if (creatures.corpse[key] === source) render();
    });
    creatures.corpseImages.set(source, img);
  } else {
    delete creatures.corpse[key];
  }
  creatures.dirty = true;
  if (redraw) render();
}

// ================================================================================================================================================================================================================================================
// corpseImage

function corpseImage(key) {
  const source = creatures.corpse[key];
  const img = source && creatures.corpseImages.get(source);
  return isReady(img) ? img : null;
}

// ================================================================================================================================================================================================================================================
// outfitSize
// Tamanho do quadro da criatura: o da folha que veio do servidor (que já
// cabe o deslocamento do Tibia) ou, enquanto carrega, o do catálogo.

function outfitSize() {
  if (!creatures.outfit) return 32;
  const img = creatures.sheetImage;
  return isReady(img) ? img.naturalHeight / 4 : creatures.outfit.size;
}

// ================================================================================================================================================================================================================================================
// frameSize
// Tamanho do quadro na folha: o maior entre a criatura e os cadáveres.

function frameSize() {
  let size = outfitSize();
  for (const stage of CORPSE_STAGES) {
    const img = corpseImage(stage.key);
    if (img) size = Math.max(size, img.naturalWidth > 32 || img.naturalHeight > 32 ? 64 : 32);
  }
  return size;
}

// ================================================================================================================================================================================================================================================
// drawCreatureFrame
// Um quadro da folha da criatura (direção × quadro) numa célula size × size.

function drawCreatureFrame(ctx, direction, frame, x, y, size) {
  const img = creatures.sheetImage;
  if (!isReady(img) || !creatures.outfit) return;
  const own = outfitSize();
  ctx.drawImage(img, frame * own, direction * own, own, own, x + size - own, y + size - own, own, own);
}

// ================================================================================================================================================================================================================================================
// render

function render() {
  for (const button of slotsEl.querySelectorAll('.slot')) {
    const key = button.dataset.key;
    button.classList.toggle('selected', key === creatures.selectedStage);
    const ctx = button.querySelector('canvas').getContext('2d');
    ctx.clearRect(0, 0, PREVIEW_CELL, PREVIEW_CELL);
    const img = corpseImage(key);
    if (img) drawAnchored(ctx, img, 0, 0, PREVIEW_CELL);
    button.querySelector('.slot-source').textContent = sourceLabel(creatures.corpse[key]);
  }

  const outfit = creatures.outfit;
  infoEl.innerHTML = outfit
    ? `<b>Criatura ${outfit.id}</b><br>${outfitSize()} px · ${outfit.frames} quadros por direção${outfit.colors ? ' · roupa com cores' : ''}${outfit.addons ? ` · ${outfit.addons} addons` : ''}`
    : 'Nenhuma criatura escolhida. Abra a aba Criaturas à direita.';
  const thumb = thumbCanvas.getContext('2d');
  thumb.clearRect(0, 0, 64, 64);
  drawCreatureFrame(thumb, 0, 0, 0, 0, 64);

  composeSheet(sheetCanvas);
  drawWalkPreview();
}

// ================================================================================================================================================================================================================================================
// composeSheet
// A folha final no canvas (e ajusta o tamanho dele).

function composeSheet(canvas) {
  const size = frameSize();
  const frames = creatures.outfit ? creatures.outfit.frames : 1;
  const columns = Math.max(frames, CORPSE_STAGES.length);
  canvas.width = columns * size;
  canvas.height = 5 * size;
  if (canvas === sheetCanvas) {
    canvas.style.width = `${canvas.width * 2}px`;
    canvas.style.height = `${canvas.height * 2}px`;
    document.getElementById('creatureSheetSize').textContent = `(${canvas.width} × ${canvas.height})`;
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let direction = 0; direction < 4; direction++) {
    for (let frame = 0; frame < frames; frame++) drawCreatureFrame(ctx, direction, frame, frame * size, direction * size, size);
  }
  CORPSE_STAGES.forEach((stage, i) => {
    const img = corpseImage(stage.key);
    if (img) drawAnchored(ctx, img, i * size, 4 * size, size);
  });
}

// ================================================================================================================================================================================================================================================
// drawWalkPreview
// As 4 direções andando (passando por todos os quadros) e os 3 estágios do cadáver.

function drawWalkPreview() {
  const ctx = walkCanvas.getContext('2d');
  ctx.clearRect(0, 0, walkCanvas.width, walkCanvas.height);
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#8b93a3';
  const frames = creatures.outfit ? creatures.outfit.frames : 1;
  const frame = creatures.frame % frames;

  DIRECTIONS.forEach((label, direction) => {
    const x = 16 + direction * 104;
    ctx.fillText(label, x, 12);
    drawCreatureFrame(ctx, direction, frame, x, 20, PREVIEW_CELL);
  });
  CORPSE_STAGES.forEach((stage, i) => {
    const x = 16 + i * 104;
    ctx.fillText(stage.name, x, 108);
    const img = corpseImage(stage.key);
    if (img) drawAnchored(ctx, img, x, 116, PREVIEW_CELL);
  });
}

// ================================================================================================================================================================================================================================================
// save

async function save() {
  if (creatures.saving) return;
  const name = normalizeName(nameEl.value);
  if (!creatures.outfit) {
    status('Escolha a criatura na aba Criaturas, à direita.', 'error');
    return;
  }
  if (!name) {
    status('Dê um nome à criatura (ex.: rato).', 'error');
    return;
  }
  const loading = !isReady(creatures.sheetImage) || Object.keys(creatures.corpse).some(key => !corpseImage(key));
  if (loading) {
    status('Espere as imagens terminarem de carregar.', 'error');
    return;
  }

  nameEl.value = name;
  creatures.saving = true;
  document.getElementById('creatureSaveBtn').disabled = true;
  const canvas = document.createElement('canvas');
  composeSheet(canvas);
  const recipe = {
    formato: {
      quadro: frameSize(),
      quadros: creatures.outfit.frames,
      linhas: ['sul', 'norte', 'leste', 'oeste', 'cadáver: fresco, apodrecendo, ossos']
    },
    criatura: { id: creatures.outfit.id, cores: creatures.colors, addons: creatures.addons },
    cadaver: creatures.corpse
  };

  try {
    const result = await saveProject(CATEGORY, name, recipe, canvas.toDataURL('image/png'));
    creatures.name = name;
    creatures.dirty = false;
    status(`Salvo em gerador/${result.arquivo}`, 'ok');
    refreshProjects();
  } catch (error) {
    status(`Não deu pra salvar: ${error.message}`, 'error');
  } finally {
    creatures.saving = false;
    document.getElementById('creatureSaveBtn').disabled = false;
  }
}

// ================================================================================================================================================================================================================================================
// openRecipe

function openRecipe(recipe) {
  const saved = recipe.criatura || {};
  creatures.outfit = saved.id ? creatureInfo(saved.id) : null;
  creatures.colors = Array.isArray(saved.cores) && saved.cores.length === 4 ? [...saved.cores] : [...DEFAULT_COLORS];
  creatures.addons = Array.isArray(saved.addons) ? [...saved.addons] : [];
  creatures.corpse = {};
  creatures.corpseImages.clear();
  for (const stage of CORPSE_STAGES) {
    const source = (recipe.cadaver || {})[stage.key];
    if (source) setCorpse(stage.key, source, false);
  }
  creatures.selectedStage = 'fresco';
  creatures.name = recipe.nome || '';
  nameEl.value = creatures.name;
  creatures.dirty = false;
  status(recipe.nome ? `Aberto: ${recipe.nome}` : '');
  reloadSheet();
  renderColors();
  renderAddons();
  render();
  refreshProjects();
}

// ================================================================================================================================================================================================================================================
// creaturesView
// A categoria Criaturas pro main.js.

export const creaturesView = {
  category: CATEGORY,
  title: 'Criaturas salvas',
  newLabel: '+ Nova criatura',
  emptyText: 'Nenhuma criatura salva ainda.',
  pickerMode: 'creatures',
  init: initCreatures,
  open: openRecipe,
  reset: () => openRecipe({ nome: '' }),
  isDirty: () => creatures.dirty,
  name: () => creatures.name,
  pick,
  useAll: () => {}
};
