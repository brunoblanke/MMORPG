// ferramentas/itens-antigos.js

// Marca os itens do Tibia 15.01 (gerador/tibia/atual) que ainda têm o desenho
// do Tibia antigo: o 1º quadro da 1ª variação igual, pixel a pixel, a algum
// sprite do 7.80 (tests/tibia-780). Grava gerador/itens-antigos.json, que o
// gerador usa pra separá-los na aba Old do painel de sprites.
//
// Uso: node ferramentas/itens-antigos.js

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { TibiaAssets } = require('../gerador/tibia-assets.js');

const RAIZ = path.join(__dirname, '..');
const ARQUIVO = path.join(RAIZ, 'gerador', 'itens-antigos.json');
const MAX_VARIACOES = 16;

// ================================================================================================================================================================================================================================================
// assinatura
// md5 dos pixels de uma variação (1º quadro) do item.

function assinatura(tibia, thing, variacao) {
  const quadro = tibia.quadro(thing, { x: variacao % thing.px, y: Math.floor(variacao / thing.px) % thing.py });
  return crypto.createHash('md5').update(Buffer.from(quadro.pixels)).digest('hex');
}

// ================================================================================================================================================================================================================================================
// faixas
// [1, 2, 3, 7] → [[1, 3], [7, 7]]: a lista em faixas, pra caber pequena.

function faixas(ids) {
  const lista = [];
  for (const id of ids) {
    const ultima = lista[lista.length - 1];
    if (ultima && ultima[1] === id - 1) ultima[1] = id;
    else lista.push([id, id]);
  }
  return lista;
}

// ================================================================================================================================================================================================================================================
// marcarAntigos

function marcarAntigos() {
  const antigo = new TibiaAssets(path.join(RAIZ, 'tests', 'tibia-780'));
  const atual = new TibiaAssets(path.join(RAIZ, 'gerador', 'tibia', 'atual'));
  const desenhosAntigos = new Set();
  for (const thing of antigo.things.item.values()) {
    for (let v = 0; v < Math.min(thing.px * thing.py, MAX_VARIACOES); v++) desenhosAntigos.add(assinatura(antigo, thing, v));
  }
  const ids = [];
  for (const [id, thing] of atual.things.item) {
    if (thing.sprites.some(Boolean) && desenhosAntigos.has(assinatura(atual, thing, 0))) ids.push(id);
  }
  fs.writeFileSync(ARQUIVO, JSON.stringify(faixas(ids)));
  console.log(`${ids.length} itens com o desenho antigo → ${path.relative(RAIZ, ARQUIVO)}`);
}

marcarAntigos();
