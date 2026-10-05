// gerador/app/js/objects.js

import { spriteUrl, saveProject, fetchItemInfo, fetchProjects } from './api.js';
import { loadImage, isReady, drawAnchored, readPngFile, normalizeName, setStatus } from './common.js';
import { refreshProjects } from './projects.js';
import { fillFolderSelect, folderOf, setFolder, recipePath } from './folders.js';

// Folha de objeto: uma linha com os quadros da animação, cada um com o
// tamanho do objeto (32 ou 64 px), como os itens do jogo. As propriedades
// (bloqueia, pode mover, tem altura) vêm do Tibia.dat e podem ser mudadas;
// ficam na receita pra quando o objeto entrar no jogo.
// O objeto vem de um item do Tibia (uma variação, com todos os quadros) ou
// de um PNG (uma imagem, ou uma tira de quadros quadrados lado a lado).
// Objeto que gira (baú, escada, cama…): um desenho por direção que ele tiver
// (norte, leste, sul, oeste), uma linha da folha por direção; no editor, R
// gira pelas que existem. Objeto de 2 sqm (cama): cada direção tem também o
// desenho do 2º sqm (em pé, o de cima; deitado, o da esquerda), juntos num
// quadro de 64 px.

const CATEGORY = 'objetos';
const FRAME_MS = 500;
const STACK_OFFSET = 7;
// Números da receita pro jogo: peso de uma unidade, espaços (container) e os
// bônus de quem usa o item: atk, def e ml somam nos skills, speed na
// velocidade.
const NUMBERS = [
  { key: 'peso', label: 'Peso (oz)', min: 0, step: 0.1 },
  { key: 'espacos', label: 'Espaços (0 = não é container)', min: 0, step: 1 },
  { key: 'atk', label: 'Ataque (atk)', min: 0, step: 1 },
  { key: 'def', label: 'Defesa (def)', min: 0, step: 1 },
  { key: 'ml', label: 'Magic level (ml)', min: 0, step: 1 },
  { key: 'speed', label: 'Velocidade (speed)', min: 0, step: 1 },
  { key: 'vidaMin', label: 'Recupera vida (mín.)', min: 0, step: 1 },
  { key: 'vidaMax', label: 'Recupera vida (máx.)', min: 0, step: 1 },
  { key: 'manaMin', label: 'Recupera mana (mín.)', min: 0, step: 1 },
  { key: 'manaMax', label: 'Recupera mana (máx.)', min: 0, step: 1 },
  { key: 'alimento', label: 'Comida (segundos de regeneração)', min: 0, step: 1 },
  { key: 'luz', label: 'Luz (raio em sqm; 0 = não ilumina)', min: 0, step: 1 },
  { key: 'duracao', label: 'Duração em uso (segundos acesa, ou equipada se regenera; 0 = não gasta)', min: 0, step: 1 },
  { key: 'regenVida', label: 'Equipado: recupera vida a cada 6 s', min: 0, step: 1 },
  { key: 'regenMana', label: 'Equipado: recupera mana a cada 6 s', min: 0, step: 1 }
];
const DEFAULT_PROPERTIES = { bloqueia: false, move: true, altura: false, empilhavel: false, peso: 10, espacos: 0, atk: 0, def: 0, ml: 0, speed: 0, vidaMin: 0, vidaMax: 0, manaMin: 0, manaMax: 0, alimento: 0, luz: 0, duracao: 0, regenVida: 0, regenMana: 0, uso: '', abreComo: '', acesoComo: '' };
const USES = [
  ['', 'Nenhum'],
  ['placa', 'Placa (mostra um texto, escrito no editor)'],
  ['livro', 'Livro (abre um texto, escrito no editor)'],
  ['bau-quest', 'Baú de quest (itens no editor, uma vez por player)'],
  ['corda', 'Marca de corda (sobe um andar usando a corda)'],
  ['pa', 'Monte que a pá abre em buraco'],
  ['pa-cai', 'Buraco que a pá abre e o player já cai (o desenho não muda)'],
  ['descer', 'Bueiro (usar leva pro andar de baixo)'],
  ['deposito', 'Depósito (cada player guarda os itens dele)'],
  ['ferramenta-corda', 'Ferramenta: corda'],
  ['ferramenta-pa', 'Ferramenta: pá']
];
const CONTAINER_SIZE = 8;
const STACK_VARIATIONS = 8;
const PROPERTIES = [
  { key: 'bloqueia', label: 'Bloqueia a passagem' },
  { key: 'move', label: 'Pode ser movido (arrastar)' },
  { key: 'altura', label: 'Tem altura (empilha e dá pra subir; escada: sobe ao pisar)' },
  { key: 'empilhavel', label: 'Empilhável (pilha até 100)' }
];

const DIRECTIONS = [['norte', 'Norte'], ['leste', 'Leste'], ['sul', 'Sul'], ['oeste', 'Oeste']];
const PLAIN = 'objeto';
const SECOND = '-2';

const objects = {
  slots: {},
  selected: PLAIN,
  rotates: false,
  twoSquares: false,
  properties: { ...DEFAULT_PROPERTIES },
  frame: 0,
  name: '',
  path: '',
  dirty: false,
  saving: false
};

const statusEl = document.getElementById('objectStatus');
const nameEl = document.getElementById('objectName');
const folderEl = document.getElementById('objectFolder');
const infoEl = document.getElementById('objectInfo');
const previewCanvas = document.getElementById('objectPreview');
const slotsEl = document.getElementById('objectSlots');
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
  document.getElementById('objectRotates').addEventListener('change', (evt) => setLayout(evt.target.checked, objects.twoSquares));
  document.getElementById('objectTwoSquares').addEventListener('change', (evt) => setLayout(objects.rotates, evt.target.checked));
  document.getElementById('objectUpload').addEventListener('change', async (evt) => {
    const file = evt.target.files[0];
    evt.target.value = '';
    if (file) setSource({ png: await readPngFile(file) }, null);
  });
  nameEl.addEventListener('input', () => { objects.dirty = true; });
  fillFolderSelect(folderEl, CATEGORY);
  folderEl.addEventListener('change', () => { objects.dirty = true; });
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
// Item da lista da direita vai pro espaço escolhido (direção ou 2º sqm); no
// 1º desenho do objeto, as propriedades vêm do Tibia.dat.

async function pick(kind, id, variation) {
  if (kind !== 'item') return;
  try {
    const info = await fetchItemInfo(id);
    const first = !Object.keys(objects.slots).some(key => key !== objects.selected);
    setSource({ tibia: { id, variacao: variation } }, info);
    if (!first) return;
    objects.properties = { ...objects.properties, bloqueia: info.bloqueia, move: info.move, altura: info.altura, empilhavel: !!info.empilhavel, espacos: info.container ? CONTAINER_SIZE : 0 };
    renderProperties();
    status(`Propriedades do item ${id} vieram do Tibia; mude se quiser.`);
  } catch (error) {
    status(`Não deu pra ler o item ${id}: ${error.message}`, 'error');
  }
}

// ================================================================================================================================================================================================================================================
// setSource
// Carrega os quadros no espaço escolhido: do Tibia, um PNG por quadro da
// animação; de um PNG, a imagem inteira (os quadros saem dela em
// sourceFrames). Item de pilha do Tibia (8 variações): um quadro por
// quantidade (1, 2, 3, 4, 5, 10, 25, 50), que o jogo escolhe pela quantidade
// em vez de animar.

function setSource(source, info, key = objects.selected) {
  objects.dirty = true;
  if (!source) {
    delete objects.slots[key];
    render();
    return;
  }
  const slot = { source, info, stack: isStackSource(source, info), frames: [] };
  const urls = source.png
    ? [source.png]
    : slot.stack
      ? Array.from({ length: STACK_VARIATIONS }, (_, variation) => spriteUrl(source.tibia.id, variation, 0))
      : Array.from({ length: info.quadros }, (_, frame) => spriteUrl(source.tibia.id, source.tibia.variacao, frame));
  slot.frames = urls.map(url => loadImage(url, () => {
    if (objects.slots[key] === slot) render();
  }));
  objects.slots[key] = slot;
  render();
}

// ================================================================================================================================================================================================================================================
// setLayout
// Liga ou desliga as direções e os 2 sqm. O desenho que já estava escolhido
// vai pro 1º espaço do jeito novo.

function setLayout(rotates, twoSquares) {
  const keys = slotKeys();
  const moved = keys.map(key => objects.slots[key]);
  objects.rotates = rotates;
  objects.twoSquares = twoSquares;
  const next = slotKeys();
  objects.slots = {};
  moved.forEach((slot, i) => {
    if (slot && next[i]) objects.slots[next[i]] = slot;
  });
  objects.selected = next[0];
  objects.dirty = true;
  render();
}

// ================================================================================================================================================================================================================================================
// slotKeys / directionKeys
// Os espaços de desenho na ordem: cada direção (ou o objeto, se não gira) e,
// em 2 sqm, o 2º sqm dela logo depois.

function directionKeys() {
  return objects.rotates ? DIRECTIONS.map(([key]) => key) : [PLAIN];
}

function slotKeys() {
  return directionKeys().flatMap(key => objects.twoSquares ? [key, key + SECOND] : [key]);
}

// ================================================================================================================================================================================================================================================
// isStackSource
// Item do Tibia que empilha e muda de desenho com a quantidade.

function isStackSource(source, info) {
  return !!(source && source.tibia && info && info.empilhavel && info.variacoes === STACK_VARIATIONS);
}

// ================================================================================================================================================================================================================================================
// sourceFrames
// Os quadros prontos de um espaço: [{ img, sx, sy, w, h }]. PNG largo (tira
// de quadros quadrados lado a lado) vira um quadro por pedaço. [] enquanto
// carrega ou vazio.

function sourceFrames(key) {
  const slot = objects.slots[key];
  if (!slot || !slot.frames.length || !slot.frames.every(isReady)) return [];
  if (slot.source.png) {
    const img = slot.frames[0];
    const side = img.naturalHeight;
    const count = img.naturalWidth >= 2 * side ? Math.floor(img.naturalWidth / side) : 1;
    if (count === 1) return [{ img, sx: 0, sy: 0, w: img.naturalWidth, h: img.naturalHeight }];
    return Array.from({ length: count }, (_, i) => ({ img, sx: i * side, sy: 0, w: side, h: side }));
  }
  return slot.frames.map(img => ({ img, sx: 0, sy: 0, w: img.naturalWidth, h: img.naturalHeight }));
}

// ================================================================================================================================================================================================================================================
// directionFrames
// Os quadros de uma direção. Em 2 sqm, cada quadro junta o sqm dela (canto
// de baixo à direita) e o 2º sqm (em cima; deitado, à esquerda) em 64 px.

function directionFrames(key) {
  const main = sourceFrames(key);
  if (!objects.twoSquares) return main;
  const second = sourceFrames(key + SECOND);
  const count = Math.max(main.length, second.length);
  const lying = key === 'leste' || key === 'oeste';
  return Array.from({ length: count }, (_, i) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (second.length) drawFrame(ctx, second[i % second.length], lying ? 0 : 32, lying ? 32 : 0, 32);
    if (main.length) drawFrame(ctx, main[i % main.length], 32, 32, 32);
    return { img: canvas, sx: 0, sy: 0, w: 64, h: 64 };
  });
}

// ================================================================================================================================================================================================================================================
// sheetRows
// As linhas da folha: [{ key, frames }] de cada direção com desenho.

function sheetRows() {
  return directionKeys().map(key => ({ key, frames: directionFrames(key) })).filter(row => row.frames.length);
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
  const useLabel = document.createElement('label');
  useLabel.className = 'numberline';
  const useSelect = document.createElement('select');
  useSelect.id = 'objectProp-uso';
  useSelect.innerHTML = USES.map(([value, text]) => `<option value="${value}">${text}</option>`).join('');
  useSelect.value = objects.properties.uso || '';
  useLabel.append('Uso', useSelect);
  list.appendChild(useLabel);
  const openLabel = document.createElement('label');
  openLabel.className = 'numberline';
  openLabel.hidden = useSelect.value !== 'pa';
  const openSelect = document.createElement('select');
  openSelect.id = 'objectProp-abreComo';
  const fillOpen = (paths) => {
    const current = objects.properties.abreComo || '';
    const options = current && !paths.includes(current) ? [current, ...paths] : paths;
    openSelect.innerHTML = '<option value="">— buraco aberto —</option>' + options.map(p => `<option value="${p}">${p}</option>`).join('');
    openSelect.value = current;
  };
  fillOpen([]);
  fetchProjects().then(projects => fillOpen(projects.filter(p => p.ferramenta === 'objetos').map(p => p.caminho).sort())).catch(() => {});
  openLabel.append('Abre como', openSelect);
  list.appendChild(openLabel);
  useSelect.onchange = () => {
    objects.properties.uso = useSelect.value;
    openLabel.hidden = useSelect.value !== 'pa';
    objects.dirty = true;
  };
  openSelect.onchange = () => {
    objects.properties.abreComo = openSelect.value;
    objects.dirty = true;
  };
  for (const number of NUMBERS) {
    const label = document.createElement('label');
    label.className = 'numberline';
    const input = document.createElement('input');
    input.type = 'number';
    input.id = `objectProp-${number.key}`;
    input.min = number.min;
    input.step = number.step;
    input.value = objects.properties[number.key] ?? DEFAULT_PROPERTIES[number.key];
    input.onchange = () => {
      objects.properties[number.key] = Math.max(number.min, Number(input.value) || 0);
      objects.dirty = true;
    };
    label.append(number.label, input);
    list.appendChild(label);
  }
  const litLabel = document.createElement('label');
  litLabel.className = 'numberline';
  litLabel.hidden = !(Number(objects.properties.luz) > 0);
  const litSelect = document.createElement('select');
  litSelect.id = 'objectProp-acesoComo';
  const fillLit = (paths) => {
    const current = objects.properties.acesoComo || '';
    const options = current && !paths.includes(current) ? [current, ...paths] : paths;
    litSelect.innerHTML = '<option value="">— mesmo desenho —</option>' + options.map(p => `<option value="${p}">${p}</option>`).join('');
    litSelect.value = current;
  };
  fillLit([]);
  fetchProjects().then(projects => fillLit(projects.filter(p => p.ferramenta === 'objetos').map(p => p.caminho).sort())).catch(() => {});
  litLabel.append('Acesa como (desenho quando acesa)', litSelect);
  list.appendChild(litLabel);
  litSelect.onchange = () => {
    objects.properties.acesoComo = litSelect.value;
    objects.dirty = true;
  };
  document.getElementById('objectProp-luz').addEventListener('change', () => {
    litLabel.hidden = !(Number(objects.properties.luz) > 0);
  });
}

// ================================================================================================================================================================================================================================================
// render

function render() {
  const slot = objects.slots[objects.selected];
  const source = slot && slot.source;
  const frames = sourceFrames(objects.selected);
  if (!source) {
    infoEl.textContent = 'Nada neste espaço. Escolha à direita ou envie um PNG.';
  } else if (source.png) {
    infoEl.innerHTML = `<b>PNG enviado</b><br>${frames.length} ${frames.length === 1 ? 'quadro' : 'quadros'}`;
  } else {
    const info = slot.info || {};
    infoEl.innerHTML = `<b>Item ${source.tibia.id}</b><br>${info.tamanho || '?'} px · ${info.quadros || 1} ${info.quadros > 1 ? 'quadros' : 'quadro'}` +
      `${slot.stack ? ' · pilha: um quadro por quantidade (1, 2, 3, 4, 5, 10, 25, 50)' : info.variacoes > 1 ? ` · variação ${source.tibia.variacao + 1} de ${info.variacoes}` : ''}${info.pegavel ? ' · dá pra pegar' : ''}`;
  }
  renderSlots();
  composeSheet(sheetCanvas, sheetRows());
  drawPreview();
}

// ================================================================================================================================================================================================================================================
// renderSlots
// Um botão por espaço de desenho (só aparecem com direções ou 2 sqm): clica
// pra escolher onde vai o próximo item da direita.

function renderSlots() {
  document.getElementById('objectRotates').checked = objects.rotates;
  document.getElementById('objectTwoSquares').checked = objects.twoSquares;
  const keys = slotKeys();
  slotsEl.hidden = keys.length === 1;
  slotsEl.innerHTML = '';
  if (keys.length === 1) return;
  for (const key of keys) {
    const [dir, second] = key.split(SECOND);
    const name = dir === PLAIN ? 'Objeto' : DIRECTIONS.find(([k]) => k === dir)[1];
    const lying = dir === 'leste' || dir === 'oeste';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `slot${key === objects.selected ? ' selected' : ''}`;
    const canvas = document.createElement('canvas');
    const frames = sourceFrames(key);
    canvas.width = canvas.height = frameSize(frames);
    if (frames.length) drawFrame(canvas.getContext('2d'), frames[0], 0, 0, canvas.width);
    const label = document.createElement('span');
    label.className = 'slot-name';
    label.textContent = second === undefined ? name : `${name} · ${lying ? 'esquerda' : 'cima'}`;
    button.append(canvas, label);
    button.onclick = () => {
      objects.selected = key;
      render();
    };
    slotsEl.appendChild(button);
  }
}

// ================================================================================================================================================================================================================================================
// composeSheet
// A folha final no canvas, que muda de tamanho: uma linha de quadros por
// direção (a que tiver menos quadros repete os dela).

function composeSheet(canvas, rows) {
  const all = rows.flatMap(row => row.frames);
  const size = frameSize(all);
  const count = Math.max(1, ...rows.map(row => row.frames.length));
  canvas.width = (all.length ? count : 1) * size;
  canvas.height = Math.max(1, rows.length) * size;
  if (canvas === sheetCanvas) {
    canvas.style.width = `${canvas.width * 3}px`;
    canvas.style.height = `${canvas.height * 3}px`;
    const directions = rows.length > 1 ? ` · ${rows.length} direções` : '';
    document.getElementById('objectSheetSize').textContent = all.length ? `(${canvas.width} × ${canvas.height} · ${count} ${count === 1 ? 'quadro' : 'quadros'}${directions})` : '';
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  rows.forEach((row, r) => {
    for (let i = 0; i < count; i++) drawFrame(ctx, row.frames[i % row.frames.length], i * size, r * size, size);
  });
}

// ================================================================================================================================================================================================================================================
// drawPreview
// O objeto animado num pedaço de chão e, se tiver altura, uma pilha de 3
// (cada um 7 px mais alto, como o jogo empilha). Objeto que gira: cada
// direção lado a lado, a escolhida com o contorno.

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
  const rows = sheetRows();
  if (!rows.length) return;
  const size = frameSize(rows.flatMap(row => row.frames));
  const outline = (x, y, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x * tile + 0.5, y * tile + 0.5, tile - 1, tile - 1);
  };
  const blocked = (x, y, key) => {
    if (!objects.properties.bloqueia) return;
    outline(x, y, 'rgba(226, 87, 76, 0.8)');
    if (objects.twoSquares) outline(key === 'leste' || key === 'oeste' ? x - 1 : x, key === 'leste' || key === 'oeste' ? y : y - 1, 'rgba(226, 87, 76, 0.8)');
  };

  if (objects.rotates) {
    rows.forEach((row, i) => {
      const x = 1 + i * 2;
      drawFrame(ctx, row.frames[objects.frame % row.frames.length], x * tile + tile - size, 2 * tile + tile - size, size);
      blocked(x, 2, row.key);
      if (objects.selected.split(SECOND)[0] === row.key) outline(x, 3, 'rgba(120, 200, 140, 0.9)');
    });
    return;
  }
  const frames = rows[0].frames;
  const frame = frames[objects.frame % frames.length];
  drawFrame(ctx, frame, 2 * tile + tile - size, 2 * tile + tile - size, size);
  if (objects.properties.altura) {
    for (let level = 0; level < 3; level++) {
      const lift = level * STACK_OFFSET;
      drawFrame(ctx, frame, 5 * tile + tile - size - lift, 2 * tile + tile - size - lift, size);
    }
  }
  blocked(2, 2, PLAIN);
}

// ================================================================================================================================================================================================================================================
// save
// Receita: objeto é o desenho (o da 1ª direção, se gira); segundo, o do 2º
// sqm; direcoes, o desenho de cada espaço ('norte', 'norte-2'…), e
// formato.direcoes, a ordem das linhas da folha.

async function save() {
  if (objects.saving) return;
  const name = normalizeName(nameEl.value);
  const keys = slotKeys().filter(key => objects.slots[key]);
  const rows = sheetRows();
  if (!keys.length) {
    status('Escolha um objeto à direita ou envie um PNG.', 'error');
    return;
  }
  if (!name) {
    status('Dê um nome ao objeto (ex.: bau).', 'error');
    return;
  }
  if (keys.some(key => !sourceFrames(key).length)) {
    status('Espere as imagens terminarem de carregar.', 'error');
    return;
  }
  if (objects.twoSquares && directionKeys().some(key => !objects.slots[key] && objects.slots[key + SECOND])) {
    status('Falta o desenho do sqm principal numa direção.', 'error');
    return;
  }

  const folder = folderOf(folderEl);
  if (!folder) {
    status('Escolha a pasta onde salvar.', 'error');
    return;
  }

  nameEl.value = name;
  objects.saving = true;
  document.getElementById('objectSaveBtn').disabled = true;
  const canvas = document.createElement('canvas');
  composeSheet(canvas, rows);
  const all = rows.flatMap(row => row.frames);
  const plain = objects.slots[PLAIN];
  const formato = {
    quadro: frameSize(all),
    quadros: Math.max(...rows.map(row => row.frames.length)),
    ...(!objects.rotates && !objects.twoSquares && plain.stack ? { pilha: true } : {}),
    ...(objects.rotates ? { direcoes: rows.map(row => row.key) } : {}),
    ...(objects.twoSquares ? { sqms: 2 } : {})
  };
  const recipe = { formato, objeto: objects.slots[rows[0].key].source };
  if (objects.rotates) recipe.direcoes = Object.fromEntries(keys.map(key => [key, objects.slots[key].source]));
  else if (objects.slots[PLAIN + SECOND]) recipe.segundo = objects.slots[PLAIN + SECOND].source;
  recipe.propriedades = objects.properties;

  try {
    const result = await saveProject(CATEGORY, folder, name, recipe, canvas.toDataURL('image/png'));
    objects.name = name;
    objects.path = result.caminho;
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
  objects.path = recipePath(recipe, CATEGORY);
  setFolder(folderEl, recipe);
  objects.properties = { ...DEFAULT_PROPERTIES, ...(recipe.propriedades || {}) };
  renderProperties();
  const formato = recipe.formato || {};
  objects.rotates = !!recipe.direcoes;
  objects.twoSquares = formato.sqms === 2;
  objects.slots = {};
  objects.selected = slotKeys()[0];
  const sources = recipe.direcoes
    ? recipe.direcoes
    : { [PLAIN]: recipe.objeto || null, ...(recipe.segundo ? { [PLAIN + SECOND]: recipe.segundo } : {}) };
  for (const [key, source] of Object.entries(sources)) {
    if (!source || !slotKeys().includes(key)) continue;
    let info = null;
    if (source.tibia) {
      try {
        info = await fetchItemInfo(source.tibia.id);
      } catch (error) {
        status(`Não deu pra ler o item ${source.tibia.id}: ${error.message}`, 'error');
        return;
      }
    }
    setSource(source, info, key);
  }
  render();
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
  path: () => objects.path,
  pick,
  useAll: () => {}
};
