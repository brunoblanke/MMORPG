// gerador/app/js/creatures.js

import { saveProject, fetchProjects } from './api.js';
import { creatureInfo, itemCategory } from './picker.js';
import { sourceUrl, sourceLabel, loadImage, isReady, drawAnchored, readPngFile, normalizeName, setStatus } from './common.js';
import { refreshProjects } from './projects.js';
import { fillFolderSelect, folderOf, setFolder, recipePath } from './folders.js';
import { VOCATION_LINES, SHOP_LINES, QUEST_LINES, BANK_LINES } from '/shared/npcs.js';

// Folha de criatura (quadros de 32 ou 64 px, o maior entre criatura e cadáver):
//   linhas 1–4  sul, norte, leste, oeste — 1º quadro parado, depois andando
//   linha 5     cadáver: fresco, apodrecendo, ossos
// A criatura vem do Tibia (roupa de humano com as cores e addons escolhidos,
// já no lugar certo do sqm) ou, na receita sem criatura do Tibia (folha
// montada fora do gerador), da própria folha salva; cada estágio do cadáver
// vem de um item do Tibia ou de um PNG enviado.

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
  attacks: [],
  resist: {},
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
  topics: [],
  shop: [],
  buys: [],
  quests: [],
  creatureTypes: []
};

const statusEl = document.getElementById('creatureStatus');
const nameEl = document.getElementById('creatureName');
const folderEl = document.getElementById('creatureFolder');
const behaviorEl = document.getElementById('creatureBehavior');
const voicesEl = document.getElementById('creatureVoices');
const STAT_FIELDS = [
  ['vida', document.getElementById('creatureHp')],
  ['xp', document.getElementById('creatureXp')],
  ['velocidade', document.getElementById('creatureSpeed')],
  ['armadura', document.getElementById('creatureArmor')],
  ['defesa', document.getElementById('creatureDefense')],
  ['ataque', document.getElementById('creatureAttack')]
];
const POWER_FIELDS = {
  spell: document.getElementById('creatureSpell'),
  spellDamage: document.getElementById('creatureSpellDamage'),
  spellChance: document.getElementById('creatureSpellChance'),
  poison: document.getElementById('creaturePoison'),
  summon: document.getElementById('creatureSummon'),
  summonMax: document.getElementById('creatureSummonMax'),
  respawn: document.getElementById('creatureRespawn')
};
const infoEl = document.getElementById('creatureInfo');
const thumbCanvas = document.getElementById('creatureThumb');
const walkCanvas = document.getElementById('walkPreview');
const sheetCanvas = document.getElementById('creatureSheet');
const slotsEl = document.getElementById('corpseSlots');
const lootEl = document.getElementById('creatureLoot');
const attacksEl = document.getElementById('creatureAttacks');
const resistEl = document.getElementById('creatureResistances');
const ATTACK_ELEMENTS = [['physical', 'Físico'], ['fire', 'Fogo'], ['energy', 'Energia'], ['poison', 'Veneno'], ['ice', 'Gelo'], ['earth', 'Terra'], ['death', 'Morte'], ['holy', 'Sagrado']];
const RESIST_ELEMENTS = ATTACK_ELEMENTS;
const ATTACK_FIELD_TYPES = [['itens/itens-encantados/fire-field', 'Campo de fogo'], ['itens/itens-encantados/poison-field', 'Campo de veneno'], ['itens/itens-encantados/energy-field', 'Campo de energia']];
const ATTACK_SHAPES = [
  ['tiro', 'Tiro (um alvo)'], ['bola', 'Bola (área no alvo)'], ['onda', 'Onda (leque)'], ['raio', 'Raio (linha)'], ['cruz', 'Cruz (no alvo)'],
  ['anel', 'Anel (aro)'], ['redor', 'Redor (8 sqms colados)'], ['varredura', 'Varredura (3 sqms na frente)'], ['campo', 'Campo (cria no chão)'],
  ['corrente', 'Corrente (pula entre players)'], ['lentidao', 'Lentidão'], ['cura', 'Cura (ela mesma)'], ['reflexo', 'Reflexo (devolve dano)']
];
const ATTACK_FIELDS = {
  elemento: { label: 'Elemento', options: ATTACK_ELEMENTS },
  min: { label: 'Dano mín.', min: 0 },
  max: { label: 'Dano máx.', min: 0 },
  chance: { label: 'Chance (%)', min: 1, max: 100 },
  alcance: { label: 'Alcance (sqm)', min: 0 },
  raio: { label: 'Raio (sqm)', min: 0 },
  comprimento: { label: 'Comprimento', min: 0 },
  abertura: { label: 'Abertura', min: 0 },
  larguras: { label: 'Larguras (ex. 1,3,3,5)', text: true },
  centro: { label: 'Centro', options: [['alvo', 'No alvo'], ['si', 'Nela']] },
  campo: { label: 'Campo', options: ATTACK_FIELD_TYPES },
  saltos: { label: 'Players (total)', min: 1 },
  alcanceSalto: { label: 'Pulo (sqm)', min: 1 },
  velocidade: { label: 'Velocidade (negativa)' },
  ms: { label: 'Duração (ms)', min: 0 },
  porcentagem: { label: 'Devolve (%)', min: 1, max: 100 }
};
const ATTACK_SHAPE_FIELDS = {
  tiro: ['elemento', 'min', 'max', 'chance', 'alcance'],
  bola: ['elemento', 'min', 'max', 'chance', 'alcance', 'raio', 'centro'],
  onda: ['elemento', 'min', 'max', 'chance', 'comprimento', 'abertura', 'larguras'],
  raio: ['elemento', 'min', 'max', 'chance', 'comprimento'],
  cruz: ['elemento', 'min', 'max', 'chance', 'alcance'],
  anel: ['elemento', 'min', 'max', 'chance', 'raio', 'centro', 'alcance'],
  redor: ['elemento', 'min', 'max', 'chance'],
  varredura: ['elemento', 'min', 'max', 'chance'],
  campo: ['campo', 'chance', 'alcance', 'raio'],
  corrente: ['elemento', 'min', 'max', 'chance', 'alcance', 'saltos', 'alcanceSalto'],
  lentidao: ['velocidade', 'ms', 'chance', 'alcance'],
  cura: ['min', 'max', 'chance'],
  reflexo: ['chance', 'porcentagem']
};
const formEl = document.getElementById('creatureSaveForm');
const npcFieldsEl = document.getElementById('npcFields');
const npcTopicsEl = document.getElementById('npcTopics');
const npcShopEl = document.getElementById('npcShop');
const npcBuyEl = document.getElementById('npcBuy');
const NPC_FOLDER = 'personagens/npcs';
const LINE_GROUPS = [
  { key: 'falasVocacao', defaults: VOCATION_LINES, box: document.getElementById('npcVocationLines'), grid: document.getElementById('npcVocationLinesGrid') },
  { key: 'falasVenda', defaults: SHOP_LINES, box: document.getElementById('npcShopLines'), grid: document.getElementById('npcShopLinesGrid') },
  { key: 'falasMissao', defaults: QUEST_LINES, box: document.getElementById('npcQuestLines'), grid: document.getElementById('npcQuestLinesGrid') },
  { key: 'falasBanco', defaults: BANK_LINES, box: document.getElementById('npcBankLines'), grid: document.getElementById('npcBankLinesGrid') }
];
const npcQuestsEl = document.getElementById('npcQuests');
const NPC_TEXT_FIELDS = [
  ['boasVindas', document.getElementById('npcWelcome')],
  ['oi', document.getElementById('npcGreet')],
  ['tchau', document.getElementById('npcBye')]
];
const npcRadiusEl = document.getElementById('npcRadius');
const npcVocationEl = document.getElementById('npcVocation');
const npcBankEl = document.getElementById('npcBank');
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
    suggestFolder();
    showNpcFields();
  });
  for (const [, el] of NPC_TEXT_FIELDS) el.addEventListener('input', () => { creatures.dirty = true; });
  npcRadiusEl.addEventListener('input', () => { creatures.dirty = true; });
  npcVocationEl.addEventListener('change', () => {
    creatures.dirty = true;
    showNpcFields();
  });
  npcBankEl.addEventListener('change', () => {
    creatures.dirty = true;
    showNpcFields();
  });
  for (const [, el] of NPC_DEST_FIELDS) el.addEventListener('input', () => { creatures.dirty = true; });
  document.getElementById('npcBuyAdd').onclick = () => {
    creatures.buys.push({ tipo: '', preco: 0, palavras: '' });
    creatures.dirty = true;
    renderShop();
  };
  document.getElementById('npcShopAdd').onclick = () => {
    creatures.shop.push({ tipo: '', preco: 0, palavras: '' });
    creatures.dirty = true;
    renderShop();
  };
  document.getElementById('npcQuestAdd').onclick = () => {
    creatures.quests.push({ nome: '', palavras: '', tipo: 'item', alvo: '', quantidade: 1, pedido: '', recompensa: { tipo: '', count: 1 }, xp: 0, moedas: 0 });
    creatures.dirty = true;
    renderQuests();
  };
  document.getElementById('npcTopicAdd').onclick = () => {
    creatures.topics.push({ palavras: '', resposta: '' });
    creatures.dirty = true;
    renderTopics();
  };
  for (const [, el] of STAT_FIELDS) el.addEventListener('input', () => { creatures.dirty = true; });
  for (const el of Object.values(POWER_FIELDS)) el.addEventListener('input', () => { creatures.dirty = true; });
  renderAttacks();
  renderResistances();
  voicesEl.addEventListener('input', () => { creatures.dirty = true; });
  fillFolderSelect(folderEl, CATEGORY);
  folderEl.addEventListener('change', () => { creatures.dirty = true; });
  document.getElementById('creatureAttackAdd').onclick = () => {
    creatures.attacks.push({ forma: 'tiro', elemento: 'fire', min: 10, max: 30, chance: 15, alcance: 4 });
    creatures.dirty = true;
    renderAttacks();
  };
  document.getElementById('creatureLootAdd').onclick = () => {
    creatures.loot.push({ tipo: '', chance: 0.1, min: 1, max: 1 });
    creatures.dirty = true;
    renderLoot();
  };
  loadLootItems();
  renderLines();
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
  if (creatures.outfit.own) {
    const own = loadImage(`/saida/${creatures.path}.png?v=${Date.now()}`, () => { if (creatures.sheetImage === own) render(); });
    creatures.sheetImage = own;
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
  if (creatures.outfit.own) return creatures.outfit.size;
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
  const full = creatures.outfit.own ? creatures.outfit.size : img.naturalHeight / 4;
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
  infoEl.innerHTML = outfit && outfit.own
    ? `<b>Folha própria</b><br>${outfit.size} px · ${outfit.frames} quadros por direção`
    : outfit
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
// powerValues
// O que a criatura faz além do golpe: magia de longe, as magias da lista
// (propriedades.ataques, ainda sem tela: só são preservadas ao salvar), veneno
// no golpe, criatura que invoca e tempo de respawn (s).

function powerValues() {
  const int = (el) => Math.max(0, Math.floor(Number(el.value)) || 0);
  const f = POWER_FIELDS;
  return {
    magia: f.spell.value && int(f.spellDamage) ? { tipo: f.spell.value, dano: int(f.spellDamage), chance: Math.min(100, int(f.spellChance)) } : null,
    ...(creatures.attacks.length ? { ataques: attackValues() } : {}),
    ...(Object.keys(resistValues()).length ? { resistencias: resistValues() } : {}),
    veneno: int(f.poison),
    invoca: f.summon.value && int(f.summonMax) ? { tipo: f.summon.value, max: Math.min(5, int(f.summonMax)) } : null,
    respawn: int(f.respawn)
  };
}

// ================================================================================================================================================================================================================================================
// loadPowers

function loadPowers(props) {
  const f = POWER_FIELDS;
  const magic = props.magia || {};
  const call = props.invoca || {};
  creatures.attacks = Array.isArray(props.ataques) ? props.ataques.map(entry => ({ ...entry })) : [];
  creatures.resist = props.resistencias && typeof props.resistencias === 'object' ? { ...props.resistencias } : {};
  renderAttacks();
  renderResistances();
  f.spell.value = magic.tipo || '';
  f.spellDamage.value = String(Number(magic.dano) || 0);
  f.spellChance.value = String(Number(magic.chance) || 20);
  f.poison.value = String(Number(props.veneno) || 0);
  f.summonMax.value = String(Number(call.max) || 0);
  f.respawn.value = String(Number(props.respawn) || 0);
  fillSummonOptions(call.tipo || '');
}

// ================================================================================================================================================================================================================================================
// renderAttacks
// Uma linha por magia: a forma e só os campos que ela usa.

function renderAttacks() {
  attacksEl.innerHTML = '';
  creatures.attacks.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'attack-row';
    const shapeLabel = document.createElement('label');
    const shape = document.createElement('select');
    shape.innerHTML = ATTACK_SHAPES.map(([value, text]) => `<option value="${value}">${text}</option>`).join('');
    shape.value = entry.forma;
    shape.onchange = () => { entry.forma = shape.value; creatures.dirty = true; renderAttacks(); };
    shapeLabel.append('Forma', shape);
    row.appendChild(shapeLabel);
    for (const key of ATTACK_SHAPE_FIELDS[entry.forma] || []) {
      const spec = ATTACK_FIELDS[key];
      const label = document.createElement('label');
      const input = document.createElement(spec.options ? 'select' : 'input');
      const stored = key === 'larguras' ? (entry.larguras || []).join(',') : entry[key];
      if (spec.options) {
        input.innerHTML = spec.options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('');
        input.value = stored ?? spec.options[0][0];
        if (stored === undefined) entry[key] = input.value;
      } else if (spec.text) {
        input.type = 'text';
        input.value = stored || '';
      } else {
        Object.assign(input, { type: 'number', min: spec.min ?? '', max: spec.max ?? '', step: 1, value: stored ?? 0 });
      }
      input.oninput = () => {
        if (spec.options) entry[key] = input.value;
        else if (spec.text) entry[key] = input.value.split(',').map(part => Math.floor(Number(part))).filter(w => w > 0);
        else entry[key] = Number(input.value) || 0;
        creatures.dirty = true;
      };
      label.append(spec.label, input);
      row.appendChild(label);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ghost-btn';
    remove.textContent = '×';
    remove.title = 'Tirar a magia';
    remove.onclick = () => { creatures.attacks.splice(index, 1); creatures.dirty = true; renderAttacks(); };
    row.appendChild(remove);
    attacksEl.appendChild(row);
  });
}

// ================================================================================================================================================================================================================================================
// attackValues
// As magias pra receita: de cada uma só a forma e os campos dela.

function attackValues() {
  return creatures.attacks.map(entry => {
    const values = { forma: entry.forma };
    for (const key of ATTACK_SHAPE_FIELDS[entry.forma] || []) {
      if (entry[key] === undefined || entry[key] === '' || (Array.isArray(entry[key]) && !entry[key].length)) continue;
      values[key] = entry[key];
    }
    return values;
  });
}

// ================================================================================================================================================================================================================================================
// renderResistances
// Uma caixa por tipo de dano (100 = normal).

function renderResistances() {
  resistEl.innerHTML = '';
  for (const [key, text] of RESIST_ELEMENTS) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    Object.assign(input, { type: 'number', min: 0, max: 500, step: 1, value: creatures.resist[key] ?? 100 });
    input.oninput = () => {
      creatures.resist[key] = Math.max(0, Math.min(500, Math.round(Number(input.value)) || 0));
      creatures.dirty = true;
    };
    label.append(text, input);
    resistEl.appendChild(label);
  }
}

// ================================================================================================================================================================================================================================================
// resistValues
// Só os tipos que mudam do normal (100).

function resistValues() {
  return Object.fromEntries(Object.entries(creatures.resist).filter(([key, value]) => RESIST_ELEMENTS.some(([k]) => k === key) && value !== 100));
}

// ================================================================================================================================================================================================================================================
// fillSummonOptions
// As criaturas salvas no gerador, pra escolher quem ela invoca.

function fillSummonOptions(selected = POWER_FIELDS.summon.value) {
  const options = creatures.creatureTypes.includes(selected) || !selected ? creatures.creatureTypes : [...creatures.creatureTypes, selected];
  POWER_FIELDS.summon.innerHTML = '<option value="">Ninguém</option>' + options.map(type => `<option value="${type}">${type.split('/').pop()}</option>`).join('');
  POWER_FIELDS.summon.value = selected;
}

// ================================================================================================================================================================================================================================================
// loadLootItems
// Os itens salvos no gerador (grupo Itens), pra escolher no loot.

async function loadLootItems() {
  try {
    const projects = await fetchProjects();
    creatures.lootItems = projects.filter(p => p.grupo === 'itens' && !p.nome.startsWith('respingo'))
      .map(p => p.caminho).sort((a, b) => a.localeCompare(b, 'pt'));
    creatures.creatureTypes = projects.filter(p => p.grupo === 'criaturas').map(p => p.caminho).sort((a, b) => a.localeCompare(b, 'pt'));
  } catch {
    creatures.lootItems = [];
    creatures.creatureTypes = [];
  }
  fillSummonOptions();
  renderLoot();
  renderShop();
}

// ================================================================================================================================================================================================================================================
// renderShop
// As duas listas da loja do NPC: o que ele vende e o que ele compra.

function renderShop() {
  renderTradeList(creatures.shop, npcShopEl, 'ex.: corda');
  renderTradeList(creatures.buys, npcBuyEl, 'ex.: queijo');
  renderQuests();
}

// ================================================================================================================================================================================================================================================
// renderQuests
// Um quadro por missão: nome, palavras, o que pede (trazer item ou matar
// criatura, qual e quantos), a fala do pedido e a recompensa (item, XP e
// moedas).

function renderQuests() {
  npcQuestsEl.innerHTML = '';
  const changed = () => { creatures.dirty = true; };
  const input = (props, onInput) => {
    const el = document.createElement('input');
    Object.assign(el, props);
    el.oninput = () => { onInput(el.value); changed(); };
    return el;
  };
  const select = (list, value, empty, onChange) => {
    const el = document.createElement('select');
    const options = value && !list.includes(value) ? [value, ...list] : list;
    el.innerHTML = `<option value="">${empty}</option>` + options.map(type => `<option value="${type}">${type.split('/').slice(1).join('/')}</option>`).join('');
    el.value = value;
    el.onchange = () => { onChange(el.value); changed(); };
    return el;
  };
  const number = (value, title, onInput) => {
    const tag = document.createElement('span');
    tag.className = 'npc-tag';
    tag.textContent = title;
    return [tag, input({ type: 'number', className: 'npc-num', min: 0, step: 1, title, value }, v => onInput(Math.max(0, Math.floor(Number(v)) || 0)))];
  };
  creatures.quests.forEach((quest, index) => {
    const box = document.createElement('div');
    box.className = 'npc-quest';
    const row = (...children) => {
      const el = document.createElement('div');
      el.className = 'npc-topic';
      el.append(...children);
      return el;
    };
    const kind = document.createElement('select');
    kind.innerHTML = '<option value="item">Trazer item</option><option value="matar">Matar criatura</option>';
    kind.value = quest.tipo;
    kind.onchange = () => { quest.tipo = kind.value; quest.alvo = ''; changed(); renderQuests(); };
    const targets = quest.tipo === 'matar' ? creatures.creatureTypes : (creatures.lootItems || []);
    const remove = document.createElement('button');
    Object.assign(remove, { type: 'button', className: 'ghost-btn', textContent: '×' });
    remove.onclick = () => { creatures.quests.splice(index, 1); changed(); renderShop(); };
    box.append(
      row(input({ type: 'text', className: 'npc-words', placeholder: 'Nome (ex.: Queijos)', value: quest.nome, maxLength: 60 }, v => { quest.nome = v; }),
        input({ type: 'text', className: 'npc-reply', placeholder: 'Palavras (ex.: queijo, missão)', value: quest.palavras, maxLength: 120 }, v => { quest.palavras = v; }), remove),
      row(kind, select(targets, quest.alvo, quest.tipo === 'matar' ? '— criatura —' : '— item —', v => { quest.alvo = v; }),
        ...number(quest.quantidade, 'quantos', v => { quest.quantidade = Math.max(1, v); })),
      row(input({ type: 'text', className: 'npc-reply', placeholder: 'Pedido do NPC (ex.: Me traz 3 queijos? (sim / não))', value: quest.pedido, maxLength: 240 }, v => { quest.pedido = v; })),
      row(select(creatures.lootItems || [], quest.recompensa.tipo, '— recompensa —', v => { quest.recompensa.tipo = v; }),
        ...number(quest.recompensa.count, 'quantos', v => { quest.recompensa.count = Math.max(1, v); }),
        ...number(quest.xp, 'XP', v => { quest.xp = v; }), ...number(quest.moedas, 'moedas', v => { quest.moedas = v; }))
    );
    npcQuestsEl.appendChild(box);
  });
  showNpcFields();
}

// ================================================================================================================================================================================================================================================
// renderTradeList
// Uma linha por item da lista: item, preço e palavras.

function renderTradeList(list, box, example) {
  box.innerHTML = '';
  const items = creatures.lootItems || [];
  list.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'npc-topic';
    const select = document.createElement('select');
    const options = entry.tipo && !items.includes(entry.tipo) ? [entry.tipo, ...items] : items;
    select.innerHTML = '<option value="">— item —</option>' + options.map(tipo => `<option value="${tipo}">${tipo.replace(/^itens\//, '')}</option>`).join('');
    select.value = entry.tipo;
    select.onchange = () => { entry.tipo = select.value; creatures.dirty = true; };
    const price = document.createElement('input');
    Object.assign(price, { type: 'number', className: 'npc-price', min: 0, step: 1, title: 'Preço (moedas de ouro)', value: entry.preco });
    price.oninput = () => { entry.preco = Math.max(0, Math.floor(Number(price.value)) || 0); creatures.dirty = true; };
    const words = document.createElement('input');
    Object.assign(words, { type: 'text', className: 'npc-reply', placeholder: example, value: entry.palavras, maxLength: 120 });
    words.oninput = () => { entry.palavras = words.value; creatures.dirty = true; };
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ghost-btn';
    remove.textContent = '×';
    remove.onclick = () => { list.splice(index, 1); creatures.dirty = true; renderShop(); };
    row.append(select, price, words, remove);
    box.appendChild(row);
  });
}

// ================================================================================================================================================================================================================================================
// renderLines
// Um campo por fala da vocação e da venda; o padrão aparece apagado no campo.

function renderLines(talk = {}) {
  for (const group of LINE_GROUPS) {
    group.grid.innerHTML = '';
    const saved = talk[group.key] || {};
    for (const [key, { label, text }] of Object.entries(group.defaults)) {
      const name = document.createElement('span');
      name.textContent = label;
      const input = document.createElement('input');
      Object.assign(input, { type: 'text', placeholder: text, value: saved[key] || '', maxLength: 200 });
      input.dataset.line = key;
      input.oninput = () => { creatures.dirty = true; };
      group.grid.append(name, input);
    }
  }
}

// ================================================================================================================================================================================================================================================
// lineValues
// As falas escritas (só as que não estão vazias) de um grupo.

function lineValues(group) {
  const values = {};
  for (const input of group.grid.querySelectorAll('input')) {
    if (input.value.trim()) values[input.dataset.line] = input.value.trim();
  }
  return values;
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
// suggestFolder
// NPC fica em Personagens › NPCs; criatura de combate, fora de Personagens.

function suggestFolder() {
  const isNpc = behaviorEl.value === 'npc';
  const inCharacters = folderEl.value.startsWith('personagens/');
  if (isNpc && !inCharacters) folderEl.value = NPC_FOLDER;
  else if (!isNpc && folderEl.value === NPC_FOLDER) folderEl.value = '';
}

// ================================================================================================================================================================================================================================================
// showNpcFields
// Com comportamento NPC, a conversa aparece e vida, XP, ataque e loot somem.
// Escolhendo vocação, aparece o destino pra onde ele leva o player.

function showNpcFields() {
  const isNpc = behaviorEl.value === 'npc';
  npcFieldsEl.hidden = !isNpc;
  npcDestEl.hidden = !npcVocationEl.value;
  LINE_GROUPS[0].box.hidden = !npcVocationEl.value;
  LINE_GROUPS[1].box.hidden = !creatures.shop.length && !creatures.buys.length;
  LINE_GROUPS[2].box.hidden = !creatures.quests.length;
  LINE_GROUPS[3].box.hidden = !npcBankEl.value;
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
  talk.vende = creatures.shop.filter(e => e.tipo).map(e => ({ tipo: e.tipo, preco: e.preco || 0, palavras: (e.palavras || '').trim() }));
  talk.compra = creatures.buys.filter(e => e.tipo).map(e => ({ tipo: e.tipo, preco: e.preco || 0, palavras: (e.palavras || '').trim() }));
  talk.missoes = creatures.quests.filter(q => q.nome.trim() && q.alvo).map(q => ({
    ...q, nome: q.nome.trim(), palavras: q.palavras.trim(), pedido: q.pedido.trim(),
    recompensa: q.recompensa.tipo ? { tipo: q.recompensa.tipo, count: Math.max(1, q.recompensa.count || 1) } : null
  }));
  for (const group of LINE_GROUPS) {
    const values = lineValues(group);
    if (Object.keys(values).length) talk[group.key] = values;
  }
  if (npcBankEl.value) talk.banco = true;
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
    ...(creatures.outfit.own ? {} : { criatura: { id: creatures.outfit.id, cores: creatures.colors, addons: creatures.addons } }),
    cadaver: creatures.corpse,
    propriedades: behaviorEl.value === 'npc'
      ? { comportamento: 'npc', conversa: conversationValues() }
      : { comportamento: behaviorEl.value, ...statValues(), ...powerValues(), loot: lootValues(), falas: voicesEl.value.split('\n').map(line => line.trim()).filter(Boolean) }
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
// ownSheet
// Receita sem criatura do Tibia: a folha salva é a criatura (tamanho e
// quadros do formato).

function ownSheet(recipe) {
  const format = recipe.formato || {};
  return format.quadro && format.quadros ? { own: true, size: format.quadro, frames: format.quadros } : null;
}

// ================================================================================================================================================================================================================================================
// openRecipe

function openRecipe(recipe) {
  const saved = recipe.criatura || {};
  creatures.outfit = saved.id ? creatureInfo(saved.id) : ownSheet(recipe);
  creatures.colors = Array.isArray(saved.cores) && saved.cores.length === 4 ? [...saved.cores] : [...DEFAULT_COLORS];
  creatures.addons = Array.isArray(saved.addons) ? [...saved.addons] : [];
  behaviorEl.value = behaviorOf(recipe.propriedades || {});
  const talk = (recipe.propriedades || {}).conversa || {};
  for (const [key, el] of NPC_TEXT_FIELDS) el.value = talk[key] || '';
  npcRadiusEl.value = String(Number.isFinite(Number(talk.raio)) && talk.raio !== undefined ? talk.raio : 2);
  npcVocationEl.value = talk.vocacao ? 'sim' : '';
  npcBankEl.value = talk.banco ? 'sim' : '';
  const dest = (talk.vocacao && talk.vocacao.destino) || {};
  for (const [key, el] of NPC_DEST_FIELDS) el.value = Number.isFinite(dest[key]) ? String(dest[key]) : (key === 'z' ? '0' : '');
  creatures.topics = Array.isArray(talk.topicos) ? talk.topicos.map(t => ({ palavras: t.palavras || '', resposta: t.resposta || '' })) : [];
  creatures.shop = Array.isArray(talk.vende) ? talk.vende.map(e => ({ tipo: e.tipo || '', preco: Number(e.preco) || 0, palavras: e.palavras || '' })) : [];
  creatures.buys = Array.isArray(talk.compra) ? talk.compra.map(e => ({ tipo: e.tipo || '', preco: Number(e.preco) || 0, palavras: e.palavras || '' })) : [];
  creatures.quests = Array.isArray(talk.missoes) ? talk.missoes.map(q => ({
    nome: q.nome || '', palavras: q.palavras || '', tipo: q.tipo === 'matar' ? 'matar' : 'item', alvo: q.alvo || '', quantidade: Number(q.quantidade) || 1,
    pedido: q.pedido || '', recompensa: { tipo: (q.recompensa && q.recompensa.tipo) || '', count: (q.recompensa && Number(q.recompensa.count)) || 1 },
    xp: Number(q.xp) || 0, moedas: Number(q.moedas) || 0
  })) : [];
  renderTopics();
  renderLines(talk);
  renderShop();
  showNpcFields();
  for (const [key, el] of STAT_FIELDS) el.value = String(Math.max(0, Math.floor(Number((recipe.propriedades || {})[key])) || 0));
  loadPowers(recipe.propriedades || {});
  const voices = (recipe.propriedades || {}).falas;
  voicesEl.value = Array.isArray(voices) ? voices.join('\n') : '';
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
