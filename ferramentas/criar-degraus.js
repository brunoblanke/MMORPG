// ferramentas/criar-degraus.js

// Cria no gerador escadas de degraus pra testar (pasta estrutura/degraus):
// cada escada tem o degrau baixo (altura 2, passo 2), o degrau alto (altura 3,
// passo 1) e o conjunto que põe os dois juntos no editor (o alto no sqm
// clicado, o baixo 1 sqm atrás dele). Os desenhos são escadas do Tibia
// (provisórios: troque pelos que quiser no gerador). As folhas saem do
// gerador: aba Objetos → "Gerar folhas pendentes" (primeiro os degraus, depois
// o conjunto). Receita que já existe fica como está.
//
// Uso: node ferramentas/criar-degraus.js

const fs = require('fs');
const path = require('path');

const PASTA = path.join(__dirname, '..', 'gerador', 'projetos', 'estrutura', 'degraus');
const ATRAS = { norte: [0, 1], oeste: [1, 0], sul: [0, -1], leste: [-1, 0] };

const ESCADAS = [
  { nome: 'madeira', baixo: { norte: 1958, oeste: 7881 }, alto: { norte: 1947, oeste: 5257 } },
  { nome: 'pedra', baixo: { norte: 1977, oeste: 1978 }, alto: { norte: 10206 } }
];

// ================================================================================================================================================================================================================================================
// degrau
// A receita de um degrau: um desenho por direção, com altura em volumes e passo.

function degrau(nome, desenhos, volume, passo) {
  const direcoes = Object.keys(desenhos);
  const fonte = (id) => ({ tibia: { id, variacao: 0 } });
  return {
    formato: { quadro: 64, quadros: 1, direcoes },
    objeto: fonte(desenhos[direcoes[0]]),
    direcoes: Object.fromEntries(direcoes.map(direcao => [direcao, fonte(desenhos[direcao])])),
    propriedades: { bloqueia: false, move: false, altura: true, volume, passo, empilhavel: false, peso: 9999, espacos: 0, atk: 0, def: 0, ml: 0 },
    ferramenta: 'objetos', grupo: 'estrutura', pasta: 'degraus', nome
  };
}

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
// principal

function principal() {
  fs.mkdirSync(PASTA, { recursive: true });
  const receitas = [];
  for (const escada of ESCADAS) {
    receitas.push(degrau(`degrau-baixo-${escada.nome}`, escada.baixo, 2, 2), degrau(`degrau-alto-${escada.nome}`, escada.alto, 3, 1), conjunto(escada.nome, escada.baixo, escada.alto));
  }
  for (const receita of receitas) {
    const arquivo = path.join(PASTA, `${receita.nome}.json`);
    if (fs.existsSync(arquivo)) {
      console.log(`já existe: ${receita.nome}`);
      continue;
    }
    fs.writeFileSync(arquivo, JSON.stringify(receita, null, 2) + '\n');
    console.log(`✅ ${receita.nome}`);
  }
}

principal();
