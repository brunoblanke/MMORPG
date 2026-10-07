// shared/spell-plan.js

import { circleArea, AREAS, RUNES, WANDS } from './spells.js';
import { MISSILES } from './effects.js';
import { FIELDS } from './conditions.js';
import { itemInfo } from './items.js';
import { AROUND, ringArea, lineTiles, waveOffsets, beamOffsets, sweepOffsets } from './spell-areas.js';

// O que o simulador (simulador.html) desenha pra cada magia: os projéteis, os
// efeitos e os campos, em sqms do campo de ARENA_WIDTH × ARENA_HEIGHT. Quem lança
// fica sempre virado pra leste e os alvos pra oeste. Não há jogo por trás: só a
// forma e a animação de cada magia.
// { missiles: [{ from, to, kind }], effects: [{ tiles, name }], fields: [{ type, tiles }] }

export const ARENA_WIDTH = 20;
export const ARENA_HEIGHT = 10;
export const CASTER = { x: 5, y: 4 };
export const CASTER_FACING = 'leste';
const TARGET_X = ARENA_WIDTH - 1 - 5;

// ================================================================================================================================================================================================================================================
// layoutFor
// Onde ficam quem lança e os alvos: um alvo, uma fileira de 3 pro raio (beam) e 3 levemente desalinhados pra corrente (chain).

export function layoutFor(shape) {
  const y = CASTER.y;
  let targets = [{ x: TARGET_X, y }];
  if (shape === 'beam') targets = [{ x: TARGET_X - 2, y }, { x: TARGET_X - 1, y }, { x: TARGET_X, y }];
  if (shape === 'chain') targets = [{ x: TARGET_X - 3, y: y - 1 }, { x: TARGET_X, y: y + 1 }, { x: TARGET_X + 3, y: y - 1 }];
  return { caster: { ...CASTER }, targets };
}

// ================================================================================================================================================================================================================================================
// around
// Os sqms do campo a partir de center com os deslocamentos de offsets.

function around(center, offsets) {
  return offsets.map(([dx, dy]) => [center.x + dx, center.y + dy])
    .filter(([x, y]) => x >= 0 && x < ARENA_WIDTH && y >= 0 && y < ARENA_HEIGHT);
}

// ================================================================================================================================================================================================================================================
// plan
// Um plano vazio com o que for dado.

function plan({ missiles = [], effects = [], fields = [] } = {}) {
  return { missiles, effects: effects.filter(effect => effect.name && effect.tiles.length), fields };
}

// ================================================================================================================================================================================================================================================
// missileTo
// O projétil de quem lança até o alvo.

function missileTo(layout, kind) {
  const target = layout.targets[0];
  return { from: [layout.caster.x, layout.caster.y], to: [target.x, target.y], kind };
}

// ================================================================================================================================================================================================================================================
// planCreatureAttack
// A magia de criatura (a forma de creaturePowers, shared/assets.js) lançada por quem está em layout.caster.

export function planCreatureAttack(attack, layout) {
  const { caster } = layout;
  const target = layout.targets[0];
  const kind = attack.element || (FIELDS[attack.field] && FIELDS[attack.field].kind);
  const self = attack.center === 'self';
  const shape = attack.shape;
  if (shape === 'heal') return plan({ effects: [{ name: 'heal', tiles: around(caster, [[0, 0]]) }] });
  if (shape === 'wave') return plan({ effects: [{ name: attack.element, tiles: around(caster, waveOffsets(attack, CASTER_FACING)) }] });
  if (shape === 'beam') return plan({ effects: [{ name: attack.element, tiles: around(caster, beamOffsets(attack, CASTER_FACING)) }] });
  if (shape === 'sweep') return plan({ effects: [{ name: attack.element, tiles: around(caster, sweepOffsets(CASTER_FACING)) }] });
  if (shape === 'around') return plan({ effects: [{ name: attack.element, tiles: around(caster, AROUND) }] });
  if (shape === 'chain') {
    const tiles = [];
    let from = caster;
    for (const next of layout.targets.slice(0, Math.max(1, attack.jumps))) {
      tiles.push(...lineTiles(from, next));
      from = next;
    }
    return plan({ effects: [{ name: attack.element, tiles: around({ x: 0, y: 0 }, tiles) }] });
  }
  if (shape === 'slow') return plan({ effects: [{ name: 'poff', tiles: around(target, [[0, 0]]) }] });
  if (shape === 'ball' || shape === 'ring') {
    const area = shape === 'ball' ? circleArea(attack.radius) : ringArea(attack.radius);
    return plan({ missiles: self ? [] : [missileTo(layout, kind)], effects: [{ name: attack.element, tiles: around(self ? caster : target, area) }] });
  }
  if (shape === 'cross') return plan({ missiles: [missileTo(layout, kind)], effects: [{ name: attack.element, tiles: around(target, AREAS.cross) }] });
  if (shape === 'field') return plan({ missiles: [missileTo(layout, kind)], fields: [{ type: attack.field, tiles: around(target, attack.radius > 0 ? circleArea(attack.radius) : AREAS.single) }] });
  return plan({ missiles: [missileTo(layout, kind)], effects: [{ name: attack.element, tiles: around(target, AREAS.single) }] });
}

// ================================================================================================================================================================================================================================================
// planSpell
// A magia dita do player (shared/spells.js).

export function planSpell(spell, layout) {
  const { caster } = layout;
  const target = layout.targets[0];
  if (spell.kind === 'heal' || spell.kind === 'cure') return plan({ effects: [{ name: 'heal', tiles: around(caster, [[0, 0]]) }] });
  if (spell.kind === 'strike') return plan({ missiles: [missileTo(layout, spell.element)], effects: [{ name: spell.element, tiles: around(target, AREAS.single) }] });
  if (spell.kind === 'blast') return plan({ effects: [{ name: spell.effect, tiles: around(caster, AREAS[spell.area].filter(([dx, dy]) => dx || dy)) }] });
  if (spell.kind === 'around') return plan({ effects: [{ name: 'poff', tiles: around(caster, AROUND) }] });
  return plan();
}

// ================================================================================================================================================================================================================================================
// planRune
// A runa usada no alvo.

export function planRune(type, layout) {
  const rune = RUNES[type];
  const target = layout.targets[0];
  if (!rune) return plan();
  const missile = missileTo(layout, rune.missile || rune.element);
  if (rune.kind === 'attack') return plan({ missiles: [missile], effects: [{ name: rune.effect, tiles: around(target, AREAS.single) }] });
  if (rune.kind === 'area') return plan({ missiles: [missile], effects: [{ name: rune.effect, tiles: around(target, AREAS[rune.area]) }] });
  if (rune.kind === 'field') return plan({ fields: [{ type: rune.field, tiles: around(target, AREAS[rune.area]) }] });
  return plan({ effects: [{ name: rune.effect || 'heal', tiles: around(target, AREAS.single) }] });
}

// ================================================================================================================================================================================================================================================
// squareArea
// O quadrado de raio r (radius 1 = 3×3).

function squareArea(r) {
  const tiles = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) tiles.push([dx, dy]);
  }
  return tiles;
}

// ================================================================================================================================================================================================================================================
// planAmmo
// O tiro da munição (a flecha, a burst arrow…): o projétil e o que ela faz ao acertar (impact da receita).

export function planAmmo(type, layout) {
  const name = type.split('/').pop();
  const target = layout.targets[0];
  const impact = itemInfo(type).impact;
  const missile = missileTo(layout, MISSILES[name] ? name : 'arrow');
  if (!impact || !impact.effect && impact.kind !== 'area') return plan({ missiles: [missile] });
  const area = impact.kind === 'area' ? squareArea(impact.radius) : AREAS.single;
  return plan({ missiles: [missile], effects: [{ name: impact.effect || 'explosion', tiles: around(target, area) }] });
}

// ================================================================================================================================================================================================================================================
// planWand
// O tiro da wand ou rod.

export function planWand(type, layout) {
  const wand = WANDS[type];
  const target = layout.targets[0];
  if (!wand) return plan();
  return plan({ missiles: [missileTo(layout, wand.element)], effects: [{ name: wand.element, tiles: around(target, AREAS.single) }] });
}
