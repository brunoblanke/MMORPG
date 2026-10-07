// tests/spell-plan.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setAssets } from '../shared/assets.js';
import { layoutFor, planCreatureAttack, planSpell, planRune, planAmmo, planWand, ARENA_WIDTH, ARENA_HEIGHT, CASTER, DISTANCE, CHAIN_RANGE } from '../shared/spell-plan.js';
import { SPELLS } from '../shared/spells.js';

const BURST = 'itens/municao/burst-arrow';
const asset = (id, propriedades) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta: 'objetos', grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([asset(BURST, { move: true, empilhavel: true, impacto: { tipo: 'area', raio: 1, efeito: 'explosion' } }), asset('itens/municao/arrow', { move: true, empilhavel: true }), asset('itens/municao/poison-arrow', { move: true, empilhavel: true, impacto: { tipo: 'veneno', dano: 3, ticks: 6 } })]);

const blank = { range: 0, radius: 0, length: 0, spread: 0, widths: [], center: 'target', field: '', jumps: 3 };
const tilesOf = (plan) => plan.effects.flatMap(effect => effect.tiles);
const inArena = ([x, y]) => x >= 0 && x < ARENA_WIDTH && y >= 0 && y < ARENA_HEIGHT;

test('simulador: quem lança e o alvo ficam a 7 sqm das bordas; beam e chain têm cópias 1 sqm a oeste cada, na linha ou 1 sqm ao norte e ao sul', () => {
  const single = layoutFor('wave');
  assert.equal(single.caster.x, 7);
  assert.deepEqual(single.targets, [{ x: ARENA_WIDTH - 1 - 7, y: CASTER.y }]);
  assert.equal(ARENA_HEIGHT, 9);
  const x = single.targets[0].x;
  const beam = layoutFor('beam');
  assert.deepEqual(beam.targets, [{ x, y: CASTER.y }, { x: x - 1, y: CASTER.y }, { x: x - 2, y: CASTER.y }]);
  const chain = layoutFor('chain');
  const base = CASTER.x + CHAIN_RANGE;
  assert.deepEqual(chain.targets.map(t => [t.x, t.y]).sort(), [[base - 1, CASTER.y - 1], [base, CASTER.y], [base - 2, CASTER.y + 1]].sort());
  assert.ok(chain.targets.every(t => Math.max(Math.abs(t.x - CASTER.x), Math.abs(t.y - CASTER.y)) <= CHAIN_RANGE));
  assert.equal(DISTANCE, 5);
});

test('simulador: surrounding e sweep têm o alvo colado, e wave e beam o põem a length sqm à frente', () => {
  const around = layoutFor('around');
  assert.deepEqual(around.targets, [{ x: CASTER.x + 1, y: CASTER.y }]);
  const sweep = layoutFor('sweep');
  assert.deepEqual(sweep.targets.map(t => [t.x - CASTER.x, t.y - CASTER.y]).sort(), [[1, -1], [1, 0], [1, 1]].sort());
  assert.deepEqual(layoutFor('wave', 3).targets, [{ x: CASTER.x + 3, y: CASTER.y }]);
  assert.deepEqual(layoutFor('beam', 4).targets.map(t => t.x), [CASTER.x + 4, CASTER.x + 3, CASTER.x + 2]);
  assert.deepEqual(layoutFor('wave', 8).targets, [{ x: CASTER.x + DISTANCE, y: CASTER.y }]);
  assert.deepEqual(layoutFor('beam', 12).targets.map(t => t.x), [CASTER.x + DISTANCE, CASTER.x + DISTANCE - 1, CASTER.x + DISTANCE - 2]);
  assert.deepEqual(layoutFor('beam', 2).targets.map(t => t.x), [CASTER.x + 2, CASTER.x + 1]);
});

test('simulador: onda, raio e bola de criatura saem pra leste e ficam dentro do campo', () => {
  const layout = layoutFor('wave');
  const wave = planCreatureAttack({ ...blank, shape: 'wave', element: 'poison', length: 8, spread: 3 }, layout);
  assert.equal(wave.effects[0].name, 'poison');
  assert.ok(wave.effects[0].tiles.every(([x]) => x > CASTER.x) && wave.effects[0].tiles.every(inArena));
  const beam = planCreatureAttack({ ...blank, shape: 'beam', element: 'fire', length: 8 }, layoutFor('beam'));
  assert.deepEqual(beam.effects[0].tiles, [8, 9, 10, 11, 12, 13, 14, 15].map(x => [x, CASTER.y]));
  const ball = planCreatureAttack({ ...blank, shape: 'ball', element: 'death', radius: 2 }, layout);
  assert.equal(ball.effects[0].tiles.length, 21);
  assert.equal(ball.missiles.length, 1);
  const self = planCreatureAttack({ ...blank, shape: 'ball', element: 'fire', radius: 2, center: 'self' }, layout);
  assert.equal(self.missiles.length, 0);
});

test('simulador: a corrente passa por todos os alvos, o campo vira sprite no alvo e a runa de campo lança o projétil', () => {
  const chain = planCreatureAttack({ ...blank, shape: 'chain', element: 'energy', jumps: 3 }, layoutFor('chain'));
  assert.ok(chain.effects[0].tiles.length >= 5);
  const field = planCreatureAttack({ ...blank, shape: 'field', field: 'itens/itens-encantados/fire-field', radius: 1 }, layoutFor('field'));
  assert.equal(field.fields[0].tiles.length, 9);
  const rune = planRune('itens/runas/fire-field-rune', layoutFor(null));
  assert.equal(rune.missiles[0].kind, 'fire');
});

test('simulador: magias, runas, munição e wands do player mostram o projétil e a área certos', () => {
  const layout = layoutFor(null);
  const flame = planSpell(SPELLS.find(spell => spell.words === 'exori flam'), layout);
  assert.equal(flame.missiles[0].kind, 'fire');
  const hell = planSpell(SPELLS.find(spell => spell.words === 'exevo gran mas flam'), layout);
  assert.ok(hell.effects[0].tiles.every(inArena) && hell.effects[0].tiles.length > 40);
  assert.equal(planRune('itens/runas/great-fireball-rune', layout).effects[0].tiles.length, 37);
  assert.equal(planRune('itens/runas/fire-bomb-rune', layout).fields[0].tiles.length, 9);
  assert.equal(planAmmo(BURST, layout).effects[0].tiles.length, 9);
  assert.equal(planAmmo('itens/municao/arrow', layout).effects.length, 0);
  assert.equal(planAmmo('itens/municao/poison-arrow', layout).effects[0].name, 'poison');
  assert.equal(planWand('itens/wands/wand-of-inferno', layout).missiles[0].kind, 'fire');
});
