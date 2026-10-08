// ferramentas/criar-criaturas.js

// Cria no gerador as receitas das criaturas clássicas do Tibia (CLASSICAS) a
// partir do Canary (servidor open source): vida, XP, velocidade, armadura,
// defesa, ataque, comportamento (foge com runHealth, mago com targetDistance > 1,
// pacífico se não é hostil), loot (só os itens que já existem no gerador),
// magias e resistências (as mesmas regras de importar-ataques.js) e o id da
// roupa no Tibia. As folhas (.png) saem do gerador: abra a aba Criaturas e use
// "Gerar folhas pendentes". Receita que já existe fica como está (--forcar troca).
//
// Uso: node ferramentas/criar-criaturas.js <pasta do canary> [--forcar]
// (pasta com data-otservbr-global/monster, como em importar-ataques.js)

const fs = require('fs');
const path = require('path');
const { importar, linhasDe } = require('./importar-ataques.js');

const RAIZ = path.join(__dirname, '..');
const PASTA_CRIATURAS = path.join(RAIZ, 'gerador', 'projetos', 'criaturas');
const PASTA_ITENS = path.join(RAIZ, 'gerador', 'projetos', 'itens');
const CADAVER_PADRAO = { apodrecendo: 4249, ossos: 3987 };
const CORES_PADRAO = [78, 69, 58, 76];
const APELIDOS_DE_ITEM = { meat: 'meet' };

const CLASSICAS = [
  ['troll', 'humanoids', 'humanoides'], ['frost_troll', 'humanoids', 'humanoides'], ['swamp_troll', 'humanoids', 'humanoides'],
  ['goblin', 'humanoids', 'humanoides'],
  ['orc', 'humanoids', 'humanoides'], ['orc_warrior', 'humanoids', 'humanoides'], ['orc_shaman', 'humanoids', 'humanoides'],
  ['orc_spearman', 'humanoids', 'humanoides'], ['orc_berserker', 'humanoids', 'humanoides'], ['orc_leader', 'humanoids', 'humanoides'],
  ['dwarf', 'humanoids', 'humanoides'], ['dwarf_soldier', 'humanoids', 'humanoides'], ['dwarf_guard', 'humanoids', 'humanoides'], ['dwarf_geomancer', 'humanoids', 'humanoides'],
  ['elf', 'humanoids', 'humanoides'], ['elf_scout', 'humanoids', 'humanoides'],
  ['minotaur', 'humanoids', 'humanoides'], ['minotaur_archer', 'humanoids', 'humanoides'], ['minotaur_mage', 'humanoids', 'humanoides'], ['minotaur_guard', 'humanoids', 'humanoides'],
  ['cyclops', 'giants', 'gigantes'], ['cyclops_drone', 'giants', 'gigantes'], ['cyclops_smith', 'giants', 'gigantes'],
  ['dragon', 'dragons', 'dragoes'], ['dragon_lord', 'dragons', 'dragoes'], ['dragon_hatchling', 'dragons', 'dragoes'], ['wyvern', 'reptiles', 'dragoes'],
  ['ghoul', 'undeads', 'mortos-vivos'], ['skeleton', 'undeads', 'mortos-vivos'], ['skeleton_warrior', 'undeads', 'mortos-vivos'], ['zombie', 'undeads', 'mortos-vivos'],
  ['mummy', 'undeads', 'mortos-vivos'], ['ghost', 'undeads', 'mortos-vivos'], ['bonebeast', 'undeads', 'mortos-vivos'],
  ['rabbit', 'mammals', 'mamiferos'], ['dog', 'mammals', 'mamiferos'], ['wolf', 'mammals', 'mamiferos'], ['bear', 'mammals', 'mamiferos'], ['rat', 'mammals', 'mamiferos'], ['cave_rat', 'mammals', 'mamiferos'],
  ['bug', 'vermins', 'vermes'], ['poison_spider', 'vermins', 'vermes'], ['scorpion', 'vermins', 'vermes'], ['centipede', 'vermins', 'vermes'], ['larva', 'vermins', 'vermes'], ['carrion_worm', 'vermins', 'vermes'],
  ['cobra', 'reptiles', 'repteis'], ['crocodile', 'reptiles', 'repteis'],
  ['amazon', 'humans', 'humanos'], ['valkyrie', 'humans', 'humanos'], ['hunter', 'humans', 'humanos'], ['witch', 'humans', 'humanos'],
  ['necromancer', 'humans', 'humanos'], ['bandit', 'humans', 'humanos'], ['dark_monk', 'humans', 'humanos'],
  ['stone_golem', 'constructs', 'constructos'], ['fire_devil', 'demons', 'demonios'], ['gargoyle', 'magicals', 'criaturas-magicas'],
  ['crab', 'aquatics', 'aquaticos'],
  ['vampire', 'undeads', 'mortos-vivos'], ['crypt_shambler', 'undeads', 'mortos-vivos'], ['demon_skeleton', 'undeads', 'mortos-vivos'], ['lich', 'undeads', 'mortos-vivos'],
  ['goblin_scavenger', 'humanoids', 'humanoides'], ['orc_rider', 'humanoids', 'humanoides'], ['orc_warlord', 'humanoids', 'humanoides'], 
  
  
  ['frost_giant', 'giants', 'gigantes'], ['frost_giantess', 'giants', 'gigantes'], ['behemoth', 'giants', 'gigantes'],
  ['tarantula', 'vermins', 'vermes'], ['ancient_scarab', 'vermins', 'vermes'], ['sandcrawler', 'vermins', 'vermes'], ['giant_spider', 'vermins', 'vermes'],
  ['polar_bear', 'mammals', 'mamiferos'], ['mammoth', 'mammals', 'mamiferos'], ['panda', 'mammals', 'mamiferos'], ['boar', 'mammals', 'mamiferos'],
  ['wild_warrior', 'humans', 'humanos'], ['pirate_cutthroat', 'humans', 'humanos'], ['pirate_buccaneer', 'humans', 'humanos'], ['pirate_corsair', 'humans', 'humanos'],
  ['assassin', 'humans', 'humanos'], ['dark_apprentice', 'humans', 'humanos'],
  ['water_elemental', 'elementals', 'elementais'], ['earth_elemental', 'elementals', 'elementais'], ['energy_elemental', 'elementals', 'elementais'],
  ['massive_fire_elemental', 'elementals', 'elementais'], ['massive_water_elemental', 'elementals', 'elementais'],
  ['massive_earth_elemental', 'elementals', 'elementais'], ['massive_energy_elemental', 'elementals', 'elementais'],
  ['hellhound', 'demons', 'demonios'], ['hydra', 'dragons', 'dragoes'], ['ghastly_dragon', 'dragons', 'dragoes'],
  ['lizard_templar', 'reptiles', 'repteis'], 
];

// ================================================================================================================================================================================================================================================
// itensDoGerador
// Os itens que existem no gerador: { nome com hífen: 'itens/pasta/nome' }.

function itensDoGerador() {
  const itens = {};
  for (const pasta of fs.readdirSync(PASTA_ITENS)) {
    const dir = path.join(PASTA_ITENS, pasta);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const arquivo of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const nome = arquivo.replace(/\.json$/, '');
      itens[nome] = `itens/${pasta}/${nome}`;
    }
  }
  return itens;
}

// ================================================================================================================================================================================================================================================
// numero
// O número da chave no texto (monster.<chave> = 12), ou o padrão.

function numero(texto, chave, padrao = 0) {
  const achado = texto.match(new RegExp(`${chave}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`));
  return achado ? Number(achado[1]) : padrao;
}

// ================================================================================================================================================================================================================================================
// lootDoCanary
// O loot do monstro só com os itens que o gerador tem: [{ tipo, chance, min, max }].

function lootDoCanary(texto, itens) {
  const loot = [];
  for (const linha of linhasDe(texto, 'loot')) {
    if (!linha.name) continue;
    const nome = linha.name.toLowerCase().replace(/\s+/g, '-');
    const tipo = itens[APELIDOS_DE_ITEM[nome] || nome];
    const chance = Number(linha.chance) / 100000;
    if (!tipo || !(chance > 0)) continue;
    const entrada = { tipo, chance: Math.min(1, Number(chance.toFixed(5))) };
    const maximo = Number(linha.maxCount) || 0;
    if (maximo > 1) Object.assign(entrada, { min: Number(linha.minCount) || 1, max: maximo });
    loot.push(entrada);
  }
  return loot.sort((a, b) => b.chance - a.chance);
}

// ================================================================================================================================================================================================================================================
// receitaDoMonstro
// A receita de criatura (formato do gerador) do arquivo .lua do Canary.

function receitaDoMonstro(texto, pasta, nome, itens) {
  const { ataques, resistencias } = importar(texto);
  const look = (campo) => numero(texto, campo);
  const cores = [look('lookHead'), look('lookBody'), look('lookLegs'), look('lookFeet')];
  const corpo = numero(texto, 'monster.corpse');
  const melee = linhasDe(texto, 'attacks').filter(linha => linha.name === 'melee').map(linha => Math.abs(Number(linha.maxDamage)) || 0);
  const alcance = numero(texto, 'targetDistance', 1);
  const foge = numero(texto, 'runHealth', 0) > 0;
  const hostil = !/hostile\s*=\s*false/.test(texto);
  const comportamento = !hostil ? 'pacifico' : alcance > 1 ? 'mago' : foge ? 'foge' : 'normal';
  const bloco = texto.slice(texto.indexOf('monster.defenses = {'));
  const propriedades = {
    comportamento,
    vida: numero(texto, 'monster.health'),
    xp: numero(texto, 'monster.experience'),
    velocidade: numero(texto, 'monster.speed') * 2,
    armadura: numero(bloco, 'armor'),
    defesa: numero(bloco, 'defense'),
    ataque: Math.max(0, ...melee),
    loot: lootDoCanary(texto, itens)
  };
  if (ataques.length) propriedades.ataques = ataques;
  if (Object.keys(resistencias).length) propriedades.resistencias = resistencias;
  return {
    formato: { quadro: 64, quadros: 9, linhas: ['sul', 'norte', 'leste', 'oeste', 'cadáver: fresco, apodrecendo, ossos'] },
    criatura: { id: numero(texto, 'lookType'), cores: cores.some(Boolean) ? cores : CORES_PADRAO, addons: [] },
    cadaver: {
      fresco: { tibia: { id: corpo, variacao: 0 } },
      apodrecendo: { tibia: { id: CADAVER_PADRAO.apodrecendo, variacao: 0 } },
      ossos: { tibia: { id: CADAVER_PADRAO.ossos, variacao: 0 } }
    },
    ferramenta: 'criaturas',
    grupo: 'criaturas',
    pasta,
    nome: nome.replace(/_/g, '-'),
    propriedades
  };
}

// ================================================================================================================================================================================================================================================
// principal

function principal() {
  const raiz = process.argv[2] ? path.join(process.argv[2], 'data-otservbr-global', 'monster') : null;
  if (!raiz || !fs.existsSync(raiz)) {
    console.error('Uso: node ferramentas/criar-criaturas.js <pasta do canary> [--forcar]');
    process.exit(1);
  }
  const forcar = process.argv.includes('--forcar');
  const itens = itensDoGerador();
  let criadas = 0;
  for (const [arquivo, categoria, pasta] of CLASSICAS) {
    const nome = arquivo.replace(/_/g, '-');
    const destino = path.join(PASTA_CRIATURAS, pasta, `${nome}.json`);
    const origem = path.join(raiz, categoria, `${arquivo}.lua`);
    if (!fs.existsSync(origem)) {
      console.log(`⚠️  ${nome}: não achei ${categoria}/${arquivo}.lua`);
      continue;
    }
    if (fs.existsSync(destino) && !forcar) {
      console.log(`↷  ${nome}: já existe, ficou como está`);
      continue;
    }
    const receita = receitaDoMonstro(fs.readFileSync(origem, 'utf8'), pasta, arquivo, itens);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, JSON.stringify(receita, null, 2) + '\n');
    criadas++;
    const p = receita.propriedades;
    console.log(`✅ ${nome} (${pasta}): vida ${p.vida}, xp ${p.xp}, ${p.comportamento}, ${p.loot.length} itens, ${(p.ataques || []).length} magia(s)`);
  }
  console.log(`${criadas} receita(s) criada(s). Falta gerar as folhas: gerador → Criaturas → "Gerar folhas pendentes".`);
}

if (require.main === module) principal();

module.exports = { receitaDoMonstro, itensDoGerador, CLASSICAS };
