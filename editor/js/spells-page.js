// editor/js/spells-page.js

import { circleArea, AREAS, SPELLS, RUNES, WANDS, SPELL_RANGE, RUNE_RANGE, WAND_RANGE } from '../../shared/spells.js';

const AROUND = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const ELEMENT_ICONS = { fire: '🔥', energy: '⚡', earth: '🌿', ice: '❄️', death: '💀', physical: '💥', holy: '✨', poison: '☠️' };

// ================================================================================================================================================================================================================================================
// ringArea
// The ring of radius r (tiles r tiles from the center, no middle).

function ringArea(r) {
  const tiles = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.hypot(dx, dy);
      if (d >= r - 0.5 && d < r + 0.5) tiles.push([dx, dy]);
    }
  }
  return tiles;
}

// ================================================================================================================================================================================================================================================
// waveArea
// The fan in front (to the right): widths per row, or growing from 1 up to 2 × spread + 1.

function waveArea(length, spread, widths = []) {
  const tiles = [];
  for (let ry = -length; ry <= length; ry++) {
    for (let rx = 1; rx <= length; rx++) {
      const half = widths.length ? (widths[Math.min(widths.length, rx) - 1] - 1) / 2 : Math.min(spread, Math.floor(rx / 2));
      if (Math.abs(ry) <= half + 0.5) tiles.push([rx, ry]);
    }
  }
  return tiles;
}

// ================================================================================================================================================================================================================================================
// lineArea
// A straight line of n tiles to the right.

function lineArea(n) {
  return Array.from({ length: n }, (_, i) => [i + 1, 0]);
}

// ================================================================================================================================================================================================================================================
// figure
// A grid of w × h tiles with the caster at (cx, cy); hit is the list of [dx, dy] from the origin
// (the caster, or the target when dist is given), marks the emojis by [dx, dy] from the caster.

function figure({ title, text, w, h, cx, cy, hit, origin = [0, 0], marks = {}, tone = 'hit', self = '🐉' }) {
  const keys = new Set(hit.map(([dx, dy]) => `${cx + origin[0] + dx},${cy + origin[1] + dy}`));
  let cells = '';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const isSelf = x === cx && y === cy;
      const mark = isSelf ? self : marks[`${x - cx},${y - cy}`] || '';
      cells += `<i class="cell${keys.has(`${x},${y}`) ? ` ${tone}` : ''}${isSelf ? ' self' : ''}">${mark}</i>`;
    }
  }
  return `<figure><div class="grid" style="grid-template-columns:repeat(${w},22px)">${cells}</div><figcaption><b>${title}</b><br>${text}</figcaption></figure>`;
}

// ================================================================================================================================================================================================================================================
// aimed
// A spell that lands on a target dist tiles away.

function aimed(title, text, dist, area, w = 12, h = 9) {
  return figure({ title, text, w, h, cx: 1, cy: Math.floor(h / 2), hit: area, origin: [dist, 0], marks: { [`${dist},0`]: '🎯' } });
}

// ================================================================================================================================================================================================================================================
// creatureShapes
// The attack shapes a creature can have (Creatures tab of the generator).

function creatureShapes() {
  return [
    aimed('Strike', 'Hits one target within range. Needs a clear line.', 7, AREAS.single, 11, 5),
    aimed('Ball', 'Explodes on the target and hits the area around it (radius 1: 3×3 tiles).', 7, circleArea(1), 11, 7),
    aimed('Ball (radius 2)', 'Explodes on the target: 21 tiles.', 8, circleArea(2), 13, 9),
    aimed('Great Ball (radius 3)', 'Explodes on the target: 37 tiles (like the great fireball).', 8, circleArea(3), 14, 9),
    aimed('Cross', 'The target tile and the 4 tiles beside it.', 6, AREAS.cross, 11, 7),
    aimed('Ring on target', 'A ring of radius 2 around the target.', 8, ringArea(2), 13, 9),
    aimed('Field', 'Creates a fire, poison or energy field on the target tile (or the area around it).', 6, AREAS.single, 11, 5),
    figure({ title: 'Wave', text: 'A fan in front of the creature: length 8, spread 3 (dragon). Only cast when a player is inside it.', w: 11, h: 9, cx: 1, cy: 4, hit: waveArea(8, 3) }),
    figure({ title: 'Wave (widths)', text: 'Each row has its own width, e.g. 1-3-3-5-5.', w: 9, h: 7, cx: 1, cy: 3, hit: waveArea(5, 0, [1, 3, 3, 5, 5]) }),
    figure({ title: 'Beam', text: 'A straight line of N tiles in front of the creature.', w: 11, h: 3, cx: 1, cy: 1, hit: lineArea(8) }),
    figure({ title: 'Sweep', text: 'The 3 tiles right in front of the creature.', w: 5, h: 5, cx: 1, cy: 2, hit: [[1, -1], [1, 0], [1, 1]] }),
    figure({ title: 'Surrounding', text: 'The 8 tiles around the creature.', w: 7, h: 7, cx: 3, cy: 3, hit: AROUND }),
    figure({ title: 'Ring', text: 'A ring of radius 3 around the creature.', w: 9, h: 9, cx: 4, cy: 4, hit: ringArea(3) }),
    figure({ title: 'Ball on self', text: 'A ball centered on the creature itself (radius 2).', w: 7, h: 7, cx: 3, cy: 3, hit: circleArea(2) }),
    figure({ title: 'Chain Spell', text: 'Hits the first player and jumps to the nearest player from there, up to N players.', w: 13, h: 5, cx: 1, cy: 2, hit: lineArea(11), tone: 'hit-chain', marks: { '4,0': '🧙', '8,0': '🧙', '11,0': '🧙' } }),
    figure({ title: 'Slow', text: 'Slows the player down for a few seconds. No damage.', w: 7, h: 5, cx: 1, cy: 2, hit: [[4, 0]], tone: 'hit-slow', marks: { '4,0': '🐌' } }),
    figure({ title: 'Heal', text: 'The creature recovers life, when wounded.', w: 3, h: 3, cx: 1, cy: 1, hit: [[0, 0]], tone: 'hit-heal', self: '💚' }),
    figure({ title: 'Parry (Reflect)', text: 'Gives back part of the damage taken to the attacker.', w: 3, h: 3, cx: 1, cy: 1, hit: [[0, 0]], tone: 'hit-slow', self: '🛡️' })
  ].join('');
}

// ================================================================================================================================================================================================================================================
// playerAreas
// The areas of runes and spells of the players.

function playerAreas() {
  return [
    aimed('Single', 'One tile: attack runes, fields, healing.', 4, AREAS.single, 11, 5),
    aimed('Cross', 'The target tile and the 4 tiles beside it.', 5, AREAS.cross, 11, 7),
    aimed('Square (3×3)', 'Explosion and Fire Bomb.', 5, AREAS.square, 11, 7),
    aimed('Circle (37)', 'Great Fireball.', 6, AREAS.circle, 13, 9),
    aimed('Big (radius 5)', "Hell's Core.", 8, AREAS.big, 15, 13),
    figure({ title: 'Berserk', text: 'The 8 tiles around the knight.', w: 7, h: 7, cx: 3, cy: 3, hit: AROUND, self: '⚔️' })
  ].join('');
}

// ================================================================================================================================================================================================================================================
// table
// A table from a header and the rows.

function table(head, rows) {
  return `<table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
}

// ================================================================================================================================================================================================================================================
// icon

function icon(element) {
  return element ? `${ELEMENT_ICONS[element] || ''} ${element}` : '';
}

// ================================================================================================================================================================================================================================================
// render

function render() {
  const spells = SPELLS.map(s => [s.words, s.name, s.lvl, s.mana, s.vocations.join(', '), `${s.kind} ${icon(s.element)}`.trim()]);
  const runes = Object.entries(RUNES).map(([type, r]) => [type.split('/').pop(), `${r.kind}${r.area ? ` (${r.area})` : ''}`, icon(r.element), r.charges, r.ml]);
  const wands = Object.entries(WANDS).map(([type, w]) => [type.split('/').pop(), icon(w.element), `${w.min}–${w.max}`, w.mana, w.lvl, w.vocations[0]]);
  document.getElementById('spellsPage').innerHTML = `
    <p>🐉 caster · 🎯 target · orange = area hit · 1 square = 1 tile. Walls cut the area in the game.</p>
    <h2>Creature attack shapes</h2><div class="wrap">${creatureShapes()}</div>
    <h2>Player spell and rune areas</h2><div class="wrap">${playerAreas()}</div>
    <h2>Player spells (said in chat; attack range ${SPELL_RANGE} tiles)</h2>
    ${table(['Words', 'Name', 'Level', 'Mana', 'Vocations', 'Type'], spells)}
    <h2>Runes (range ${RUNE_RANGE} tiles)</h2>
    ${table(['Rune', 'Effect', 'Element', 'Charges', 'Magic level'], runes)}
    <h2>Wands and rods (range ${WAND_RANGE} tiles)</h2>
    ${table(['Item', 'Element', 'Damage', 'Mana', 'Level', 'Vocation'], wands)}`;
}

render();
