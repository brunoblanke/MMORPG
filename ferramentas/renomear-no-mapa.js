// ferramentas/renomear-no-mapa.js

// Troca no mapa os nomes antigos das folhas do gerador pelos novos, pela tabela
// gerador/renomeados.json ({ "estrutura/pisos/piso-terra-3": "estrutura/pisos/terra-4" }):
// objetos, bordas ("Border:<piso>:<peça>"), peças ("<folha>#<peça>") e escadas.
// O servidor roda isso no mapa ao vivo ao subir (guardando uma cópia do antes).
// Acrescente à tabela sempre que renomear uma folha que já está no mapa.
//
// Uso: node ferramentas/renomear-no-mapa.js [arquivo do mapa]  (padrão data/map.json)

const fs = require('fs');
const path = require('path');

const TABELA = path.join(__dirname, '..', 'gerador', 'renomeados.json');

// ================================================================================================================================================================================================================================================
// renomearTipo
// O tipo com o nome novo (ou o mesmo, se não mudou).

function renomearTipo(tipo, tabela) {
  if (typeof tipo !== 'string') return tipo;
  if (tipo.startsWith('Border:')) {
    const partes = tipo.split(':');
    partes[1] = tabela[partes[1]] || partes[1];
    return partes.join(':');
  }
  const [base, peca] = tipo.split('#');
  const novo = tabela[base];
  if (!novo) return tipo;
  return peca === undefined ? novo : `${novo}#${peca}`;
}

// ================================================================================================================================================================================================================================================
// renomearMapa
// Troca os nomes em todas as listas do mapa (o tipo é o 1º item de cada linha). Devolve quantos itens mudaram.

function renomearMapa(mapa, tabela = JSON.parse(fs.readFileSync(TABELA, 'utf8'))) {
  let mudou = 0;
  for (const lista of ['objetosData', 'transicoesData']) {
    for (const linha of mapa[lista] || []) {
      const novo = renomearTipo(linha[0], tabela);
      if (novo !== linha[0]) {
        linha[0] = novo;
        mudou++;
      }
    }
  }
  return mudou;
}

// ================================================================================================================================================================================================================================================
// renomearArquivo
// Aplica no arquivo do mapa e grava (com a cópia <arquivo>.antes-de-renomear). Devolve quantos itens mudaram.

function renomearArquivo(arquivo) {
  const mapa = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const mudou = renomearMapa(mapa);
  if (mudou) {
    fs.copyFileSync(arquivo, `${arquivo}.antes-de-renomear`);
    fs.writeFileSync(arquivo, JSON.stringify(mapa, null, 2));
  }
  return mudou;
}

module.exports = { renomearTipo, renomearMapa, renomearArquivo };

if (require.main === module) {
  const arquivo = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data', 'map.json'));
  console.log(`${renomearArquivo(arquivo)} item(ns) renomeado(s) em ${arquivo}`);
}
