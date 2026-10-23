// gerador/sprites.js

const fs = require('fs');
const path = require('path');

// ================================================================================================================================================================================================================================================
// lerSprites
// Lista das folhas (o que /api/sprites devolve).

function lerSprites(raiz = path.join(__dirname, '..'), { todas = false } = {}) {
  const PASTA_PROJETOS = path.join(raiz, 'gerador', 'projetos');
  const PASTA_SAIDA = path.join(raiz, 'gerador', 'saida');
  const TAXONOMIA_PATH = path.join(raiz, 'gerador', 'taxonomia.json');
  const taxonomia = fs.existsSync(TAXONOMIA_PATH) ? JSON.parse(fs.readFileSync(TAXONOMIA_PATH, 'utf8')) : { grupos: [] };
  const sprites = [];
  for (const grupo of taxonomia.grupos) {
    for (const secao of grupo.secoes) {
      for (const pasta of secao.pastas) {
        const relativa = `${grupo.id}/${pasta.id}`;
        const dir = path.join(PASTA_PROJETOS, grupo.id, pasta.id);
        if (!fs.existsSync(dir)) continue;
        for (const arquivo of fs.readdirSync(dir).filter(nome => nome.endsWith('.json')).sort()) {
          const nome = arquivo.slice(0, -5);
          if (!todas && !fs.existsSync(path.join(PASTA_SAIDA, relativa, `${nome}.png`))) continue;
          const receita = JSON.parse(fs.readFileSync(path.join(dir, arquivo), 'utf8'));
          sprites.push(descreverSprite(`${relativa}/${nome}`, grupo, pasta, nome, receita));
        }
      }
    }
  }
  return sprites;
}


// ================================================================================================================================================================================================================================================
// descreverSprite
// O que o jogo precisa saber de uma folha pra desenhar e pra colocar no mapa.

function descreverSprite(id, grupo, pasta, nome, receita) {
  const formato = receita.formato || {};
  return {
    id,
    ferramenta: pasta.ferramenta,
    grupo: grupo.id,
    pasta: pasta.id,
    nome,
    rotulo: `${grupo.nome} › ${pasta.nome}`,
    url: `/gerador/saida/${id}.png`,
    quadro: formato.quadro || 32,
    quadros: formato.quadros || 1,
    msPorQuadro: formato.msPorQuadro || 0,
    pilha: !!formato.pilha,
    respingo: !!formato.respingo,
    direcoes: Array.isArray(formato.direcoes) && formato.direcoes.length ? formato.direcoes : null,
    conjunto: receita.conjunto && typeof receita.conjunto === 'object' ? receita.conjunto : null,
    sqms: formato.sqms === 2 ? 2 : 1,
    volumePecas: Math.max(1, Math.floor(Number(formato.volume)) || 1),
    variacoes: receita.variacoesDoMeio || 0,
    padrao: Array.isArray(formato.padrao) ? formato.padrao : null,
    padraoSorteado: formato.padraoSorteado === true,
    raras: Number(formato.raras) || 0,
    chanceRaras: Number(formato.chanceRaras) || 0,
    ordem: formato.pecas || null,
    pecas: Object.keys(receita.pecas || receita.slots || {}),
    propriedades: receita.propriedades || null,
    cadaver: !!(receita.cadaver && Object.keys(receita.cadaver).length)
  };
}

module.exports = { lerSprites, descreverSprite };
