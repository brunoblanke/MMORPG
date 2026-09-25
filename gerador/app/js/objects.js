// gerador/app/js/objects.js

import { spriteUrl, saveProject, fetchItemInfo } from './api.js';
import { loadImage, isReady, drawAnchored, readPngFile, normalizeName, setStatus } from './common.js';
import { refreshProjects } from './projects.js';

// Folha de objeto: uma linha com os quadros da animação, cada um com o
// tamanho do objeto (32 ou 64 px), como os itens do jogo. As propriedades
// (bloqueia, pode mover, tem altura) vêm do Tibia.dat e podem ser mudadas;
// ficam na receita pra quando o objeto entrar no jogo.
// O objeto vem de um item do Tibia (uma variação, com todos os quadros) ou
// de um PNG (uma imagem, ou uma tira de quadros quadrados lado a lado).

const CATEGORY = 'objetos';
const FRAME_MS = 500;
const STACK_OFFSET = 7;
const PROPERTIES = [
  { key: 'bloqueia', label: 'Bloqueia a passagem' },
  { key: 'move', label: 'Pode ser movido (arrastar)' },
  { key: 'altura', label: 'Tem altura (empilha e dá pra subir)' }
];

const objects = {
  source: null,
  info: null,
  frames: [],
  frameSize: 32,
  properties: { bloqueia: false, move: true, altura: false },
  frame: 0,
  name: '',
  dirty: false,
  saving: false
};

const statusEl = document.getElementById('objectStatus');
const nameEl = document.getElementById('objectName');
const infoEl = document.getElementById('objectInfo');
const previewCanvas = document.getElementById('objectPreview');
const sheetCanvas = document.getElementById('objectSheet');

// ================================================================================================================================================================================================================================================
// initObjects

function initObjects() {
  renderProperties();
  document.getElementById('objectSaveForm').addEventListener('submit', (evt) => {
    evt.preventDefault();
    save();
  });
  document.getElementById('objectClear').onclick = () => setSource(null, null);
  document.getElementById('objectUpload').addEventListener('change', async (evt) => {
    const file = evt.target.files[0];
    evt.target.value = '';
    if (file) setSource({ png: await readPngFile(file) }, null);
  });
  nameEl.addEventListener('input', () => { objects.dirty = true; });
  setInterval(() => {
    objects.frame++;
    drawPreview();
  }, FRAME_MS);
  render();
}

// ================================================================================================================================================================================================================================================
// status

function status(text, kind) {
  setStatus(statusEl, text, kind);
}

// ================================================================================================================================================================================================================================================
// pick
// Item da lista da direita vira o objeto; as propriedades vêm do Tibia.dat.

async function pick(kind, id, variation) {
  if (kind !== 'item') return;
  try {
    const info = await fetchItemInfo(id);
    objects.properties = { bloqueia: info.bloqueia, move: info.move, altura: info.altura };
    setSource({ tibia: { id, variacao: variation } }, info);
    renderProperties();
    status(`Propriedades do item ${id} vieram do Tibia; mude se quiser.`);
  } catch (error) {
    status(`Não deu pra ler o item ${id}: ${error.message}`, 'error');
  }
}

// ================================================================================================================================================================================================================================================
// setSource
// Carrega os quadros: do Tibia, um PNG por quadro da animação; de um PNG,
// a imagem inteira (os quadros saem dela em sourceFrames).

function setSource(source, info) {
  objects.source = source;
  objects.info = info;
  objects.frames = [];
  objects.dirty = true;
  if (source) {
    const urls = source.png
      ? [source.png]
      : Array.from({ length: info.quadros }, (_, frame) => spriteUrl(source.tibia.id, source.tibia.variacao, frame));
    objects.frames = urls.map(url => loadImage(url, () => {
      if (objects.source === source) render();
    }));
  }
  render();
}

// ================================================================================================================================================================================================================================================
// sourceFrames
// Os quadros prontos: [{ img, sx, sy, w, h }]. PNG largo (tira de quadros
// quadrados lado a lado) vira um quadro por pedaço. [] enquanto carrega.

function sourceFrames() {
  if (!objects.source || !objects.frames.length || !objects.frames.every(isReady)) return [];
  if (objects.source.png) {
    const img = objects.frames[0];
    const side = img.naturalHeight;
    const count = img.naturalWidth >= 2 * side ? Math.floor(img.naturalWidth / side) : 1;
    if (count === 1) return [{ img, sx: 0, sy: 0, w: img.naturalWidth, h: img.naturalHeight }];
    return Array.from({ length: count }, (_, i) => ({ img, sx: i * side, sy: 0, w: side, h: side }));
  }
  return objects.frames.map(img => ({ img, sx: 0, sy: 0, w: img.naturalWidth, h: img.naturalHeight }));
}

// ================================================================================================================================================================================================================================================
// frameSize
// 32 ou 64 (ou mais): o menor múltiplo de 32 que cabe o maior quadro.

function frameSize(frames) {
  const largest = Math.max(32, ...frames.map(f => Math.max(f.w, f.h)));
  return Math.ceil(largest / 32) * 32;
}

// ================================================================================================================================================================================================================================================
// drawFrame
// Desenha o quadro ancorado no canto de baixo à direita da célula size × size.

function drawFrame(ctx, frame, x, y, size) {
  const w = Math.min(frame.w, size);
  const h = Math.min(frame.h, size);
  ctx.drawImage(frame.img, frame.sx + frame.w - w, frame.sy + frame.h - h, w, h, x + size - w, y + size - h, w, h);
}

// ================================================================================================================================================================================================================================================
// renderProperties

function renderProperties() {
  const list = document.getElementById('objectProperties');
  list.innerHTML = '';
  for (const property of PROPERTIES) {
    const label = document.createElement('label');
    label.className = 'checkline';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!objects.properties[property.key];
    input.onchange = () => {
      objects.properties[property.key] = input.checked;
      objects.dirty = true;
      drawPreview();
    };
    label.append(input, property.label);
    list.appendChild(label);
  }
}

// ================================================================================================================================================================================================================================================
// render

function render() {
  const frames = sourceFrames();
  const source = objects.source;
  if (!source) {
    infoEl.textContent = 'Nenhum objeto escolhido. Escolha à direita ou envie um PNG.';
  } else if (source.png) {
    infoEl.innerHTML = `<b>PNG enviado</b><br>${frames.length} ${frames.length === 1 ? 'quadro' : 'quadros'}`;
  } else {
    const info = objects.info || {};
    infoEl.innerHTML = `<b>Item ${source.tibia.id}</b><br>${info.tamanho || '?'} px · ${info.quadros || 1} ${info.quadros > 1 ? 'quadros' : 'quadro'}` +
      `${info.variacoes > 1 ? ` · variação ${source.tibia.variacao + 1} de ${info.variacoes}` : ''}${info.pegavel ? ' · dá pra pegar' : ''}`;
  }
  composeSheet(sheetCanvas, frames);
  drawPreview();
}

// ================================================================================================================================================================================================================================================
// composeSheet
// A folha final (uma linha de quadros) no canvas, que muda de tamanho.

function composeSheet(canvas, frames) {
  const size = frameSize(frames);
  canvas.width = Math.max(1, frames.length) * size;
  canvas.height = size;
  if (canvas === sheetCanvas) {
    canvas.style.width = `${canvas.width * 3}px`;
    canvas.style.height = `${canvas.height * 3}px`;
    document.getElementById('objectSheetSize').textContent = frames.length ? `(${canvas.width} × ${canvas.height} · ${frames.length} ${frames.length === 1 ? 'quadro' : 'quadros'})` : '';
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  frames.forEach((frame, i) => drawFrame(ctx, frame, i * size, 0, size));
}

// ================================================================================================================================================================================================================================================
// drawPreview
// O objeto animado num pedaço de chão e, se tiver altura, uma pilha de 3
// (cada um 7 px mais alto, como o jogo empilha).

function drawPreview() {
  const tile = 32;
  const ctx = previewCanvas.getContext('2d');
  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  for (let y = 0; y < previewCanvas.height / tile; y++) {
    for (let x = 0; x < previewCanvas.width / tile; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#2a2f3a' : '#262a33';
      ctx.fillRect(x * tile, y * tile, tile, tile);
    }
  }
  const frames = sourceFrames();
  if (!frames.length) return;
  const frame = frames[objects.frame % frames.length];
  const size = frameSize(frames);

  drawFrame(ctx, frame, 2 * tile + tile - size, 2 * tile + tile - size, size);
  if (objects.properties.altura) {
    for (let level = 0; level < 3; level++) {
      const lift = level * STACK_OFFSET;
      drawFrame(ctx, frame, 5 * tile + tile - size - lift, 2 * tile + tile - size - lift, size);
    }
  }
  if (objects.properties.bloqueia) {
    ctx.strokeStyle = 'rgba(226, 87, 76, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(2 * tile + 0.5, 2 * tile + 0.5, tile - 1, tile - 1);
  }
}

// ================================================================================================================================================================================================================================================
// save

async function save() {
  if (objects.saving) return;
  const name = normalizeName(nameEl.value);
  const frames = sourceFrames();
  if (!objects.source) {
    status('Escolha um objeto à direita ou envie um PNG.', 'error');
    return;
  }
  if (!name) {
    status('Dê um nome ao objeto (ex.: bau).', 'error');
    return;
  }
  if (!frames.length) {
    status('Espere as imagens terminarem de carregar.', 'error');
    return;
  }

  nameEl.value = name;
  objects.saving = true;
  document.getElementById('objectSaveBtn').disabled = true;
  const canvas = document.createElement('canvas');
  composeSheet(canvas, frames);
  const recipe = {
    formato: { quadro: frameSize(frames), quadros: frames.length },
    objeto: objects.source,
    propriedades: objects.properties
  };

  try {
    const result = await saveProject(CATEGORY, name, recipe, canvas.toDataURL('image/png'));
    objects.name = name;
    objects.dirty = false;
    status(`Salvo em gerador/${result.arquivo}`, 'ok');
    refreshProjects();
  } catch (error) {
    status(`Não deu pra salvar: ${error.message}`, 'error');
  } finally {
    objects.saving = false;
    document.getElementById('objectSaveBtn').disabled = false;
  }
}

// ================================================================================================================================================================================================================================================
// openRecipe

async function openRecipe(recipe) {
  objects.name = recipe.nome || '';
  nameEl.value = objects.name;
  objects.properties = { bloqueia: false, move: true, altura: false, ...(recipe.propriedades || {}) };
  renderProperties();
  const source = recipe.objeto || null;
  let info = null;
  if (source && source.tibia) {
    try {
      info = await fetchItemInfo(source.tibia.id);
    } catch (error) {
      status(`Não deu pra ler o item ${source.tibia.id}: ${error.message}`, 'error');
      return;
    }
  }
  setSource(source, info);
  objects.dirty = false;
  status(recipe.nome ? `Aberto: ${recipe.nome}` : '');
  refreshProjects();
}

// ================================================================================================================================================================================================================================================
// objectsView
// A categoria Objetos pro main.js.

export const objectsView = {
  category: CATEGORY,
  title: 'Objetos salvos',
  newLabel: '+ Novo objeto',
  emptyText: 'Nenhum objeto salvo ainda.',
  pickerMode: 'objects',
  init: initObjects,
  open: openRecipe,
  reset: () => openRecipe({ nome: '' }),
  isDirty: () => objects.dirty,
  name: () => objects.name,
  pick,
  useAll: () => {}
};
