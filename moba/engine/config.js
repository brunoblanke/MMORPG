// moba/engine/config.js

// ================================================================================================================================================================================================================================================
// Números do MOBA (tudo em tiles e segundos): campo, partida, heróis (uma vocação cada),
// minions e estruturas. O campo é aberto, com movimento livre; cada time tem 4 heróis
// (knight, paladin, sorcerer e druid), 2 torres e um nexus.

export const TICK_MS = 50;
export const ARENA = { width: 100, height: 30 };
export const TEAMS = ['blue', 'red'];
export const VOCATIONS = ['knight', 'paladin', 'sorcerer', 'druid'];
export const WAVE = { first: 6, every: 25, melee: 3, ranged: 1 };
export const RESPAWN = { base: 6, perLevel: 2 };
export const MAX_LEVEL = 15;
export const GOLD = { start: 300, perSecond: 2, minion: 20, hero: 150, tower: 200 };
export const XP = { minion: 40, hero: 120, shareRadius: 10 };
export const FOUNTAIN = { radius: 6, hpRegen: 40, manaRegen: 40 };

export const HEROES = {
  knight: {
    name: 'Knight', hp: 720, hpPerLevel: 85, mana: 160, manaPerLevel: 12, speed: 4.2, radius: 0.5,
    range: 1.6, damage: 40, damagePerLevel: 4.5, cooldown: 0.9, missile: null, element: 'physical',
    armor: 30, magicResist: 15, hpRegen: 2.5, manaRegen: 2,
    abilities: [
      { name: 'Berserk', kind: 'around', cooldown: 6, mana: 40, radius: 2.4, damage: 90, damagePerLevel: 9, element: 'physical', effect: 'explosion' },
      { name: 'Charge', kind: 'dash', cooldown: 9, mana: 50, distance: 6, radius: 1.6, damage: 60, damagePerLevel: 6, element: 'physical', effect: 'poff' },
      { name: 'Haste', kind: 'haste', cooldown: 14, mana: 60, seconds: 3, factor: 1.45, effect: 'poff' }
    ]
  },
  paladin: {
    name: 'Paladin', hp: 540, hpPerLevel: 65, mana: 240, manaPerLevel: 18, speed: 4, radius: 0.45,
    range: 7, damage: 36, damagePerLevel: 4, cooldown: 1, missile: 'arrow', element: 'physical',
    armor: 20, magicResist: 15, hpRegen: 2, manaRegen: 2.5,
    abilities: [
      { name: 'Power Shot', kind: 'line', cooldown: 6, mana: 50, length: 12, width: 1.2, damage: 120, damagePerLevel: 12, element: 'physical', missile: 'arrow', effect: 'poff' },
      { name: 'Explosive Arrow', kind: 'ball', cooldown: 8, mana: 70, range: 8, radius: 2, damage: 100, damagePerLevel: 10, element: 'fire', missile: 'burst-arrow', effect: 'explosion' },
      { name: 'Haste', kind: 'haste', cooldown: 14, mana: 60, seconds: 3, factor: 1.4, effect: 'poff' }
    ]
  },
  sorcerer: {
    name: 'Sorcerer', hp: 450, hpPerLevel: 52, mana: 420, manaPerLevel: 30, speed: 3.9, radius: 0.45,
    range: 6.5, damage: 38, damagePerLevel: 4.5, cooldown: 1.1, missile: 'fire', element: 'fire',
    armor: 12, magicResist: 20, hpRegen: 1.6, manaRegen: 4,
    abilities: [
      { name: 'Fireball', kind: 'ball', cooldown: 5, mana: 60, range: 8, radius: 1.6, damage: 110, damagePerLevel: 11, element: 'fire', missile: 'fire', effect: 'fire' },
      { name: 'Energy Wave', kind: 'cone', cooldown: 7, mana: 70, length: 6, halfAngle: 0.6, damage: 100, damagePerLevel: 10, element: 'energy', effect: 'energy' },
      { name: 'Great Fireball', kind: 'ball', cooldown: 12, mana: 140, range: 7, radius: 3.4, damage: 170, damagePerLevel: 15, element: 'fire', missile: 'fire', effect: 'fire' }
    ]
  },
  druid: {
    name: 'Druid', hp: 480, hpPerLevel: 58, mana: 400, manaPerLevel: 28, speed: 3.9, radius: 0.45,
    range: 6.5, damage: 32, damagePerLevel: 4, cooldown: 1.1, missile: 'earth', element: 'earth',
    armor: 15, magicResist: 22, hpRegen: 1.8, manaRegen: 4,
    abilities: [
      { name: 'Ice Strike', kind: 'ball', cooldown: 5, mana: 50, range: 8, radius: 1.2, damage: 90, damagePerLevel: 9, element: 'ice', missile: 'ice', effect: 'ice', slow: { factor: 0.6, seconds: 2 } },
      { name: 'Intense Healing', kind: 'heal', cooldown: 8, mana: 80, range: 7, amount: 160, amountPerLevel: 16, effect: 'heal' },
      { name: 'Terra Wave', kind: 'cone', cooldown: 9, mana: 90, length: 6.5, halfAngle: 0.5, damage: 110, damagePerLevel: 11, element: 'earth', effect: 'earth', slow: { factor: 0.7, seconds: 1.5 } }
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
