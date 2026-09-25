// gerador/app/js/common.js

import { spriteUrl } from './api.js';

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
