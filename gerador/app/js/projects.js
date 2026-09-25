// gerador/app/js/projects.js

import { fetchProjects } from './api.js';
import { folderLabel } from './folders.js';

// Lista da esquerda: o que já foi salvo com a ferramenta aberta, agrupado
// pela pasta, com a miniatura (canto de cima à esquerda da folha). Clicar
// abre a receita. As antigas, de antes das pastas, ficam em "Sem pasta".

const listEl = document.getElementById('projectList');

let current = { tool: null, emptyText: '', activePath: () => '', onOpen: () => {} };

// ================================================================================================================================================================================================================================================
// showProjects
// options: { emptyText, activePath(): caminho aberto agora, onOpen(caminho) }.

export function showProjects(tool, options) {
  current = { tool, ...options };
  listEl.innerHTML = '<li class="empty">Carregando…</li>';
  refreshProjects();
}

// ================================================================================================================================================================================================================================================
// refreshProjects

export async function refreshProjects() {
  const { tool, emptyText, activePath, onOpen } = current;
  let projects = [];
  try {
    projects = (await fetchProjects()).filter(p => p.ferramenta === tool);
  } catch (error) {
    listEl.innerHTML = `<li class="empty">Sem conexão com o gerador: ${error.message}</li>`;
    return;
  }
  if (tool !== current.tool) return;

  listEl.innerHTML = '';
  if (!projects.length) {
    listEl.innerHTML = `<li class="empty">${emptyText}</li>`;
    return;
  }
  const groups = new Map();
  for (const project of projects) {
    const label = folderLabel(project.grupo, project.pasta) || 'Sem pasta';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(project);
  }
  for (const label of [...groups.keys()].sort((a, b) => a.localeCompare(b, 'pt'))) {
    const head = document.createElement('li');
    head.className = 'folder-head';
    head.textContent = label;
    listEl.appendChild(head);
    for (const project of groups.get(label)) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = project.caminho === activePath() ? 'active' : '';
      const img = document.createElement('img');
      img.src = `/saida/${project.caminho}.png?v=${Math.round(project.atualizado)}`;
      img.alt = '';
      button.append(img, project.nome);
      button.onclick = () => onOpen(project.caminho);
      item.appendChild(button);
      listEl.appendChild(item);
    }
  }
}
