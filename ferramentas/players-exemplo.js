// ferramentas/players-exemplo.js

// Cria 4 personagens de nível 100 pra testar, um de cada vocação, com os
// skills de quem chegou nesse nível e o equipamento da vocação: Cavaleiro
// (knight), Arqueira (paladin), Feiticeiro (sorcerer) e Druida (druid).
// Entram no data/characters.json (ou no arquivo de JOGO_PERSONAGENS); quem
// já existe com o mesmo nome é trocado. Pode rodar com o servidor ligado,
// mas com esses 4 personagens fora do jogo (quem está online é gravado por
// cima ao sair).
//
// Uso: node ferramentas/players-exemplo.js

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ARQUIVO = process.env.JOGO_PERSONAGENS || path.join(RAIZ, 'data', 'characters.json');
const MAPA = process.env.JOGO_MAPA || path.join(RAIZ, 'data', 'map.json');
const NIVEL = 100;

const item = (type, extra = {}) => ({ type, ...extra });
const pilha = (type, count) => ({ type, count });
const mochila = (itens) => ({ type: 'itens/recipientes/backpack-verde', items: [...itens, ...new Array(20 - itens.length).fill(null)] });
const runa = (type, charges) => ({ type, charges });

const PERSONAGENS = [
  {
    name: 'Cavaleiro', gender: 'male', vocation: 'knight',
    skills: { magic: 9, fist: 40, club: 80, sword: 85, axe: 80, distance: 30, shielding: 82, fishing: 20 },
    equip: {
      cabeca: item('itens/capacetes/crown-helmet'), corpo: item('itens/armaduras/knight-armor'), pernas: item('itens/calcas/knight-legs'),
      pes: item('itens/botas/leather-boots'), arma: item('itens/espadas/fire-sword'), escudo: item('itens/escudos/dragon-shield'),
      amuleto: item('itens/amuletos-e-colares/stone-skin-amulet'), anel: item('itens/aneis/life-ring'),
      mochila: mochila([pilha('itens/liquidos/health-potion', 50), pilha('itens/liquidos/health-potion', 50), pilha('itens/comidas/ham', 20),
        item('itens/ferramentas/rope'), item('itens/ferramentas/shovel'), pilha('itens/valiosos/platinum-coin', 50)])
    }
  },
  {
    name: 'Arqueira', gender: 'female', vocation: 'paladin',
    skills: { magic: 20, fist: 30, club: 30, sword: 30, axe: 30, distance: 90, shielding: 70, fishing: 20 },
    equip: {
      cabeca: item('itens/capacetes/steel-helmet'), corpo: item('itens/armaduras/plate-armor'), pernas: item('itens/calcas/plate-legs'),
      pes: item('itens/botas/leather-boots'), arma: item('itens/distancia/crossbow'), municao: pilha('itens/municao/arrow', 100),
      amuleto: item('itens/amuletos-e-colares/elven-amulet'), anel: item('itens/aneis/ring-of-healing'),
      mochila: mochila([pilha('itens/municao/arrow', 100), pilha('itens/municao/poison-arrow', 100), pilha('itens/municao/burst-arrow', 100),
        pilha('itens/distancia/spear', 20), pilha('itens/liquidos/health-potion', 50), pilha('itens/liquidos/mana-potion', 30),
        pilha('itens/comidas/ham', 20), item('itens/ferramentas/rope'), pilha('itens/valiosos/platinum-coin', 50)])
    }
  },
  {
    name: 'Feiticeiro', gender: 'male', vocation: 'sorcerer',
    skills: { magic: 70, fist: 15, club: 15, sword: 15, axe: 15, distance: 15, shielding: 30, fishing: 20 },
    equip: {
      corpo: item('itens/armaduras/blue-robe'), pernas: item('itens/calcas/leather-legs'), pes: item('itens/botas/boots-of-haste'),
      arma: item('itens/wands/wand-of-inferno'), escudo: item('itens/spellbooks/spellbook'),
      amuleto: item('itens/amuletos-e-colares/platinum-amulet'), anel: item('itens/aneis/time-ring'),
      mochila: mochila([runa('itens/runas/sudden-death-rune', 3), runa('itens/runas/sudden-death-rune', 3), runa('itens/runas/great-fireball-rune', 4),
        runa('itens/runas/great-fireball-rune', 4), runa('itens/runas/explosion-rune', 6), runa('itens/runas/magic-wall-rune', 4),
        runa('itens/runas/fire-bomb-rune', 2), runa('itens/runas/ultimate-healing-rune', 1), runa('itens/runas/ultimate-healing-rune', 1),
        item('itens/runas/blank-rune'), item('itens/runas/blank-rune'), item('itens/runas/blank-rune'),
        pilha('itens/liquidos/mana-potion', 50), pilha('itens/comidas/ham', 20), item('itens/ferramentas/rope'), pilha('itens/valiosos/platinum-coin', 50)])
    }
  },
  {
    name: 'Druida', gender: 'female', vocation: 'druid',
    skills: { magic: 70, fist: 15, club: 15, sword: 15, axe: 15, distance: 15, shielding: 30, fishing: 20 },
    equip: {
      corpo: item('itens/armaduras/red-robe'), pernas: item('itens/calcas/leather-legs'), pes: item('itens/botas/sandals'),
      arma: item('itens/rods/terra-rod'), escudo: item('itens/spellbooks/spellbook'),
      amuleto: item('itens/amuletos-e-colares/silver-amulet'), anel: item('itens/aneis/ring-of-healing'),
      mochila: mochila([runa('itens/runas/ultimate-healing-rune', 1), runa('itens/runas/ultimate-healing-rune', 1), runa('itens/runas/ultimate-healing-rune', 1),
        runa('itens/runas/intense-healing-rune', 1), runa('itens/runas/cure-poison-rune', 1), runa('itens/runas/great-fireball-rune', 4),
        runa('itens/runas/heavy-magic-missile-rune', 5), runa('itens/runas/poison-field-rune', 3), runa('itens/runas/energy-field-rune', 3),
        item('itens/runas/blank-rune'), item('itens/runas/blank-rune'), item('itens/runas/blank-rune'),
        pilha('itens/liquidos/mana-potion', 50), pilha('itens/comidas/ham', 20), item('itens/ferramentas/rope'), pilha('itens/valiosos/platinum-coin', 50)])
    }
  }
];

// ================================================================================================================================================================================================================================================
// lerJson

function lerJson(arquivo, padrao) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  } catch {
    return padrao;
  }
}

// ================================================================================================================================================================================================================================================
// salvar
// Grava os personagens no começo do mapa (spawn), com vida e mana cheias
// (o jogo calcula pelo nível e pela vocação ao entrar).

function salvar() {
  const personagens = lerJson(ARQUIVO, {});
  const spawn = (lerJson(MAPA, {}).spawn) || { x: 132, y: 145, z: 0 };
  for (const p of PERSONAGENS) {
    const skills = Object.fromEntries(Object.entries(p.skills).map(([key, lvl]) => [key, { lvl, pct: 0, tries: 0 }]));
    personagens[p.name.toLowerCase()] = {
      name: p.name, gender: p.gender, lvl: NIVEL, xp: 0, vocation: p.vocation,
      home: { x: spawn.x, y: spawn.y, z: spawn.z }, x: spawn.x, y: spawn.y, z: spawn.z,
      skills, equip: p.equip, food: 600000, followMode: true, attackMode: false
    };
    console.log(`✅ ${p.name} (${p.vocation}, nível ${NIVEL})`);
  }
  fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
  fs.writeFileSync(ARQUIVO, JSON.stringify(personagens, null, 2), 'utf8');
  console.log(`💾 ${ARQUIVO}`);
}

salvar();
