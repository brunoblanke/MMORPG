// ferramentas/criar-pisos.js

// Cria no gerador as receitas dos pisos clássicos do Tibia 7.x que ainda faltam
// (pasta estrutura/pisos), a partir dos pincéis de chão do Remere's Map Editor
// 7.60 (grounds.xml, borders.xml e items.otb, que traduz o id do servidor pro
// id do cliente): o chão principal no meio (com o padrão do item, até 4 × 4,
// lido do Tibia 7.80 de tests/tibia-780), os outros chãos do pincel como
// variações raras, a borda de fora nas 12 peças e o bloqueio do Tibia.dat
// (água, lava, piche, montanha: "Bloqueia" com a borda bloqueando também). As folhas (.png) saem do
// gerador: aba Pisos → "Gerar folhas pendentes". Receita que já existe (ou
// chão que já está numa receita) fica como está.
//
// Uso: node ferramentas/criar-pisos.js [pasta com grounds.xml, borders.xml e items.otb]
// (sem a pasta, baixa os arquivos do data/760 do RME no GitHub)

const fs = require('fs');
const path = require('path');
const { TibiaAssets } = require('../gerador/tibia-assets.js');
const { listarReceitas } = require('./receitas.js');

const RAIZ = path.join(__dirname, '..');
const PASTA_PROJETOS = path.join(RAIZ, 'gerador', 'projetos');
const PASTA = path.join(PASTA_PROJETOS, 'estrutura', 'pisos');
const CLIENTE_780 = path.join(RAIZ, 'tests', 'tibia-780');
const RME = 'https://raw.githubusercontent.com/hampusborgos/rme/master/data/760/';
const PADRAO_MAX = 4;
const RARAS_MAX = 8;

const PISOS = {
  snow: { nome: 'neve', propriedades: {} },
  lawn: { nome: 'grama', propriedades: { minhocas: 50, plantavel: true } },
  'dry earth': { nome: 'terra', propriedades: { plantavel: true } },
  sand: { nome: 'areia', propriedades: {} },
  cobblestone: { nome: 'calcamento', propriedades: {} },
  'grassy cobblestone': { nome: 'calcamento', propriedades: {} },
  'jungle dirt': { nome: 'terra', propriedades: { plantavel: true }, semBorda: true },
  'mountain ground': { nome: 'montanha', propriedades: {} },
  'mountain top ground': { nome: 'montanha', propriedades: {} },
  lava: { nome: 'lava', propriedades: {} },
  'white gravel': { nome: 'cascalho', propriedades: {} },
  'light dirt': { nome: 'terra', propriedades: { plantavel: true } },
  'tar pit': { nome: 'piche', propriedades: {} },
  'clear water': { nome: 'agua', propriedades: { pescavel: ['itens/peixes/fish'] } },
  'dark swamp': { nome: 'pantano', propriedades: {} },
  ice: { nome: 'gelo', propriedades: {} },
  'flat roof': { nome: 'telhado', propriedades: {} },
  'stone floor': { nome: 'pedra', propriedades: {} },
  'wooden floor': { nome: 'madeira', propriedades: {} },
  'dark wooden floor': { nome: 'madeira', propriedades: {} },
  'white marble floor': { nome: 'marmore', propriedades: {} },
  'black marble floor': { nome: 'marmore', propriedades: {} },
  'dark tiled sandstone': { nome: 'arenito', propriedades: {} },
  'dark sandstone': { nome: 'arenito', propriedades: {} },
  sandstone: { nome: 'arenito', propriedades: {} },
  'tiled sandstone floor': { nome: 'arenito', propriedades: {} },
  'gray stone tiles': { nome: 'ladrilho', propriedades: {} },
  'drab tiled stone floor': { nome: 'ladrilho', propriedades: {} },
  'dark tiled stone floor': { nome: 'ladrilho', propriedades: {} },
  'light tiled stone floor': { nome: 'ladrilho', propriedades: {} },
  'orange tiled floor': { nome: 'ladrilho', propriedades: {} }
};

const BORDAS = { n: 's', e: 'o', s: 'n', w: 'l', cnw: 'sl', cne: 'so', csw: 'nl', cse: 'no', dnw: 'int-sl', dne: 'int-so', dsw: 'int-nl', dse: 'int-no' };
const LINHAS = ['meio: 1 variações', 's o n l', 'sl so nl no', 'int-sl int-so int-nl int-no'];

// ================================================================================================================================================================================================================================================
// lerArquivos
// grounds.xml, borders.xml (texto) e items.otb (bytes), da pasta ou do GitHub.

async function lerArquivos(pasta) {
  const nomes = ['grounds.xml', 'borders.xml', 'items.otb'];
  if (pasta) return nomes.map(nome => fs.readFileSync(path.join(pasta, nome)));
  return Promise.all(nomes.map(async (nome) => {
    const resposta = await fetch(RME + nome);
    if (!resposta.ok) throw new Error(`${nome}: HTTP ${resposta.status}`);
    return Buffer.from(await resposta.arrayBuffer());
  }));
}

// ================================================================================================================================================================================================================================================
// idsDoCliente
// O items.otb: id do servidor → id do cliente.

function idsDoCliente(otb) {
  const mapa = new Map();
  const pilha = [];
  let atual = null;
  for (let i = 4; i < otb.length; i++) {
    const byte = otb[i];
    if (byte === 0xfe) {
      atual = { dados: [], nivel: pilha.length };
      pilha.push(atual);
      i++;
      continue;
    }
    if (byte === 0xff) {
      const no = pilha.pop();
      if (no.nivel === 1) lerItemOtb(Buffer.from(no.dados), mapa);
      atual = pilha[pilha.length - 1];
      continue;
    }
    if (byte === 0xfd) i++;
    if (atual) atual.dados.push(otb[i]);
  }
  return mapa;
}

// ================================================================================================================================================================================================================================================
// lerItemOtb

function lerItemOtb(dados, mapa) {
  let servidor = 0;
  let cliente = 0;
  for (let j = 4; j + 3 <= dados.length;) {
    const atributo = dados[j];
    const tamanho = dados.readUInt16LE(j + 1);
    if (atributo === 0x10) servidor = dados.readUInt16LE(j + 3);
    if (atributo === 0x11) cliente = dados.readUInt16LE(j + 3);
    j += 3 + tamanho;
  }
  if (servidor) mapa.set(servidor, cliente);
}

// ================================================================================================================================================================================================================================================
// semComentarios

function semComentarios(texto) {
  return texto.replace(/<!--[\s\S]*?-->/g, '').replace(/--[^<\n]*--/g, '');
}

// ================================================================================================================================================================================================================================================
// lerBordas
// borders.xml: id da borda → { aresta: id do cliente }.

function lerBordas(texto, cliente) {
  const bordas = new Map();
  for (const m of semComentarios(texto).matchAll(/<border id="(\d+)"[^>]*>([\s\S]*?)<\/border>/g)) {
    const pecas = {};
    for (const p of m[2].matchAll(/<borderitem edge="(\w+)"\s+item="(\d+)"/g)) pecas[p[1]] = cliente.get(Number(p[2]));
    bordas.set(m[1], pecas);
  }
  return bordas;
}

// ================================================================================================================================================================================================================================================
// lerPinceis
// grounds.xml: [{ nome, itens: [[id do cliente, chance]], borda }] (borda = id da borda de fora).

function lerPinceis(texto, cliente) {
  const pinceis = [];
  for (const m of semComentarios(texto).matchAll(/<brush name="([^"]+)" type="border"[^>/]*>([\s\S]*?)<\/brush>/g)) {
    const itens = [...m[2].matchAll(/<item id="(\d+)" chance="(\d+)"/g)].map(i => [cliente.get(Number(i[1])), Number(i[2])]).filter(([id]) => id);
    const fora = [...m[2].matchAll(/<border align="outer"( to="[^"]*")? id="(\d+)"/g)].find(b => !b[1]);
    pinceis.push({ nome: m[1], itens, borda: fora ? fora[2] : null });
  }
  return pinceis;
}

// ================================================================================================================================================================================================================================================
// idsUsados
// Os ids do Tibia que as receitas de piso já usam.

function idsUsados() {
  const ids = new Set();
  for (const { receita } of listarReceitas(PASTA_PROJETOS, 'estrutura')) {
    if (receita.ferramenta !== 'pisos') continue;
    for (const fonte of Object.values(receita.slots || {})) if (fonte && fonte.tibia) ids.add(fonte.tibia.id);
  }
  return ids;
}

// ================================================================================================================================================================================================================================================
// proximoNome
// grama → grama-7 (o primeiro número livre na pasta).

function proximoNome(base) {
  for (let n = 1; ; n++) {
    if (!fs.existsSync(path.join(PASTA, `${base}-${n}.json`))) return `${base}-${n}`;
  }
}

// ================================================================================================================================================================================================================================================
// montarReceita
// A receita do gerador pro pincel: meio (e padrão), raras e bordas.

function montarReceita(pincel, { nome, propriedades, semBorda }, tibia, bordas) {
  const ordenados = [...pincel.itens].sort((a, b) => b[1] - a[1]);
  const [principal] = ordenados[0];
  const info = tibia.infoDoItem(principal);
  const slots = { 'meio-1': { tibia: { id: principal, variacao: 0 } } };
  const formato = { quadro: 32 };
  const [px, py] = info ? info.padrao : [1, 1];
  if (px * py > 1) {
    const colunas = Math.min(px, PADRAO_MAX);
    const linhas = Math.min(py, PADRAO_MAX);
    formato.padrao = [colunas, linhas];
    for (let y = 0; y < linhas; y++) {
      for (let x = 0; x < colunas; x++) slots[`padrao-${x}-${y}`] = { tibia: { id: principal, variacao: y * px + x } };
    }
  }
  const raras = ordenados.slice(1).filter(([id, chance]) => chance > 0 && id !== principal).slice(0, RARAS_MAX);
  if (raras.length) {
    const total = pincel.itens.reduce((soma, [, chance]) => soma + chance, 0);
    const chanceRaras = raras.reduce((soma, [, chance]) => soma + chance, 0) / total * 100;
    formato.raras = raras.length;
    formato.chanceRaras = Math.min(50, Math.max(1, Math.round(chanceRaras)));
    raras.forEach(([id], i) => { slots[`raro-${i + 1}`] = { tibia: { id, variacao: 0 } }; });
  }
  const borda = !semBorda && pincel.borda && bordas.get(pincel.borda);
  if (borda) {
    for (const [aresta, peca] of Object.entries(BORDAS)) if (borda[aresta]) slots[peca] = { tibia: { id: borda[aresta], variacao: 0 } };
  }
  formato.linhas = LINHAS;
  return {
    formato,
    variacoesDoMeio: 1,
    slots,
    propriedades: info && info.bloqueia ? { comportamento: 'bloqueia', bordaBloqueia: true, ...propriedades } : { comportamento: 'normal', ...propriedades },
    ferramenta: 'pisos',
    grupo: 'estrutura',
    pasta: 'pisos',
    nome
  };
}

// ================================================================================================================================================================================================================================================
// criar

async function criar(pasta) {
  const [grounds, borders, otb] = await lerArquivos(pasta);
  const cliente = idsDoCliente(otb);
  const bordas = lerBordas(borders.toString('utf8'), cliente);
  const tibia = new TibiaAssets(CLIENTE_780);
  const usados = idsUsados();
  const criadas = [];
  for (const pincel of lerPinceis(grounds.toString('utf8'), cliente)) {
    const piso = PISOS[pincel.nome];
    if (!piso || !pincel.itens.length || pincel.itens.some(([id]) => usados.has(id))) continue;
    const nome = proximoNome(piso.nome);
    const receita = montarReceita(pincel, { ...piso, nome }, tibia, bordas);
    fs.writeFileSync(path.join(PASTA, `${nome}.json`), JSON.stringify(receita, null, 2));
    for (const [id] of pincel.itens) usados.add(id);
    criadas.push(`${nome} (${pincel.nome})`);
  }
  console.log(criadas.length ? `Criadas ${criadas.length} receitas:\n  ${criadas.join('\n  ')}` : 'Nenhuma receita nova.');
}

criar(process.argv[2]).catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
