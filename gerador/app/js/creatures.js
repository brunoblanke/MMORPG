// gerador/app/js/creatures.js

import { saveProject, fetchProjects } from './api.js';
import { creatureInfo, itemCategory } from './picker.js';
import { sourceUrl, sourceLabel, loadImage, isReady, drawAnchored, readPngFile, normalizeName, setStatus } from './common.js';
import { refreshProjects } from './projects.js';
import { fillFolderSelect, folderOf, setFolder, recipePath } from './folders.js';

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
  path: '',
  dirty: false,
  saving: false,
  loot: [],
  lootItems: [],
  topics: []
};

const statusEl = document.getElementById('creatureStatus');
const nameEl = document.getElementById('creatureName');
const folderEl = document.getElementById('creatureFolder');
const behaviorEl = document.getElementById('creatureBehavior');
const STAT_FIELDS = [
  ['vida', document.getElementById('creatureHp')],
  ['xp', document.getElementById('creatureXp')],
  ['velocidade', document.getElementById('creatureSpeed')],
  ['armadura', document.getElementById('creatureArmor')],
  ['defesa', document.getElementById('creatureDefense')],
  ['ataque', document.getElementById('creatureAttack')]
];
const infoEl = document.getElementById('creatureInfo');
const thumbCanvas = document.getElementById('creatureThumb');
const walkCanvas = document.getElementById('walkPreview');
const sheetCanvas = document.getElementById('creatureSheet');
const slotsEl = document.getElementById('corpseSlots');
const lootEl = document.getElementById('creatureLoot');
const formEl = document.getElementById('creatureSaveForm');
const npcFieldsEl = document.getElementById('npcFields');
const npcTopicsEl = document.getElementById('npcTopics');
const NPC_TEXT_FIELDS = [
  ['boasVindas', document.getElementById('npcWelcome')],
  ['oi', document.getElementById('npcGreet')],
  ['tchau', document.getElementById('npcBye')]
];
const npcRadiusEl = document.getElementById('npcRadius');
const npcVocationEl = document.getElementById('npcVocation');
const npcDestEl = document.getElementById('npcDest');
const NPC_DEST_FIELDS = [['x', document.getElementById('npcDestX')], ['y', document.getElementById('npcDestY')], ['z', document.getElementById('npcDestZ')]];

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
  behaviorEl.addEventListener('change', () => {
    creatures.dirty = true;
    showNpcFields();
  });
  for (const [, el] of NPC_TEXT_FIELDS) el.addEventListener('input', () => { creatures.dirty = true; });
  npcRadiusEl.addEventListener('input', () => { creatures.dirty = true; });
  npcVocationEl.addEventListener('change', () => {
    creatures.dirty = true;
    showNpcFields();
  });
  for (const [, el] of NPC_DEST_FIELDS) el.addEventListener('input', () => { creatures.dirty = true; });
  document.getElementById('npcTopicAdd').onclick = () => {
    creatures.topics.push({ palavras: '', resposta: '' });
    creatures.dirty = true;
    renderTopics();
  };
  for (const [, el] of STAT_FIELDS) el.addEventListener('input', () => { creatures.dirty = true; });
  fillFolderSelect(folderEl, CATEGORY);
  folderEl.addEventListener('change', () => { creatures.dirty = true; });
  document.getElementById('creatureLootAdd').onclick = () => {
    creatures.loot.push({ tipo: '', chance: 0.1, min: 1, max: 1 });
    creatures.dirty = true;
    renderLoot();
  };
  loadLootItems();
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
    img.contentSize = contentSize(img);
    if (creatures.sheetImage === img) render();
  });
  creatures.sheetImage = img;
}

// ================================================================================================================================================================================================================================================
// contentSize
// Quanto do quadro a criatura realmente ocupa (ancorada embaixo à direita),
// arredondado pra múltiplo de 32: roupa do Tibia de 2×2 sqm com o desenho
// todo num canto de 32 vira folha de 32.

function contentSize(img) {
  const full = img.naturalHeight / 4;
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let used = 0;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] === 0) continue;
      used = Math.max(used, full - (x % full), full - (y % full));
    }
  }
  return Math.min(full, Math.max(32, Math.ceil(used / 32) * 32));
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
// Tamanho do quadro da criatura: o que o desenho ocupa na folha que veio do
// servidor (contentSize) ou, enquanto carrega, o do catálogo.

function outfitSize() {
  if (!creatures.outfit) return 32;
  const img = creatures.sheetImage;
  if (!isReady(img)) return creatures.outfit.size;
  return img.contentSize || img.naturalHeight / 4;
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
  const full = img.naturalHeight / 4;
  const own = outfitSize();
  ctx.drawImage(img, frame * full + full - own, direction * full + full - own, own, own, x + size - own, y + size - own, own, own);
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
// statValues
// Números da criatura pro jogo (vida, XP, velocidade na escala do Tibia,
// armadura e ataque); 0 = usa o do nível no mapa.

function statValues() {
  return Object.fromEntries(STAT_FIELDS.map(([key, el]) => [key, Math.max(0, Math.floor(Number(el.value)) || 0)]));
}

// ================================================================================================================================================================================================================================================
// loadLootItems
// Os itens salvos no gerador (grupo Itens), pra escolher no loot.

async function loadLootItems() {
  try {
    const projects = await fetchProjects();
    creatures.lootItems = projects.filter(p => p.grupo === 'itens' && !p.nome.startsWith('respingo'))
      .map(p => p.caminho).sort((a, b) => a.localeCompare(b, 'pt'));
  } catch {
    creatures.lootItems = [];
  }
  renderLoot();
}

// ================================================================================================================================================================================================================================================
// renderLoot
// Uma linha por item do loot: item, chance (%), quantidade mínima e máxima.

function renderLoot() {
  lootEl.innerHTML = '';
  const items = creatures.lootItems || [];
  creatures.loot.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'loot-row';
    const select = document.createElement('select');
    const options = entry.tipo && !items.includes(entry.tipo) ? [entry.tipo, ...items] : items;
    select.innerHTML = '<option value="">— item —</option>' + options.map(tipo => `<option value="${tipo}">${tipo.replace(/^itens\//, '')}</option>`).join('');
    select.value = entry.tipo;
    select.onchange = () => { entry.tipo = select.value; creatures.dirty = true; };
    const number = (value, min, max, step, title, apply) => {
      const input = document.createElement('input');
      input.type = 'number';
      Object.assign(input, { min, max, step, title, value });
      input.oninput = () => { apply(Number(input.value)); creatures.dirty = true; };
      return input;
    };
    const chance = number(+(entry.chance * 100).toFixed(2), 0, 100, 0.01, 'Chance de cair (%)', v => { entry.chance = Math.max(0, Math.min(100, v || 0)) / 100; });
    const min = number(entry.min, 1, 100, 1, 'Quantidade mínima', v => { entry.min = Math.max(1, Math.floor(v) || 1); });
    const max = number(entry.max, 1, 100, 1, 'Quantidade máxima', v => { entry.max = Math.max(1, Math.floor(v) || 1); });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ghost-btn';
    remove.textContent = '×';
    remove.title = 'Tirar do loot';
    remove.onclick = () => { creatures.loot.splice(index, 1); creatures.dirty = true; renderLoot(); };
    row.append(select, chance, document.createTextNode('%'), min, document.createTextNode('–'), max, remove);
    lootEl.appendChild(row);
  });
}

// ================================================================================================================================================================================================================================================
// lootValues
// O loot pra receita: [{ tipo, chance (0–1), min, max }], sem linhas vazias.

function lootValues() {
  return creatures.loot.filter(e => e.tipo && e.chance > 0).map(e => {
    const entry = { tipo: e.tipo, chance: Math.round(e.chance * 10000) / 10000 };
    const max = Math.max(e.min || 1, e.max || 1);
    if (max > 1) Object.assign(entry, { min: Math.min(e.min || 1, max), max });
    return entry;
  });
}

// ================================================================================================================================================================================================================================================
// showNpcFields
// Com comportamento NPC, a conversa aparece e vida, XP, ataque e loot somem.
// Escolhendo vocação, aparece o destino pra onde ele leva o player.

function showNpcFields() {
  const isNpc = behaviorEl.value === 'npc';
  npcFieldsEl.hidden = !isNpc;
  npcDestEl.hidden = !npcVocationEl.value;
  formEl.classList.toggle('is-npc', isNpc);
}

// ================================================================================================================================================================================================================================================
// renderTopics
// Uma linha por tópico: palavras (separadas por vírgula) e a resposta.

function renderTopics() {
  npcTopicsEl.innerHTML = '';
  creatures.topics.forEach((topic, index) => {
    const row = document.createElement('div');
    row.className = 'npc-topic';
    const words = document.createElement('input');
    Object.assign(words, { type: 'text', className: 'npc-words', placeholder: 'ex.: comida, comer', value: topic.palavras, maxLength: 120 });
    words.oninput = () => { topic.palavras = words.value; creatures.dirty = true; };
    const reply = document.createElement('input');
    Object.assign(reply, { type: 'text', className: 'npc-reply', placeholder: 'Resposta do NPC', value: topic.resposta, maxLength: 240 });
    reply.oninput = () => { topic.resposta = reply.value; creatures.dirty = true; };
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ghost-btn';
    remove.textContent = '×';
    remove.onclick = () => { creatures.topics.splice(index, 1); creatures.dirty = true; renderTopics(); };
    row.append(words, reply, remove);
    npcTopicsEl.appendChild(row);
  });
}

// ================================================================================================================================================================================================================================================
// conversationValues
// A conversa pra receita (propriedades.conversa), sem tópicos vazios.

function conversationValues() {
  const talk = Object.fromEntries(NPC_TEXT_FIELDS.map(([key, el]) => [key, el.value.trim()]));
  talk.raio = Math.max(0, Math.min(10, Math.floor(Number(npcRadiusEl.value)) || 0));
  talk.topicos = creatures.topics.map(t => ({ palavras: t.palavras.trim(), resposta: t.resposta.trim() })).filter(t => t.palavras && t.resposta);
  if (npcVocationEl.value) {
    const dest = Object.fromEntries(NPC_DEST_FIELDS.map(([key, el]) => [key, Math.floor(Number(el.value))]));
    talk.vocacao = { destino: NPC_DEST_FIELDS.every(([key, el]) => el.value !== '' && Number.isFinite(dest[key])) ? dest : null };
  }
  return talk;
}

// ================================================================================================================================================================================================================================================
// behaviorOf
// Comportamento guardado na receita: normal, foge (com a vida baixa), mago
// (ataca de longe), pacifico (nunca ataca, foge de quem chega perto) ou npc
// (conversa, não luta).
// Receita antiga com foge > 0 vira "foge".

function behaviorOf(props) {
  if (['normal', 'foge', 'mago', 'pacifico', 'npc'].includes(props.comportamento)) return props.comportamento;
  return Number(props.foge) > 0 ? 'foge' : 'normal';
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

  const folder = folderOf(folderEl);
  if (!folder) {
    status('Escolha a pasta onde salvar.', 'error');
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
    cadaver: creatures.corpse,
    propriedades: behaviorEl.value === 'npc'
      ? { comportamento: 'npc', conversa: conversationValues() }
      : { comportamento: behaviorEl.value, ...statValues(), loot: lootValues() }
  };

  try {
    const result = await saveProject(CATEGORY, folder, name, recipe, canvas.toDataURL('image/png'));
    creatures.name = name;
    creatures.path = result.caminho;
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
  behaviorEl.value = behaviorOf(recipe.propriedades || {});
  const talk = (recipe.propriedades || {}).conversa || {};
  for (const [key, el] of NPC_TEXT_FIELDS) el.value = talk[key] || '';
  npcRadiusEl.value = String(Number.isFinite(Number(talk.raio)) && talk.raio !== undefined ? talk.raio : 2);
  npcVocationEl.value = talk.vocacao ? 'sim' : '';
  const dest = (talk.vocacao && talk.vocacao.destino) || {};
  for (const [key, el] of NPC_DEST_FIELDS) el.value = Number.isFinite(dest[key]) ? String(dest[key]) : (key === 'z' ? '0' : '');
  creatures.topics = Array.isArray(talk.topicos) ? talk.topicos.map(t => ({ palavras: t.palavras || '', resposta: t.resposta || '' })) : [];
  renderTopics();
  showNpcFields();
  for (const [key, el] of STAT_FIELDS) el.value = String(Math.max(0, Math.floor(Number((recipe.propriedades || {})[key])) || 0));
  const loot = (recipe.propriedades || {}).loot;
  creatures.loot = Array.isArray(loot) ? loot.map(e => ({ tipo: e.tipo, chance: Number(e.chance) || 0, min: e.min || 1, max: e.max || e.min || 1 })) : [];
  loadLootItems();
  creatures.corpse = {};
  creatures.corpseImages.clear();
  for (const stage of CORPSE_STAGES) {
    const source = (recipe.cadaver || {})[stage.key];
    if (source) setCorpse(stage.key, source, false);
  }
  creatures.selectedStage = 'fresco';
  creatures.name = recipe.nome || '';
  nameEl.value = creatures.name;
  creatures.path = recipePath(recipe, CATEGORY);
  setFolder(folderEl, recipe);
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
  path: () => creatures.path,
  pick,
  useAll: () => {}
};
