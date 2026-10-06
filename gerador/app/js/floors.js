// gerador/app/js/floors.js

import { spriteUrl, saveProject, fetchBorderSuggestion, fetchFloorSuggestion, fetchItemInfo, fetchPattern } from './api.js';
import { itemCategory, showSuggestions } from './picker.js';
import { normalizeName } from './common.js';
import { refreshProjects } from './projects.js';
import { fillFolderSelect, folderOf, setFolder, recipePath } from './folders.js';

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
// Chão do Tibia que muda pela posição (areia 4 × 4, paralelepípedo 4 × 2…):
// escolhido no meio, vira padrão — o bloco inteiro fica nas linhas de baixo
// da folha (linha 5 em diante) e cada sqm do mapa usa o pedaço da posição
// dele, emendando sem costura.
// Piso animado (água…): cada peça vem com todos os quadros da animação do
// Tibia, lado a lado na folha (a peça da coluna c ocupa as colunas c × quadros
// até c × quadros + quadros - 1); peça parada repete o desenho.

const TILE = 32;
const CATEGORY = 'pisos';
const MAX_VARIANTS = 4;
const DEFAULT_FRAME_MS = 200;
const PATTERN_MAX = 4;
const PATTERN_KEY = /^padrao-\d+-\d+$/;

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
  frameMs: new Map(),
  pattern: null,
  selected: 'meio-1',
  name: '',
  path: '',
  behavior: 'normal',
  damage: 10,
  dirty: false,
  saving: false
};

const rowsEl = document.getElementById('sheetRows');
const statusEl = document.getElementById('status');
const nameEl = document.getElementById('projectName');
const folderEl = document.getElementById('floorFolder');
const behaviorEl = document.getElementById('floorBehavior');
const damageEl = document.getElementById('floorDamage');
const damageFieldEl = document.getElementById('floorDamageField');
const edgeBlocksEl = document.getElementById('floorEdgeBlocks');
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
  document.getElementById('clearSlot').onclick = () => {
    if (floors.selected.startsWith('meio')) clearPattern();
    setSlot(floors.selected, null);
  };
  document.getElementById('suggestBorders').onclick = () => {
    if (BORDER_KEYS.some(key => floors.slots[key]) && !window.confirm('Trocar as bordas atuais pela sugestão?')) return;
    suggestBorders();
  };
  document.getElementById('suggestFloor').onclick = suggestFloor;
  document.getElementById('uploadPng').addEventListener('change', uploadPng);
  nameEl.addEventListener('input', () => { floors.dirty = true; });
  fillFolderSelect(folderEl, CATEGORY);
  folderEl.addEventListener('change', () => { floors.dirty = true; });
  edgeBlocksEl.addEventListener('change', () => {
    floors.edgeBlocks = edgeBlocksEl.checked;
    floors.dirty = true;
  });
  behaviorEl.addEventListener('change', () => {
    floors.behavior = behaviorEl.value;
    floors.dirty = true;
    showBehavior();
  });
  damageEl.addEventListener('input', () => {
    floors.damage = Math.max(1, Math.floor(Number(damageEl.value)) || 1);
    floors.dirty = true;
  });
  setInterval(() => {
    if (sheetFrameCount() < 2) return;
    composeSheet(sheetCanvas, currentFrame());
    drawGroundPreview();
  }, 50);
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
// Escolhe o espaço que o próximo sprite vai preencher (a lista da direita
// fica na aba em que está).

function selectSlot(key) {
  floors.selected = key;
  render();
}

// ================================================================================================================================================================================================================================================
// pickSprite
// Sprite escolhido à direita; o próximo espaço do grupo fica selecionado.
// Com "Preencher em sequência", os espaços seguintes do mesmo grupo (meio ou
// bordas) recebem id+1, id+2… enquanto os itens forem da mesma categoria.

export async function pickSprite(id, variation) {
  const group = floors.selected.startsWith('meio') ? MIDDLE_KEYS : BORDER_KEYS;
  const start = group.indexOf(floors.selected);
  const sequence = document.getElementById('fillSequence').checked && variation === 0;
  const category = itemCategory(id);
  if (group === MIDDLE_KEYS && await usePattern(id)) return;
  if (group === MIDDLE_KEYS) clearPattern();

  let filled = 0;
  for (const key of sequence ? group.slice(start) : [floors.selected]) {
    const itemId = id + filled;
    if (filled > 0 && itemCategory(itemId) !== category) break;
    setSlot(key, { tibia: { id: itemId, variacao: filled === 0 ? variation : 0 } }, false);
    filled++;
  }
  floors.selected = group[Math.min(start + filled, group.length - 1)];
  render();
  if (group === MIDDLE_KEYS && !BORDER_KEYS.some(key => floors.slots[key])) suggestBorders();
}

// ================================================================================================================================================================================================================================================
// useAllVariations
// Enche o meio com as variações do chão escolhido (até 4), na ordem do Tibia.

export async function useAllVariations(id, total) {
  if (await usePattern(id)) return;
  clearPattern();
  MIDDLE_KEYS.forEach((key, i) => setSlot(key, i < total ? { tibia: { id, variacao: i } } : null, false));
  floors.selected = BORDER_KEYS[0];
  render();
  if (total > MAX_VARIANTS) setStatus(`O item ${id} tem ${total} variações; a folha guarda as ${MAX_VARIANTS} primeiras.`);
  if (!BORDER_KEYS.some(key => floors.slots[key])) suggestBorders();
}

// ================================================================================================================================================================================================================================================
// usePattern / clearPattern
// Chão do Tibia em padrão vira padrão do piso: o bloco inteiro (até 4 × 4)
// vai pros espaços 'padrao-<c>-<l>' e o meio fica com o 1º pedaço. O bloco
// vem das variações do item (areia 231: 4 × 4 pela posição) ou de itens
// separados que emendam sem costura (areia 959–966: 2 × 4, o servidor acha o
// arranjo). false se o chão não é padrão.

async function usePattern(id) {
  let pieces = null;
  try {
    const info = await fetchItemInfo(id);
    const [cols, rows] = (info && info.categoria === 'ground' && info.padrao) || [1, 1];
    if (cols * rows > 1) {
      pieces = { cols: Math.min(cols, PATTERN_MAX), rows: Math.min(rows, PATTERN_MAX), source: (c, r) => ({ tibia: { id, variacao: r * cols + c } }) };
    } else {
      const block = await fetchPattern(id);
      if (block) pieces = { cols: block.colunas, rows: block.linhas, source: (c, r) => ({ tibia: { id: block.ids[r * block.colunas + c], variacao: 0 } }) };
    }
  } catch (error) {
    return false;
  }
  if (!pieces) return false;
  clearPattern();
  MIDDLE_KEYS.forEach(key => setSlot(key, null, false));
  setSlot('meio-1', pieces.source(0, 0), false);
  for (let row = 0; row < pieces.rows; row++) {
    for (let col = 0; col < pieces.cols; col++) setSlot(`padrao-${col}-${row}`, pieces.source(col, row), false);
  }
  floors.pattern = [pieces.cols, pieces.rows];
  floors.selected = BORDER_KEYS[0];
  render();
  setStatus(`Padrão ${pieces.cols} × ${pieces.rows}: cada sqm usa o pedaço da posição dele.`, 'ok');
  if (!BORDER_KEYS.some(key => floors.slots[key])) suggestBorders();
  return true;
}

function clearPattern() {
  for (const key of Object.keys(floors.slots)) {
    if (PATTERN_KEY.test(key)) delete floors.slots[key];
  }
  floors.pattern = null;
}

// ================================================================================================================================================================================================================================================
// suggestFloor
// O inverso de Sugerir bordas: mostra à direita os chãos que combinam com as
// bordas escolhidas; clicar num deles põe ele no meio (como escolher na
// lista: chão em padrão vira padrão).

async function suggestFloor() {
  const borderIds = BORDER_KEYS.map(key => floors.slots[key]).filter(source => source && source.tibia).map(source => source.tibia.id);
  if (!borderIds.length) {
    setStatus('Pra sugerir o piso, escolha antes as bordas (do Tibia).', 'error');
    return;
  }
  try {
    const ids = await fetchFloorSuggestion(borderIds);
    if (!ids.length) {
      setStatus('Nenhum chão do Tibia combina com essas bordas.');
      return;
    }
    showSuggestions('Pisos que combinam com as bordas', ids, (id) => {
      clearPattern();
      MIDDLE_KEYS.forEach(key => setSlot(key, null, false));
      floors.selected = 'meio-1';
      pickSprite(id, 0);
    });
    setStatus('Pisos sugeridos à direita, do que mais combina pro menos. Clique num pra pôr no meio.', 'ok');
  } catch (error) {
    setStatus(`Não deu pra sugerir o piso: ${error.message}`, 'error');
  }
}

// ================================================================================================================================================================================================================================================
// suggestBorders
// Preenche as 12 bordas com o conjunto do Tibia que combina com o meio (cor
// parecida). Só usa os espaços do meio que vieram do Tibia.

export async function suggestBorders() {
  const groundIds = MIDDLE_KEYS.map(key => floors.slots[key]).filter(source => source && source.tibia).map(source => source.tibia.id);
  if (!groundIds.length) {
    setStatus('Pra sugerir bordas, preencha o meio com um chão do Tibia.', 'error');
    return;
  }
  try {
    const suggestion = await fetchBorderSuggestion(groundIds);
    if (!suggestion) {
      setStatus('Nenhum conjunto de borda do Tibia combina com esse chão. Escolha as bordas à mão ou envie PNGs.');
      return;
    }
    for (const key of BORDER_KEYS) {
      const id = suggestion.pecas[key];
      setSlot(key, id ? { tibia: { id, variacao: 0 } } : null, false);
    }
    render();
    const missing = BORDER_KEYS.filter(key => !suggestion.pecas[key]).length;
    const filled = (suggestion.completadas || []).length;
    setStatus(`Bordas sugeridas: conjunto ${suggestion.conjunto[0]}–${suggestion.conjunto[1]}${filled ? ` (${filled} peças completadas de outro conjunto: ${suggestion.completadas.join(', ')})` : ''}${missing ? ` (faltaram ${missing} peças)` : ''}. Troque o que quiser.`, 'ok');
  } catch (error) {
    setStatus(`Não deu pra sugerir bordas: ${error.message}`, 'error');
  }
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
// Carrega o desenho do espaço: do Tibia, todos os quadros da animação (com o
// tempo de cada um); de um PNG, a imagem.

async function loadSlotImage(key, source) {
  const done = () => {
    if (floors.slots[key] === source) render();
  };
  const load = (url) => {
    const img = new Image();
    img.onload = done;
    img.src = url;
    return img;
  };
  if (source.png) {
    floors.images.set(source, [load(source.png)]);
    return;
  }
  floors.images.set(source, [load(spriteUrl(source.tibia.id, source.tibia.variacao))]);
  try {
    const info = await fetchItemInfo(source.tibia.id);
    if (!info || info.quadros < 2 || floors.slots[key] !== source) return;
    floors.frameMs.set(source, info.msPorQuadro || DEFAULT_FRAME_MS);
    floors.images.set(source, Array.from({ length: info.quadros }, (_, frame) => load(spriteUrl(source.tibia.id, source.tibia.variacao, frame))));
  } catch (error) {
    setStatus(`Não deu pra ler os quadros do item ${source.tibia.id}: ${error.message}`, 'error');
  }
}

// ================================================================================================================================================================================================================================================
// slotImage / slotFrames
// O desenho já carregado do espaço (o quadro frame, que repete se ele tiver
// menos quadros), ou null. slotFrames: quantos quadros ele tem.

function slotImage(key, frame = 0) {
  const source = floors.slots[key];
  const images = source && floors.images.get(source);
  const img = images && images[frame % images.length];
  return img && img.complete && img.naturalWidth ? img : null;
}

function slotFrames(key) {
  const source = floors.slots[key];
  const images = source && floors.images.get(source);
  return images ? images.length : 0;
}

// ================================================================================================================================================================================================================================================
// sheetFrameCount / frameMs / currentFrame
// Quadros da folha (o espaço com mais quadros), o tempo de cada um e o
// quadro que a prévia mostra agora.

function sheetFrameCount() {
  return Math.max(1, ...Object.keys(floors.slots).map(slotFrames));
}

function frameMs() {
  const times = Object.values(floors.slots).map(source => floors.frameMs.get(source)).filter(Boolean);
  return times.length ? Math.max(...times) : DEFAULT_FRAME_MS;
}

function currentFrame() {
  return Math.floor(performance.now() / frameMs()) % sheetFrameCount();
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
  reader.onload = () => {
    if (floors.selected.startsWith('meio')) clearPattern();
    setSlot(floors.selected, { png: reader.result });
  };
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
  const note = rowsEl.querySelector('.row-title span');
  note.textContent = floors.pattern ? `Padrão ${floors.pattern[0]} × ${floors.pattern[1]} pela posição: cada sqm usa o pedaço dele.` : FLOOR_ROWS[0].note;
  composeSheet(sheetCanvas, currentFrame());
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
// A folha: meio compactado à esquerda da 1ª linha; bordas nas posições fixas.
// Com frame, só aquele quadro da animação (a prévia, 4 × 4); sem, a folha
// inteira, com os quadros de cada peça lado a lado.

function composeSheet(canvas, frame = null) {
  const count = frame === null ? sheetFrameCount() : 1;
  const patternRows = floors.pattern ? floors.pattern[1] : 0;
  canvas.width = 4 * count * TILE;
  canvas.height = (4 + patternRows) * TILE;
  if (canvas === sheetCanvas) canvas.style.height = `${(4 + patternRows) * 64}px`;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const place = (key, column, row) => {
    for (let f = 0; f < count; f++) {
      const img = slotImage(key, frame === null ? f : frame);
      if (img) drawPiece(ctx, img, (column * count + f) * TILE, row * TILE);
    }
  };
  middleKeysInUse().forEach((key, column) => place(key, column, 0));
  FLOOR_ROWS.slice(1).forEach((row, i) => {
    row.slots.forEach((slot, column) => place(slot.key, column, i + 1));
  });
  for (let r = 0; r < patternRows; r++) {
    for (let c = 0; c < floors.pattern[0]; c++) place(`padrao-${c}-${r}`, c, 4 + r);
  }
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
  const frame = currentFrame();
  const middle = middleKeysInUse().map(key => slotImage(key, frame)).filter(Boolean);

  for (let y = 0; y < PREVIEW_SHAPE.length; y++) {
    for (let x = 0; x < PREVIEW_SHAPE[y].length; x++) {
      if (isFloor(x, y)) {
        if (!middle.length) continue;
        const img = floors.pattern
          ? slotImage(`padrao-${x % floors.pattern[0]}-${y % floors.pattern[1]}`, frame)
          : middle[hashTile(x, y) % middle.length];
        if (!img) continue;
        drawPiece(ctx, img, x * TILE, y * TILE);
        continue;
      }
      for (const key of borderPiecesAt(isFloor, x, y)) {
        const img = slotImage(key, frame);
        if (img) drawPiece(ctx, img, x * TILE, y * TILE);
      }
    }
  }
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
  const loading = Object.keys(floors.slots).filter(key => Array.from({ length: slotFrames(key) }, (_, f) => slotImage(key, f)).some(img => !img));
  if (loading.length) {
    setStatus('Espere as imagens terminarem de carregar.', 'error');
    return;
  }

  const folder = folderOf(folderEl);
  if (!folder) {
    setStatus('Escolha a pasta onde salvar.', 'error');
    return;
  }

  nameEl.value = name;
  floors.saving = true;
  document.getElementById('saveBtn').disabled = true;
  const canvas = document.createElement('canvas');
  composeSheet(canvas);
  const frames = sheetFrameCount();
  const recipe = {
    formato: {
      quadro: TILE,
      ...(frames > 1 ? { quadros: frames, msPorQuadro: frameMs() } : {}),
      ...(floors.pattern ? { padrao: floors.pattern } : {}),
      linhas: [
        `meio: ${middleKeysInUse().length} variações`,
        FLOOR_ROWS[1].slots.map(s => s.key).join(' '),
        FLOOR_ROWS[2].slots.map(s => s.key).join(' '),
        FLOOR_ROWS[3].slots.map(s => s.key).join(' ')
      ]
    },
    variacoesDoMeio: middleKeysInUse().length,
    slots: floors.slots,
    propriedades: {
      ...(floors.behavior === 'dano' ? { comportamento: 'dano', dano: floors.damage } : { comportamento: floors.behavior }),
      ...(floors.edgeBlocks ? { bordaBloqueia: true } : {})
    }
  };

  try {
    const result = await saveProject(CATEGORY, folder, name, recipe, canvas.toDataURL('image/png'));
    floors.name = name;
    floors.path = result.caminho;
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
  floors.frameMs.clear();
  floors.pattern = recipe.formato && Array.isArray(recipe.formato.padrao) ? recipe.formato.padrao : null;
  for (const [key, source] of Object.entries(recipe.slots || {})) {
    if (!ALL_SLOTS.some(slot => slot.key === key) && !PATTERN_KEY.test(key)) continue;
    floors.slots[key] = source;
    loadSlotImage(key, source);
  }
  floors.name = recipe.nome || '';
  nameEl.value = floors.name;
  const props = recipe.propriedades || {};
  floors.behavior = ['bloqueia', 'dano'].includes(props.comportamento) ? props.comportamento : 'normal';
  floors.damage = Math.max(1, Math.floor(Number(props.dano)) || 10);
  floors.edgeBlocks = props.bordaBloqueia === true;
  showBehavior();
  floors.path = recipePath(recipe, CATEGORY);
  setFolder(folderEl, recipe);
  floors.selected = 'meio-1';
  floors.dirty = false;
  setStatus(recipe.nome ? `Aberto: ${recipe.nome}` : '');
  render();
  refreshProjects();
}

// ================================================================================================================================================================================================================================================
// showBehavior
// Comportamento do piso no formulário; o dano só aparece em "Dano ao pisar".

function showBehavior() {
  behaviorEl.value = floors.behavior;
  damageEl.value = floors.damage;
  damageFieldEl.hidden = floors.behavior !== 'dano';
  edgeBlocksEl.checked = !!floors.edgeBlocks;
}

// ================================================================================================================================================================================================================================================
// floorsView
// A categoria Pisos pro main.js (lista da esquerda, lista de sprites, novo/abrir).

export const floorsView = {
  category: CATEGORY,
  title: 'Pisos salvos',
  newLabel: '+ Novo piso',
  emptyText: 'Nenhum piso salvo ainda.',
  pickerMode: 'floors',
  init: initFloors,
  open: openRecipe,
  reset: () => openRecipe({ nome: '', slots: {} }),
  isDirty: () => floors.dirty,
  path: () => floors.path,
  pick: (kind, id, variation) => { if (kind === 'item') pickSprite(id, variation); },
  useAll: useAllVariations
};
