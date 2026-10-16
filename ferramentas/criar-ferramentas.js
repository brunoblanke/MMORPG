// ferramentas/criar-ferramentas.js

// Cria no gerador as receitas das ferramentas e peças de mapa novas (a foice, a chave, a alavanca e a alavanca
// ligada) e marca o Uso do que já existe: a pick (picareta), o machete, o mato (jungle-grass e sugar-cane,
// cortados pelo machete) e o trigo (wheat, cortado pela foice). Receita que já existe fica como está,
// só ganha o Uso se não tiver nenhum. Os ids do Tibia podem ser trocados no gerador.
// As folhas saem do gerador: aba Objetos → "Gerar folhas pendentes".
//
// Uso: node ferramentas/criar-ferramentas.js

const fs = require('fs');
const path = require('path');

const PASTA = path.join(__dirname, '..', 'gerador', 'projetos');

const NOVAS = [
  { grupo: 'itens', pasta: 'ferramentas', nome: 'scythe', id: 3453, peso: 50, move: true, uso: 'ferramenta-foice' },
  { grupo: 'itens', pasta: 'ferramentas', nome: 'chave-dourada', id: 2970, peso: 1, move: true, uso: 'ferramenta-chave' },
  { grupo: 'decoracao', pasta: 'alavancas', nome: 'alavanca-1', id: 1945, peso: 0, move: false, uso: 'alavanca', ativoComo: 'decoracao/alavancas/alavanca-1-ligada' },
  { grupo: 'decoracao', pasta: 'alavancas', nome: 'alavanca-1-ligada', id: 1946, peso: 0, move: false, uso: '' }
];

const USOS = {
  'itens/ferramentas/pick': 'ferramenta-picareta',
  'itens/espadas/machete': 'ferramenta-machete',
  'estrutura/natureza/jungle-grass': 'machete',
  'estrutura/natureza/sugar-cane': 'machete',
  'estrutura/natureza/wheat': 'foice'
};

// ================================================================================================================================================================================================================================================
// criarReceita

function criarReceita(item) {
  const arquivo = path.join(PASTA, item.grupo, item.pasta, `${item.nome}.json`);
  if (fs.existsSync(arquivo)) {
    console.log(`já existe: ${item.grupo}/${item.pasta}/${item.nome}`);
    return;
  }
  const receita = {
    formato: { quadro: 32, quadros: 1 },
    objeto: { tibia: { id: item.id, variacao: 0 } },
    propriedades: {
      bloqueia: false, move: item.move, altura: false, empilhavel: false, peso: item.peso,
      espacos: 0, atk: 0, def: 0, ml: 0, speed: 0, vidaMin: 0, vidaMax: 0, manaMin: 0, manaMax: 0, alimento: 0,
      uso: item.uso, ativoComo: item.ativoComo || ''
    },
    ferramenta: 'objetos', grupo: item.grupo, pasta: item.pasta, nome: item.nome
  };
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(receita, null, 2) + '\n');
  console.log(`✅ ${item.grupo}/${item.pasta}/${item.nome}`);
}

// ================================================================================================================================================================================================================================================
// marcarUso

function marcarUso(id, uso) {
  const arquivo = path.join(PASTA, `${id}.json`);
  if (!fs.existsSync(arquivo)) {
    console.log(`não existe: ${id}`);
    return;
  }
  const receita = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  if (receita.propriedades.uso) {
    console.log(`já tem Uso: ${id} (${receita.propriedades.uso})`);
    return;
  }
  receita.propriedades.uso = uso;
  fs.writeFileSync(arquivo, JSON.stringify(receita, null, 2) + '\n');
  console.log(`✅ Uso ${uso}: ${id}`);
}

NOVAS.forEach(criarReceita);
Object.entries(USOS).forEach(([id, uso]) => marcarUso(id, uso));
