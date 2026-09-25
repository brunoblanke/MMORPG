// js/view/tools-panel.js

import { IMG_BASE } from '../config.js';
import { FLOOR1_FILES, FLOOR2_FILES, OBJECT_DEFS, ITEM_CATALOG } from '../model/catalog.js';
import { state, TOOLS } from '../model/state.js';
import { FLOOR_MIN, FLOOR_MAX, GROUND_FLOOR } from '../../../shared/constants.js';
import { scheduleRender } from './canvas-renderer.js';
import { BORDER_VARIANTS } from '../../../shared/floor-borders.js';

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
// renderTools

export function renderTools() {
  const wrap = document.getElementById('tools');
  wrap.innerHTML = '';
  TOOLS.forEach(t => {
    const btn = document.createElement('div');
    btn.className = 'tool-btn' + (t.id === state.tool ? ' active' : '');
    const swatch = document.createElement('div');
    swatch.className = 'tool-swatch';
    if (t.id === 'floor') {
      swatch.style.backgroundImage = `url(${IMG_BASE}${(state.floorPaint === 'Floor2' ? FLOOR2_FILES : FLOOR1_FILES)['a']})`;
    } else if (t.id === 'item') {
      swatch.style.backgroundImage = `url(${IMG_BASE}${ITEM_CATALOG[state.itemPaint].file})`;
      swatch.style.backgroundSize = 'cover';
    } else if (t.id === 'border') {
      swatch.style.backgroundImage = `url(${IMG_BASE}${borderFile(state.borderPaint)})`;
      swatch.style.backgroundSize = 'cover';
    } else if (t.id === 'border-eraser') {
      swatch.style.backgroundImage = `url(${IMG_BASE}${borderFile({ type: 'Floor', variant: 'n' })})`;
      swatch.style.backgroundSize = 'cover';
      swatch.style.opacity = '0.45';
      swatch.style.outline = '1px dashed #e2574c';
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
    } else if (t.id === 'eraser') {
      swatch.style.background = '#2a2f3a';
      swatch.style.border = '1px dashed #555';
    } else if (t.obj) {
      const def = OBJECT_DEFS[t.obj];
      swatch.style.backgroundImage = `url(${IMG_BASE}${def.file})`;
      if (def.frames > 1) {
        swatch.style.backgroundSize = `${def.frames * 100}% 100%`;
        swatch.style.backgroundPosition = '0 0';
      } else {
        swatch.style.backgroundSize = 'cover';
      }
    }
    const label = document.createElement('span');
    label.textContent = t.label;
    btn.appendChild(swatch);
    btn.appendChild(label);

    if (t.id === 'floor') {
      const sub = document.createElement('span');
      sub.className = 'tool-sub';
      sub.textContent = state.floorPaint === 'Floor2' ? 'Piso 2' : 'Piso 1';
      btn.appendChild(sub);
    }

    if (t.id === 'item') {
      const sub = document.createElement('span');
      sub.className = 'tool-sub';
      sub.textContent = ITEM_CATALOG[state.itemPaint].label;
      btn.appendChild(sub);
    }

    if (t.id === 'border') {
      const sub = document.createElement('span');
      sub.className = 'tool-sub';
      sub.textContent = `${state.borderPaint.type === 'Floor2' ? 'Piso 2' : 'Piso 1'} ${state.borderPaint.variant}`;
      btn.appendChild(sub);
    }

    btn.onclick = () => {
      if (t.id === 'floor') {
        state.floorAccordionOpen = !state.floorAccordionOpen;
        state.itemAccordionOpen = false;
        state.borderAccordionOpen = false;
        state.tool = 'floor';
        renderTools();
        return;
      }
      if (t.id === 'item') {
        state.itemAccordionOpen = !state.itemAccordionOpen;
        state.floorAccordionOpen = false;
        state.borderAccordionOpen = false;
        state.tool = 'item';
        renderTools();
        return;
      }
      if (t.id === 'border') {
        state.borderAccordionOpen = !state.borderAccordionOpen;
        state.floorAccordionOpen = false;
        state.itemAccordionOpen = false;
        state.tool = 'border';
        renderTools();
        return;
      }
      state.tool = t.id;
      state.floorAccordionOpen = false;
      state.itemAccordionOpen = false;
      state.borderAccordionOpen = false;
      renderTools();
    };
    wrap.appendChild(btn);

    if (t.id === 'floor' && state.floorAccordionOpen) {
      wrap.appendChild(buildFloorAccordion());
    }
    if (t.id === 'item' && state.itemAccordionOpen) {
      wrap.appendChild(buildItemAccordion());
    }
    if (t.id === 'border' && state.borderAccordionOpen) {
      wrap.appendChild(buildBorderAccordion());
    }
  });
}

// ================================================================================================================================================================================================================================================
// buildFloorAccordion

function buildFloorAccordion() {
  const acc = document.createElement('div');
  acc.className = 'tool-accordion show';
  [['Floor', 'Piso 1'], ['Floor2', 'Piso 2']].forEach(([type, label]) => {
    const opt = document.createElement('div');
    opt.className = 'floor-opt' + (state.floorPaint === type ? ' selected' : '');
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.style.backgroundImage = `url(${IMG_BASE}${(type === 'Floor2' ? FLOOR2_FILES : FLOOR1_FILES)['a']})`;
    const span = document.createElement('span');
    span.textContent = label;
    opt.appendChild(thumb);
    opt.appendChild(span);
    opt.onclick = () => {
      state.floorPaint = type;
      state.tool = 'floor';
      renderTools();
    };
    acc.appendChild(opt);
  });
  return acc;
}

// ================================================================================================================================================================================================================================================
// buildItemAccordion

function buildItemAccordion() {
  const acc = document.createElement('div');
  acc.className = 'tool-accordion show';
  Object.entries(ITEM_CATALOG).forEach(([type, def]) => {
    const opt = document.createElement('div');
    opt.className = 'floor-opt' + (type === state.itemPaint ? ' selected' : '');
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.style.backgroundImage = `url(${IMG_BASE}${def.file})`;
    thumb.style.backgroundSize = 'cover';
    const span = document.createElement('span');
    span.textContent = def.label;
    opt.appendChild(thumb);
    opt.appendChild(span);
    opt.onclick = () => {
      state.itemPaint = type;
      state.tool = 'item';
      renderTools();
    };
    acc.appendChild(opt);
  });
  return acc;
}

// ================================================================================================================================================================================================================================================
// borderFile

function borderFile(piece) {
  return (piece.type === 'Floor2' ? FLOOR2_FILES : FLOOR1_FILES)[piece.variant];
}

// ================================================================================================================================================================================================================================================
// buildBorderAccordion
// As 12 peças de borda de cada piso, pra pôr à mão (lados, cantos de fora e
// cantos de dentro).

function buildBorderAccordion() {
  const acc = document.createElement('div');
  acc.className = 'tool-accordion show border-accordion';
  [['Floor', 'Piso 1'], ['Floor2', 'Piso 2']].forEach(([type, label]) => {
    const title = document.createElement('div');
    title.className = 'border-accordion-title';
    title.textContent = label;
    acc.appendChild(title);
    for (const variant of BORDER_VARIANTS) {
      const piece = { type, variant };
      const opt = document.createElement('div');
      const selected = state.borderPaint.type === type && state.borderPaint.variant === variant;
      opt.className = 'border-opt' + (selected ? ' selected' : '');
      opt.title = `${label} · ${variant}`;
      opt.style.backgroundImage = `url(${IMG_BASE}${borderFile(piece)})`;
      opt.onclick = () => {
        state.borderPaint = piece;
        state.tool = 'border';
        renderTools();
      };
      acc.appendChild(opt);
    }
  });
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
      if (o.type === 'Stairs') s++;
      else if (ITEM_CATALOG[o.type]) it++;
      else w++;
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