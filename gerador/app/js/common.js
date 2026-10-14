// gerador/app/js/common.js

import { spriteUrl, fetchProjects, fetchProject } from './api.js';

// Pedaços usados por mais de uma categoria: de onde vem a imagem de um
// espaço (item do Tibia ou PNG enviado), desenho ancorado e nome de arquivo.

// ================================================================================================================================================================================================================================================
// sourceUrl
// source: { tibia: { id, variacao } } ou { png: dataURL }.

export function sourceUrl(source) {
  return source.png || spriteUrl(source.tibia.id, source.tibia.variacao);
}

// ================================================================================================================================================================================================================================================
// sourceLabel
// Texto curto embaixo do espaço: '#4526', '#103 v3' ou 'PNG'.

export function sourceLabel(source) {
  if (!source) return '';
  if (source.png) return 'PNG';
  return `#${source.tibia.id}${source.tibia.variacao ? ` v${source.tibia.variacao + 1}` : ''}`;
}

// ================================================================================================================================================================================================================================================
// loadImage
// Carrega a imagem e chama onLoad quando ela estiver pronta.

export function loadImage(url, onLoad) {
  const img = new Image();
  img.onload = () => onLoad(img);
  img.src = url;
  return img;
}

// ================================================================================================================================================================================================================================================
// isReady

export function isReady(img) {
  return !!img && img.complete && img.naturalWidth > 0;
}

// ================================================================================================================================================================================================================================================
// drawAnchored
// Desenha a imagem (até size × size, do canto de baixo à direita dela) com o
// canto de baixo à direita em (x + size, y + size) — como o jogo desenha.

export function drawAnchored(ctx, img, x, y, size) {
  const w = Math.min(img.naturalWidth, size);
  const h = Math.min(img.naturalHeight, size);
  ctx.drawImage(img, img.naturalWidth - w, img.naturalHeight - h, w, h, x + size - w, y + size - h, w, h);
}

// ================================================================================================================================================================================================================================================
// readPngFile
// Arquivo do computador → dataURL.

export function readPngFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ================================================================================================================================================================================================================================================
// normalizeName
// "Grama Escura" → "grama-escura" (o nome do arquivo).

export function normalizeName(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ================================================================================================================================================================================================================================================
// setStatus

export function setStatus(el, text, kind = '') {
  el.textContent = text;
  el.className = 'status' + (kind ? ` ${kind}` : '');
}

// ================================================================================================================================================================================================================================================
// statusOf
// A função que escreve no aviso da tela (o elemento de id dado): status(texto, tipo).

export function statusOf(id) {
  const el = document.getElementById(id);
  return (text, kind = '') => setStatus(el, text, kind);
}

// ================================================================================================================================================================================================================================================
// generatePendingSheets
// "Gerar folhas pendentes": abre, uma por uma, as receitas da ferramenta que não têm folha (.png) e salva cada uma. open abre a receita, ready diz se as imagens dela já carregaram (espera até 20 s) e save salva; filter tira as que não entram; emptyText é o aviso de quando não há nenhuma (sem ele, fica quieto).

export async function generatePendingSheets({ category, button, status, emptyText, filter = () => true, open, ready, save }) {
  button.disabled = true;
  try {
    const pending = (await fetchProjects()).filter(project => project.ferramenta === category && !project.temFolha && filter(project));
    if (!pending.length) return emptyText ? status(emptyText, 'ok') : undefined;
    let done = 0;
    for (const project of pending) {
      status(`Gerando ${project.nome} (${done + 1} de ${pending.length})…`);
      await open(await fetchProject(project.caminho));
      const limit = Date.now() + 20000;
      while (Date.now() < limit && !ready()) await new Promise(resolve => setTimeout(resolve, 100));
      await save();
      done++;
    }
    status(`${done} folha(s) gerada(s). Faça o commit de gerador/saida e gerador/projetos.`, 'ok');
  } catch (error) {
    status(`Parou: ${error.message}`, 'error');
  } finally {
    button.disabled = false;
  }
}
