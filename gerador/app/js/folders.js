// gerador/app/js/folders.js

import { fetchProjects } from './api.js';

// Pastas onde as folhas são salvas (gerador/taxonomia.json): grupos
// (Estrutura, Decoração, Itens, Criaturas, Personagens), seções e pastas,
// cada pasta de uma ferramenta. É a divisão que o editor usa; as abas da
// direita continuam pelo tipo do sprite no Tibia.

let taxonomy = { grupos: [] };
const lastByTool = {};

// ================================================================================================================================================================================================================================================
// setTaxonomy

export function setTaxonomy(value) {
  taxonomy = value;
}

// ================================================================================================================================================================================================================================================
// fillFolderSelect
// Lista de pastas da ferramenta no <select>, agrupadas (grupo · seção). As
// pastas que ainda não têm nada salvo ficam juntas no fim, em "Pastas
// vazias", pra não poluir a lista. Lembra a última pasta usada em cada
// ferramenta.

export function fillFolderSelect(select, tool) {
  buildFolderOptions(select, tool, null);
  const options = [...select.options].filter(option => option.value);
  select.value = lastByTool[tool] || (options.length === 1 ? options[0].value : '');
  select.addEventListener('change', () => { lastByTool[tool] = select.value; });
  fetchProjects().then((projects) => {
    const used = new Set(projects.map(project => `${project.grupo}/${project.pasta}`));
    const current = select.value;
    buildFolderOptions(select, tool, used);
    select.value = current;
  }).catch(() => {});
}

// ================================================================================================================================================================================================================================================
// buildFolderOptions
// used: pastas com algo salvo (Set de 'grupo/pasta'), ou null (todas juntas).

function buildFolderOptions(select, tool, used) {
  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Escolha a pasta…';
  select.appendChild(placeholder);
  const empty = document.createElement('optgroup');
  empty.label = 'Pastas vazias';
  for (const group of taxonomy.grupos) {
    for (const section of group.secoes) {
      const folders = section.pastas.filter(folder => folder.ferramenta === tool);
      if (!folders.length) continue;
      const optgroup = document.createElement('optgroup');
      optgroup.label = section.nome ? `${group.nome} · ${section.nome}` : group.nome;
      for (const folder of folders) {
        const value = `${group.id}/${folder.id}`;
        const option = document.createElement('option');
        option.value = value;
        if (used && !used.has(value)) {
          option.textContent = `${group.nome} › ${folder.nome}`;
          empty.appendChild(option);
        } else {
          option.textContent = folder.nome;
          optgroup.appendChild(option);
        }
      }
      if (optgroup.children.length) select.appendChild(optgroup);
    }
  }
  if (empty.children.length) select.appendChild(empty);
}

// ================================================================================================================================================================================================================================================
// folderOf
// { grupo, pasta } escolhidos no <select>, ou null.

export function folderOf(select) {
  if (!select.value) return null;
  const [grupo, pasta] = select.value.split('/');
  return { grupo, pasta };
}

// ================================================================================================================================================================================================================================================
// setFolder
// Põe a pasta da receita no <select> (receita antiga, sem pasta, mantém a atual).

export function setFolder(select, recipe) {
  if (!recipe.grupo || !recipe.pasta) return;
  const value = `${recipe.grupo}/${recipe.pasta}`;
  if ([...select.options].some(option => option.value === value)) select.value = value;
}

// ================================================================================================================================================================================================================================================
// folderLabel
// 'Itens › Espadas' da pasta, ou '' (receita antiga, sem pasta).

export function folderLabel(grupo, pasta) {
  const group = taxonomy.grupos.find(item => item.id === grupo);
  if (!group) return '';
  for (const section of group.secoes) {
    const folder = section.pastas.find(item => item.id === pasta);
    if (folder) return `${group.nome} › ${folder.nome}`;
  }
  return '';
}

// ================================================================================================================================================================================================================================================
// recipePath
// Caminho da receita aberta: 'grupo/pasta/nome', 'ferramenta/nome' (antiga)
// ou '' (nova, ainda não salva).

export function recipePath(recipe, tool) {
  if (!recipe.nome) return '';
  return recipe.grupo ? `${recipe.grupo}/${recipe.pasta}/${recipe.nome}` : `${tool}/${recipe.nome}`;
}
