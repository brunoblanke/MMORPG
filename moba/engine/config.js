// moba/engine/config.js

// ================================================================================================================================================================================================================================================
// Números do MOBA (tudo em tiles e segundos): campo, partida, heróis (uma vocação cada),
// minions e estruturas. O campo é aberto, com movimento livre; cada time tem 4 heróis
// (knight, paladin, sorcerer e druid), 2 torres e um nexus.

export const TICK_MS = 50;
export const ARENA = { width: 120, height: 60 };
export const TEAMS = ['blue', 'red'];
export const VOCATIONS = ['knight', 'paladin', 'sorcerer', 'druid'];
export const WAVE = { first: 6, every: 25, melee: 3, ranged: 1 };
export const RESPAWN = { base: 6, perLevel: 2 };
export const MAX_LEVEL = 15;
export const GOLD = { start: 300, perSecond: 2, minion: 20, hero: 150, tower: 200 };
export const XP = { minion: 40, hero: 120, shareRadius: 10 };
export const FOUNTAIN = { radius: 7, hpRegen: 40, manaRegen: 40 };
export const ULTIMATE_LEVEL = 6;
export const MAX_ITEMS = 6;

export const HEROES = {
  knight: {
    name: 'Knight', hp: 720, hpPerLevel: 85, mana: 160, manaPerLevel: 12, speed: 4.2, radius: 0.5,
    range: 1.6, damage: 40, damagePerLevel: 4.5, cooldown: 0.9, missile: null, element: 'physical',
    armor: 30, magicResist: 15, hpRegen: 2.5, manaRegen: 2,
    abilities: [
      { name: 'Berserk', kind: 'around', cooldown: 6, mana: 40, radius: 2.4, damage: 90, damagePerLevel: 9, element: 'physical', effect: 'explosion' },
      { name: 'Charge', kind: 'dash', cooldown: 9, mana: 50, distance: 6, radius: 1.6, damage: 60, damagePerLevel: 6, element: 'physical', effect: 'poff' },
      { name: 'Haste', kind: 'haste', cooldown: 14, mana: 60, seconds: 3, factor: 1.45, effect: 'poff' },
      { name: 'Fierce Stomp', kind: 'around', cooldown: 60, mana: 120, radius: 4.2, damage: 220, damagePerLevel: 20, element: 'physical', effect: 'explosion', stun: 1.5, unlock: ULTIMATE_LEVEL }
    ]
  },
  paladin: {
    name: 'Paladin', hp: 540, hpPerLevel: 65, mana: 240, manaPerLevel: 18, speed: 4, radius: 0.45,
    range: 7, damage: 36, damagePerLevel: 4, cooldown: 1, missile: 'arrow', element: 'physical',
    armor: 20, magicResist: 15, hpRegen: 2, manaRegen: 2.5,
    abilities: [
      { name: 'Power Shot', kind: 'line', cooldown: 6, mana: 50, length: 12, width: 1.2, damage: 120, damagePerLevel: 12, element: 'physical', missile: 'arrow', effect: 'poff' },
      { name: 'Explosive Arrow', kind: 'ball', cooldown: 8, mana: 70, range: 8, radius: 2, damage: 100, damagePerLevel: 10, element: 'fire', missile: 'burst-arrow', effect: 'explosion' },
      { name: 'Haste', kind: 'haste', cooldown: 14, mana: 60, seconds: 3, factor: 1.4, effect: 'poff' },
      { name: 'Sudden Death', kind: 'line', cooldown: 65, mana: 150, length: 18, width: 1.6, damage: 300, damagePerLevel: 25, element: 'death', missile: 'sudden-death', effect: 'death', unlock: ULTIMATE_LEVEL }
    ]
  },
  sorcerer: {
    name: 'Sorcerer', hp: 450, hpPerLevel: 52, mana: 420, manaPerLevel: 30, speed: 3.9, radius: 0.45,
    range: 6.5, damage: 38, damagePerLevel: 4.5, cooldown: 1.1, missile: 'fire', element: 'fire',
    armor: 12, magicResist: 20, hpRegen: 1.6, manaRegen: 4,
    abilities: [
      { name: 'Fireball', kind: 'ball', cooldown: 5, mana: 60, range: 8, radius: 1.6, damage: 110, damagePerLevel: 11, element: 'fire', missile: 'fire', effect: 'fire' },
      { name: 'Energy Wave', kind: 'cone', cooldown: 7, mana: 70, length: 6, halfAngle: 0.6, damage: 100, damagePerLevel: 10, element: 'energy', effect: 'energy' },
      { name: 'Great Fireball', kind: 'ball', cooldown: 12, mana: 140, range: 7, radius: 3.4, damage: 170, damagePerLevel: 15, element: 'fire', missile: 'fire', effect: 'fire' },
      { name: "Hell's Core", kind: 'around', cooldown: 70, mana: 260, radius: 5.2, damage: 290, damagePerLevel: 26, element: 'fire', effect: 'fire', unlock: ULTIMATE_LEVEL }
    ]
  },
  druid: {
    name: 'Druid', hp: 480, hpPerLevel: 58, mana: 400, manaPerLevel: 28, speed: 3.9, radius: 0.45,
    range: 6.5, damage: 32, damagePerLevel: 4, cooldown: 1.1, missile: 'earth', element: 'earth',
    armor: 15, magicResist: 22, hpRegen: 1.8, manaRegen: 4,
    abilities: [
      { name: 'Ice Strike', kind: 'ball', cooldown: 5, mana: 50, range: 8, radius: 1.2, damage: 90, damagePerLevel: 9, element: 'ice', missile: 'ice', effect: 'ice', slow: { factor: 0.6, seconds: 2 } },
      { name: 'Intense Healing', kind: 'heal', cooldown: 8, mana: 80, range: 7, amount: 160, amountPerLevel: 16, effect: 'heal' },
      { name: 'Terra Wave', kind: 'cone', cooldown: 9, mana: 90, length: 6.5, halfAngle: 0.5, damage: 110, damagePerLevel: 11, element: 'earth', effect: 'earth', slow: { factor: 0.7, seconds: 1.5 } },
      { name: 'Mass Healing', kind: 'massHeal', cooldown: 60, mana: 200, radius: 7, amount: 260, amountPerLevel: 24, effect: 'heal', unlock: ULTIMATE_LEVEL }
    ]
  }
};

export const MINIONS = {
  melee: { creature: 'troll', hp: 320, speed: 3, radius: 0.45, range: 1.4, damage: 22, cooldown: 1, armor: 10, aggro: 6, missile: null },
  ranged: { creature: 'orc-spearman', hp: 220, speed: 3, radius: 0.45, range: 5, damage: 26, cooldown: 1.2, armor: 5, aggro: 7, missile: 'spear' }
};

export const STRUCTURES = {
  tower: { hp: 1800, radius: 1.1, range: 7.5, damage: 75, cooldown: 1.2, armor: 40, missile: 'energy' },
  nexus: { hp: 3200, radius: 1.8, range: 0, damage: 0, cooldown: 1, armor: 40, missile: null }
};

export const BUFFS = {
  dragon: { name: 'Fúria do Dragão', seconds: 180, attack: 1.15, power: 1.15, speed: 1 },
  demon: { name: 'Pressa do Demon', seconds: 180, attack: 1, power: 1, speed: 1.15 }
};

export const NEUTRALS = {
  wolf: { creature: 'wolf', hp: 240, damage: 22, range: 1.4, cooldown: 1, speed: 3.6, radius: 0.45, armor: 5, gold: 25, xp: 40, respawn: 60, first: 30, missile: null },
  bear: { creature: 'bear', hp: 460, damage: 36, range: 1.5, cooldown: 1.1, speed: 3.2, radius: 0.55, armor: 15, gold: 45, xp: 70, respawn: 70, first: 35, missile: null },
  minotaur: { creature: 'minotaur', hp: 1150, damage: 62, range: 1.7, cooldown: 1.2, speed: 3.2, radius: 0.6, armor: 25, gold: 95, xp: 150, respawn: 90, first: 45, missile: null },
  cyclops: { creature: 'cyclops', hp: 950, damage: 56, range: 1.7, cooldown: 1.2, speed: 3, radius: 0.6, armor: 20, gold: 85, xp: 130, respawn: 90, first: 45, missile: null },
  dragon: { creature: 'dragon', hp: 5200, damage: 120, range: 6, cooldown: 1.6, speed: 2.6, radius: 1, armor: 40, gold: 250, xp: 300, respawn: 300, first: 180, missile: 'fire', buff: 'dragon' },
  demon: { creature: 'demon', hp: 6500, damage: 140, range: 1.9, cooldown: 1.4, speed: 2.8, radius: 1, armor: 45, gold: 250, xp: 300, respawn: 300, first: 240, missile: null, buff: 'demon' }
};

export const CAMPS = [
  { id: 'wolves-w', type: 'wolf', count: 2, x: 28, y: 12 }, { id: 'bear-w', type: 'bear', count: 1, x: 48, y: 17 },
  { id: 'minotaur', type: 'minotaur', count: 1, x: 72, y: 11 }, { id: 'cyclops-e', type: 'cyclops', count: 1, x: 92, y: 15 },
  { id: 'dragon', type: 'dragon', count: 1, x: 60, y: 8 },
  { id: 'wolves-e', type: 'wolf', count: 2, x: 92, y: 48 }, { id: 'bear-e', type: 'bear', count: 1, x: 72, y: 43 },
  { id: 'minotaur-s', type: 'minotaur', count: 1, x: 48, y: 49 }, { id: 'cyclops-w', type: 'cyclops', count: 1, x: 28, y: 45 },
  { id: 'demon', type: 'demon', count: 1, x: 60, y: 52 }
];

export const ITEMS = {
  'short-sword': { name: 'Short Sword', icon: 'itens/espadas/short-sword', cost: 300, stats: { attack: 10 } },
  'giant-sword': { name: 'Giant Sword', icon: 'itens/espadas/giant-sword', cost: 900, stats: { attack: 28 } },
  'fire-axe': { name: 'Fire Axe', icon: 'itens/machados/fire-axe', cost: 1100, stats: { attack: 32, hp: 80 } },
  'spellbook': { name: 'Spellbook', icon: 'itens/spellbooks/spellbook', cost: 450, stats: { power: 20 } },
  'wand-of-inferno': { name: 'Wand of Inferno', icon: 'itens/wands/wand-of-inferno', cost: 1000, stats: { power: 40, mana: 120 } },
  'crown-helmet': { name: 'Crown Helmet', icon: 'itens/capacetes/crown-helmet', cost: 500, stats: { armor: 12, hp: 90 } },
  'crown-armor': { name: 'Crown Armor', icon: 'itens/armaduras/crown-armor', cost: 800, stats: { armor: 28 } },
  'dragon-shield': { name: 'Dragon Shield', icon: 'itens/escudos/dragon-shield', cost: 950, stats: { armor: 22, hp: 160 } },
  'blue-robe': { name: 'Blue Robe', icon: 'itens/armaduras/blue-robe', cost: 700, stats: { magicResist: 28, mana: 60 } },
  'stone-skin-amulet': { name: 'Stone Skin Amulet', icon: 'itens/amuletos-e-colares/stone-skin-amulet', cost: 550, stats: { magicResist: 20, hp: 70 } },
  'boots-of-haste': { name: 'Boots of Haste', icon: 'itens/botas/boots-of-haste', cost: 550, stats: { speed: 0.7 } },
  'life-ring': { name: 'Life Ring', icon: 'itens/aneis/life-ring', cost: 350, stats: { hpRegen: 3, hp: 60 } },
  'might-ring': { name: 'Might Ring', icon: 'itens/aneis/might-ring', cost: 600, stats: { attackSpeed: 25, attack: 6 } },
  'health-potion': { name: 'Health Potion', icon: 'itens/liquidos/health-potion', cost: 70, consumable: { hp: 220 }, stats: {} },
  'mana-potion': { name: 'Mana Potion', icon: 'itens/liquidos/mana-potion', cost: 60, consumable: { mana: 180 }, stats: {} }
};
export const POTION_COOLDOWN = 8;
