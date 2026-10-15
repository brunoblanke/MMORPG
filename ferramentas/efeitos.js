// ferramentas/efeitos.js

// Gera as imagens dos efeitos mágicos e dos projéteis que o jogo usa
// (shared/effects.js) a partir dos sprites do Tibia (gerador/tibia/atual):
//   gerador/saida/efeitos/efeito-<id>.png    os quadros da animação lado a lado
//   gerador/saida/projeteis/projetil-<id>.png as 9 direções (3×3: noroeste,
//                                              norte, nordeste… sudeste)
// Cada quadro é um quadrado de `size` px (32 ou 64) com o desenho encostado
// embaixo à direita, como no Tibia. No fim mostra frames, size e ms de cada
// efeito pra conferir com shared/effects.js.
//
// Uso: node ferramentas/efeitos.js

const fs = require('fs');
const path = require('path');
const { TibiaAssets, gerarPng } = require('../gerador/tibia-assets.js');

const RAIZ = path.join(__dirname, '..');
const SAIDA = path.join(RAIZ, 'gerador', 'saida');
const SPRITE = 32;

// ================================================================================================================================================================================================================================================
// colarQuadro

function colarQuadro(destino, larguraDestino, quadro, x, y) {
  for (let linha = 0; linha < quadro.altura; linha++) {
    const inicio = linha * quadro.largura * 4;
    destino.set(quadro.pixels.subarray(inicio, inicio + quadro.largura * 4), ((y + linha) * larguraDestino + x) * 4);
  }
}

// ================================================================================================================================================================================================================================================
// gerarEfeito

function gerarEfeito(tibia, id) {
  const thing = tibia.things.effect.get(id);
  const size = Math.max(thing.w, thing.h) * SPRITE;
  const largura = size * thing.anim;
  const pixels = new Uint8Array(largura * size * 4);
  for (let anim = 0; anim < thing.anim; anim++) {
    const quadro = tibia.quadro(thing, { anim });
    colarQuadro(pixels, largura, quadro, anim * size + size - quadro.largura, size - quadro.altura);
  }
  fs.writeFileSync(path.join(SAIDA, 'efeitos', `efeito-${id}.png`), gerarPng(pixels, largura, size));
  const ms = thing.duracoes.length ? Math.round(thing.duracoes.reduce((a, b) => a + b, 0) / thing.duracoes.length) : 100;
  return { frames: thing.anim, size, ms };
}

// ================================================================================================================================================================================================================================================
// gerarProjetil

function gerarProjetil(tibia, id) {
  const thing = tibia.things.missile.get(id);
  const size = Math.max(thing.w, thing.h) * SPRITE;
  const largura = size * 3;
  const pixels = new Uint8Array(largura * largura * 4);
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      const quadro = tibia.quadro(thing, { x: Math.min(x, thing.px - 1), y: Math.min(y, thing.py - 1) });
      colarQuadro(pixels, largura, quadro, x * size + size - quadro.largura, y * size + size - quadro.altura);
    }
  }
  fs.writeFileSync(path.join(SAIDA, 'projeteis', `projetil-${id}.png`), gerarPng(pixels, largura, largura));
  return { size };
}

// ================================================================================================================================================================================================================================================
// gerarTudo

async function gerarTudo() {
  const { EFFECTS, MISSILES } = await import('../shared/effects.js');
  const tibia = new TibiaAssets(path.join(RAIZ, 'gerador', 'tibia', 'atual'));
  for (const pasta of ['efeitos', 'projeteis']) {
    fs.rmSync(path.join(SAIDA, pasta), { recursive: true, force: true });
    fs.mkdirSync(path.join(SAIDA, pasta), { recursive: true });
  }
  const efeitos = {};
  for (const [nome, { id }] of Object.entries(EFFECTS)) efeitos[nome] = { id, ...gerarEfeito(tibia, id) };
  const projeteis = {};
  for (const [nome, { id }] of Object.entries(MISSILES)) projeteis[nome] = { id, ...gerarProjetil(tibia, id) };
  console.log(JSON.stringify({ efeitos, projeteis }, null, 1));
}

gerarTudo();
