// js/controller/app.js

import { FLOOR1_FILES, FLOOR2_FILES, OBJECT_DEFS, ITEM_CATALOG } from '../model/catalog.js';
import { state, makeEmptyLayer } from '../model/state.js';
import { preloadAll } from '../view/image-cache.js';
import { scheduleRender } from '../view/canvas-renderer.js';
import { renderLayerTabs, renderTools, onLayerChange, updateStats } from '../view/tools-panel.js';
import { loadMapIntoState, saveMap, hasUnsavedChanges } from '../model/map-io.js';
import { resetHistory, commitHistory, undo, redo } from '../model/history.js';
import './canvas-input.js';
import { refreshCreatureOptions } from '../view/forms.js';
import { rebuildBorders } from '../model/borders.js';

document.getElementById('clearLayerBtn').onclick = () => {
  state.layers[state.activeZ] = makeEmptyLayer();
  updateStats();
  scheduleRender();
};

document.getElementById('rebuildBordersBtn').onclick = () => {
  rebuildBorders(state.activeZ);
  updateStats();
  scheduleRender();
};

document.getElementById('ghostToggle').onchange = (evt) => { state.ghost = evt.target.checked; scheduleRender(); };

// ================================================================================================================================================================================================================================================
// Salvar direto em data/map.json (precisa do server.js rodando)

const saveBtn = document.getElementById('saveBtn');
let saving = false;

async function handleSave() {
  if (saving) return;
  saving = true;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Salvando…';
  try {
    await saveMap();
    saveBtn.textContent = 'Salvo ✓';
  } catch (error) {
    saveBtn.textContent = 'Erro ao salvar';
    alert(`Não foi possível salvar o mapa.\n\n${error.message}\n\nO servidor (init-server.bat) está rodando?`);
  }
  saving = false;
  saveBtn.disabled = false;
  setTimeout(() => { if (!saving) saveBtn.textContent = 'Salvar'; }, 1500);
}

saveBtn.onclick = handleSave;

window.addEventListener('keydown', (evt) => {
  if (!(evt.ctrlKey || evt.metaKey)) return;
  const key = evt.key.toLowerCase();
  if (key === 's') {
    evt.preventDefault();
    handleSave();
    return;
  }
  // Em campos de texto, Ctrl+Z continua sendo o desfazer do próprio campo.
  const tag = evt.target && evt.target.tagName;
  if (key === 'z' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
    evt.preventDefault();
    const changed = evt.shiftKey ? redo() : undo();
    if (changed) onLayerChange();
  }
});

// Toda ação do editor termina num mouseup (traço no canvas) ou num clique
// (painéis, formulários, abas): nesse momento, se o mapa mudou, vira um passo.
window.addEventListener('mouseup', () => commitHistory());
document.addEventListener('click', () => commitHistory());

window.addEventListener('beforeunload', (evt) => {
  if (hasUnsavedChanges()) {
    evt.preventDefault();
    evt.returnValue = '';
  }
});

preloadAll([FLOOR1_FILES, FLOOR2_FILES, OBJECT_DEFS, ITEM_CATALOG]);

refreshCreatureOptions();

try {
  await loadMapIntoState();
} catch (error) {
  console.warn('Não foi possível carregar data/map.json; começando com mapa vazio.', error);
}
resetHistory();

renderLayerTabs();
renderTools();
onLayerChange();
updateStats();
scheduleRender();

// Cadência de repaint pra manter as animações fluindo; o frame exibido em cada
// redesenho é sempre calculado em tempo real (shared/sprite-sheet.js), então
// esse valor só afeta suavidade visual, não a precisão do timing.
const REDRAW_INTERVAL_MS = 250;
setInterval(scheduleRender, REDRAW_INTERVAL_MS);