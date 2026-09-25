// gerador/app/js/main.js

import { fetchCatalog, fetchProject } from './api.js';
import { initPicker, setPickerMode } from './picker.js';
import { showProjects } from './projects.js';
import { floorsView } from './floors.js';
import { creaturesView } from './creatures.js';

// Gerador de sprites: uma área de trabalho por categoria (pisos, criaturas),
// a lista do que foi salvo à esquerda e os sprites do Tibia à direita.

const VIEWS = { pisos: floorsView, criaturas: creaturesView };
const SECTIONS = { pisos: 'floorsView', criaturas: 'creaturesView' };

let active = 'pisos';

// ================================================================================================================================================================================================================================================
// activeView

function activeView() {
  return VIEWS[active];
}

// ================================================================================================================================================================================================================================================
// confirmDiscard

function confirmDiscard() {
  return !activeView().isDirty() || window.confirm('Descartar o que não foi salvo?');
}

// ================================================================================================================================================================================================================================================
// activate
// Abre a categoria: área de trabalho, lista da esquerda e abas da direita.

function activate(category) {
  active = category;
  const view = activeView();
  for (const [key, id] of Object.entries(SECTIONS)) document.getElementById(id).hidden = key !== category;
  for (const button of document.querySelectorAll('.category[data-category]')) {
    button.classList.toggle('active', button.dataset.category === category);
  }
  document.getElementById('projectsTitle').textContent = view.title;
  document.getElementById('newProject').textContent = view.newLabel;
  setPickerMode(view.pickerMode);
  showProjects(view.category, {
    emptyText: view.emptyText,
    activeName: () => view.name(),
    onOpen: async (name) => {
      if (!confirmDiscard()) return;
      view.open(await fetchProject(view.category, name));
    }
  });
}

// ================================================================================================================================================================================================================================================
// boot

async function boot() {
  for (const view of Object.values(VIEWS)) view.init();
  for (const button of document.querySelectorAll('.category[data-category]')) {
    button.onclick = () => activate(button.dataset.category);
  }
  document.getElementById('newProject').onclick = () => {
    if (confirmDiscard()) activeView().reset();
  };
  window.addEventListener('beforeunload', (evt) => {
    if (!Object.values(VIEWS).some(view => view.isDirty())) return;
    evt.preventDefault();
    evt.returnValue = '';
  });
  activate('pisos');

  try {
    const catalog = await fetchCatalog();
    initPicker(catalog, {
      onPick: (kind, id, variation) => activeView().pick(kind, id, variation),
      onUseAll: (id, total) => activeView().useAll(id, total)
    });
  } catch (error) {
    document.getElementById('pickerGrid').textContent = `Não deu pra ler os sprites do Tibia: ${error.message}`;
  }
}

boot();
