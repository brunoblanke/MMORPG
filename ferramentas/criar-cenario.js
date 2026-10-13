// ferramentas/criar-cenario.js

// Cria no gerador as receitas de itens de natureza e decoração clássicos do
// Tibia (árvores, pedras, plantas, móveis, estátuas, luz, adornos), com os
// ids do Tibia atual e o nome inglês do Canary. Peça que gira (cadeira,
// cômoda, piano…) segue a corrente "rotateto" do Canary e vira um objeto com
// as 4 direções (ordem norte, leste, sul, oeste: confira no gerador). Bloqueio,
// altura e se mexe saem do Tibia.dat quando o gerador abre a receita
// (propriedadesDoTibia). As folhas (.png) saem do gerador: aba Objetos →
// "Gerar folhas pendentes". Receita que já existe fica como está.
//
// Uso: node ferramentas/criar-cenario.js <pasta do canary>
// (pasta com data/items/items.xml)

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PASTA_PROJETOS = path.join(RAIZ, 'gerador', 'projetos');
const DIRECOES = ['norte', 'leste', 'sul', 'oeste'];

const CENARIO = {
  'estrutura/natureza': {
    'fir-tree': 3614, pine: 3626, 'dwarf-tree': 3625, palm: 3639, 'coconut-palm': 3640, willow: 3616, 'plum-tree': 3617,
    'pear-tree': 3619, 'red-maple': 3618, 'yellow-maple': 3620, beech: 3621, poplar: 3622, 'old-tree': 3636, 'dead-tree': 7753,
    'snowy-dead-tree': 3608, bush: 3681, 'blueberry-bush': 3699, 'dry-bush': 3698, tulip: 3668, sunflower: 3667, orchid: 3675,
    'moon-flower': 3655, wheat: 3651, 'sugar-cane': 5462, 'jungle-grass': 3695, agave: 3697, stalagmites: 388, 'mossy-stone': 1840,
    stone: 1851, 'stone-pile': 1822, 'swamp-reed': 3688, 'sludge-fern': 3694
  },
  'decoracao/moveis': {
    'wooden-chair': 2358, 'small-table': 2319, table: 2339, 'square-table': 2315, 'small-round-table': 2316, dresser: 2441,
    bookcase: 6367, piano: 2959, harp: 2963, pedestal: 2049
  },
  'decoracao/estatuas': {
    statue: 2026, 'angel-statue': 2031, 'dwarven-statue': 2032, 'goblin-statue': 2030, 'minotaur-statue': 2029,
    'sandstone-statue': 2034, 'cobra-statue': 2057, obelisk: 2199, monument: 2028, 'small-pagoda': 2074
  },
  'decoracao/iluminacao': { lamp: 2914, candlestick: 2917, 'torch-bearer': 2940, candelabrum: 2911 },
  'decoracao/sinalizacao': { painting: 2596, banner: 2606, 'wall-mirror': 2635, map: 2822 },
  'decoracao/adornos': {
    skeleton: 4315, anvil: 3458, cart: 5543, vase: 2876, pot: 3465, amphora: 2893, 'wine-cask': 2521, 'rum-cask': 4848,
    'water-cask': 137, barrel: 2519, crate: 116, box: 2469, mailbox: 3501
  }
};

// ================================================================================================================================================================================================================================================
// lerRotacoes
// O items.xml do Canary: id → id seguinte da corrente "rotateto" (as direções do mesmo móvel).

function lerRotacoes(arquivo) {
  const texto = fs.readFileSync(arquivo, 'utf8');
  const proximo = new Map();
  for (const m of texto.matchAll(/<item id="(\d+)"[^>]*?>([\s\S]*?)<\/item>/g)) {
    const r = /key="rotateto" value="(\d+)"/i.exec(m[2]);
    if (r) proximo.set(Number(m[1]), Number(r[1]));
  }
  return proximo;
}

// ================================================================================================================================================================================================================================================
// corrente
// Os ids que giram a partir de id (id, o seguinte, o seguinte…), até voltar ou chegar a 4.

function corrente(id, proximo) {
  const ids = [id];
  while (ids.length < 4 && proximo.has(ids[ids.length - 1]) && proximo.get(ids[ids.length - 1]) !== id && !ids.includes(proximo.get(ids[ids.length - 1]))) {
    ids.push(proximo.get(ids[ids.length - 1]));
  }
  return ids;
}

// ================================================================================================================================================================================================================================================
// montarReceita
// A receita do objeto: com 2 a 4 ids na corrente, um objeto que gira (as direções na ordem norte, leste, sul, oeste).

function montarReceita(grupoPasta, nome, id, proximo) {
  const [grupo, pasta] = grupoPasta.split('/');
  const ids = corrente(id, proximo);
  const fonte = (tibia) => ({ tibia: { id: tibia, variacao: 0 } });
  const gira = ids.length > 1;
  const direcoes = DIRECOES.slice(0, ids.length);
  const receita = {
    formato: { quadro: 32, quadros: 1, ...(gira ? { direcoes } : {}) },
    objeto: fonte(id),
    ...(gira ? { direcoes: Object.fromEntries(direcoes.map((direcao, i) => [direcao, fonte(ids[i])])) } : {}),
    propriedades: {
      bloqueia: false, move: false, altura: false, empilhavel: false, peso: 10, espacos: 0, atk: 0, def: 0, ml: 0, speed: 0,
      vidaMin: 0, vidaMax: 0, manaMin: 0, manaMax: 0, alimento: 0, uso: '', ativoComo: ''
    },
    propriedadesDoTibia: true,
    ferramenta: 'objetos', grupo, pasta, nome
  };
  return receita;
}

// ================================================================================================================================================================================================================================================
// idsExistentes
// Os ids do Tibia que já têm receita (pra não repetir).

function idsExistentes() {
  const ids = new Set();
  const visitar = (pasta) => {
    for (const nome of fs.readdirSync(pasta)) {
      const caminho = path.join(pasta, nome);
      if (fs.statSync(caminho).isDirectory()) visitar(caminho);
      else if (nome.endsWith('.json')) {
        const receita = JSON.parse(fs.readFileSync(caminho, 'utf8'));
        if (receita.objeto && receita.objeto.tibia) ids.add(receita.objeto.tibia.id);
        for (const fonte of Object.values(receita.direcoes || {})) if (fonte && fonte.tibia) ids.add(fonte.tibia.id);
      }
    }
  };
  visitar(path.join(PASTA_PROJETOS, 'estrutura'));
  visitar(path.join(PASTA_PROJETOS, 'decoracao'));
  visitar(path.join(PASTA_PROJETOS, 'itens'));
  return ids;
}

// ================================================================================================================================================================================================================================================
// criar
// Cria as receitas que faltam e devolve a lista das criadas.

function criar(pastaCanary) {
  const proximo = lerRotacoes(path.join(pastaCanary, 'data', 'items', 'items.xml'));
  const existentes = idsExistentes();
  const criadas = [];
  for (const [grupoPasta, itens] of Object.entries(CENARIO)) {
    for (const [nome, id] of Object.entries(itens)) {
      const arquivo = path.join(PASTA_PROJETOS, grupoPasta, `${nome}.json`);
      if (fs.existsSync(arquivo) || existentes.has(id)) continue;
      fs.mkdirSync(path.dirname(arquivo), { recursive: true });
      fs.writeFileSync(arquivo, JSON.stringify(montarReceita(grupoPasta, nome, id, proximo), null, 2));
      criadas.push(`${grupoPasta}/${nome}`);
    }
  }
  return criadas;
}

module.exports = { criar, CENARIO };

if (require.main === module) {
  if (!process.argv[2]) {
    console.error('Uso: node ferramentas/criar-cenario.js <pasta do canary>');
    process.exit(1);
  }
  const criadas = criar(process.argv[2]);
  for (const nome of criadas) console.log(`✅ ${nome}`);
  console.log(`${criadas.length} receita(s) criada(s). Falta gerar as folhas: gerador → Objetos → "Gerar folhas pendentes".`);
}
