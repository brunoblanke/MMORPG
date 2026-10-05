// ferramentas/pre-classificar.js

// Pré-classifica todos os sprites do Tibia (gerador/tibia/atual) nas pastas
// da taxonomia, pra conferir na página Classificar do gerador. De onde vem a
// pasta de cada um:
//   itens: a categoria do TibiaWiki que o Canary (servidor open source)
//     guarda no items.xml; sem ela, a categoria de mercado do Tibia.dat; sem
//     as duas, as propriedades do item (chão, parede, pega, luz…);
//   criaturas: a classe do bestiário (ou a pasta) do monstro do Canary que
//     usa aquela roupa; roupa só de NPC vai pra NPCs; roupa colorida de humano
//     sem monstro, pra Players.
// Na 1ª vez, o que já estava classificado (do 7.80) continua, e conta como
// conferido, se o desenho do 7.80 e o do atual forem o mesmo item. Rodando de
// novo, o que foi conferido na página fica como está. O resto vira sugestão
// (classificacao.json → sugeridos), que a página mostra pra conferir.
//
// Uso: node ferramentas/pre-classificar.js <pasta do canary>
// (git clone --depth 1 --filter=blob:none --sparse https://github.com/opentibiabr/canary.git
//  e git sparse-checkout set data/items data-otservbr-global/monster data-otservbr-global/npc)

const fs = require('fs');
const path = require('path');
const { TibiaAssets } = require('../gerador/tibia-assets.js');

const RAIZ = path.join(__dirname, '..');
const ARQUIVO = path.join(RAIZ, 'gerador', 'classificacao.json');
const TAXONOMIA = JSON.parse(fs.readFileSync(path.join(RAIZ, 'gerador', 'taxonomia.json'), 'utf8'));
const MESMO_ITEM = 40;

const FLAG = { GROUND: 0, GROUND_BORDER: 1, ON_BOTTOM: 2, CONTAINER: 4, STACKABLE: 5, WRITABLE: 9, WRITABLE_ONCE: 10, FLUID_CONTAINER: 11, UNPASSABLE: 13, PICKUPABLE: 17, HANGABLE: 18, LIGHT: 22, LYING: 27, LENS_HELP: 30, MARKET: 134 };

const POR_CATEGORIA = {
  'natural tiles': 'estrutura/pisos', 'artificial tiles': 'estrutura/pisos',
  walls: 'estrutura/paredes', windows: 'estrutura/paredes', doors: 'estrutura/paredes', pillars: 'estrutura/paredes', constructions: 'estrutura/paredes',
  stairs: 'estrutura/escadas', ladders: 'estrutura/escadas',
  dropdowns: 'estrutura/entradas', teleporters: 'estrutura/entradas', portals: 'estrutura/entradas', traps: 'estrutura/entradas',
  rocks: 'estrutura/natureza', trees: 'estrutura/natureza', bushes: 'estrutura/natureza', grass: 'estrutura/natureza', ferns: 'estrutura/natureza',
  cactuses: 'estrutura/natureza', 'flora and minerals': 'estrutura/natureza', metals: 'estrutura/natureza',
  furniture: 'decoracao/moveis', tables: 'decoracao/moveis', closets: 'decoracao/moveis', casks: 'decoracao/moveis', coffins: 'decoracao/moveis',
  'machines (objects)': 'decoracao/moveis', machines: 'decoracao/moveis', 'tools (objects)': 'decoracao/moveis', transportation: 'decoracao/moveis',
  'torture instruments': 'decoracao/moveis',
  signs: 'decoracao/sinalizacao', 'wall hangings': 'decoracao/sinalizacao', flags: 'decoracao/sinalizacao',
  illumination: 'decoracao/iluminacao',
  plants: 'decoracao/plantas', flowers: 'decoracao/plantas', mushrooms: 'decoracao/plantas',
  statues: 'decoracao/estatuas', 'shrines and altars': 'decoracao/estatuas', skeletons: 'decoracao/estatuas',
  decoration: 'decoracao/adornos', 'floor decorations': 'decoracao/adornos', 'quest objects': 'decoracao/adornos', animals: 'decoracao/adornos',
  remains: 'decoracao/adornos', 'other items': 'decoracao/adornos',
  helmets: 'itens/capacetes', helmet: 'itens/capacetes', armors: 'itens/armaduras', shields: 'itens/escudos', legs: 'itens/calcas',
  spellbooks: 'itens/spellbooks', boots: 'itens/botas', quivers: 'itens/aljavas', 'extra slot': 'itens/extra-slot',
  'axe weapons': 'itens/machados', 'club weapons': 'itens/clavas', 'sword weapons': 'itens/espadas', rods: 'itens/rods', wands: 'itens/wands',
  'distance weapons': 'itens/distancia', ammunition: 'itens/municao', 'training weapons': 'itens/replicas-de-armas', 'exercise weapons': 'itens/replicas-de-armas',
  'fist weapons': 'itens/punhos',
  books: 'itens/livros', 'tournament rewards': 'itens/premios-de-eventos', 'contest prizes': 'itens/premios-de-eventos',
  'documents and papers': 'itens/documentos-e-papeis', 'dolls and bears': 'itens/dolls-e-bears', 'musical instruments': 'itens/instrumentos-musicais',
  trophies: 'itens/trofeus', 'fansite items': 'itens/itens-de-fansites', containers: 'itens/recipientes',
  food: 'itens/comidas', liquids: 'itens/liquidos', 'fluid containers': 'itens/liquidos', 'plants and herbs': 'itens/plantas-e-ervas',
  'natural products': 'itens/plantas-e-ervas', 'creature products': 'itens/produtos-de-criaturas', 'soul cores': 'itens/produtos-de-criaturas',
  'amulets and necklaces': 'itens/amuletos-e-colares', rings: 'itens/aneis', keys: 'itens/chaves', tools: 'itens/ferramentas', utilities: 'itens/ferramentas',
  'painting equipment': 'itens/ferramentas', 'kitchen tools': 'itens/ferramentas-de-cozinha', 'light sources': 'itens/fontes-de-luz',
  'taming items': 'itens/itens-de-domar', 'clothing accessories': 'itens/itens-de-addons', 'imbuement scrolls': 'itens/itens-de-imbuements',
  'magical items': 'itens/itens-encantados', 'enchanted items': 'itens/itens-encantados', fields: 'itens/itens-encantados', 'blessing charms': 'itens/itens-encantados',
  'game tokens': 'itens/jogos-e-diversao', 'quest items': 'itens/itens-de-quest', 'party items': 'itens/itens-de-festa', valuables: 'itens/valiosos',
  'attack runes': 'itens/runas', 'support runes': 'itens/runas', 'healing runes': 'itens/runas', rubbish: 'itens/lixos', refuse: 'itens/lixos'
};

const POR_MERCADO = {
  1: 'itens/armaduras', 2: 'itens/amuletos-e-colares', 3: 'itens/botas', 4: 'itens/recipientes', 5: 'decoracao/adornos', 6: 'itens/comidas',
  7: 'itens/capacetes', 8: 'itens/calcas', 10: 'itens/liquidos', 11: 'itens/aneis', 12: 'itens/runas', 13: 'itens/escudos', 14: 'itens/ferramentas',
  15: 'itens/valiosos', 16: 'itens/municao', 17: 'itens/machados', 18: 'itens/clavas', 19: 'itens/distancia', 20: 'itens/espadas', 22: 'itens/valiosos',
  24: 'itens/produtos-de-criaturas', 25: 'itens/aljavas'
};

const POR_CLASSE = {
  amphibic: 'anfibios', aquatic: 'aquaticos', bird: 'aves', construct: 'constructos', demon: 'demonios', dragon: 'dragoes', elemental: 'elementais',
  'extra dimensional': 'extra-dimensionais', fey: 'fadas', giant: 'gigantes', human: 'humanos', humanoid: 'humanoides', lycanthrope: 'licantropos',
  magical: 'criaturas-magicas', mammal: 'mamiferos', plant: 'plantas', reptile: 'repteis', slime: 'slimes', undead: 'mortos-vivos', vermin: 'vermes',
  inkborn: 'inkborn'
};

const POR_PASTA_DE_MONSTRO = {
  amphibics: 'anfibios', aquatics: 'aquaticos', birds: 'aves', bosses: 'bosses', constructs: 'constructos', demons: 'demonios', dragons: 'dragoes',
  elementals: 'elementais', extra_dimensional: 'extra-dimensionais', fey: 'fadas', giants: 'gigantes', humanoids: 'humanoides', humans: 'humanos',
  lycanthropes: 'licantropos', magicals: 'criaturas-magicas', mammals: 'mamiferos', plants: 'plantas', reptiles: 'repteis', slimes: 'slimes',
  undeads: 'mortos-vivos', vermins: 'vermes'
};

// ================================================================================================================================================================================================================================================
// pastaExiste

function pastaExiste(valor) {
  const [grupo, pasta] = valor.split('/');
  const g = TAXONOMIA.grupos.find(item => item.id === grupo);
  return !!g && g.secoes.some(secao => secao.pastas.some(item => item.id === pasta));
}

// ================================================================================================================================================================================================================================================
// lerItensDoCanary
// id → { nome, categoria } do items.xml (itens soltos e intervalos fromid/toid).

function lerItensDoCanary(canary) {
  const xml = fs.readFileSync(path.join(canary, 'data', 'items', 'items.xml'), 'utf8');
  const itens = new Map();
  const bloco = /<item\s([^>]*?)(\/>|>([\s\S]*?)<\/item>)/g;
  for (let m; (m = bloco.exec(xml));) {
    const atributo = (nome) => { const a = new RegExp(`\\b${nome}="([^"]*)"`).exec(m[1]); return a ? a[1] : null; };
    const categoria = m[3] && /key="primarytype" value="([^"]*)"/.exec(m[3]);
    const info = { nome: atributo('name') || '', categoria: categoria ? categoria[1] : null };
    const id = atributo('id');
    const de = Number(atributo('fromid'));
    const ate = Number(atributo('toid'));
    if (id) itens.set(Number(id), info);
    else if (de && ate) for (let n = de; n <= ate; n++) itens.set(n, info);
  }
  return itens;
}

// ================================================================================================================================================================================================================================================
// lerRoupasDoCanary
// lookType → pasta de criatura (monstros) ou 'npc' (só NPCs usam).

function lerRoupasDoCanary(canary) {
  const roupas = new Map();
  const andar = (dir, cada) => {
    for (const nome of fs.readdirSync(dir)) {
      const caminho = path.join(dir, nome);
      if (fs.statSync(caminho).isDirectory()) andar(caminho, cada);
      else if (nome.endsWith('.lua')) cada(caminho, fs.readFileSync(caminho, 'utf8'));
    }
  };
  const pastaMonstros = path.join(canary, 'data-otservbr-global', 'monster');
  andar(pastaMonstros, (caminho, lua) => {
    const roupa = /lookType\s*=\s*(\d+)/.exec(lua);
    if (!roupa) return;
    const tipo = Number(roupa[1]);
    const primeiraPasta = path.relative(pastaMonstros, caminho).split(path.sep)[0];
    const classe = /class\s*=\s*"([^"]*)"/.exec(lua);
    const pasta = primeiraPasta === 'bosses' ? 'bosses' : (classe && POR_CLASSE[classe[1].toLowerCase()]) || POR_PASTA_DE_MONSTRO[primeiraPasta];
    if (!pasta) return;
    if (!roupas.has(tipo) || roupas.get(tipo) === 'bosses') roupas.set(tipo, pasta);
  });
  andar(path.join(canary, 'data-otservbr-global', 'npc'), (caminho, lua) => {
    const roupa = /lookType\s*=\s*(\d+)/.exec(lua);
    if (roupa && !roupas.has(Number(roupa[1]))) roupas.set(Number(roupa[1]), 'npc');
  });
  return roupas;
}

// ================================================================================================================================================================================================================================================
// pastaDoItem
// A pasta sugerida pro item, ou null se não der pra saber.

function pastaDoItem(thing, canary) {
  const tem = (flag) => flag in thing.flags;
  if (tem(FLAG.GROUND) || tem(FLAG.GROUND_BORDER)) return 'estrutura/pisos';
  const porCategoria = canary && canary.categoria && POR_CATEGORIA[canary.categoria];
  if (porCategoria) return porCategoria;
  if (tem(FLAG.ON_BOTTOM)) return 'estrutura/paredes';
  const mercado = thing.flags[FLAG.MARKET];
  if (mercado) {
    const nome = mercado.nome.toLowerCase();
    if (mercado.categoria === 21) return /\brod\b/.test(nome) ? 'itens/rods' : 'itens/wands';
    if (mercado.categoria === 13 && /spellbook|book of/.test(nome)) return 'itens/spellbooks';
    if (POR_MERCADO[mercado.categoria]) return POR_MERCADO[mercado.categoria];
  }
  if (tem(FLAG.LYING)) return 'itens/produtos-de-criaturas';
  if (tem(FLAG.PICKUPABLE)) {
    if (tem(FLAG.FLUID_CONTAINER)) return 'itens/liquidos';
    if (tem(FLAG.LIGHT)) return 'itens/fontes-de-luz';
    if (tem(FLAG.CONTAINER)) return 'itens/recipientes';
    if (tem(FLAG.WRITABLE) || tem(FLAG.WRITABLE_ONCE)) return 'itens/documentos-e-papeis';
    return null;
  }
  if (tem(FLAG.LIGHT)) return 'decoracao/iluminacao';
  if (tem(FLAG.CONTAINER)) return 'decoracao/baus';
  if (tem(FLAG.HANGABLE)) return 'decoracao/sinalizacao';
  if (tem(FLAG.WRITABLE) || tem(FLAG.WRITABLE_ONCE)) return 'decoracao/sinalizacao';
  return tem(FLAG.UNPASSABLE) ? 'decoracao/moveis' : 'decoracao/adornos';
}

// ================================================================================================================================================================================================================================================
// mesmoDesenho
// O item tem (quase) o mesmo desenho no 7.80 e no atual?

function mesmoDesenho(velho, atual, id) {
  const a = velho.things.item.get(id);
  const b = atual.things.item.get(id);
  if (!a || !b || a.w !== b.w || a.h !== b.h) return false;
  const qa = velho.quadro(a, {});
  const qb = atual.quadro(b, {});
  let diferenca = 0;
  for (let i = 0; i < qa.pixels.length; i += 4) {
    const pa = qa.pixels[i + 3] > 0;
    const pb = qb.pixels[i + 3] > 0;
    if (pa !== pb) diferenca += 765;
    else if (pa) diferenca += Math.abs(qa.pixels[i] - qb.pixels[i]) + Math.abs(qa.pixels[i + 1] - qb.pixels[i + 1]) + Math.abs(qa.pixels[i + 2] - qb.pixels[i + 2]);
  }
  return diferenca / (qa.pixels.length / 4) <= MESMO_ITEM;
}

// ================================================================================================================================================================================================================================================
// preClassificar

function preClassificar(canary) {
  const atual = new TibiaAssets(path.join(RAIZ, 'gerador', 'tibia', 'atual'));
  const velho = new TibiaAssets(path.join(RAIZ, 'gerador', 'tibia', '780'));
  const antiga = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));
  const primeiraVez = !antiga.sugeridos;
  const sugeridosAntes = new Set(primeiraVez ? [] : antiga.sugeridos.itens);
  const criaturasSugeridasAntes = new Set(primeiraVez ? [] : antiga.sugeridos.criaturas);
  const itensCanary = lerItensDoCanary(canary);
  const roupasCanary = lerRoupasDoCanary(canary);
  const catalogo = atual.catalogo();
  const nova = { itens: {}, criaturas: {}, sugeridos: { itens: [], criaturas: [] } };
  const contagem = { conferidos: 0, sugeridos: 0, semPasta: 0 };

  for (const [id] of catalogo.items) {
    const anterior = antiga.itens[id];
    const conferido = primeiraVez ? mesmoDesenho(velho, atual, id) : !sugeridosAntes.has(id);
    if (anterior && pastaExiste(anterior) && conferido) {
      nova.itens[id] = anterior;
      contagem.conferidos++;
      continue;
    }
    const pasta = pastaDoItem(atual.things.item.get(id), itensCanary.get(id));
    if (!pasta || !pastaExiste(pasta)) {
      contagem.semPasta++;
      continue;
    }
    nova.itens[id] = pasta;
    nova.sugeridos.itens.push(id);
    contagem.sugeridos++;
  }

  for (const [id, , , , colorida] of catalogo.creatures) {
    const anterior = antiga.criaturas[id];
    if (anterior && pastaExiste(anterior) && !criaturasSugeridasAntes.has(id)) {
      nova.criaturas[id] = anterior;
      contagem.conferidos++;
      continue;
    }
    const doCanary = roupasCanary.get(id);
    const pasta = doCanary === 'npc' ? 'personagens/npcs' : doCanary ? `criaturas/${doCanary}` : colorida ? 'personagens/players' : null;
    if (!pasta || !pastaExiste(pasta)) {
      contagem.semPasta++;
      continue;
    }
    nova.criaturas[id] = pasta;
    nova.sugeridos.criaturas.push(id);
    contagem.sugeridos++;
  }

  fs.writeFileSync(ARQUIVO, JSON.stringify(nova, null, 1), 'utf8');
  console.log(`✅ ${catalogo.items.length} itens e ${catalogo.creatures.length} criaturas: ${contagem.conferidos} já conferidos, ${contagem.sugeridos} sugeridos, ${contagem.semPasta} sem pasta.`);
}

const canary = process.argv[2];
if (!canary || !fs.existsSync(path.join(canary, 'data', 'items', 'items.xml'))) {
  console.error('Uso: node ferramentas/pre-classificar.js <pasta do canary>');
  process.exit(1);
}
preClassificar(canary);
