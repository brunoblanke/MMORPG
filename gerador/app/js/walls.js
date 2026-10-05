// gerador/app/js/walls.js

import { spriteUrl, saveProject, fetchWallSuggestion, fetchDoorSuggestion } from './api.js';
import { itemCategory } from './picker.js';
import { sourceLabel, loadImage, isReady, drawAnchored, readPngFile, normalizeName, setStatus } from './common.js';
import { refreshProjects } from './projects.js';
import { fillFolderSelect, folderOf, setFolder, recipePath } from './folders.js';

// Folha de parede (256 × 256, 4 × 4 quadros de 64 px, sem animação):
//   linha 1  x (horizontal) · y (vertical) · xy (canto) · yx (pilar)
//   linha 2  porta x fechada · porta x aberta · porta y fechada · porta y aberta
//   linha 3  arco x oeste · arco x leste · arco y norte · arco y sul
//   linha 4  janela x · janela y
// O arco ocupa 2 sqm: o x tem a metade oeste e a leste; o y, a norte e a sul.
// x corre ao longo de x (paredes de cima e de baixo da sala); y ao longo de
// y (paredes dos lados); xy é o canto que fecha a sala embaixo à direita e yx
// o pilar que fecha em cima à esquerda. Porta, arco e janela x ficam numa
// parede x; os y, numa y.
// Serve também pras cercas e parapeitos (a porta vira o portão).
// Cada peça vem de um item do Tibia ou de um PNG.

const CATEGORY = 'paredes';
const SIZE = 64;
const COLUMNS = 4;
const WALL_PIECES = [
  { key: 'x', name: 'X · horizontal' },
  { key: 'y', name: 'Y · vertical' },
  { key: 'xy', name: 'XY · canto (baixo-dir.)' },
  { key: 'yx', name: 'YX · pilar (cima-esq.)' }
];
const DOOR_PIECES = [
  { key: 'porta-x', name: 'Porta X · fechada' },
  { key: 'porta-x-aberta', name: 'Porta X · aberta' },
  { key: 'porta-y', name: 'Porta Y · fechada' },
  { key: 'porta-y-aberta', name: 'Porta Y · aberta' }
];
const OPENING_PIECES = [
  { key: 'arco-x-oeste', name: 'Arco X · oeste' },
  { key: 'arco-x-leste', name: 'Arco X · leste' },
  { key: 'arco-y-norte', name: 'Arco Y · norte' },
  { key: 'arco-y-sul', name: 'Arco Y · sul' },
  { key: 'janela-x', name: 'Janela X' },
  { key: 'janela-y', name: 'Janela Y' }
];
const PIECES = [...WALL_PIECES, ...DOOR_PIECES, ...OPENING_PIECES];

// Sala da prévia (como no Tibia): pilar em cima à esquerda, a parede x de
// cima indo até o fim à direita, a y da esquerda até o fim embaixo, e o canto
// xy fechando embaixo à direita. Porta fechada em cima e à esquerda, aberta
// embaixo e à direita; arco (as duas metades) e janela em cima e à
// esquerda. Sem a peça escolhida, fica a parede.
const ROOM = [
  '..........',
  '.pxdxabwx.',
  '.v......v.',
  '.e......E.',
  '.v......v.',
  '.A......v.',
  '.B......v.',
  '.W......v.',
  '.vxxDxxxc.',
  '..........'
];
const ROOM_PIECES = {
  c: ['xy'], x: ['x'], v: ['y'], p: ['yx'],
  d: ['porta-x', 'x'], D: ['porta-x-aberta', 'x'], e: ['porta-y', 'y'], E: ['porta-y-aberta', 'y'],
  a: ['arco-x-oeste', 'x'], b: ['arco-x-leste', 'x'], A: ['arco-y-norte', 'y'], B: ['arco-y-sul', 'y'],
  w: ['janela-x', 'x'], W: ['janela-y', 'y']
};

const walls = {
  slots: {},
  images: new Map(),
  selected: 'x',
  name: '',
  path: '',
  dirty: false,
  saving: false
};

const statusEl = document.getElementById('wallStatus');
const nameEl = document.getElementById('wallName');
const folderEl = document.getElementById('wallFolder');
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
  document.getElementById('wallSuggest').onclick = suggestAll;
  document.getElementById('wallUpload').addEventListener('change', async (evt) => {
    const file = evt.target.files[0];
    evt.target.value = '';
    if (file) setPiece(walls.selected, { png: await readPngFile(file) });
  });
  nameEl.addEventListener('input', () => { walls.dirty = true; });
  fillFolderSelect(folderEl, CATEGORY);
  folderEl.addEventListener('change', () => { walls.dirty = true; });
  render();
}

// ================================================================================================================================================================================================================================================
// status

function status(text, kind) {
  setStatus(statusEl, text, kind);
}

// ================================================================================================================================================================================================================================================
// groupOf
// Grupo da peça: paredes (sugere pelo material), portas (sugere pelo par) ou
// aberturas (arco e janela, escolhidos à mão).

function groupOf(key) {
  if (DOOR_PIECES.some(piece => piece.key === key)) return 'door';
  if (OPENING_PIECES.some(piece => piece.key === key)) return 'opening';
  return 'wall';
}

// ================================================================================================================================================================================================================================================
// firstTibia
// Primeira peça do grupo (paredes ou portas) que veio do Tibia, ou null.

function firstTibia(pieces) {
  const piece = pieces.find(p => walls.slots[p.key] && walls.slots[p.key].tibia);
  return piece ? walls.slots[piece.key].tibia.id : null;
}

// ================================================================================================================================================================================================================================================
// pick
// Item da lista da direita vai pra peça selecionada; se as outras peças do
// mesmo grupo (paredes ou portas) estiverem vazias, elas são sugeridas.

function pick(kind, id, variation) {
  if (kind !== 'item') return;
  const group = groupOf(walls.selected);
  const pieces = group === 'door' ? DOOR_PIECES : WALL_PIECES;
  const category = itemCategory(id);
  if (group === 'door' && category !== 'door') status(`O item ${id} não é porta; ficou na peça assim mesmo.`);
  if (group === 'wall' && category !== 'wall') status(`O item ${id} não é parede; ficou na peça assim mesmo.`);
  const othersEmpty = pieces.every(piece => piece.key === walls.selected || !walls.slots[piece.key]);
  setPiece(walls.selected, { tibia: { id, variacao: variation } });
  const next = PIECES[PIECES.findIndex(piece => piece.key === walls.selected) + 1];
  if (next) walls.selected = next.key;
  render();
  if (!othersEmpty || category !== group) return;
  if (group === 'door') suggestDoors(id);
  else suggestPieces(id);
}

// ================================================================================================================================================================================================================================================
// suggestAll
// Botão "Sugerir peças": paredes pelo material da primeira parede do Tibia e
// portas pela primeira porta do Tibia.

async function suggestAll() {
  const wallId = firstTibia(WALL_PIECES);
  const doorId = firstTibia(DOOR_PIECES);
  if (!wallId && !doorId) {
    status('Escolha uma parede ou porta do Tibia primeiro; as outras vêm dela.', 'error');
    return;
  }
  if (Object.keys(walls.slots).length > 1 && !window.confirm('Trocar as peças atuais pela sugestão?')) return;
  if (wallId) await suggestPieces(wallId);
  if (doorId) await suggestDoors(doorId);
}

// ================================================================================================================================================================================================================================================
// applySuggestion
// Coloca as peças sugeridas no grupo e diz o que faltou.

function applySuggestion(pieces, suggested, text) {
  for (const piece of pieces) {
    const pieceId = suggested[piece.key];
    setPiece(piece.key, pieceId ? { tibia: { id: pieceId, variacao: 0 } } : null, false);
  }
  render();
  const missing = pieces.filter(piece => !suggested[piece.key]).map(piece => piece.name);
  status(`${text}${missing.length ? ` (não achei: ${missing.join(', ')})` : ''}. Troque o que quiser.`, 'ok');
}

// ================================================================================================================================================================================================================================================
// suggestPieces
// As 4 peças de parede do material do item (formato + cor + número perto).

async function suggestPieces(id) {
  try {
    const suggestion = await fetchWallSuggestion(id);
    if (!suggestion) {
      status(`O item ${id} não parece uma das 4 peças de parede; escolha as outras à mão.`);
      return;
    }
    applySuggestion(WALL_PIECES, suggestion.pecas, `Paredes sugeridas pelo material do item ${id}`);
  } catch (error) {
    status(`Não deu pra sugerir: ${error.message}`, 'error');
  }
}

// ================================================================================================================================================================================================================================================
// suggestDoors
// As 4 portas a partir de uma porta (a aberta/fechada do par dela e o par
// da outra orientação mais perto).

async function suggestDoors(id) {
  try {
    const suggestion = await fetchDoorSuggestion(id);
    if (!suggestion) {
      status(`Não achei o par do item ${id}; escolha as outras portas à mão.`);
      return;
    }
    applySuggestion(DOOR_PIECES, suggestion.pecas, `Portas sugeridas a partir do item ${id}`);
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
// source: { tibia: { id, variacao } } ou { png: dataURL } ou null.

function setPiece(key, source, redraw = true) {
  if (source) {
    walls.slots[key] = source;
    const img = loadImage(source.png || spriteUrl(source.tibia.id, source.tibia.variacao), () => {
      if (walls.slots[key] === source) render();
    });
    walls.images.set(source, img);
  } else {
    delete walls.slots[key];
  }
  walls.dirty = true;
  if (redraw) render();
}

// ================================================================================================================================================================================================================================================
// pieceImage
// A imagem pronta da peça, ou null.

function pieceImage(key) {
  const source = walls.slots[key];
  const img = source && walls.images.get(source);
  return isReady(img) ? img : null;
}

// ================================================================================================================================================================================================================================================
// drawPiece
// Desenha a peça ancorada no canto de baixo à direita da célula de 64.

function drawPiece(ctx, key, x, y) {
  const img = pieceImage(key);
  if (img) drawAnchored(ctx, img, x, y, SIZE);
}

// ================================================================================================================================================================================================================================================
// render

function render() {
  for (const button of slotsEl.querySelectorAll('.slot')) {
    const key = button.dataset.key;
    button.classList.toggle('selected', key === walls.selected);
    const ctx = button.querySelector('canvas').getContext('2d');
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawPiece(ctx, key, 0, 0);
    button.querySelector('.slot-source').textContent = sourceLabel(walls.slots[key]);
  }
  composeSheet(sheetCanvas);
  drawRoom();
}

// ================================================================================================================================================================================================================================================
// composeSheet

function composeSheet(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  PIECES.forEach((piece, i) => drawPiece(ctx, piece.key, (i % COLUMNS) * SIZE, Math.floor(i / COLUMNS) * SIZE));
}

// ================================================================================================================================================================================================================================================
// drawRoom
// A sala da prévia, sqm a sqm (de cima pra baixo, da esquerda pra direita,
// como o jogo desenha).

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
      const keys = ROOM_PIECES[ROOM[y][x]];
      const key = keys && keys.find(k => pieceImage(k));
      if (key) drawPiece(ctx, key, x * tile + tile - SIZE, y * tile + tile - SIZE);
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
  if (PIECES.some(piece => walls.slots[piece.key] && !pieceImage(piece.key))) {
    status('Espere as imagens terminarem de carregar.', 'error');
    return;
  }

  const folder = folderOf(folderEl);
  if (!folder) {
    status('Escolha a pasta onde salvar.', 'error');
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
    formato: { quadro: SIZE, colunas: COLUMNS, pecas: PIECES.map(piece => piece.key) },
    pecas: walls.slots
  };

  try {
    const result = await saveProject(CATEGORY, folder, name, recipe, canvas.toDataURL('image/png'));
    walls.name = name;
    walls.path = result.caminho;
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
  walls.path = recipePath(recipe, CATEGORY);
  setFolder(folderEl, recipe);
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
  path: () => walls.path,
  pick,
  useAll: () => {}
};
