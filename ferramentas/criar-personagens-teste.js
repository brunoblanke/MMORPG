// ferramentas/criar-personagens-teste.js

// Cria (ou refaz) quatro personagens de teste, um por vocação — Druid, Paladin,
// Knight e Sorcerer —, nível 100, todos os skills em 100 (magic level
// incluído), com as armas, munições e runas da vocação e a senha de teste.
// Grava no characters.json e no passwords.json da pasta de dados. O servidor
// guarda os personagens da memória a cada 10 s: PARE o servidor antes de rodar
// (sudo systemctl stop jogo) e ligue de novo depois.
//
// Uso: node ferramentas/criar-personagens-teste.js [pasta de dados] [--senha X]
// (sem pasta: a de JOGO_PERSONAGENS, ou data/ do projeto; senha padrão 123456)

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const RAIZ = path.join(__dirname, '..');
const SENHA_PADRAO = '123456';
const BASE = 'itens/';
const item = (tipo, count) => (count ? { type: BASE + tipo, count } : { type: BASE + tipo });
const comida = [item('comidas/dragon-ham', 20), item('comidas/ham', 20)];
const pocoes = [item('liquidos/health-potion', 100), item('liquidos/mana-potion', 100)];
const ferramentas = [item('ferramentas/rope', 1), item('ferramentas/shovel'), item('ferramentas/pick')];
const runa = (nome, cargas) => ({ type: `${BASE}runas/${nome}`, charges: cargas });

const PERSONAGENS = {
  Druid: {
    vocation: 'druid',
    equip: { cabeca: item('capacetes/crown-helmet'), corpo: item('armaduras/blue-robe'), pernas: item('calcas/crown-legs'), pes: item('botas/boots-of-haste'), arma: item('rods/terra-rod'), escudo: item('spellbooks/spellbook'), anel: item('aneis/life-ring'), amuleto: item('amuletos-e-colares/stone-skin-amulet') },
    mochila: [item('runas/blank-rune'), item('runas/blank-rune'), item('runas/blank-rune'), runa('ultimate-healing-rune', 1), runa('intense-healing-rune', 1), runa('cure-poison-rune', 1), runa('sudden-death-rune', 3), runa('great-fireball-rune', 4), runa('heavy-magic-missile-rune', 5), runa('magic-wall-rune', 3), runa('poison-field-rune', 3), runa('explosion-rune', 6), ...pocoes, ...comida, ...ferramentas]
  },
  Paladin: {
    vocation: 'paladin',
    equip: { cabeca: item('capacetes/crown-helmet'), corpo: item('armaduras/crown-armor'), pernas: item('calcas/crown-legs'), pes: item('botas/boots-of-haste'), arma: item('distancia/crossbow'), municao: item('municao/arrow', 100), anel: item('aneis/might-ring'), amuleto: item('amuletos-e-colares/stone-skin-amulet') },
    mochila: [item('municao/arrow', 100), item('municao/burst-arrow', 100), item('municao/poison-arrow', 100), item('distancia/spear', 50), runa('ultimate-healing-rune', 1), runa('sudden-death-rune', 3), ...pocoes, ...comida, ...ferramentas]
  },
  Knight: {
    vocation: 'knight',
    equip: { cabeca: item('capacetes/crown-helmet'), corpo: item('armaduras/crown-armor'), pernas: item('calcas/crown-legs'), pes: item('botas/boots-of-haste'), arma: item('espadas/fire-sword'), escudo: item('escudos/dragon-shield'), anel: item('aneis/might-ring'), amuleto: item('amuletos-e-colares/stone-skin-amulet') },
    mochila: [item('espadas/giant-sword'), item('machados/fire-axe'), item('clavas/dragon-hammer'), item('espadas/two-handed-sword'), item('escudos/crown-shield'), item('distancia/spear', 20), ...pocoes, ...comida, ...ferramentas]
  },
  Sorcerer: {
    vocation: 'sorcerer',
    equip: { cabeca: item('capacetes/crown-helmet'), corpo: item('armaduras/red-robe'), pernas: item('calcas/crown-legs'), pes: item('botas/boots-of-haste'), arma: item('wands/wand-of-inferno'), escudo: item('spellbooks/spellbook'), anel: item('aneis/life-ring'), amuleto: item('amuletos-e-colares/stone-skin-amulet') },
    mochila: [item('wands/wand-of-cosmic-energy'), item('runas/blank-rune'), item('runas/blank-rune'), item('runas/blank-rune'), runa('sudden-death-rune', 3), runa('great-fireball-rune', 4), runa('fireball-rune', 5), runa('heavy-magic-missile-rune', 5), runa('explosion-rune', 6), runa('fire-bomb-rune', 2), runa('fire-field-rune', 3), runa('energy-field-rune', 3), runa('magic-wall-rune', 3), ...pocoes, ...comida, ...ferramentas]
  }
};

// ================================================================================================================================================================================================================================================
// montarPersonagem
// O personagem pronto pra gravar (o formato do characters.json): nível 100,
// vida e mana cheias, skills em 100, comida cheia e o equipamento da vocação.

async function montarPersonagem(nome, modelo, { Player, newSkills, SKILL_KEYS, FOOD_MAX_SECONDS, EQUIP_SLOTS }) {
  const player = new Player({ id: 'teste', name: nome, x: 0, y: 0, z: 0, lvl: 100, vocation: modelo.vocation });
  player.applyLevelStats();
  player.currentHp = player.hp;
  player.mana = player.maxMana;
  player.skills = newSkills();
  for (const chave of ['magic', ...SKILL_KEYS]) player.skills[chave] = { lvl: 100, pct: 0, tries: 0 };
  player.food = FOOD_MAX_SECONDS * 1000;
  const mochila = { type: BASE + 'recipientes/backpack-azul', items: modelo.mochila };
  const equip = Object.fromEntries(EQUIP_SLOTS.map(chave => [chave, modelo.equip[chave] || null]));
  equip.mochila = mochila;
  return { ...player.toSave(), x: undefined, y: undefined, z: undefined, equip };
}

// ================================================================================================================================================================================================================================================
// criar
// Grava os quatro personagens e as senhas em pasta (characters.json e
// passwords.json). Devolve os nomes.

async function criar(pasta, senha = SENHA_PADRAO) {
  const importar = (arquivo) => import(pathToFileURL(path.join(RAIZ, arquivo)).href);
  const [{ Player }, { newSkills, SKILL_KEYS }, itens, { PasswordStore }] = await Promise.all([
    importar('js/models/player.js'), importar('shared/skills.js'), importar('shared/items.js'), importar('js/net/passwords.js')
  ]);
  const ferramentasDoJogo = { Player, newSkills, SKILL_KEYS, FOOD_MAX_SECONDS: itens.FOOD_MAX_SECONDS, EQUIP_SLOTS: itens.EQUIP_SLOTS };
  fs.mkdirSync(pasta, { recursive: true });
  const arquivoPersonagens = path.join(pasta, 'characters.json');
  let personagens = {};
  try {
    personagens = JSON.parse(fs.readFileSync(arquivoPersonagens, 'utf8')) || {};
  } catch {
    personagens = {};
  }
  const senhas = new PasswordStore(path.join(pasta, 'passwords.json'));
  for (const [nome, modelo] of Object.entries(PERSONAGENS)) {
    personagens[nome.toLowerCase()] = JSON.parse(JSON.stringify(await montarPersonagem(nome, modelo, ferramentasDoJogo)));
    delete senhas.entries[nome.toLowerCase()];
    await senhas.claim(nome, senha);
  }
  fs.writeFileSync(arquivoPersonagens, JSON.stringify(personagens, null, 2));
  return Object.keys(PERSONAGENS);
}

// ================================================================================================================================================================================================================================================
// principal

async function principal() {
  const args = process.argv.slice(2);
  const iSenha = args.indexOf('--senha');
  const senha = iSenha >= 0 ? args[iSenha + 1] : SENHA_PADRAO;
  const pasta = args.find((a, i) => !a.startsWith('--') && (iSenha < 0 || i !== iSenha + 1))
    || (process.env.JOGO_PERSONAGENS ? path.dirname(process.env.JOGO_PERSONAGENS) : path.join(RAIZ, 'data'));
  const nomes = await criar(path.resolve(pasta), senha);
  console.log(`✅ ${nomes.join(', ')} criados em ${path.resolve(pasta)} (senha: ${senha})`);
}

if (require.main === module) principal();

module.exports = { criar, PERSONAGENS };
