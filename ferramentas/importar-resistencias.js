// ferramentas/importar-resistencias.js

// Põe nas receitas dos itens do gerador as resistências que o item tem no
// Canary (absorbpercent: físico, fogo, energia, gelo, terra, veneno, morte e
// sagrado, em %, negativo = fraqueza). O item é achado pelo id do desenho do
// Tibia. Receita que já tem `resistencias` fica como está.
//
// Uso: node ferramentas/importar-resistencias.js <pasta do canary>
// (pasta com data/items/items.xml)

const fs = require('fs');
const path = require('path');
const { listarReceitas } = require('./receitas.js');

const RAIZ = path.join(__dirname, '..');
const PASTA_PROJETOS = path.join(RAIZ, 'gerador', 'projetos');
const ELEMENTOS = { physical: 'physical', fire: 'fire', energy: 'energy', ice: 'ice', earth: 'earth', poison: 'poison', death: 'death', holy: 'holy' };

// ================================================================================================================================================================================================================================================
// lerResistencias
// { id do item: { elemento: % } } do items.xml do Canary.

function lerResistencias(arquivo) {
  const texto = fs.readFileSync(arquivo, 'utf8');
  const itens = new Map();
  for (const m of texto.matchAll(/<item id="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/item>)/g)) {
    const resistencias = {};
    for (const a of (m[2] || '').matchAll(/<attribute key="absorbpercent([a-z]+)" value="(-?\d+)"/g)) {
      const elemento = ELEMENTOS[a[1]];
      const percentual = Number(a[2]);
      if (elemento && percentual && !(elemento in resistencias)) resistencias[elemento] = percentual;
    }
    if (Object.keys(resistencias).length) itens.set(Number(m[1]), resistencias);
  }
  return itens;
}

// ================================================================================================================================================================================================================================================
// principal

function principal() {
  const canary = process.argv[2];
  if (!canary) throw new Error('Passe a pasta do canary (com data/items/items.xml).');
  const resistencias = lerResistencias(path.join(canary, 'data', 'items', 'items.xml'));
  let mudou = 0;
  for (const { tipo, receita } of listarReceitas(PASTA_PROJETOS, 'itens')) {
    const id = receita.objeto && receita.objeto.tibia && receita.objeto.tibia.id;
    const valores = resistencias.get(id);
    if (!valores) continue;
    receita.propriedades = receita.propriedades || {};
    if (receita.propriedades.resistencias) continue;
    receita.propriedades.resistencias = valores;
    fs.writeFileSync(path.join(PASTA_PROJETOS, `${tipo}.json`), JSON.stringify(receita, null, 2) + '\n');
    console.log(`${tipo}: ${JSON.stringify(valores)}`);
    mudou++;
  }
  console.log(`${mudou} item(ns) com resistências.`);
}

principal();
