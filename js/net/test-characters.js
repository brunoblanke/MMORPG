// js/net/test-characters.js

import { Player } from '../models/player.js';
import { newSkills, SKILL_KEYS } from '../../shared/skills.js';
import { EQUIP_SLOTS, FOOD_MAX_SECONDS } from '../../shared/items.js';

// Personagens de teste (Druid, Paladin, Knight e Sorcerer): nível 100, todos os
// skills em 100 (magic level incluído), vida, mana e comida cheias, e o
// equipamento da vocação, com runas, munição e poções em pilhas de 100 dentro
// de mochilas. Criados pelo botão do editor (server.js) ou pelo script
// ferramentas/criar-personagens-teste.js.

export const TEST_PASSWORD = '123456';
const BASE = 'itens/';
const item = (tipo, count) => (count ? { type: BASE + tipo, count } : { type: BASE + tipo });
const pilhas = (tipo, vezes, quantidade = 100) => Array.from({ length: vezes }, () => item(tipo, quantidade));
const mochila = (cor, itens) => ({ type: `${BASE}recipientes/backpack-${cor}`, items: itens });
const comida = [item('comidas/dragon-ham', 100), item('comidas/ham', 100)];
const pocoes = [...pilhas('liquidos/health-potion', 2), ...pilhas('liquidos/mana-potion', 3)];
const ferramentas = [item('ferramentas/rope', 1), item('ferramentas/shovel'), item('ferramentas/pick')];
const comum = { cabeca: item('capacetes/crown-helmet'), pernas: item('calcas/crown-legs'), pes: item('botas/boots-of-haste'), amuleto: item('amuletos-e-colares/stone-skin-amulet') };

export const TEST_CHARACTERS = {
  Druid: {
    vocation: 'druid',
    equip: { ...comum, corpo: item('armaduras/blue-robe'), arma: item('rods/terra-rod'), escudo: item('spellbooks/spellbook'), anel: item('aneis/life-ring') },
    mochila: [
      mochila('cinza', [...pilhas('runas/blank-rune', 2), ...pilhas('runas/sudden-death-rune', 2), ...pilhas('runas/great-fireball-rune', 2), ...pilhas('runas/heavy-magic-missile-rune', 2), ...pilhas('runas/light-magic-missile-rune', 1), ...pilhas('runas/explosion-rune', 2)]),
      mochila('marrom', [...pilhas('runas/ultimate-healing-rune', 3), ...pilhas('runas/intense-healing-rune', 2), ...pilhas('runas/cure-poison-rune', 1), ...pilhas('runas/magic-wall-rune', 2), ...pilhas('runas/poison-field-rune', 1), ...pilhas('runas/fire-field-rune', 1), ...pilhas('runas/energy-field-rune', 1), ...pilhas('runas/fire-bomb-rune', 1)]),
      ...pocoes, ...comida, ...ferramentas
    ]
  },
  Paladin: {
    vocation: 'paladin',
    equip: { ...comum, corpo: item('armaduras/crown-armor'), arma: item('distancia/crossbow'), municao: item('municao/arrow', 100), anel: item('aneis/might-ring') },
    mochila: [
      mochila('cinza', [...pilhas('municao/arrow', 3), ...pilhas('municao/burst-arrow', 5), ...pilhas('municao/poison-arrow', 3), ...pilhas('distancia/spear', 2)]),
      mochila('marrom', [...pilhas('runas/ultimate-healing-rune', 2), ...pilhas('runas/sudden-death-rune', 2), ...pilhas('runas/great-fireball-rune', 1), ...pilhas('runas/explosion-rune', 1), ...pilhas('runas/magic-wall-rune', 1), ...pilhas('runas/blank-rune', 1)]),
      ...pocoes, ...comida, ...ferramentas
    ]
  },
  Knight: {
    vocation: 'knight',
    equip: { ...comum, corpo: item('armaduras/crown-armor'), arma: item('espadas/fire-sword'), escudo: item('escudos/dragon-shield'), anel: item('aneis/might-ring') },
    mochila: [
      item('espadas/giant-sword'), item('machados/fire-axe'), item('clavas/dragon-hammer'), item('espadas/two-handed-sword'), item('escudos/crown-shield'),
      mochila('marrom', [...pilhas('runas/ultimate-healing-rune', 2), ...pilhas('runas/sudden-death-rune', 2), ...pilhas('runas/explosion-rune', 1), ...pilhas('runas/great-fireball-rune', 1), ...pilhas('runas/magic-wall-rune', 1), ...pilhas('distancia/spear', 2)]),
      ...pocoes, ...comida, ...ferramentas
    ]
  },
  Sorcerer: {
    vocation: 'sorcerer',
    equip: { ...comum, corpo: item('armaduras/red-robe'), arma: item('wands/wand-of-inferno'), escudo: item('spellbooks/spellbook'), anel: item('aneis/life-ring') },
    mochila: [
      item('wands/wand-of-cosmic-energy'),
      mochila('cinza', [...pilhas('runas/blank-rune', 2), ...pilhas('runas/sudden-death-rune', 3), ...pilhas('runas/great-fireball-rune', 2), ...pilhas('runas/fireball-rune', 2), ...pilhas('runas/heavy-magic-missile-rune', 2), ...pilhas('runas/explosion-rune', 2)]),
      mochila('marrom', [...pilhas('runas/fire-bomb-rune', 1), ...pilhas('runas/fire-field-rune', 1), ...pilhas('runas/energy-field-rune', 1), ...pilhas('runas/poison-field-rune', 1), ...pilhas('runas/magic-wall-rune', 2), ...pilhas('runas/ultimate-healing-rune', 2)]),
      ...pocoes, ...comida, ...ferramentas
    ]
  }
};

// ================================================================================================================================================================================================================================================
// buildTestCharacter
// O personagem pronto pra gravar (o formato do characters.json), sem posição
// nem casa: ele nasce, e renasce ao morrer, no spawn do mapa.

export function buildTestCharacter(name, model) {
  const player = new Player({ id: 'teste', name, x: 0, y: 0, z: 0, lvl: 100, vocation: model.vocation });
  player.applyLevelStats();
  player.currentHp = player.hp;
  player.mana = player.maxMana;
  player.skills = newSkills();
  for (const key of ['magic', ...SKILL_KEYS]) player.skills[key] = { lvl: 100, pct: 0, tries: 0 };
  player.food = FOOD_MAX_SECONDS * 1000;
  const equip = Object.fromEntries(EQUIP_SLOTS.map(key => [key, model.equip[key] || null]));
  equip.mochila = { type: `${BASE}recipientes/backpack-azul`, items: model.mochila };
  const { x, y, z, home, ...saved } = player.toSave();
  return JSON.parse(JSON.stringify({ ...saved, equip }));
}

// ================================================================================================================================================================================================================================================
// createTestCharacters
// Põe os quatro em characters (o objeto { nome em minúsculas: personagem }) e
// define a senha deles em passwords (PasswordStore), trocando os que já
// existem. Devolve os nomes.

export async function createTestCharacters(characters, passwords, password = TEST_PASSWORD) {
  for (const [name, model] of Object.entries(TEST_CHARACTERS)) {
    characters[name.toLowerCase()] = buildTestCharacter(name, model);
    delete passwords.entries[name.toLowerCase()];
    await passwords.claim(name, password);
  }
  return Object.keys(TEST_CHARACTERS);
}
