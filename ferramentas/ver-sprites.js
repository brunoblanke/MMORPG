// ferramentas/ver-sprites.js

// Desenha sprites do Tibia por número pra você conferir qual é qual: uma linha por sprite, com
// todos os quadros da animação, num ver-sprites.png na raiz do projeto (fora do git).
//
// Uso: node ferramentas/ver-sprites.js --item 1387 1388 --efeito 11 40
// Precisa dos arquivos do Tibia em gerador/tibia/atual (como o ferramentas/efeitos.js). Mostra no
// terminal a ordem das linhas.

const fs = require('fs');
const path = require('path');
const { TibiaAssets, gerarPng } = require('../gerador/tibia-assets.js');

const RAIZ = path.join(__dirname, '..');
const CELULA = 64;
const ESCALA = 2;
const FUNDO = [90, 122, 58, 255];

// ================================================================================================================================================================================================================================================
// lerArgumentos
// { item: [ids], efeito: [ids] } a partir de --item 1 2 --efeito 3.

function lerArgumentos(lista) {
  const grupos = { item: [], efeito: [] };
  let atual = null;
  for (const texto of lista) {
    if (texto.startsWith('--')) atual = grupos[texto.slice(2)] || null;
    else if (atual && Number.isInteger(Number(texto))) atual.push(Number(texto));
  }
  return grupos;
}

// ================================================================================================================================================================================================================================================
// colar
// Copia o quadro pra dentro da imagem (x, y em pixels), ampliado ESCALA vezes sem suavizar, por cima do fundo.

function colar(destino, largura, quadro, x, y) {
  for (let linha = 0; linha < quadro.altura * ESCALA; linha++) {
    for (let coluna = 0; coluna < quadro.largura * ESCALA; coluna++) {
      const origem = (Math.floor(linha / ESCALA) * quadro.largura + Math.floor(coluna / ESCALA)) * 4;
      const alfa = quadro.pixels[origem + 3] / 255;
      if (!alfa) continue;
      const dest = ((y + linha) * largura + x + coluna) * 4;
      for (let canal = 0; canal < 3; canal++) destino[dest + canal] = Math.round(quadro.pixels[origem + canal] * alfa + destino[dest + canal] * (1 - alfa));
    }
  }
}

// ================================================================================================================================================================================================================================================
// ver

function ver() {
  const { item, efeito } = lerArgumentos(process.argv.slice(2));
  const linhas = [...item.map(id => ['item', id]), ...efeito.map(id => ['efeito', id])];
  if (!linhas.length) {
    console.log('Uso: node ferramentas/ver-sprites.js --item 1387 1388 --efeito 11 40');
    process.exit(1);
  }
  const tibia = new TibiaAssets(path.join(RAIZ, 'gerador', 'tibia', 'atual'));
  const coisas = linhas.map(([tipo, id]) => ({ tipo, id, thing: tipo === 'item' ? tibia.things.item.get(id) : tibia.things.effect.get(id) }));
  const maiorAnim = Math.max(...coisas.map(c => (c.thing ? Math.max(1, c.thing.anim || 1) : 1)), 1);
  const largura = CELULA * ESCALA * Math.min(maiorAnim, 12);
  const altura = CELULA * ESCALA * coisas.length;
  const pixels = new Uint8Array(largura * altura * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set(FUNDO, i);
  coisas.forEach((coisa, linha) => {
    if (!coisa.thing) {
      console.log(`linha ${linha + 1}: ${coisa.tipo} ${coisa.id} NÃO existe no Tibia.dat`);
      return;
    }
    const quadros = Math.min(Math.max(1, coisa.thing.anim || 1), 12);
    console.log(`linha ${linha + 1}: ${coisa.tipo} ${coisa.id} (${quadros} quadros)`);
    for (let anim = 0; anim < quadros; anim++) colar(pixels, largura, tibia.quadro(coisa.thing, { anim }), anim * CELULA * ESCALA, linha * CELULA * ESCALA);
  });
  fs.writeFileSync(path.join(RAIZ, 'ver-sprites.png'), gerarPng(pixels, largura, altura));
  console.log('Pronto: ver-sprites.png na raiz do projeto.');
}

ver();
