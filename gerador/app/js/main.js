// gerador/app/js/main.js

import { fetchCatalog, fetchProject, fetchTaxonomy, deleteProject } from './api.js';
import { setTaxonomy } from './folders.js';
import { initPicker, setPickerMode } from './picker.js';
import { showProjects, refreshProjects } from './projects.js';
import { floorsView } from './floors.js';
import { creaturesView } from './creatures.js';
import { wallsView } from './walls.js';
import { objectsView } from './objects.js';

// Gerador de sprites: uma área de trabalho por ferramenta (pisos, criaturas, paredes, objetos),
// a lista do que foi salvo à esquerda (pelas pastas) e os sprites do Tibia à direita.

const VIEWS = { pisos: floorsView, criaturas: creaturesView, paredes: wallsView, objetos: objectsView };
const SECTIONS = { pisos: 'floorsView', criaturas: 'creaturesView', paredes: 'wallsView', objetos: 'objectsView' };

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
    activePath: () => view.path(),
    onOpen: async (path) => {
      if (!confirmDiscard()) return;
      view.open(await fetchProject(path));
    },
    onDelete: removeProject
  });
}

// ================================================================================================================================================================================================================================================
// removeProject
// Exclui a folha e a receita (depois de confirmar); se estava aberta, a área
// de trabalho volta a ficar vazia.

async function removeProject(project) {
  if (!window.confirm(`Excluir ${project.nome}? A folha (PNG) e a receita são apagadas.`)) return;
  const view = activeView();
  try {
    await deleteProject(project.caminho);
  } catch (error) {
    window.alert(`Não deu pra excluir: ${error.message}`);
    return;
  }
  if (view.path() === project.caminho) view.reset();
  else refreshProjects();
}

// ================================================================================================================================================================================================================================================
// boot

async function boot() {
  try {
    setTaxonomy(await fetchTaxonomy());
  } catch (error) {
    document.getElementById('projectList').innerHTML = `<li class="empty">Não deu pra ler as pastas: ${error.message}</li>`;
  }
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
