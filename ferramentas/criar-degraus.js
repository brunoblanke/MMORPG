// ferramentas/criar-degraus.js

// Liga os degraus em escadas (pasta estrutura/degraus): todo par
// `degrau-baixo-X` + `degrau-alto-X` criado no gerador ganha o conjunto
// `escada-X`, que põe os dois juntos no editor (o alto no sqm clicado, o baixo
// 1 sqm atrás dele, em cada direção que os dois têm; o R gira). As folhas saem
// do gerador: aba Objetos → "Gerar folhas pendentes" (primeiro os degraus,
// depois o conjunto). Receita que já existe fica como está.
//
// Uso: node ferramentas/criar-degraus.js

const fs = require('fs');
const path = require('path');

const PASTA = path.join(__dirname, '..', 'gerador', 'projetos', 'estrutura', 'degraus');
const ATRAS = { norte: [0, 1], oeste: [1, 0], sul: [0, -1], leste: [-1, 0] };

// ================================================================================================================================================================================================================================================
// conjunto
// O conjunto que põe o degrau alto e o baixo juntos, em cada direção que os dois têm.

function conjunto(nome, baixo, alto) {
  const direcoes = Object.keys(alto).filter(direcao => baixo[direcao]);
  const parte = (tipo, direcao, [dx, dy]) => ({ tipo: `estrutura/degraus/${tipo}#${direcao}`, dx, dy });
  return {
    formato: { quadro: 64, quadros: 1, direcoes },
    conjunto: Object.fromEntries(direcoes.map(direcao => [direcao, [
      parte(`degrau-baixo-${nome}`, direcao, ATRAS[direcao]),
      parte(`degrau-alto-${nome}`, direcao, [0, 0])
    ]])),
    propriedades: { bloqueia: false, move: false, altura: false, empilhavel: false, peso: 9999, espacos: 0, atk: 0, def: 0, ml: 0 },
    ferramenta: 'objetos', grupo: 'estrutura', pasta: 'degraus', nome: `escada-${nome}`
  };
}

// ================================================================================================================================================================================================================================================
// conjuntosDosPares
// Os conjuntos que faltam: um por par degrau-baixo-X + degrau-alto-X que já existe na pasta, em todas as direções que os dois têm.

function conjuntosDosPares() {
  const lerReceita = (nome) => JSON.parse(fs.readFileSync(path.join(PASTA, `${nome}.json`), 'utf8'));
  const nomes = fs.readdirSync(PASTA).filter(nome => nome.endsWith('.json')).map(nome => nome.replace(/\.json$/, ''));
  const conjuntos = [];
  for (const nome of nomes.filter(item => item.startsWith('degrau-baixo-'))) {
    const sufixo = nome.slice('degrau-baixo-'.length);
    if (!nomes.includes(`degrau-alto-${sufixo}`) || nomes.includes(`escada-${sufixo}`)) continue;
    const direcoesDe = (receita) => Object.fromEntries((receita.formato.direcoes || []).map(direcao => [direcao, true]));
    conjuntos.push(conjunto(sufixo, direcoesDe(lerReceita(nome)), direcoesDe(lerReceita(`degrau-alto-${sufixo}`))));
  }
  return conjuntos;
}

// ================================================================================================================================================================================================================================================
// principal

function principal() {
  fs.mkdirSync(PASTA, { recursive: true });
  for (const receita of conjuntosDosPares()) escrever(receita);
}

// ================================================================================================================================================================================================================================================
// escrever
// Grava a receita na pasta, se ainda não existe.

function escrever(receita) {
  const arquivo = path.join(PASTA, `${receita.nome}.json`);
  if (fs.existsSync(arquivo)) {
    console.log(`já existe: ${receita.nome}`);
    return;
  }
  fs.writeFileSync(arquivo, JSON.stringify(receita, null, 2) + '\n');
  console.log(`✅ ${receita.nome}`);
}

principal();
