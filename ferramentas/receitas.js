// ferramentas/receitas.js

// O que os scripts de criar receitas precisam saber das receitas que já existem
// no gerador (gerador/projetos).

const fs = require('fs');
const path = require('path');

// ================================================================================================================================================================================================================================================
// listarReceitas
// Todas as receitas das subpastas de `raiz` (recursivo): [{ tipo: 'grupo/pasta/nome', nome, receita }].

function listarReceitas(raiz, ...subpastas) {
  const lista = [];
  const visitar = (pasta, tipoDaPasta) => {
    if (!fs.existsSync(pasta)) return;
    for (const item of fs.readdirSync(pasta, { withFileTypes: true })) {
      if (item.isDirectory()) visitar(path.join(pasta, item.name), `${tipoDaPasta}/${item.name}`);
      else if (item.name.endsWith('.json')) {
        const nome = item.name.replace(/\.json$/, '');
        lista.push({ tipo: `${tipoDaPasta}/${nome}`, nome, receita: JSON.parse(fs.readFileSync(path.join(pasta, item.name), 'utf8')) });
      }
    }
  };
  for (const subpasta of subpastas) visitar(path.join(raiz, subpasta), subpasta);
  return lista;
}

// ================================================================================================================================================================================================================================================
// idsDoTibia
// Os ids de desenho do Tibia que as receitas já usam (o desenho principal e o de cada direção).

function idsDoTibia(receitas) {
  const ids = new Set();
  for (const { receita } of receitas) {
    const fontes = [receita.objeto, ...Object.values(receita.direcoes || {})];
    for (const fonte of fontes) if (fonte && fonte.tibia) ids.add(fonte.tibia.id);
  }
  return ids;
}

// ================================================================================================================================================================================================================================================
// tiposPorIdDoTibia
// Id de desenho do Tibia → tipo da receita (a primeira que o usa).

function tiposPorIdDoTibia(receitas) {
  const mapa = new Map();
  for (const { tipo, receita } of receitas) {
    const fontes = [receita.objeto, ...Object.values(receita.direcoes || {})];
    for (const fonte of fontes) if (fonte && fonte.tibia && !mapa.has(fonte.tibia.id)) mapa.set(fonte.tibia.id, tipo);
  }
  return mapa;
}

module.exports = { listarReceitas, idsDoTibia, tiposPorIdDoTibia };
