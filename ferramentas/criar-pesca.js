// ferramentas/criar-pesca.js

// Cria no gerador as receitas da pesca: a vara de pescar (itens/ferramentas,
// Uso "vara de pescar", isca: a minhoca) e os peixes (itens/peixes: fish,
// northern pike, green perch e rainbow trout, comida; cada um pede um nível de
// fishing: 0, 20, 35 e 50). O peso vem do Canary;
// as folhas (.png) saem do gerador: aba Objetos → "Gerar folhas pendentes".
// Receita que já existe fica como está. Os peixes que cada piso de água dá se
// marcam no gerador (Pisos → Pescável).
//
// Uso: node ferramentas/criar-pesca.js <pasta do canary>
// (pasta com data/items/items.xml)

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PASTA_ITENS = path.join(RAIZ, 'gerador', 'projetos', 'itens');

const ITENS = [
  { pasta: 'ferramentas', nome: 'fishing-rod', id: 3483, extra: { uso: 'ferramenta-pesca', isca: 'itens/produtos-de-criaturas/worm' } },
  { pasta: 'peixes', nome: 'fish', id: 3578, extra: { alimento: 144, empilhavel: true, nivelPesca: 0 } },
  { pasta: 'peixes', nome: 'northern-pike', id: 3580, extra: { alimento: 145, empilhavel: true, nivelPesca: 20 } },
  { pasta: 'peixes', nome: 'green-perch', id: 7159, extra: { alimento: 100, empilhavel: true, nivelPesca: 35 } },
  { pasta: 'peixes', nome: 'rainbow-trout', id: 7158, extra: { alimento: 144, empilhavel: true, nivelPesca: 50 } }
];

// ================================================================================================================================================================================================================================================
// pesoDoCanary
// O peso (oz) do item no items.xml, ou 10.

function pesoDoCanary(texto, id) {
  const bloco = texto.match(new RegExp(`<item id="${id}"[^>]*?>([\\s\\S]*?)</item>`));
  const peso = bloco && bloco[1].match(/key="weight" value="(\d+)"/);
  return peso ? Math.round(Number(peso[1]) / 10) / 10 : 10;
}

// ================================================================================================================================================================================================================================================
// principal

function principal() {
  const canary = process.argv[2];
  if (!canary) throw new Error('Passe a pasta do canary (com data/items/items.xml).');
  const texto = fs.readFileSync(path.join(canary, 'data', 'items', 'items.xml'), 'utf8');
  for (const item of ITENS) {
    const arquivo = path.join(PASTA_ITENS, item.pasta, `${item.nome}.json`);
    if (fs.existsSync(arquivo)) {
      console.log(`já existe: ${item.pasta}/${item.nome}`);
      continue;
    }
    const receita = {
      formato: { quadro: 32, quadros: 1 },
      objeto: { tibia: { id: item.id, variacao: 0 } },
      propriedades: {
        bloqueia: false, move: true, altura: false, empilhavel: false, peso: pesoDoCanary(texto, item.id),
        espacos: 0, atk: 0, def: 0, ml: 0, speed: 0, vidaMin: 0, vidaMax: 0, manaMin: 0, manaMax: 0, alimento: 0, ...item.extra
      },
      ferramenta: 'objetos', grupo: 'itens', pasta: item.pasta, nome: item.nome
    };
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    fs.writeFileSync(arquivo, JSON.stringify(receita, null, 2) + '\n');
    console.log(`✅ ${item.pasta}/${item.nome}`);
  }
}

principal();
