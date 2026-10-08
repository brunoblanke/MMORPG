// gerador/app/js/projects.js

import { fetchProjects } from './api.js';
import { folderLabel } from './folders.js';

// Lista da esquerda: o que já foi salvo com a ferramenta aberta, agrupado
// pela pasta, com a miniatura (o primeiro quadro da folha, reduzido pra
// caber em 32 × 32). Clicar
// abre a receita; o × exclui. As antigas, de antes das pastas, ficam em
// "Sem pasta".

const listEl = document.getElementById('projectList');

let current = { tool: null, emptyText: '', activePath: () => '', onOpen: () => {}, onDelete: () => {} };

// ================================================================================================================================================================================================================================================
// showProjects
// options: { emptyText, activePath(): caminho aberto agora, onOpen(caminho),
// onDelete(projeto) }.

export function showProjects(tool, options) {
  current = { tool, ...options };
  listEl.innerHTML = '<li class="empty">Carregando…</li>';
  refreshProjects();
}

// ================================================================================================================================================================================================================================================
// refreshProjects

export async function refreshProjects() {
  const { tool, emptyText, activePath, onOpen, onDelete } = current;
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
    for (const project of groups.get(label).sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { numeric: true, sensitivity: 'base' }))) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = project.caminho === activePath() ? 'active' : '';
      button.append(thumbnail(project), project.nome);
      button.onclick = () => onOpen(project.caminho);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete-btn';
      remove.title = `Excluir ${project.nome}`;
      remove.textContent = '×';
      remove.onclick = () => onDelete(project);
      item.append(button, remove);
      listEl.appendChild(item);
    }
  }
}

// ================================================================================================================================================================================================================================================
// thumbnail
// O primeiro quadro da folha (quadro × quadro, no canto de cima à esquerda)
// reduzido pra 32 × 32. A criatura vem recortada no que ela ocupa (a folha tem o
// tamanho da maior entre ela e os cadáveres, e ela fica no canto de baixo à direita),
// centralizada.

function thumbnail(project) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  canvas.className = 'project-thumb';
  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const box = project.ferramenta === 'criaturas' ? contentBox(img, project.quadro) : { x: 0, y: 0, w: project.quadro, h: project.quadro };
    const scale = Math.min(32 / box.w, 32 / box.h);
    const w = Math.max(1, Math.round(box.w * scale));
    const h = Math.max(1, Math.round(box.h * scale));
    ctx.drawImage(img, box.x, box.y, box.w, box.h, Math.floor((32 - w) / 2), Math.floor((32 - h) / 2), w, h);
  };
  img.src = `/saida/${project.caminho}.png?v=${Math.round(project.atualizado)}`;
  return canvas;
}

// ================================================================================================================================================================================================================================================
// contentBox
// O retângulo { x, y, w, h } que o desenho ocupa no primeiro quadro (size × size) da folha.

function contentBox(img, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, size, size, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  let minX = size;
  let minY = size;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < 0 ? { x: 0, y: 0, w: size, h: size } : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
