// gerador/app/js/walls.js

import { spriteUrl, saveProject, fetchWallSuggestion } from './api.js';
import { itemCategory, itemFrames } from './picker.js';
import { sourceLabel, loadImage, isReady, drawAnchored, readPngFile, normalizeName, setStatus } from './common.js';
import { refreshProjects } from './projects.js';

// Folha de parede (256 × 256, 4 × 4 quadros de 64 px), uma linha por peça:
//   x   horizontal (corre ao longo de x, no lado de cima do sqm)
//   y   vertical (corre ao longo de y, no lado esquerdo do sqm)
//   xy  canto (onde a horizontal e a vertical se encontram, em cima à esquerda)
//   yx  pilar (a ponta que fecha o canto de baixo à direita)
// Cada linha tem 4 quadros de animação; parede parada repete o quadro.
// Cada peça vem de um item do Tibia (com os quadros dele) ou de um PNG (uma
// imagem, ou uma tira de quadros quadrados lado a lado).

const CATEGORY = 'paredes';
const SIZE = 64;
const FRAMES = 4;
const FRAME_MS = 500;
const PIECES = [
  { key: 'x', name: 'X · horizontal' },
  { key: 'y', name: 'Y · vertical' },
  { key: 'xy', name: 'XY · canto' },
  { key: 'yx', name: 'YX · pilar' }
];

// Sala da prévia (como no Tibia): canto em cima à esquerda, paredes
// horizontais em cima e embaixo, verticais nos lados e o pilar fechando o
// canto de baixo à direita.
const ROOM = [
  '........',
  '.cxxxxv.',
  '.v....v.',
  '.v....v.',
  '.v....v.',
  '.xxxxxp.',
  '........'
];
const ROOM_PIECES = { c: 'xy', x: 'x', v: 'y', p: 'yx' };

const walls = {
  slots: {},
  images: new Map(),
  selected: 'x',
  frame: 0,
  name: '',
  dirty: false,
  saving: false
};

const statusEl = document.getElementById('wallStatus');
const nameEl = document.getElementById('wallName');
const slotsEl = document.getElementById('wallSlots');
const roomCanvas = document.getElementById('wallPreview');
const sheetCanvas = document.getElementById('wallSheet');

// ================================================================================================================================================================================================================================================
// initWalls

function initWalls() {
  renderSlots();
  document.getElementById('wallSaveForm').addEventListener('submit', (evt) => {
    evt.preventDefault();
    save();
  });
  document.getElementById('wallClear').onclick = () => setPiece(walls.selected, null);
  document.getElementById('wallSuggest').onclick = () => {
    const source = Object.values(walls.slots).find(s => s.tibia);
    if (!source) {
      status('Escolha uma peça do Tibia primeiro; as outras vêm do mesmo material.', 'error');
      return;
    }
    if (Object.keys(walls.slots).length > 1 && !window.confirm('Trocar as peças atuais pela sugestão?')) return;
    suggestPieces(source.tibia.id);
  };
  document.getElementById('wallUpload').addEventListener('change', async (evt) => {
    const file = evt.target.files[0];
    evt.target.value = '';
    if (file) setPiece(walls.selected, { png: await readPngFile(file) });
  });
  nameEl.addEventListener('input', () => { walls.dirty = true; });
  setInterval(() => {
    walls.frame++;
    drawRoom();
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
// Item da lista da direita vai pra peça selecionada; se as outras estiverem
// vazias, elas são sugeridas pelo material.

function pick(kind, id, variation) {
  if (kind !== 'item') return;
  if (itemCategory(id) !== 'wall') status(`O item ${id} não é parede; ficou na peça assim mesmo.`);
  const othersEmpty = PIECES.every(piece => piece.key === walls.selected || !walls.slots[piece.key]);
  setPiece(walls.selected, { tibia: { id, variacao: variation } });
  const next = PIECES[PIECES.findIndex(piece => piece.key === walls.selected) + 1];
  if (next) walls.selected = next.key;
  render();
  if (othersEmpty && itemCategory(id) === 'wall') suggestPieces(id);
}

// ================================================================================================================================================================================================================================================
// suggestPieces
// As 4 peças do material do item (formato + cor + número perto); a peça do
// item escolhido fica com ele.

async function suggestPieces(id) {
  try {
    const suggestion = await fetchWallSuggestion(id);
    if (!suggestion) {
      status(`O item ${id} não parece uma das 4 peças de parede; escolha as outras à mão.`);
      return;
    }
    for (const piece of PIECES) {
      const pieceId = suggestion.pecas[piece.key];
      setPiece(piece.key, pieceId ? { tibia: { id: pieceId, variacao: 0 } } : null, false);
    }
    render();
    const missing = PIECES.filter(piece => !suggestion.pecas[piece.key]).map(piece => piece.key.toUpperCase());
    status(`Peças sugeridas pelo material do item ${id}${missing.length ? ` (não achei: ${missing.join(', ')})` : ''}. Troque o que quiser.`, 'ok');
  } catch (error) {
    status(`Não deu pra sugerir: ${error.message}`, 'error');
  }
}

// ================================================================================================================================================================================================================================================
// renderSlots

function renderSlots() {
  slotsEl.innerHTML = '';
  for (const piece of PIECES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'slot';
    button.dataset.key = piece.key;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const label = document.createElement('span');
    label.className = 'slot-name';
    label.textContent = piece.name;
    const source = document.createElement('span');
    source.className = 'slot-source';
    button.append(canvas, label, source);
    button.onclick = () => {
      walls.selected = piece.key;
      render();
    };
    slotsEl.appendChild(button);
  }
}

// ================================================================================================================================================================================================================================================
// setPiece
// source: { tibia: { id, variacao } } ou { png: dataURL } ou null. Do Tibia,
// carrega um quadro por quadro de animação (até 4).

function setPiece(key, source, redraw = true) {
  if (source) {
    walls.slots[key] = source;
    const urls = source.png
      ? [source.png]
      : Array.from({ length: Math.min(itemFrames(source.tibia.id), FRAMES) }, (_, frame) => spriteUrl(source.tibia.id, source.tibia.variacao, frame));
    const images = urls.map(url => loadImage(url, () => {
      if (walls.slots[key] === source) render();
    }));
    walls.images.set(source, images);
  } else {
    delete walls.slots[key];
  }
  walls.dirty = true;
  if (redraw) render();
}

// ================================================================================================================================================================================================================================================
// pieceFrame
// Quadro `frame` da peça: { img, sx, sy, size } ou null. PNG largo (tira de
// quadros quadrados) usa um pedaço por quadro; o resto repete o que tem.

function pieceFrame(key, frame) {
  const source = walls.slots[key];
  const images = source && walls.images.get(source);
  if (!images || !images.every(isReady)) return null;
  if (source.png) {
    const img = images[0];
    const strip = Math.floor(img.naturalWidth / img.naturalHeight);
    const count = img.naturalWidth >= 2 * img.naturalHeight ? Math.min(strip, FRAMES) : 1;
    const side = count > 1 ? img.naturalHeight : null;
    return side ? { img, sx: (frame % count) * side, sy: 0, size: side } : { img, sx: 0, sy: 0, size: null };
  }
  return { img: images[frame % images.length], sx: 0, sy: 0, size: null };
}

// ================================================================================================================================================================================================================================================
// drawPieceFrame
// Desenha o quadro da peça ancorado no canto de baixo à direita da célula de 64.

function drawPieceFrame(ctx, key, frame, x, y) {
  const part = pieceFrame(key, frame);
  if (!part) return;
  if (!part.size) {
    drawAnchored(ctx, part.img, x, y, SIZE);
    return;
  }
  const side = Math.min(part.size, SIZE);
  ctx.drawImage(part.img, part.sx + part.size - side, part.sy + part.size - side, side, side, x + SIZE - side, y + SIZE - side, side, side);
}

// ================================================================================================================================================================================================================================================
// render

function render() {
  for (const button of slotsEl.querySelectorAll('.slot')) {
    const key = button.dataset.key;
    button.classList.toggle('selected', key === walls.selected);
    const ctx = button.querySelector('canvas').getContext('2d');
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawPieceFrame(ctx, key, 0, 0, 0);
    const source = walls.slots[key];
    const frames = source && source.tibia ? itemFrames(source.tibia.id) : 1;
    button.querySelector('.slot-source').textContent = sourceLabel(source) + (frames > 1 ? ` · ${frames}q` : '');
  }
  composeSheet(sheetCanvas);
  drawRoom();
}

// ================================================================================================================================================================================================================================================
// composeSheet

function composeSheet(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  PIECES.forEach((piece, row) => {
    for (let frame = 0; frame < FRAMES; frame++) drawPieceFrame(ctx, piece.key, frame, frame * SIZE, row * SIZE);
  });
}

// ================================================================================================================================================================================================================================================
// drawRoom
// A sala da prévia, sqm a sqm (de cima pra baixo, da esquerda pra direita,
// como o jogo desenha), com a animação das peças.

function drawRoom() {
  const tile = 32;
  const ctx = roomCanvas.getContext('2d');
  ctx.clearRect(0, 0, roomCanvas.width, roomCanvas.height);
  for (let y = 0; y < ROOM.length; y++) {
    for (let x = 0; x < ROOM[y].length; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#2a2f3a' : '#262a33';
      ctx.fillRect(x * tile, y * tile, tile, tile);
    }
  }
  for (let y = 0; y < ROOM.length; y++) {
    for (let x = 0; x < ROOM[y].length; x++) {
      const key = ROOM_PIECES[ROOM[y][x]];
      if (key) drawPieceFrame(ctx, key, walls.frame % FRAMES, x * tile + tile - SIZE, y * tile + tile - SIZE);
    }
  }
}

// ================================================================================================================================================================================================================================================
// save

async function save() {
  if (walls.saving) return;
  const name = normalizeName(nameEl.value);
  if (!Object.keys(walls.slots).length) {
    status('Escolha pelo menos uma peça.', 'error');
    return;
  }
  if (!name) {
    status('Dê um nome à parede (ex.: madeira).', 'error');
    return;
  }
  if (PIECES.some(piece => walls.slots[piece.key] && !pieceFrame(piece.key, 0))) {
    status('Espere as imagens terminarem de carregar.', 'error');
    return;
  }

  nameEl.value = name;
  walls.saving = true;
  document.getElementById('wallSaveBtn').disabled = true;
  const canvas = document.createElement('canvas');
  canvas.width = sheetCanvas.width;
  canvas.height = sheetCanvas.height;
  composeSheet(canvas);
  const recipe = {
    formato: { quadro: SIZE, quadros: FRAMES, linhas: PIECES.map(piece => piece.key) },
    pecas: walls.slots
  };

  try {
    const result = await saveProject(CATEGORY, name, recipe, canvas.toDataURL('image/png'));
    walls.name = name;
    walls.dirty = false;
    status(`Salvo em gerador/${result.arquivo}`, 'ok');
    refreshProjects();
  } catch (error) {
    status(`Não deu pra salvar: ${error.message}`, 'error');
  } finally {
    walls.saving = false;
    document.getElementById('wallSaveBtn').disabled = false;
  }
}

// ================================================================================================================================================================================================================================================
// openRecipe

function openRecipe(recipe) {
  walls.slots = {};
  walls.images.clear();
  for (const piece of PIECES) {
    const source = (recipe.pecas || {})[piece.key];
    if (source) setPiece(piece.key, source, false);
  }
  walls.selected = 'x';
  walls.name = recipe.nome || '';
  nameEl.value = walls.name;
  walls.dirty = false;
  status(recipe.nome ? `Aberto: ${recipe.nome}` : '');
  render();
  refreshProjects();
}

// ================================================================================================================================================================================================================================================
// wallsView
// A categoria Paredes pro main.js.

export const wallsView = {
  category: CATEGORY,
  title: 'Paredes salvas',
  newLabel: '+ Nova parede',
  emptyText: 'Nenhuma parede salva ainda.',
  pickerMode: 'walls',
  init: initWalls,
  open: openRecipe,
  reset: () => openRecipe({ nome: '' }),
  isDirty: () => walls.dirty,
  name: () => walls.name,
  pick,
  useAll: () => {}
};
