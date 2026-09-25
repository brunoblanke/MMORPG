// gerador/app/js/floors.js

import { spriteUrl, fetchProjects, fetchProject, saveProject } from './api.js';
import { itemCategory, setPickerTab } from './picker.js';

// Folha de piso (128 × 128, 4 × 4 quadros de 32 px):
//   linha 1  meio: as variações do piso cheio, lado a lado (até 4)
//   linha 2  lados: s, o, n, l          (borda fora do piso, encostada no lado)
//   linha 3  cantos de fora: sl, so, nl, no (ponta do piso, na diagonal)
//   linha 4  cantos de dentro: int-sl, int-so, int-nl, int-no (dois lados juntos)
// O nome de cada borda diz onde ela fica em relação ao piso: 'n' fica ao
// norte dele, 'no' a noroeste… As bordas seguem a ordem dos conjuntos de
// borda do Tibia (ex.: grama 4531–4542), pra "Preencher em sequência" encaixar
// as 12 de uma vez. Cada espaço vem de um item do Tibia (número e variação)
// ou de um PNG enviado.

const TILE = 32;
const CATEGORY = 'pisos';
const MAX_VARIANTS = 4;

// Diagramas: onde fica o piso (x, y de -1 a 1) em volta da peça (no centro).
const TOP = [[-1, -1], [0, -1], [1, -1]];
const BOTTOM = [[-1, 1], [0, 1], [1, 1]];
const LEFT = [[-1, -1], [-1, 0], [-1, 1]];
const RIGHT = [[1, -1], [1, 0], [1, 1]];

export const FLOOR_ROWS = [
  {
    title: 'Meio', note: 'Variações do piso cheio, sorteadas por igual.',
    slots: Array.from({ length: MAX_VARIANTS }, (_, i) => ({ key: `meio-${i + 1}`, name: `${i + 1}`, floor: [[0, 0]] }))
  },
  {
    title: 'Lados', note: 'Borda fora do piso, encostada num lado dele.',
    slots: [
      { key: 's', name: 'S', floor: TOP },
      { key: 'o', name: 'O', floor: RIGHT },
      { key: 'n', name: 'N', floor: BOTTOM },
      { key: 'l', name: 'L', floor: LEFT }
    ]
  },
  {
    title: 'Cantos de fora', note: 'Ponta do piso, encostada só pela diagonal.',
    slots: [
      { key: 'sl', name: 'SL', floor: [[-1, -1]] },
      { key: 'so', name: 'SO', floor: [[1, -1]] },
      { key: 'nl', name: 'NL', floor: [[-1, 1]] },
      { key: 'no', name: 'NO', floor: [[1, 1]] }
    ]
  },
  {
    title: 'Cantos de dentro', note: 'Onde dois lados do piso se encontram.',
    slots: [
      { key: 'int-sl', name: 'int-SL', floor: [...TOP, ...LEFT] },
      { key: 'int-so', name: 'int-SO', floor: [...TOP, ...RIGHT] },
      { key: 'int-nl', name: 'int-NL', floor: [...BOTTOM, ...LEFT] },
      { key: 'int-no', name: 'int-NO', floor: [...BOTTOM, ...RIGHT] }
    ]
  }
];

const ALL_SLOTS = FLOOR_ROWS.flatMap(row => row.slots);
const BORDER_KEYS = ALL_SLOTS.filter(slot => !slot.key.startsWith('meio')).map(slot => slot.key);
const MIDDLE_KEYS = ALL_SLOTS.filter(slot => slot.key.startsWith('meio')).map(slot => slot.key);

// Chão da prévia: '#' é piso. Tem ponta, lado reto, canto de dentro e buraco.
const PREVIEW_SHAPE = [
  '............',
  '..######....',
  '..#######...',
  '.########...',
  '.###..####..',
  '.###..####..',
  '..#########.',
  '...######...',
  '............'
];

const floors = {
  slots: {},
  images: new Map(),
  selected: 'meio-1',
  name: '',
  dirty: false,
  saving: false
};

const rowsEl = document.getElementById('sheetRows');
const statusEl = document.getElementById('status');
const nameEl = document.getElementById('projectName');
const groundCanvas = document.getElementById('groundPreview');
const sheetCanvas = document.getElementById('sheetPreview');

// ================================================================================================================================================================================================================================================
// initFloors

export function initFloors() {
  renderRows();
  document.getElementById('saveForm').addEventListener('submit', (evt) => {
    evt.preventDefault();
    save();
  });
  document.getElementById('clearSlot').onclick = () => setSlot(floors.selected, null);
  document.getElementById('uploadPng').addEventListener('change', uploadPng);
  document.getElementById('newProject').onclick = () => {
    if (floors.dirty && !window.confirm('Descartar o que não foi salvo?')) return;
    openRecipe({ nome: '', slots: {} });
  };
  nameEl.addEventListener('input', () => { floors.dirty = true; });
  window.addEventListener('beforeunload', (evt) => {
    if (!floors.dirty) return;
    evt.preventDefault();
    evt.returnValue = '';
  });
  refreshProjects();
  render();
}

// ================================================================================================================================================================================================================================================
// setStatus

function setStatus(text, kind = '') {
  statusEl.textContent = text;
  statusEl.className = 'status' + (kind ? ` ${kind}` : '');
}

// ================================================================================================================================================================================================================================================
// renderRows
// Monta as linhas da folha com um botão por espaço (sprite + nome + diagrama).

function renderRows() {
  rowsEl.innerHTML = '';
  for (const row of FLOOR_ROWS) {
    const line = document.createElement('div');
    line.className = 'sheet-row';
    const title = document.createElement('div');
    title.className = 'row-title';
    title.innerHTML = `<b>${row.title}</b><span>${row.note}</span>`;
    const slotsEl = document.createElement('div');
    slotsEl.className = 'slots';

    for (const slot of row.slots) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'slot';
      button.dataset.key = slot.key;
      button.title = slot.key.startsWith('meio') ? `Meio ${slot.name}` : `Borda ${slot.key}: o piso fica onde o diagrama está preenchido`;
      const canvas = document.createElement('canvas');
      canvas.width = TILE;
      canvas.height = TILE;
      const label = document.createElement('span');
      label.className = 'slot-name';
      label.append(diagram(slot.floor), ` ${slot.name}`);
      const source = document.createElement('span');
      source.className = 'slot-source';
      button.append(canvas, label, source);
      button.onclick = () => selectSlot(slot.key);
      slotsEl.appendChild(button);
    }

    line.append(title, slotsEl);
    rowsEl.appendChild(line);
  }
}

// ================================================================================================================================================================================================================================================
// diagram
// Mini desenho 3×3: piso em verde, a peça no centro (contorno).

function diagram(floorCells) {
  const canvas = document.createElement('canvas');
  canvas.width = 15;
  canvas.height = 15;
  canvas.style.cssText = 'width:15px;height:15px;display:inline-block;vertical-align:-3px;';
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2a2f3a';
  ctx.fillRect(0, 0, 15, 15);
  ctx.fillStyle = '#4c9a5a';
  for (const [dx, dy] of floorCells) ctx.fillRect((dx + 1) * 5, (dy + 1) * 5, 5, 5);
  ctx.strokeStyle = '#5eead4';
  ctx.strokeRect(5.5, 5.5, 4, 4);
  return canvas;
}

// ================================================================================================================================================================================================================================================
// selectSlot
// Escolhe o espaço que o próximo sprite vai preencher; a lista da direita
// abre na categoria que combina (chão pro meio, bordas pro resto).

function selectSlot(key) {
  floors.selected = key;
  setPickerTab(key.startsWith('meio') ? 'ground' : 'border');
  render();
}

// ================================================================================================================================================================================================================================================
// pickSprite
// Sprite escolhido à direita; o próximo espaço do grupo fica selecionado.
// Com "Preencher em sequência", os espaços seguintes do mesmo grupo (meio ou
// bordas) recebem id+1, id+2… enquanto os itens forem da mesma categoria.

export function pickSprite(id, variation) {
  const group = floors.selected.startsWith('meio') ? MIDDLE_KEYS : BORDER_KEYS;
  const start = group.indexOf(floors.selected);
  const sequence = document.getElementById('fillSequence').checked && variation === 0;
  const category = itemCategory(id);

  let filled = 0;
  for (const key of sequence ? group.slice(start) : [floors.selected]) {
    const itemId = id + filled;
    if (filled > 0 && itemCategory(itemId) !== category) break;
    setSlot(key, { tibia: { id: itemId, variacao: filled === 0 ? variation : 0 } }, false);
    filled++;
  }
  floors.selected = group[Math.min(start + filled, group.length - 1)];
  render();
}

// ================================================================================================================================================================================================================================================
// useAllVariations
// Enche o meio com as variações do chão escolhido (até 4), na ordem do Tibia.

export function useAllVariations(id, total) {
  MIDDLE_KEYS.forEach((key, i) => setSlot(key, i < total ? { tibia: { id, variacao: i } } : null, false));
  floors.selected = BORDER_KEYS[0];
  setPickerTab('border');
  render();
  if (total > MAX_VARIANTS) setStatus(`O item ${id} tem ${total} variações; a folha guarda as ${MAX_VARIANTS} primeiras.`);
}

// ================================================================================================================================================================================================================================================
// setSlot
// source: { tibia: { id, variacao } } ou { png: dataURL } ou null (vazio).

function setSlot(key, source, redraw = true) {
  if (source) floors.slots[key] = source;
  else delete floors.slots[key];
  floors.dirty = true;
  if (source) loadSlotImage(key, source);
  if (redraw) render();
}

// ================================================================================================================================================================================================================================================
// loadSlotImage

function loadSlotImage(key, source) {
  const img = new Image();
  img.onload = () => {
    if (floors.slots[key] === source) render();
  };
  img.src = source.png || spriteUrl(source.tibia.id, source.tibia.variacao);
  floors.images.set(source, img);
}

// ================================================================================================================================================================================================================================================
// slotImage
// Imagem já carregada do espaço, ou null.

function slotImage(key) {
  const source = floors.slots[key];
  const img = source && floors.images.get(source);
  return img && img.complete && img.naturalWidth ? img : null;
}

// ================================================================================================================================================================================================================================================
// drawPiece
// Desenha o sqm da imagem (32 × 32 do canto de baixo à direita, onde fica o
// sqm de um item do Tibia maior que 1 sqm).

function drawPiece(ctx, img, x, y) {
  ctx.drawImage(img, Math.max(0, img.naturalWidth - TILE), Math.max(0, img.naturalHeight - TILE), TILE, TILE, x, y, TILE, TILE);
}

// ================================================================================================================================================================================================================================================
// uploadPng
// PNG do computador no espaço escolhido.

function uploadPng(evt) {
  const file = evt.target.files[0];
  evt.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setSlot(floors.selected, { png: reader.result });
  reader.readAsDataURL(file);
}

// ================================================================================================================================================================================================================================================
// render

function render() {
  for (const button of rowsEl.querySelectorAll('.slot')) {
    const key = button.dataset.key;
    const source = floors.slots[key];
    button.classList.toggle('selected', key === floors.selected);
    const ctx = button.querySelector('canvas').getContext('2d');
    ctx.clearRect(0, 0, TILE, TILE);
    const img = slotImage(key);
    if (img) drawPiece(ctx, img, 0, 0);
    button.querySelector('.slot-source').textContent = !source ? '' : source.png ? 'PNG' : `#${source.tibia.id}${source.tibia.variacao ? ` v${source.tibia.variacao + 1}` : ''}`;
  }
  composeSheet(sheetCanvas);
  drawGroundPreview();
}

// ================================================================================================================================================================================================================================================
// middleKeysInUse
// Espaços do meio preenchidos, na ordem (na folha eles ficam lado a lado).

function middleKeysInUse() {
  return MIDDLE_KEYS.filter(key => floors.slots[key]);
}

// ================================================================================================================================================================================================================================================
// composeSheet
// A folha final: meio compactado à esquerda da 1ª linha; bordas nas posições fixas.

function composeSheet(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  middleKeysInUse().forEach((key, column) => {
    const img = slotImage(key);
    if (img) drawPiece(ctx, img, column * TILE, 0);
  });
  FLOOR_ROWS.slice(1).forEach((row, i) => {
    row.slots.forEach((slot, column) => {
      const img = slotImage(slot.key);
      if (img) drawPiece(ctx, img, column * TILE, (i + 1) * TILE);
    });
  });
}

// ================================================================================================================================================================================================================================================
// hashTile

function hashTile(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

// ================================================================================================================================================================================================================================================
// borderPiecesAt
// Peças de borda num sqm vazio da prévia. Dois lados que se encontram viram
// o canto de dentro (se ele estiver preenchido); ponta só pela diagonal vira
// canto de fora.

function borderPiecesAt(isFloor, x, y) {
  const S = isFloor(x, y + 1);
  const N = isFloor(x, y - 1);
  const W = isFloor(x - 1, y);
  const E = isFloor(x + 1, y);
  const sides = { n: S, s: N, l: W, o: E };
  const pieces = [];

  for (const [a, b, inner] of [['n', 'o', 'int-no'], ['n', 'l', 'int-nl'], ['s', 'o', 'int-so'], ['s', 'l', 'int-sl']]) {
    if (sides[a] && sides[b] && floors.slots[inner]) pieces.push(inner);
  }
  const covered = new Set(pieces.flatMap(inner => inner.slice(4).split('')));
  for (const side of ['n', 's', 'l', 'o']) if (sides[side] && !covered.has(side)) pieces.push(side);

  if (isFloor(x + 1, y + 1) && !S && !E) pieces.push('no');
  if (isFloor(x - 1, y + 1) && !S && !W) pieces.push('nl');
  if (isFloor(x + 1, y - 1) && !N && !E) pieces.push('so');
  if (isFloor(x - 1, y - 1) && !N && !W) pieces.push('sl');
  return pieces;
}

// ================================================================================================================================================================================================================================================
// drawGroundPreview
// O piso num pedaço de chão (PREVIEW_SHAPE), com as bordas aplicadas.

function drawGroundPreview() {
  const ctx = groundCanvas.getContext('2d');
  ctx.clearRect(0, 0, groundCanvas.width, groundCanvas.height);
  const isFloor = (x, y) => PREVIEW_SHAPE[y] && PREVIEW_SHAPE[y][x] === '#';
  const middle = middleKeysInUse().map(slotImage).filter(Boolean);

  for (let y = 0; y < PREVIEW_SHAPE.length; y++) {
    for (let x = 0; x < PREVIEW_SHAPE[y].length; x++) {
      if (isFloor(x, y)) {
        if (!middle.length) continue;
        const img = middle[hashTile(x, y) % middle.length];
        drawPiece(ctx, img, x * TILE, y * TILE);
        continue;
      }
      for (const key of borderPiecesAt(isFloor, x, y)) {
        const img = slotImage(key);
        if (img) drawPiece(ctx, img, x * TILE, y * TILE);
      }
    }
  }
}

// ================================================================================================================================================================================================================================================
// normalizeName
// "Grama Escura" → "grama-escura" (o nome do arquivo).

function normalizeName(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ================================================================================================================================================================================================================================================
// save

async function save() {
  if (floors.saving) return;
  const name = normalizeName(nameEl.value);
  if (!name) {
    setStatus('Dê um nome ao piso (ex.: grama).', 'error');
    return;
  }
  if (!middleKeysInUse().length) {
    setStatus('Preencha pelo menos um espaço do meio.', 'error');
    return;
  }
  const loading = Object.keys(floors.slots).filter(key => !slotImage(key));
  if (loading.length) {
    setStatus('Espere as imagens terminarem de carregar.', 'error');
    return;
  }

  nameEl.value = name;
  floors.saving = true;
  document.getElementById('saveBtn').disabled = true;
  const canvas = document.createElement('canvas');
  canvas.width = sheetCanvas.width;
  canvas.height = sheetCanvas.height;
  composeSheet(canvas);
  const recipe = {
    formato: {
      quadro: TILE,
      linhas: [
        `meio: ${middleKeysInUse().length} variações`,
        FLOOR_ROWS[1].slots.map(s => s.key).join(' '),
        FLOOR_ROWS[2].slots.map(s => s.key).join(' '),
        FLOOR_ROWS[3].slots.map(s => s.key).join(' ')
      ]
    },
    variacoesDoMeio: middleKeysInUse().length,
    slots: floors.slots
  };

  try {
    const result = await saveProject(CATEGORY, name, recipe, canvas.toDataURL('image/png'));
    floors.name = name;
    floors.dirty = false;
    setStatus(`Salvo em gerador/${result.arquivo}`, 'ok');
    refreshProjects();
  } catch (error) {
    setStatus(`Não deu pra salvar: ${error.message}`, 'error');
  } finally {
    floors.saving = false;
    document.getElementById('saveBtn').disabled = false;
  }
}

// ================================================================================================================================================================================================================================================
// openRecipe

function openRecipe(recipe) {
  floors.slots = {};
  floors.images.clear();
  for (const [key, source] of Object.entries(recipe.slots || {})) {
    if (!ALL_SLOTS.some(slot => slot.key === key)) continue;
    floors.slots[key] = source;
    loadSlotImage(key, source);
  }
  floors.name = recipe.nome || '';
  nameEl.value = floors.name;
  floors.selected = 'meio-1';
  floors.dirty = false;
  setPickerTab('ground');
  setStatus(recipe.nome ? `Aberto: ${recipe.nome}` : '');
  render();
  refreshProjects();
}

// ================================================================================================================================================================================================================================================
// refreshProjects
// Lista da esquerda, com a 1ª variação do meio de cada piso salvo.

async function refreshProjects() {
  const list = document.getElementById('projectList');
  let projects = [];
  try {
    projects = (await fetchProjects()).filter(p => p.categoria === CATEGORY);
  } catch (error) {
    list.innerHTML = `<li class="empty">Sem conexão com o gerador: ${error.message}</li>`;
    return;
  }
  list.innerHTML = '';
  if (!projects.length) {
    list.innerHTML = '<li class="empty">Nenhum piso salvo ainda.</li>';
    return;
  }
  for (const project of projects) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = project.nome === floors.name ? 'active' : '';
    const img = document.createElement('img');
    img.src = `/saida/${CATEGORY}/${project.nome}.png?v=${Math.round(project.atualizado)}`;
    img.alt = '';
    button.append(img, project.nome);
    button.onclick = async () => {
      if (floors.dirty && !window.confirm('Descartar o que não foi salvo?')) return;
      try {
        openRecipe(await fetchProject(CATEGORY, project.nome));
      } catch (error) {
        setStatus(`Não deu pra abrir: ${error.message}`, 'error');
      }
    };
    item.appendChild(button);
    list.appendChild(item);
  }
}
