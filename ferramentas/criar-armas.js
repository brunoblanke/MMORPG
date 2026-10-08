// ferramentas/criar-armas.js

// Cria no gerador as receitas das armas e munições clássicas do Tibia 7.8
// (espadas, machados, clavas, distância, munição e escudos) a partir do Canary: peso,
// ataque, defesa, duas mãos e tipo de munição (flecha ou virote). O desenho
// é o item de mesmo nome do Tibia atual. As folhas (.png) saem do gerador:
// aba Objetos → "Gerar folhas pendentes". Receita que já existe fica como está
// (o tipo de munição das que já existem se põe à mão, no gerador).
//
// Uso: node ferramentas/criar-armas.js <pasta do canary>
// (pasta com data/items/items.xml)

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PASTA_ITENS = path.join(RAIZ, 'gerador', 'projetos', 'itens');

const ARMAS = {
  espadas: [
    'dagger', 'sword', 'sabre', 'rapier', 'short sword', 'longsword', 'broadsword', 'two handed sword', 'bright sword', 'fire sword',
    'giant sword', 'magic sword', 'ice rapier', 'serpent sword', 'poison dagger', 'carlin sword', 'spike sword', 'scimitar', 'katana',
    'bone sword', 'epee', 'warlord sword', 'djinn blade', 'knife', 'combat knife', 'machete', 'jagged sword', 'blacksteel sword', 'mystic blade'
  ],
  machados: [
    'axe', 'hatchet', 'battle axe', 'double axe', 'war axe', 'halberd', 'orcish axe', 'barbarian axe', 'dwarven axe', 'knight axe',
    'stonecutter axe', 'fire axe', 'guardian halberd', 'dragon lance', 'naginata', 'sickle', 'golden sickle', 'obsidian lance',
    'daramian axe', 'daramian waraxe', 'twin axe', 'beastslayer axe', 'ripper lance'
  ],
  clavas: [
    'club', 'mace', 'morning star', 'war hammer', 'battle hammer', 'studded club', 'clerical mace', 'crystal mace', 'dragon hammer',
    'heavy mace', 'silver mace', 'skull staff', 'staff', 'crowbar', 'bone club', 'daramian mace', 'thunder hammer', 'hammer of wrath',
    'lich staff', 'enchanted staff', 'arcane staff'
  ],
  distancia: [
    'bow', 'crossbow', 'arbalest', 'spear', 'hunting spear', 'enchanted spear', 'throwing knife', 'throwing star', 'viper star', 'small stone', 'snowball'
  ],
  municao: ['arrow', 'bolt', 'power bolt', 'poison arrow', 'burst arrow'],
  escudos: [
    'steel shield', 'plate shield', 'brass shield', 'wooden shield', 'battle shield', 'mastermind shield', 'guardian shield', 'dragon shield',
    'shield of honour', 'bonelord shield', 'crown shield', 'demon shield', 'dark shield', 'great shield', 'blessed shield', 'ornamented shield',
    'dwarven shield', 'studded shield', 'rose shield', 'tower shield', 'black shield', 'copper shield', 'viking shield', 'ancient shield',
    'griffin shield', 'vampire shield', 'castle shield', 'medusa shield', 'amazon shield', 'eagle shield', 'phoenix shield', 'scarab shield',
    'bone shield', 'tempest shield', 'tusk shield', 'sentinel shield', 'salamander shield'
  ]
};
const EMPILHAVEL = new Set(['spear', 'hunting spear', 'enchanted spear', 'throwing knife', 'throwing star', 'viper star', 'small stone', 'snowball', ...ARMAS.municao]);
const MUNICAO_DO_ARCO = { bow: 'arrow', crossbow: 'bolt', arbalest: 'bolt' };

// ================================================================================================================================================================================================================================================
// lerItens
// Os itens do items.xml do Canary: nome → [{ id, atributos }] (vários itens podem ter o mesmo nome).

function lerItens(arquivo) {
  const texto = fs.readFileSync(arquivo, 'utf8');
  const itens = new Map();
  for (const m of texto.matchAll(/<item id="(\d+)"[^>]*?name="([^"]+)"[^>]*?(?:\/>|>([\s\S]*?)<\/item>)/g)) {
    const atributos = {};
    for (const a of (m[3] || '').matchAll(/<attribute key="([^"]+)" value="([^"]*)"/g)) if (!(a[1] in atributos)) atributos[a[1]] = a[2];
    if (!itens.has(m[2])) itens.set(m[2], []);
    itens.get(m[2]).push({ id: Number(m[1]), atributos });
  }
  return itens;
}

// ================================================================================================================================================================================================================================================
// receitasExistentes
// Os ids do Tibia e os nomes que já têm receita em gerador/projetos/itens.

function receitasExistentes() {
  const ids = new Set();
  const nomes = new Set();
  for (const pasta of fs.readdirSync(PASTA_ITENS)) {
    for (const arquivo of fs.readdirSync(path.join(PASTA_ITENS, pasta)).filter(nome => nome.endsWith('.json'))) {
      const receita = JSON.parse(fs.readFileSync(path.join(PASTA_ITENS, pasta, arquivo), 'utf8'));
      if (receita.objeto && receita.objeto.tibia) ids.add(receita.objeto.tibia.id);
      nomes.add(receita.nome);
    }
  }
  return { ids, nomes };
}

// ================================================================================================================================================================================================================================================
// montarReceita
// A receita do item (propriedades do jogo a partir dos atributos do Canary).

function montarReceita(pasta, nome, item) {
  const a = item.atributos;
  const empilhavel = EMPILHAVEL.has(nome);
  const propriedades = {
    bloqueia: false, move: true, altura: false, empilhavel,
    peso: Math.round((Number(a.weight) || 0) / 10) / 10,
    espacos: 0, atk: Number(a.attack) || 0, def: Number(a.defense) || 0, ml: 0, speed: 0,
    vidaMin: 0, vidaMax: 0, manaMin: 0, manaMax: 0, alimento: 0
  };
  if (a.slotType === 'two-handed') propriedades.duasMaos = true;
  const tipo = a.ammotype || MUNICAO_DO_ARCO[nome];
  if (tipo === 'arrow' || tipo === 'bolt') propriedades.tipoMunicao = tipo;
  return {
    formato: pasta === 'municao' ? { quadro: 32, quadros: 8, pilha: true } : { quadro: 32, quadros: 1 },
    objeto: { tibia: { id: item.id, variacao: 0 } },
    propriedades,
    ferramenta: 'objetos', grupo: 'itens', pasta, nome: nome.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  };
}

// ================================================================================================================================================================================================================================================
// criar
// Cria as receitas que faltam e devolve { criadas, faltando } (faltando: nomes que o Canary não tem).

function criar(pastaCanary) {
  const itens = lerItens(path.join(pastaCanary, 'data', 'items', 'items.xml'));
  const { ids, nomes } = receitasExistentes();
  const criadas = [];
  const faltando = [];
  for (const [pasta, lista] of Object.entries(ARMAS)) {
    for (const nome of lista) {
      const candidatos = (itens.get(nome) || []).sort((x, y) => x.id - y.id);
      if (!candidatos.length) {
        faltando.push(nome);
        continue;
      }
      const receita = montarReceita(pasta, nome, candidatos[0]);
      const arquivo = path.join(PASTA_ITENS, pasta, `${receita.nome}.json`);
      if (fs.existsSync(arquivo)) continue;
      if (ids.has(candidatos[0].id) || nomes.has(receita.nome)) continue;
      fs.mkdirSync(path.dirname(arquivo), { recursive: true });
      fs.writeFileSync(arquivo, JSON.stringify(receita, null, 2));
      criadas.push(`${pasta}/${receita.nome}`);
    }
  }
  return { criadas, faltando };
}

module.exports = { criar, ARMAS };

if (require.main === module) {
  const pasta = process.argv[2];
  if (!pasta) {
    console.error('Uso: node ferramentas/criar-armas.js <pasta do canary>');
    process.exit(1);
  }
  const { criadas, faltando } = criar(pasta);
  for (const nome of criadas) console.log(`✅ ${nome}`);
  if (faltando.length) console.log(`⚠️  Sem item no Canary: ${faltando.join(', ')}`);
  console.log(`${criadas.length} receita(s) criada(s). Falta gerar as folhas: gerador → Objetos → "Gerar folhas pendentes".`);
}
