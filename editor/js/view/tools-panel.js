// js/view/tools-panel.js

import { state, TOOLS } from '../model/state.js';
import { FLOOR_MIN, FLOOR_MAX, GROUND_FLOOR } from '../../../shared/constants.js';
import { scheduleRender } from './canvas-renderer.js';
import { BORDER_VARIANTS } from '../../../shared/floor-borders.js';
import { listAssets, pieceType, splitType, displayName, isStairsType, isHoleType, isItemType, isWallType, WALL_PIECES, WALL_PIECE_NAMES } from '../../../shared/assets.js';
import { setThumb } from './sprite-thumb.js';

// ================================================================================================================================================================================================================================================
// renderLayerTabs

// Andares fixos, como num prédio: acima do térreo em cima (+5 … +1), o
// térreo no meio e abaixo dele embaixo (-1 … -5).

export function renderLayerTabs() {
  const wrap = document.getElementById('layerTabs');
  wrap.innerHTML = '';

  const row = (floors, className) => {
    const line = document.createElement('div');
    line.className = 'layer-row' + (className ? ' ' + className : '');
    for (const z of floors) {
      const btn = document.createElement('div');
      const hasContent = layerHasContent(z);
      btn.className = 'layer-tab' + (z === state.activeZ ? ' active' : '') + (hasContent ? ' has-content' : '');
      btn.textContent = z === GROUND_FLOOR ? 'Térreo (0)' : floorLabel(z);
      btn.title = `Andar ${floorLabel(z)}${hasContent ? '' : ' (vazio)'}`;
      btn.onclick = () => { state.activeZ = z; onLayerChange(); };
      line.appendChild(btn);
    }
    wrap.appendChild(line);
  };

  const above = [];
  for (let z = FLOOR_MAX; z > GROUND_FLOOR; z--) above.push(z);
  const below = [];
  for (let z = GROUND_FLOOR - 1; z >= FLOOR_MIN; z--) below.push(z);

  row(above);
  row([GROUND_FLOOR], 'ground');
  row(below);
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
    if (cell.floor || cell.floorTop || cell.hole || cell.borders.length || cell.objects.length || cell.enemy || cell.spawn || cell.safe) return true;
  }
  return false;
}

// ================================================================================================================================================================================================================================================
// onLayerChange

export function onLayerChange() {
  document.getElementById('layerLabel').textContent = 'Andar ' + floorLabel(state.activeZ);
  renderLayerTabs();
  updateStats();
  scheduleRender();
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
  if (!state.stairsPaint) state.stairsPaint = first(listAssets('objetos', a => isStairsType(a.id)));
  if (!state.holePaint) state.holePaint = first(listAssets('objetos', a => isHoleType(a.id)));
  if (!state.itemPaint) state.itemPaint = first(listAssets('objetos', a => isItemType(a.id)));
  if (!state.enemyPaint) state.enemyPaint = first(listAssets('criaturas'));
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
  if (tool.id === 'border' || tool.id === 'border-eraser') return state.borderPaint && pieceType(state.borderPaint.type, state.borderPaint.variant);
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
  return displayName(value);
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
  if (tool.id === 'stairs') return { empty: 'Nenhuma escada gerada (Estrutura › Escadas).', groups: byFolder(listAssets('objetos', a => isStairsType(a.id)), simple) };
  if (tool.id === 'hole') return { empty: 'Nenhuma entrada gerada (Estrutura › Entradas).', groups: byFolder(listAssets('objetos', a => isHoleType(a.id)), simple) };
  if (tool.id === 'item') return { empty: 'Nenhum objeto gerado.', groups: byFolder(listAssets('objetos', a => isItemType(a.id)), simple) };
  return { empty: '', groups: [] };
}

// ================================================================================================================================================================================================================================================
// currentValue / setValue
// O que está escolhido na ferramenta, no formato das opções ('<folha>' ou
// '<folha>#<peça>').

function currentValue(tool) {
  const value = state[tool.paint];
  if (tool.id === 'border') return value ? pieceType(value.type, value.variant) : null;
  return value;
}

function setValue(tool, value) {
  if (tool.id === 'border') {
    const { asset, piece } = splitType(value);
    state.borderPaint = { type: asset, variant: piece };
  } else {
    state[tool.paint] = value;
  }
}

// ================================================================================================================================================================================================================================================
// renderTools

export function renderTools() {
  const wrap = document.getElementById('tools');
  wrap.innerHTML = '';
  TOOLS.forEach(t => {
    const btn = document.createElement('div');
    btn.className = 'tool-btn' + (t.id === state.tool ? ' active' : '');
    const swatch = document.createElement('div');
    swatch.className = 'tool-swatch';
    const thumbType = paintThumbType(t);
    if (thumbType) {
      setThumb(swatch, thumbType, 20);
      if (t.id === 'border-eraser') {
        swatch.style.opacity = '0.45';
        swatch.style.outline = '1px dashed #e2574c';
      }
    } else if (t.id === 'enemy') {
      swatch.style.background = '#c0392b';
      swatch.style.borderRadius = '50%';
    } else if (t.id === 'spawn') {
      swatch.style.background = 'transparent';
      swatch.textContent = '★';
      swatch.style.color = '#f5c518';
      swatch.style.display = 'flex';
      swatch.style.alignItems = 'center';
      swatch.style.justifyContent = 'center';
      swatch.style.fontSize = '14px';
    } else if (t.id === 'safe') {
      swatch.style.background = 'rgba(46, 204, 113, 0.35)';
      swatch.style.border = '1px solid rgba(46, 204, 113, 0.9)';
    } else {
      swatch.style.background = '#2a2f3a';
      swatch.style.border = '1px dashed #555';
    }
    const label = document.createElement('span');
    label.textContent = t.label;
    btn.appendChild(swatch);
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
      renderTools();
    };
    wrap.appendChild(btn);

    if (t.paint && state.openAccordion === t.id) wrap.appendChild(buildAccordion(t));
  });
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
  for (const group of groups) {
    const title = document.createElement('div');
    title.className = 'border-accordion-title';
    title.textContent = group.title;
    acc.appendChild(title);
    for (const option of group.options) {
      const opt = document.createElement('div');
      opt.title = option.label;
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
  return acc;
}

const borderToggle = document.getElementById('borderToggle');
borderToggle.onclick = () => {
  state.showBorders = !state.showBorders;
  borderToggle.classList.toggle('on', state.showBorders);
  scheduleRender();
};

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
      if (isStairsType(o.type)) s++;
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