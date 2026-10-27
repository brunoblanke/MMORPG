// ferramentas/criar-lenha.js

// Cortar lenha: cria no gerador a receita da madeira (itens/materiais/wood, empilhável), dá a capacidade "lenhar"
// aos machados (itens/machados: os que têm "axe" no nome e o hatchet) e escreve nas árvores (estrutura/natureza) a
// reação: machado usado com a mira na árvore, ao lado dela, com CHANCE % solta 1 madeira ao lado do player.
// Pode rodar de novo: o que já está feito fica como está. A folha da madeira sai do gerador: aba Objetos →
// "Gerar folhas pendentes"; a chance e o que cai se mudam no gerador (Interações da árvore).
//
// Uso: node ferramentas/criar-lenha.js

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PROJETOS = path.join(RAIZ, 'gerador', 'projetos');
const MADEIRA = 'itens/materiais/wood';
const CHANCE = 40;
const ARVORES = [
  'arvore-1', 'arvore-3', 'beech', 'coconut-palm', 'dead-tree', 'dwarf-tree', 'fir-tree', 'old-tree', 'palm', 'pear-tree',
  'pine', 'pinheiro-1', 'plum-tree', 'poplar', 'red-maple', 'snowy-dead-tree', 'willow', 'yellow-maple'
];

// ================================================================================================================================================================================================================================================
// lerReceita

function lerReceita(arquivo) {
  return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
}

// ================================================================================================================================================================================================================================================
// gravarReceita

function gravarReceita(arquivo, receita) {
  fs.writeFileSync(arquivo, JSON.stringify(receita, null, 2) + '\n');
}

// ================================================================================================================================================================================================================================================
// criarMadeira
// A receita da madeira (Tibia: wood, id 5901), se ainda não existe.

function criarMadeira() {
  const arquivo = path.join(PROJETOS, `${MADEIRA}.json`);
  if (fs.existsSync(arquivo)) return console.log(`já existe: ${MADEIRA}`);
  const [grupo, pasta, nome] = MADEIRA.split('/');
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  gravarReceita(arquivo, {
    formato: { quadro: 32, quadros: 1 },
    objeto: { tibia: { id: 5901, variacao: 0 } },
    propriedades: {
      bloqueia: false, move: true, altura: false, empilhavel: true, peso: 10,
      espacos: 0, atk: 0, def: 0, ml: 0, speed: 0, vidaMin: 0, vidaMax: 0, manaMin: 0, manaMax: 0, alimento: 0
    },
    ferramenta: 'objetos', grupo, pasta, nome
  });
  console.log(`✅ ${MADEIRA}`);
}

// ================================================================================================================================================================================================================================================
// marcarMachados
// Os machados ganham a capacidade "lenhar".

function marcarMachados() {
  const pasta = path.join(PROJETOS, 'itens', 'machados');
  for (const nome of fs.readdirSync(pasta).filter(n => n.endsWith('.json')).sort()) {
    const base = nome.replace(/\.json$/, '');
    if (!base.includes('axe') && base !== 'hatchet') continue;
    const arquivo = path.join(pasta, nome);
    const receita = lerReceita(arquivo);
    const props = receita.propriedades = receita.propriedades || {};
    const lista = Array.isArray(props.capacidade) ? props.capacidade : [];
    if (lista.includes('lenhar')) continue;
    props.capacidade = [...lista, 'lenhar'];
    gravarReceita(arquivo, receita);
    console.log(`🪓 ${base}`);
  }
}

// ================================================================================================================================================================================================================================================
// marcarArvores
// As árvores ganham a reação ao machado: com CHANCE % solta 1 madeira.

function marcarArvores() {
  for (const nome of ARVORES) {
    const arquivo = path.join(PROJETOS, 'estrutura', 'natureza', `${nome}.json`);
    if (!fs.existsSync(arquivo)) {
      console.log(`não achei: estrutura/natureza/${nome}`);
      continue;
    }
    const receita = lerReceita(arquivo);
    const props = receita.propriedades = receita.propriedades || {};
    const lista = Array.isArray(props.interacoes) ? props.interacoes : [];
    if (lista.some(i => i && i.gatilho && i.gatilho.capacidade === 'lenhar')) continue;
    props.interacoes = [...lista, {
      gatilho: { tipo: 'capacidade', capacidade: 'lenhar' },
      condicoes: { alcance: 1, chance: CHANCE },
      efeitos: [{ tipo: 'soltar-item', item: MADEIRA, quantidade: 1 }]
    }];
    gravarReceita(arquivo, receita);
    console.log(`🌳 ${nome}`);
  }
}

criarMadeira();
marcarMachados();
marcarArvores();
