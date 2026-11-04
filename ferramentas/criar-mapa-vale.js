// ferramentas/criar-mapa-vale.js

// Monta um mapa a partir da planta ferramentas/mapa-vale.json, tirada de uma imagem de mapa (40 × 40 blocos):
// "terreno" tem uma letra por sqm (t terra, g grama, c caminho, r rio, p piso de pedra, q quadra, b praça; a = o azul
// das paredes azuis, que vira o terreno em volta)
// e "paredes", "arvores", "pedras" e "casas" vêm por bloco da imagem, que vira escala × escala sqm. As paredes
// passam pelo meio do bloco e se ligam às dos blocos vizinhos; as casas viram uma sala de madeira com porta ao sul;
// onde o caminho atravessa o rio entra uma ponte de madeira. O spawn e a zona segura ficam na cidade das quadras.
// Grava TRANSF/mapa-vale.json (semente fixa), que se copia pro data/map.json do servidor.
//
// Uso: node ferramentas/criar-mapa-vale.js [saída]

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { lerSprites } = require('../gerador/sprites.js');

const RAIZ = path.join(__dirname, '..');
const GRID = 250;
const PLANTA = path.join(__dirname, 'mapa-vale.json');
const SAIDA_PADRAO = path.join(RAIZ, 'TRANSF', 'mapa-vale.json');
const MARGEM = 45;
const GRAMAS = ['estrutura/pisos/grama-1', 'estrutura/pisos/grama-1', 'estrutura/pisos/grama-1', 'estrutura/pisos/grama-2', 'estrutura/pisos/grama-3'];
const PISOS = {
  t: ['estrutura/pisos/terra-9'],
  g: GRAMAS,
  c: ['estrutura/pisos/terra-5'],
  r: ['estrutura/pisos/agua-1'],
  p: ['estrutura/pisos/pedra-9'],
  q: ['estrutura/pisos/tijolo-1'],
  b: ['estrutura/pisos/calcamento-5']
};
const PONTE = 'estrutura/pisos/madeira-1';
const PISO_CASA = 'estrutura/pisos/madeira-1';
const PAREDES = { cinza: 'estrutura/paredes/pedra-6', marrom: 'estrutura/paredes/pedra-6', azul: 'estrutura/paredes/pedra-3' };
const PAREDE_CASA = 'estrutura/paredes/madeira-1';
const ARVORES_GRAMA = ['estrutura/natureza/arvore-1', 'estrutura/natureza/beech', 'estrutura/natureza/poplar', 'estrutura/natureza/bush'];
const ARVORES_TERRA = ['estrutura/natureza/pine', 'estrutura/natureza/fir-tree', 'estrutura/natureza/pinheiro-1', 'estrutura/natureza/dry-bush'];
const PEDRAS = ['estrutura/natureza/stone-pile', 'estrutura/natureza/stone', 'estrutura/natureza/mossy-stone'];
const AGUA = new Set(['r']);
const PONTE_MAX = 6;
const CIDADE_MARGEM = 8;

// ================================================================================================================================================================================================================================================
// criarAleatorio
// Gerador com semente: o mesmo mapa sai sempre igual.

function criarAleatorio(semente) {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6D2B79F5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ================================================================================================================================================================================================================================================
// criarCelulas

function criarCelulas() {
  const celulas = {};
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      celulas[`${x},${y}`] = { floor: null, floorTop: null, hole: null, borders: [], objects: [], enemy: null, npc: null, bot: null, spawn: false, safe: false, house: null };
    }
  }
  return celulas;
}

// ================================================================================================================================================================================================================================================
// pecaDeParede
// A peça da parede pelo que liga em volta: canto que abre pra leste e sul = xy, horizontal = x, vertical = y, o resto
// (canto, ponta solta, cruzamento) = pilar yx.

function pecaDeParede(n, s, l, o) {
  if (l && s && !n && !o) return 'xy';
  if ((l || o) && !n && !s) return 'x';
  if ((n || s) && !l && !o) return 'y';
  if (l && s) return 'xy';
  return 'yx';
}

// ================================================================================================================================================================================================================================================
// resolverAzul
// O azul das paredes azuis (a) vira o terreno que mais aparece em volta dele.

function resolverAzul(terreno) {
  const linhas = terreno.map(linha => linha.split(''));
  for (let raio = 1; raio <= 6; raio++) {
    for (let y = 0; y < linhas.length; y++) {
      for (let x = 0; x < linhas[y].length; x++) {
        if (linhas[y][x] !== 'a') continue;
        const conta = {};
        for (let dy = -raio; dy <= raio; dy++) {
          for (let dx = -raio; dx <= raio; dx++) {
            const l = terreno[y + dy] && terreno[y + dy][x + dx];
            if (l && l !== 'a') conta[l] = (conta[l] || 0) + 1;
          }
        }
        const melhor = Object.keys(conta).sort((a, b) => conta[b] - conta[a])[0];
        if (melhor) linhas[y][x] = melhor;
      }
    }
  }
  return linhas.map(linha => linha.join('').replace(/a/g, 'g'));
}

// ================================================================================================================================================================================================================================================
// montarMapa

async function montarMapa() {
  const importar = (...partes) => import(pathToFileURL(path.join(RAIZ, ...partes)).href);
  const assets = await importar('shared', 'assets.js');
  const formato = await importar('shared', 'map-format.js');
  const bordas = await importar('shared', 'floor-borders.js');
  const sprites = lerSprites(RAIZ);
  assets.setAssets(sprites);
  const existe = new Set(sprites.map(s => s.id));
  const planta = JSON.parse(fs.readFileSync(PLANTA, 'utf8'));
  const aleatorio = criarAleatorio(4040);
  const layer = criarCelulas();
  const ausentes = new Set();
  const E = planta.escala;
  const tamanho = planta.tamanho;
  const terreno = resolverAzul(planta.terreno);
  const letra = (x, y) => (terreno[y] || '')[x];
  const celula = (x, y) => layer[`${x + MARGEM},${y + MARGEM}`];
  const sorteio = (lista) => lista[Math.floor(aleatorio() * lista.length)];
  const confere = (tipo) => {
    const base = tipo.split('#')[0];
    if (existe.has(base)) return true;
    ausentes.add(base);
    return false;
  };
  const piso = (x, y, tipo) => {
    const c = celula(x, y);
    c.floor = null;
    c.floorTop = null;
    if (confere(tipo)) formato.addFloorToCell(c, tipo);
  };
  const objeto = (x, y, tipo) => {
    if (confere(tipo)) celula(x, y).objects.push({ type: tipo });
  };
  const livre = (x, y) => {
    const c = celula(x, y);
    return c && c.floor && !c.objects.length && !AGUA.has(letra(x, y));
  };

  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) piso(x, y, sorteio(PISOS[letra(x, y)] || PISOS.t));
  }

  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      if (!AGUA.has(letra(x, y))) continue;
      const atravessa = (dx, dy) => {
        const ponta = (sinal) => {
          for (let i = 1; i <= PONTE_MAX; i++) {
            const l = letra(x + dx * i * sinal, y + dy * i * sinal);
            if (!AGUA.has(l)) return l === 'c';
          }
          return false;
        };
        return ponta(1) && ponta(-1);
      };
      if (atravessa(1, 0) || atravessa(0, 1)) piso(x, y, PONTE);
    }
  }

  const paredes = new Map();
  const blocoDeParede = new Map(planta.paredes.map(([tx, ty, material]) => [`${tx},${ty}`, material]));
  const meio = (t) => t * E + Math.floor(E / 2) - 1;
  for (const [tx, ty, material] of planta.paredes) {
    paredes.set(`${meio(tx)},${meio(ty)}`, material);
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      if (!blocoDeParede.has(`${tx + dx},${ty + dy}`)) continue;
      for (let i = 1; i < E; i++) paredes.set(`${meio(tx) + dx * i},${meio(ty) + dy * i}`, material);
    }
  }
  for (const [chave, material] of paredes) {
    const [x, y] = chave.split(',').map(Number);
    if (AGUA.has(letra(x, y))) piso(x, y, PISOS.t[0]);
    const tem = (dx, dy) => paredes.has(`${x + dx},${y + dy}`);
    objeto(x, y, `${PAREDES[material] || PAREDES.cinza}#${pecaDeParede(tem(0, -1), tem(0, 1), tem(1, 0), tem(-1, 0))}`);
  }

  for (const [tx, ty] of planta.casas) {
    const x0 = tx * E;
    const y0 = ty * E;
    const ocupado = [];
    for (let y = y0; y < y0 + E; y++) for (let x = x0; x < x0 + E; x++) if (celula(x, y).objects.length || AGUA.has(letra(x, y))) ocupado.push([x, y]);
    if (ocupado.length) continue;
    for (let y = y0; y < y0 + E; y++) {
      for (let x = x0; x < x0 + E; x++) {
        piso(x, y, PISO_CASA);
        const topo = y === y0;
        const fundo = y === y0 + E - 1;
        const esquerda = x === x0;
        const direita = x === x0 + E - 1;
        if (!topo && !fundo && !esquerda && !direita) continue;
        let peca = topo && esquerda ? 'xy' : (topo || fundo) && (esquerda || direita) ? 'yx' : topo || fundo ? 'x' : 'y';
        if (fundo && x === x0 + 1) peca = 'porta-x';
        objeto(x, y, `${PAREDE_CASA}#${peca}`);
      }
    }
  }

  const espalhar = (tx, ty, quantos, escolher) => {
    for (let i = 0, tentativas = 0; i < quantos && tentativas < 12; tentativas++) {
      const x = tx * E + Math.floor(aleatorio() * E);
      const y = ty * E + Math.floor(aleatorio() * E);
      if (!livre(x, y)) continue;
      objeto(x, y, escolher(x, y));
      i++;
    }
  };
  for (const [tx, ty] of planta.arvores) espalhar(tx, ty, 2 + Math.floor(aleatorio() * 2), (x, y) => sorteio(letra(x, y) === 'g' ? ARVORES_GRAMA : ARVORES_TERRA));
  for (const [tx, ty] of planta.pedras) espalhar(tx, ty, 2, () => sorteio(PEDRAS));

  let spawn = null;
  const quadras = [];
  for (let y = 0; y < tamanho; y++) for (let x = 0; x < tamanho; x++) if (letra(x, y) === 'q') quadras.push([x, y]);
  const caixa = quadras.reduce((c, [x, y]) => ({ x0: Math.min(c.x0, x - CIDADE_MARGEM), y0: Math.min(c.y0, y - CIDADE_MARGEM), x1: Math.max(c.x1, x + CIDADE_MARGEM), y1: Math.max(c.y1, y + CIDADE_MARGEM) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  const alvo = { x: (caixa.x0 + caixa.x1) / 2, y: (caixa.y0 + caixa.y1) / 2 };
  for (let y = Math.max(0, caixa.y0); y <= Math.min(tamanho - 1, caixa.y1); y++) {
    for (let x = Math.max(0, caixa.x0); x <= Math.min(tamanho - 1, caixa.x1); x++) {
      if (letra(x, y) !== 'p' && letra(x, y) !== 'q') continue;
      celula(x, y).safe = true;
      if (!livre(x, y)) continue;
      const d = Math.abs(x - alvo.x) + Math.abs(y - alvo.y);
      if (!spawn || d < spawn.d) spawn = { x, y, d };
    }
  }
  if (spawn) celula(spawn.x, spawn.y).spawn = true;

  bordas.rebuildLayerBorders(layer, new Set());
  const mapa = formato.serializeMapFromLayers([0], { 0: layer }, GRID);
  return { mapa, ausentes: [...ausentes].sort() };
}

// ================================================================================================================================================================================================================================================
// principal

async function principal() {
  const saida = path.resolve(process.argv[2] || SAIDA_PADRAO);
  const { mapa, ausentes } = await montarMapa();
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  fs.writeFileSync(saida, JSON.stringify(mapa));
  console.log(`Mapa gravado em ${saida}`);
  console.log(`${mapa.objetosData.length} objetos, ${mapa.safeZoneData.length} sqms de zona segura, spawn ${JSON.stringify(mapa.spawn)}`);
  if (ausentes.length) console.log(`Sem folha no gerador (ficaram de fora): ${ausentes.join(', ')}`);
}

principal();
