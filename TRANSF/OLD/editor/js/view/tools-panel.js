// js/view/tools-panel.js

import { IMG_BASE } from '../config.js';
import { FLOOR1_FILES, FLOOR2_FILES, OBJECT_DEFS, ITEM_CATALOG } from '../model/catalog.js';
import { state, TOOLS, makeEmptyLayer } from '../model/state.js';
import { scheduleRender } from './canvas-renderer.js';

// ================================================================================================================================================================================================================================================
// renderLayerTabs

export function renderLayerTabs() {
  const wrap = document.getElementById('layerTabs');
  wrap.innerHTML = '';
  state.layerOrder.forEach(z => {
    const btn = document.createElement('div');
    btn.className = 'layer-tab' + (z === state.activeZ ? ' active' : '');
    btn.textContent = 'Andar ' + z;
    btn.onclick = () => { state.activeZ = z; onLayerChange(); };
    wrap.appendChild(btn);
  });
  const addBtn = document.createElement('div');
  addBtn.className = 'layer-add';
  addBtn.textContent = '+';
  addBtn.title = 'Adicionar andar';
  addBtn.onclick = () => {
    if (state.layerOrder.length >= 6) return;
    const nextZ = Math.max(...state.layerOrder) + 1;
    state.layers[nextZ] = makeEmptyLayer();
    state.layerOrder.push(nextZ);
    state.activeZ = nextZ;
    renderLayerTabs();
    onLayerChange();
  };
  wrap.appendChild(addBtn);
}

// ================================================================================================================================================================================================================================================
// onLayerChange

export function onLayerChange() {
  document.getElementById('layerLabel').textContent = 'Andar ' + state.activeZ;
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

    btn.onclick = () => {
      if (t.id === 'floor') {
        state.floorAccordionOpen = !state.floorAccordionOpen;
        state.itemAccordionOpen = false;
        state.tool = 'floor';
        renderTools();
        return;
      }
      if (t.id === 'item') {
        state.itemAccordionOpen = !state.itemAccordionOpen;
        state.floorAccordionOpen = false;
        state.tool = 'item';
        renderTools();
        return;
      }
      state.tool = t.id;
      state.floorAccordionOpen = false;
      state.itemAccordionOpen = false;
      renderTools();
    };
    wrap.appendChild(btn);

    if (t.id === 'floor' && state.floorAccordionOpen) {
      wrap.appendChild(buildFloorAccordion());
    }
    if (t.id === 'item' && state.itemAccordionOpen) {
      wrap.appendChild(buildItemAccordion());
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
  let f = 0, w = 0, s = 0, h = 0, it = 0, cr = 0;
  Object.values(layer).forEach(c => {
    if (c.floor) f++;
    if (c.hole) h++;
    if (c.enemy) cr++;
    c.objects.forEach(o => {
      if (o.type === 'Stairs') s++;
      else if (ITEM_CATALOG[o.type]) it++;
      else w++;
    });
  });
  document.getElementById('statFloor').textContent = f;
  document.getElementById('statWall').textContent = w;
  document.getElementById('statStairs').textContent = s;
  document.getElementById('statHole').textContent = h;
  document.getElementById('statItem').textContent = it;
  document.getElementById('statCreature').textContent = cr;
}