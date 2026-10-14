// ferramentas/criar-vendedores.js

// Cria no gerador as receitas dos NPCs vendedores clássicos do Tibia (armeiro,
// armadureiro, ferreiro, taverneiro, runeiro e joalheira) a partir dos NPCs do
// Canary: roupa e cores, o que vendem e o que compram, com os preços de lá
// (só entram os itens que já existem no gerador). As folhas dos NPCs saem do
// gerador: aba Criaturas → "Gerar folhas pendentes". Receita que já existe
// fica como está.
//
// Uso: node ferramentas/criar-vendedores.js <pasta do canary>
// (pasta com data-otservbr-global/npc)

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PASTA_ITENS = path.join(RAIZ, 'gerador', 'projetos', 'itens');
const PASTA_NPCS = path.join(RAIZ, 'gerador', 'projetos', 'personagens', 'npcs');

const VENDEDORES = [
  { nome: 'armeiro', canary: 'obi', boasVindas: 'Armas boas e baratas!', oi: 'Olá, {nome}! Vendo e compro armas.' },
  { nome: 'armadureiro', canary: 'dixi', boasVindas: 'Proteção pra sua jornada!', oi: 'Olá, {nome}! Vendo e compro armaduras e escudos.' },
  { nome: 'ferreiro', canary: 'sam', boasVindas: 'O melhor aço da região!', oi: 'Olá, {nome}! Vendo e compro armas e armaduras.' },
  { nome: 'taverneiro', canary: 'frodo', boasVindas: 'Comida quentinha!', oi: 'Olá, {nome}! Posso te vender comida.' },
  { nome: 'runeiro', canary: 'rachel', boasVindas: 'Runas e magia!', oi: 'Olá, {nome}! Vendo runas.' },
  { nome: 'joalheira', canary: 'hanna', boasVindas: 'Joias e pedras preciosas!', oi: 'Olá, {nome}! Compro e vendo joias.' }
];

const FALAS_VENDA = {
  lista: 'O que você deseja comprar?',
  confirmar: 'Quer comprar {item} por {preco}?',
  listaCompra: 'O que você deseja vender?',
  queVender: 'O que você deseja vender?',
  confirmarCompra: 'Quer me vender {quantidade} {item} por {preco}?'
};

// ================================================================================================================================================================================================================================================
// itensDoGerador
// Id do desenho do Tibia → tipo do item no gerador ('itens/pasta/nome').

function itensDoGerador() {
  const mapa = new Map();
  for (const pasta of fs.readdirSync(PASTA_ITENS)) {
    const dir = path.join(PASTA_ITENS, pasta);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const arquivo of fs.readdirSync(dir).filter(nome => nome.endsWith('.json'))) {
      const receita = JSON.parse(fs.readFileSync(path.join(dir, arquivo), 'utf8'));
      const fontes = [receita.objeto, ...Object.values(receita.direcoes || {})];
      for (const fonte of fontes) {
        if (fonte && fonte.tibia && !mapa.has(fonte.tibia.id)) mapa.set(fonte.tibia.id, `itens/${pasta}/${arquivo.replace(/\.json$/, '')}`);
      }
    }
  }
  return mapa;
}

// ================================================================================================================================================================================================================================================
// lerNpc
// Roupa, cores e lojas do NPC do Canary (lua): { roupa, cores, itens: [{ nome, id, compra, venda }] }.

function lerNpc(arquivo) {
  const texto = fs.readFileSync(arquivo, 'utf8');
  const numero = (chave) => Number((texto.match(new RegExp(`${chave} = (\\d+)`)) || [])[1]) || 0;
  const itens = [...texto.matchAll(/itemName = "([^"]+)", clientId = (\d+)(?:, buy = (\d+))?(?:, sell = (\d+))?/g)]
    .map(([, nome, id, compra, venda]) => ({ nome, id: Number(id), compra: Number(compra) || 0, venda: Number(venda) || 0 }));
  return {
    roupa: numero('lookType'),
    cores: [numero('lookHead'), numero('lookBody'), numero('lookLegs'), numero('lookFeet')],
    itens
  };
}

// ================================================================================================================================================================================================================================================
// linhas
// Itens com preço pra lista do NPC: { tipo, preco, palavras } (sem repetir o mesmo tipo).

function linhas(itens, mapa, chave) {
  const vistos = new Set();
  const lista = [];
  for (const item of itens) {
    const tipo = mapa.get(item.id);
    if (!tipo || !item[chave] || vistos.has(tipo)) continue;
    vistos.add(tipo);
    lista.push({ tipo, preco: item[chave], palavras: item.nome.toLowerCase() });
  }
  return lista;
}

// ================================================================================================================================================================================================================================================
// main

function main() {
  const canary = process.argv[2];
  if (!canary) throw new Error('Passe a pasta do canary (com data-otservbr-global/npc).');
  const modelo = JSON.parse(fs.readFileSync(path.join(PASTA_NPCS, 'vendedor.json'), 'utf8'));
  const mapa = itensDoGerador();
  fs.mkdirSync(PASTA_NPCS, { recursive: true });

  for (const vendedor of VENDEDORES) {
    const destino = path.join(PASTA_NPCS, `${vendedor.nome}.json`);
    if (fs.existsSync(destino)) {
      console.log(`já existe: ${vendedor.nome}`);
      continue;
    }
    const npc = lerNpc(path.join(canary, 'data-otservbr-global', 'npc', `${vendedor.canary}.lua`));
    const vende = linhas(npc.itens, mapa, 'compra');
    const compra = linhas(npc.itens, mapa, 'venda');
    const receita = {
      formato: modelo.formato,
      criatura: { id: npc.roupa, cores: npc.cores, addons: [] },
      cadaver: modelo.cadaver,
      propriedades: {
        comportamento: 'npc',
        conversa: {
          boasVindas: vendedor.boasVindas,
          oi: vendedor.oi,
          tchau: 'Volte sempre, {nome}.',
          raio: 2,
          topicos: [],
          vende,
          compra,
          missoes: [],
          falasVenda: FALAS_VENDA
        }
      },
      ferramenta: 'criaturas',
      grupo: 'personagens',
      pasta: 'npcs',
      nome: vendedor.nome
    };
    fs.writeFileSync(destino, JSON.stringify(receita, null, 2) + '\n');
    console.log(`${vendedor.nome}: vende ${vende.length}, compra ${compra.length}`);
  }
}

main();
