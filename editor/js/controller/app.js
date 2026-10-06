// js/controller/app.js

import { state } from '../model/state.js';
import { preloadAll } from '../view/image-cache.js';
import { scheduleRender } from '../view/canvas-renderer.js';
import { renderLayerTabs, renderTools, onLayerChange, updateStats, choosePaintDefaults, rotatePaint } from '../view/tools-panel.js';
import { rotateSelected } from '../view/forms.js';
import { restoreFloor, restoreScroll } from '../view/view-memory.js';
import { loadAssets } from '../../../shared/assets.js';
import { loadMapIntoState, saveMap, hasUnsavedChanges } from '../model/map-io.js';
import { resetHistory, commitHistory, undo, redo } from '../model/history.js';
import './canvas-input.js';
import '../view/goto-field.js';

// ================================================================================================================================================================================================================================================
// Janela de ferramentas: tocar no título recolhe e abre (no celular ela começa
// recolhida, pra não cobrir a barra de andares).

const toolsWindow = document.querySelector('.side-col .ed-win');
toolsWindow.querySelector('.ed-head').onclick = () => toolsWindow.classList.toggle('collapsed');
if (window.matchMedia('(max-width: 700px)').matches) toolsWindow.classList.add('collapsed');

document.getElementById('ghostToggle').onchange = (evt) => { state.ghost = evt.target.checked; scheduleRender(); };
document.getElementById('detailsToggle').onchange = (evt) => { state.showDetails = evt.target.checked; scheduleRender(); };
document.getElementById('statsToggle').onchange = (evt) => {
  document.getElementById('statusbar').hidden = !evt.target.checked;
  document.querySelector('.main').classList.toggle('stats-hidden', !evt.target.checked);
};

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
    alert(`Não foi possível salvar o mapa.\n\n${error.message}\n\nO servidor (start-server.bat) está rodando?`);
  }
  saving = false;
  saveBtn.disabled = false;
  setTimeout(() => { if (!saving) saveBtn.textContent = 'Salvar'; }, 1500);
}

saveBtn.onclick = handleSave;

// R gira o objeto: o do pincel ou, selecionando, o do sqm (Shift+R volta).
window.addEventListener('keydown', (evt) => {
  const tag = evt.target && evt.target.tagName;
  if (evt.ctrlKey || evt.metaKey || evt.altKey || evt.key.toLowerCase() !== 'r' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  const step = evt.shiftKey ? -1 : 1;
  if (state.tool === 'select' ? rotateSelected(step) : rotatePaint(step)) {
    evt.preventDefault();
    commitHistory();
  }
});

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

// As folhas do gerador (gerador/saida) são tudo o que dá pra pintar.
try {
  const sprites = await loadAssets();
  preloadAll(sprites.map(sprite => sprite.url));
} catch (error) {
  alert(`Não deu pra ler os sprites do gerador.\n\n${error.message}\n\nO servidor (start-server.bat) está rodando?`);
}
choosePaintDefaults();

try {
  await loadMapIntoState();
} catch (error) {
  console.warn('Não foi possível carregar data/map.json; começando com mapa vazio.', error);
}
resetHistory();

restoreFloor();
renderLayerTabs();
renderTools();
onLayerChange();
updateStats();
scheduleRender();
restoreScroll();

// Cadência de repaint pra manter as animações fluindo; o frame exibido em cada
// redesenho é sempre calculado em tempo real (shared/sprite-sheet.js), então
// esse valor só afeta suavidade visual, não a precisão do timing.
const REDRAW_INTERVAL_MS = 250;
setInterval(() => { if (state.showDetails) scheduleRender(); }, REDRAW_INTERVAL_MS);