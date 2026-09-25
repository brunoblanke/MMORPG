// gerador/app/js/projects.js

import { fetchProjects } from './api.js';

// Lista da esquerda: o que já foi salvo na categoria aberta, com a
// miniatura (canto de cima à esquerda da folha). Clicar abre a receita.

const listEl = document.getElementById('projectList');

let current = { category: null, emptyText: '', activeName: () => '', onOpen: () => {} };

// ================================================================================================================================================================================================================================================
// showProjects
// options: { emptyText, activeName(): nome aberto agora, onOpen(nome) }.

export function showProjects(category, options) {
  current = { category, ...options };
  listEl.innerHTML = '<li class="empty">Carregando…</li>';
  refreshProjects();
}

// ================================================================================================================================================================================================================================================
// refreshProjects

export async function refreshProjects() {
  const { category, emptyText, activeName, onOpen } = current;
  let projects = [];
  try {
    projects = (await fetchProjects()).filter(p => p.categoria === category);
  } catch (error) {
    listEl.innerHTML = `<li class="empty">Sem conexão com o gerador: ${error.message}</li>`;
    return;
  }
  if (category !== current.category) return;

  listEl.innerHTML = '';
  if (!projects.length) {
    listEl.innerHTML = `<li class="empty">${emptyText}</li>`;
    return;
  }
  for (const project of projects) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = project.nome === activeName() ? 'active' : '';
    const img = document.createElement('img');
    img.src = `/saida/${category}/${project.nome}.png?v=${Math.round(project.atualizado)}`;
    img.alt = '';
    button.append(img, project.nome);
    button.onclick = () => onOpen(project.nome);
    item.appendChild(button);
    listEl.appendChild(item);
  }
}
