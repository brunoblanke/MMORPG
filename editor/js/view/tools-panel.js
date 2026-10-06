// js/view/tools-panel.js

import { state, TOOLS } from '../model/state.js';
import { FLOOR_MIN, FLOOR_MAX, GROUND_FLOOR } from '../../../shared/constants.js';
import { canvas, scheduleRender } from './canvas-renderer.js';
import { BORDER_VARIANTS } from '../../../shared/floor-borders.js';
import { listAssets, creatureBehavior, pieceType, splitType, displayName, isStairsFolder, isEntranceFolder, isItemType, isWallType, objectDirections, objectDirection, rotateType, withDirection, WALL_PIECES, WALL_PIECE_NAMES } from '../../../shared/assets.js';
import { setThumb } from './sprite-thumb.js';
import { svgIcon } from '../../../js/views/inventory-ui/icons.js';
import { closeSelectPanel } from './forms.js';
import { rememberView } from './view-memory.js';

// ================================================================================================================================================================================================================================================
// renderLayerTabs

// Andares numa linha só, na barra do topo: do mais fundo (-5) ao mais alto
// (+5), com o térreo (0) no meio.

export function renderLayerTabs() {
  const wrap = document.getElementById('layerTabs');
  wrap.innerHTML = '';
  for (let z = FLOOR_MIN; z <= FLOOR_MAX; z++) {
    const btn = document.createElement('div');
    const hasContent = layerHasContent(z);
    btn.className = 'layer-tab' + (z === state.activeZ ? ' active' : '') + (hasContent ? ' has-content' : '') + (z === GROUND_FLOOR ? ' ground' : '');
    btn.textContent = floorLabel(z);
    btn.onclick = () => { state.activeZ = z; onLayerChange(); };
    wrap.appendChild(btn);
  }
}

// ================================================================================================================================================================================================================================================
// floorLabel

export function floorLabel(z) {
  return z > 0 ? `+${z}` : String(z);
}

// ================================================================================================================================================================================================================================================
// layerHasContent

function layerHasContent(z) {
  const layer = state.layers[z];
  if (!layer) return false;
  for (const key in layer) {
    const cell = layer[key];
    if (cell.floor || cell.floorTop || cell.hole || cell.borders.length || cell.objects.length || cell.enemy || cell.npc || cell.bot || cell.spawn || cell.safe || cell.house) return true;
  }
  return false;
}

// ================================================================================================================================================================================================================================================
// onLayerChange

export function onLayerChange() {
  document.getElementById('layerLabel').textContent = 'Andar ' + floorLabel(state.activeZ);
  closeSelectPanel();
  renderLayerTabs();
  updateStats();
  scheduleRender();
  rememberView();
}

// ================================================================================================================================================================================================================================================
// choosePaintDefaults
// Cada ferramenta começa com a primeira folha que tiver (depois de loadAssets).

export function choosePaintDefaults() {
  const floors = listAssets('pisos');
  const walls = listAssets('paredes');
  const first = (list) => (list[0] ? list[0].id : null);
  if (!state.floorPaint) state.floorPaint = first(floors);
  if (!state.wallPaint && walls[0]) state.wallPaint = pieceType(walls[0].id, wallPieces(walls[0])[0]);
  if (!state.stairsPaint) state.stairsPaint = first(listAssets('objetos', a => isStairsFolder(a.id)));
  if (!state.holePaint) state.holePaint = first(listAssets('objetos', a => isEntranceFolder(a.id)));
  if (!state.itemPaint) state.itemPaint = first(listAssets('objetos', isCarried));
  if (!state.decoPaint) state.decoPaint = first(listAssets('objetos', isDecoration));
  if (!state.enemyPaint) state.enemyPaint = first(listAssets('criaturas', isMonster));
  if (!state.npcPaint) state.npcPaint = first(listAssets('criaturas', a => creatureBehavior(a.id) === 'npc'));
  if (!state.botPaint) state.botPaint = first(listAssets('criaturas', isPlayerSheet));
  if (!state.borderPaint && floors[0]) state.borderPaint = { type: floors[0].id, variant: 'n' };
}

// ================================================================================================================================================================================================================================================
// wallPieces
// Peças que a folha de parede tem, na ordem da folha.

function wallPieces(asset) {
  return WALL_PIECES.filter(piece => asset.pecas.includes(piece));
}

// ================================================================================================================================================================================================================================================
// paintThumbType
// A peça que representa o que a ferramenta pinta agora (miniatura), ou null.

function paintThumbType(tool) {
  if (tool.id === 'floor') return state.floorPaint && pieceType(state.floorPaint, 'meio-1');
  if (tool.id === 'border') return state.borderPaint && pieceType(state.borderPaint.type, state.borderPaint.variant);
  return tool.paint ? state[tool.paint] : null;
}

// ================================================================================================================================================================================================================================================
// paintLabel
// Nome curto do que a ferramenta pinta (ao lado do botão).

function paintLabel(tool) {
  const value = state[tool.paint];
  if (!value) return 'nenhum';
  if (tool.id === 'border') return `${displayName(value.type)} ${value.variant}`;
  if (tool.id === 'wall') return WALL_PIECE_NAMES[splitType(value).piece] || '';
  return objectDirections(value).length > 1 ? `${displayName(value)} · ${objectDirection(value)} (R gira)` : displayName(value);
}

// ================================================================================================================================================================================================================================================
// accordionGroups
// O que a lista da ferramenta mostra: [{ title, compact, options: [{ value,
// thumb, label }] }] e o texto pra quando não há folha.

function accordionGroups(tool) {
  const byFolder = (assets, option) => {
    const groups = new Map();
    for (const asset of assets) {
      if (!groups.has(asset.rotulo)) groups.set(asset.rotulo, []);
      groups.get(asset.rotulo).push(option(asset));
    }
    return [...groups].map(([title, options]) => ({ title, compact: false, options }));
  };
  const simple = (asset) => ({ value: asset.id, thumb: asset.id, label: displayName(asset.id) });

  if (tool.id === 'floor') {
    return { empty: 'Nenhum piso gerado (Estrutura › Pisos).', groups: byFolder(listAssets('pisos'), asset => ({ value: asset.id, thumb: pieceType(asset.id, 'meio-1'), label: displayName(asset.id) })) };
  }
  if (tool.id === 'wall') {
    return {
      empty: 'Nenhuma parede gerada (Estrutura › Paredes ou Cercas).',
      groups: listAssets('paredes').map(asset => ({
        title: `${displayName(asset.id)} · ${asset.rotulo.split(' › ').pop()}`,
        compact: true,
        options: wallPieces(asset).map(piece => ({ value: pieceType(asset.id, piece), thumb: pieceType(asset.id, piece), label: WALL_PIECE_NAMES[piece] }))
      }))
    };
  }
  if (tool.id === 'border') {
    return {
      empty: 'Nenhum piso gerado (Estrutura › Pisos).',
      groups: listAssets('pisos').map(asset => ({
        title: displayName(asset.id),
        compact: true,
        options: BORDER_VARIANTS.map(variant => ({ value: pieceType(asset.id, variant), thumb: pieceType(asset.id, variant), label: variant }))
      }))
    };
  }
  if (tool.id === 'stairs') return { empty: 'Nenhuma escada gerada (Estrutura › Escadas).', groups: byFolder(listAssets('objetos', a => isStairsFolder(a.id)), simple) };
  if (tool.id === 'hole') return { empty: 'Nenhuma entrada gerada (Estrutura › Entradas).', groups: byFolder(listAssets('objetos', a => isEntranceFolder(a.id)), simple) };
  if (tool.id === 'item') return { empty: 'Nenhum item gerado (Itens).', groups: byFolder(listAssets('objetos', isCarried), simple) };
  if (tool.id === 'deco') return { empty: 'Nenhuma decoração gerada (Decoração ou Estrutura › Natureza).', groups: byFolder(listAssets('objetos', isDecoration), simple) };
  if (tool.id === 'enemy') return { empty: 'Nenhuma criatura gerada (Criaturas).', groups: byFolder(listAssets('criaturas', isMonster), simple) };
  if (tool.id === 'npc') return { empty: 'Nenhum NPC gerado (Personagens › NPCs, comportamento NPC).', groups: byFolder(listAssets('criaturas', a => creatureBehavior(a.id) === 'npc'), simple) };
  if (tool.id === 'bot') return { empty: 'Nenhum player gerado (Personagens › Players).', groups: byFolder(listAssets('criaturas', isPlayerSheet), simple) };
  return { empty: '', groups: [] };
}

// ================================================================================================================================================================================================================================================
// isCarried / isDecoration / isPlayerSheet / isMonster
// Ferramenta Item: o que fica no grupo Itens. Decoração: os outros objetos
// soltos no mapa (Decoração e a natureza da Estrutura). Bot: as folhas de
// Personagens › Players. Criatura: as do grupo Criaturas que não são NPC.

function isCarried(asset) {
  return isItemType(asset.id) && asset.grupo === 'itens';
}

function isDecoration(asset) {
  return isItemType(asset.id) && asset.grupo !== 'itens';
}

function isPlayerSheet(asset) {
  return asset.grupo === 'personagens' && asset.pasta === 'players';
}

function isMonster(asset) {
  return asset.grupo !== 'personagens' && creatureBehavior(asset.id) !== 'npc';
}

// ================================================================================================================================================================================================================================================
// currentValue / setValue
// O que está escolhido na ferramenta, no formato das opções ('<folha>' ou
// '<folha>#<peça>'; objeto que gira aparece pela folha, sem a direção). Ao
// trocar de objeto, o novo fica virado como o anterior, se tiver essa direção.

function currentValue(tool) {
  const value = state[tool.paint];
  if (tool.id === 'border') return value ? pieceType(value.type, value.variant) : null;
  if (tool.id === 'wall') return value;
  return value && splitType(value).asset;
}

function setValue(tool, value) {
  if (tool.id === 'border') {
    const { asset, piece } = splitType(value);
    state.borderPaint = { type: asset, variant: piece };
  } else if (tool.id === 'wall' || !state[tool.paint]) {
    state[tool.paint] = value;
  } else {
    state[tool.paint] = withDirection(value, state[tool.paint]);
  }
}

// ================================================================================================================================================================================================================================================
// rotatePaint
// R: vira o que a ferramenta pinta pra próxima direção (step -1, a
// anterior). false se a ferramenta não pinta objeto que gira.

export function rotatePaint(step = 1) {
  const tool = TOOLS.find(t => t.id === state.tool);
  if (!tool || !tool.paint || tool.id === 'wall' || tool.id === 'border') return false;
  const value = state[tool.paint];
  if (typeof value !== 'string' || objectDirections(value).length < 2) return false;
  state[tool.paint] = rotateType(value, step);
  renderTools();
  scheduleRender();
  return true;
}

// ================================================================================================================================================================================================================================================
// renderTools

export function renderTools() {
  const wrap = document.getElementById('tools');
  const quick = document.getElementById('quickTools');
  wrap.innerHTML = '';
  quick.innerHTML = '';
  canvas.classList.toggle('select-mode', state.tool === 'select');
  TOOLS.forEach(t => {
    const btn = document.createElement('div');
    btn.className = (t.quick ? 'quick-btn' : 'tool-btn') + (t.id === state.tool ? ' active' : '');
    btn.appendChild(toolSwatch(t));
    const label = document.createElement('span');
    label.textContent = t.label;
    btn.appendChild(label);

    if (t.paint) {
      const sub = document.createElement('span');
      sub.className = 'tool-sub';
      sub.textContent = paintLabel(t);
      btn.appendChild(sub);
    }

    btn.onclick = () => {
      state.openAccordion = t.paint && state.openAccordion !== t.id ? t.id : null;
      state.tool = t.id;
      if (t.id !== 'select') closeSelectPanel();
      renderTools();
    };
    (t.quick ? quick : wrap).appendChild(btn);

    if (t.paint && state.openAccordion === t.id) wrap.appendChild(buildAccordion(t));
    if (t.id === 'house' && state.tool === 'house') wrap.appendChild(buildHouseForm());
  });
}

// ================================================================================================================================================================================================================================================
// buildHouseForm
// A casa que o pincel pinta: nome e preço (moedas de ouro); as casas que já
// existem no mapa aparecem pra escolher. Pintar um sqm da mesma casa tira.

function buildHouseForm() {
  const form = document.createElement('div');
  form.className = 'tool-accordion show house-form';
  const name = document.createElement('input');
  Object.assign(name, { type: 'text', className: 'accordion-search', placeholder: 'Nome da casa', value: state.housePaint.name, maxLength: 40 });
  name.oninput = () => { state.housePaint.name = name.value.trim(); };
  const price = document.createElement('input');
  Object.assign(price, { type: 'number', className: 'accordion-search', min: 0, step: 1, placeholder: 'Preço', title: 'Preço (moedas de ouro)', value: state.housePaint.price });
  price.oninput = () => { state.housePaint.price = Math.max(0, Math.floor(Number(price.value)) || 0); };
  form.append(name, price);
  const known = new Map();
  for (const layer of Object.values(state.layers)) {
    for (const cell of Object.values(layer)) if (cell.house) known.set(cell.house.name, cell.house.price);
  }
  for (const [houseName, housePrice] of known) {
    const opt = document.createElement('div');
    opt.className = 'house-opt' + (houseName === state.housePaint.name ? ' selected' : '');
    opt.textContent = `${houseName} · ${housePrice}`;
    opt.onclick = () => {
      state.housePaint = { name: houseName, price: housePrice };
      renderTools();
    };
    form.appendChild(opt);
  }
  return form;
}

const QUICK_ICON_SCALE = 16 / 22;
const QUICK_ICONS = {
  select: svgIcon('0 0 16 22', '<path d="M.95.95v16.7l4.4-4.1 3.2 7.2 3-1.3-3.2-7h6.7L.95.95Z"/>', QUICK_ICON_SCALE),
  'border-eraser': svgIcon('0 0 22 22', '<path d="M.95 6.5V.95H6.5M15.5.95h5.55V6.5M21.05 15.5v5.55H15.5M6.5 21.05H.95V15.5"/><path d="M7.5 7.5l7 7M14.5 7.5l-7 7"/>', QUICK_ICON_SCALE),
  spawn: svgIcon('0 0 22 22', '<path d="M18.6 7.2A8.6 8.6 0 1 0 19.6 13"/><path d="M19.2 1.9v5.6h-5.6"/><circle cx="11" cy="11" r="2.4"/>', QUICK_ICON_SCALE),
  eraser: svgIcon('0 0 22 22', '<path d="M8.2 20.05L1.95 13.8 13.1 2.65l7.25 7.25-10.15 10.15H8.2Z"/><path d="M6.4 9.3l7.25 7.25M8.2 20.05h12.85"/>', QUICK_ICON_SCALE)
};

// ================================================================================================================================================================================================================================================
// toolSwatch
// O desenho pequeno de cada ferramenta (a folha escolhida ou um símbolo).

function toolSwatch(t) {
  const swatch = document.createElement('div');
  swatch.className = 'tool-swatch';
  if (QUICK_ICONS[t.id]) {
    swatch.classList.add('icon');
    swatch.innerHTML = QUICK_ICONS[t.id];
    return swatch;
  }
  const thumbType = paintThumbType(t);
  if (thumbType) {
    setThumb(swatch, thumbType, 20);
  } else if (t.id === 'safe') {
    swatch.style.background = 'rgba(46, 204, 113, 0.35)';
    swatch.style.border = '1px solid rgba(46, 204, 113, 0.9)';
  } else if (t.id === 'house') {
    swatch.style.background = 'rgba(245, 158, 11, 0.35)';
    swatch.style.border = '1px solid rgba(245, 158, 11, 0.9)';
  } else {
    swatch.style.background = '#2a2f3a';
    swatch.style.border = '1px dashed #555';
  }
  return swatch;
}

// ================================================================================================================================================================================================================================================
// buildAccordion
// A lista da ferramenta: folhas (ou peças) agrupadas por pasta/folha.

function buildAccordion(tool) {
  const acc = document.createElement('div');
  acc.className = 'tool-accordion show';
  const { empty, groups } = accordionGroups(tool);
  if (!groups.length) {
    const note = document.createElement('div');
    note.className = 'accordion-empty';
    note.textContent = `${empty} Gere no gerador de sprites.`;
    acc.appendChild(note);
    return acc;
  }
  const selected = currentValue(tool);
  const search = document.createElement('input');
  Object.assign(search, { type: 'search', className: 'accordion-search', placeholder: 'Buscar…', value: searchTerms[tool.id] || '' });
  search.oninput = () => {
    searchTerms[tool.id] = search.value;
    filterAccordion(acc, search.value);
  };
  acc.appendChild(search);
  for (const group of groups) {
    const title = document.createElement('div');
    title.className = 'border-accordion-title';
    title.textContent = group.title;
    acc.appendChild(title);
    for (const option of group.options) {
      const opt = document.createElement('div');
      opt.title = option.label;
      opt.dataset.search = normalizeSearch(`${option.label} ${group.title}`);
      opt.dataset.group = group.title;
      opt.onclick = () => {
        setValue(tool, option.value);
        state.tool = tool.id;
        renderTools();
      };
      if (group.compact) {
        opt.className = 'border-opt' + (option.value === selected ? ' selected' : '');
        setThumb(opt, option.thumb, 32);
      } else {
        opt.className = 'floor-opt' + (option.value === selected ? ' selected' : '');
        const thumb = document.createElement('div');
        thumb.className = 'thumb';
        setThumb(thumb, option.thumb, 36);
        const span = document.createElement('span');
        span.textContent = option.label;
        opt.append(thumb, span);
      }
      acc.appendChild(opt);
    }
  }
  filterAccordion(acc, searchTerms[tool.id] || '');
  return acc;
}

// ================================================================================================================================================================================================================================================
// filterAccordion / normalizeSearch
// A busca da lista: mostra só as opções cujo nome (ou o da pasta) tem o que
// foi digitado, sem diferenciar acento e maiúscula; pasta sem nada some.

const searchTerms = {};

function filterAccordion(acc, term) {
  const wanted = normalizeSearch(term);
  const visible = new Set();
  for (const opt of acc.querySelectorAll('[data-search]')) {
    const show = !wanted || opt.dataset.search.includes(wanted);
    opt.hidden = !show;
    if (show) visible.add(opt.dataset.group);
  }
  for (const title of acc.querySelectorAll('.border-accordion-title')) title.hidden = !visible.has(title.textContent);
}

function normalizeSearch(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// ================================================================================================================================================================================================================================================
// updateStats

export function updateStats() {
  const layer = state.layers[state.activeZ];
  let f = 0, b = 0, w = 0, s = 0, h = 0, it = 0, cr = 0, sf = 0;
  Object.values(layer).forEach(c => {
    if (c.floor) f++;
    b += c.borders.length;
    if (c.safe) sf++;
    if (c.hole) h++;
    if (c.enemy) cr++;
    c.objects.forEach(o => {
      if (isStairsFolder(o.type)) s++;
      else if (isWallType(o.type)) w++;
      else it++;
    });
  });
  document.getElementById('statFloor').textContent = f;
  document.getElementById('statBorder').textContent = b;
  document.getElementById('statWall').textContent = w;
  document.getElementById('statStairs').textContent = s;
  document.getElementById('statHole').textContent = h;
  document.getElementById('statItem').textContent = it;
  document.getElementById('statCreature').textContent = cr;
  document.getElementById('statSafe').textContent = sf;
}