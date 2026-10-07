// js/views/spell-simulator.js

import { loadAssets, listAssets, getAsset, creaturePowers, displayName, RESISTANCE_ELEMENTS } from '../../shared/assets.js';
import { SPELLS, RUNES, WANDS } from '../../shared/spells.js';
import { EFFECTS, MISSILES, effectUrl, missileUrl, missileDirection } from '../../shared/effects.js';
import { ARENA_WIDTH, ARENA_HEIGHT, layoutFor, planCreatureAttack, planSpell, planRune, planAmmo, planWand } from '../../shared/spell-plan.js';

const TILE = 32;
const PAD = 1;
const MISSILE_MS = 280;
const FIELD_MS = 200;
const FLOOR = 'estrutura/pisos/piso-metal-1';
const TARGET = 'criaturas/humanos/dummy';
const PLAYER_SHEETS = ['personagens/players/player-masculino', 'personagens/players/player-feminino'];
const ROW = { leste: 2, oeste: 3 };
const PLAYER_KINDS = [['spell', 'Spells'], ['rune', 'Runes'], ['ammo', 'Ammo'], ['wand', 'Wands and Rods']];
const HIDDEN_SPELL_KINDS = ['conjure', 'ammo', 'light', 'haste'];
const SHAPES = [['shot', 'Strike'], ['ball', 'Ball'], ['wave', 'Wave'], ['beam', 'Beam'], ['cross', 'Cross'], ['ring', 'Ring'], ['around', 'Surrounding'], ['sweep', 'Sweep'], ['field', 'Field'], ['chain', 'Chain'], ['slow', 'Slow'], ['heal', 'Heal']];
const FIELDS = ['itens/itens-encantados/fire-field', 'itens/itens-encantados/poison-field', 'itens/itens-encantados/energy-field'];
const USED_BY_SHAPE = {
  shot: ['element'], ball: ['element', 'center', 'radius'], ring: ['element', 'center', 'radius'], cross: ['element'], around: ['element'], sweep: ['element'],
  wave: ['element', 'length', 'spread'], beam: ['element', 'length'], chain: ['element', 'jumps'], field: ['field', 'radius'], slow: [], heal: []
};
const NUMBERS = [['radius', 'Radius', 1, 6], ['length', 'Length', 8, 12], ['spread', 'Spread', 3, 6]];

const form = document.getElementById('simForm');
const fieldsBox = document.getElementById('simFields');
const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const images = new Map();
const state = { who: 'creature', cast: null };
let creatures = [];

// ================================================================================================================================================================================================================================================
// loadImage
// A imagem de uma folha do gerador (guardada).

function loadImage(url) {
  if (!images.has(url)) {
    const image = new Image();
    image.src = url;
    images.set(url, image);
  }
  return images.get(url);
}

// ================================================================================================================================================================================================================================================
// title

function title(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ================================================================================================================================================================================================================================================
// select
// O HTML de um select com as opções [valor, texto].

function select(id, label, options) {
  return `<label>${label}<select id="${id}">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></label>`;
}

// ================================================================================================================================================================================================================================================
// value
// O valor do campo do formulário.

function value(id) {
  const field = document.getElementById(id);
  return field ? field.value : '';
}

// ================================================================================================================================================================================================================================================
// usedFields
// Os campos que a forma usa (os outros nem aparecem).

function usedFields(shape) {
  return USED_BY_SHAPE[shape] || [];
}

// ================================================================================================================================================================================================================================================
// shapeFields
// Os campos da forma escolhida: só o que ela usa.

function shapeFields(shape) {
  const used = usedFields(shape);
  const only = (name, html) => (used.includes(name) ? html : '');
  return only('element', select('simElement', 'Element', RESISTANCE_ELEMENTS.map(item => [item, title(item)])))
    + only('center', select('simCenter', 'Center', [['target', 'On the target'], ['self', 'On the caster']]))
    + only('field', select('simField', 'Field', FIELDS.map(item => [item, displayName(item)])))
    + NUMBERS.map(([key, label, fallback, max]) => only(key, `<label>${label}<input id="sim_${key}" type="number" min="0" max="${max}" value="${fallback}"></label>`)).join('')
    + only('jumps', select('simJumps', 'Chain jumps to', [['1', '1 target'], ['2', '2 targets'], ['3', '3 targets']]));
}

// ================================================================================================================================================================================================================================================
// customAttack
// A magia dos campos, no formato de creaturePowers (shared/assets.js).

function customAttack() {
  const shape = value('simShape') || 'wave';
  const used = usedFields(shape);
  const number = (id, max, fallback) => Math.min(max, Math.max(0, Math.floor(Number(value(id))))) || fallback;
  return {
    shape,
    element: used.includes('element') ? (RESISTANCE_ELEMENTS.includes(value('simElement')) ? value('simElement') : 'fire') : null,
    radius: number('sim_radius', 6, 1),
    length: number('sim_length', 12, 8),
    spread: number('sim_spread', 6, 3),
    widths: [],
    center: value('simCenter') === 'self' ? 'self' : 'target',
    field: used.includes('field') ? (value('simField') || FIELDS[0]) : '',
    jumps: number('simJumps', 3, 3)
  };
}

// ================================================================================================================================================================================================================================================
// usersOf
// As criaturas que têm uma magia com essa forma (e esse elemento ou campo, quando a forma usa).

function usersOf(attack) {
  return creatures.filter(asset => creaturePowers(asset.id).attacks.some(item => sameSpell(item, attack)));
}

// ================================================================================================================================================================================================================================================
// sameSpell
// A magia item é da mesma forma, elemento e campo que attack.

function sameSpell(item, attack) {
  const used = usedFields(attack.shape);
  return item.shape === attack.shape && (!used.includes('element') || item.element === attack.element) && (!used.includes('field') || item.field === attack.field);
}

// ================================================================================================================================================================================================================================================
// loadFrom
// Põe nos campos os números da magia que a criatura tem dessa forma.

function loadFrom(creature) {
  const attack = creaturePowers(creature).attacks.find(item => sameSpell(item, customAttack()));
  if (!attack) return;
  const set = (id, number) => { const field = document.getElementById(id); if (field && number) field.value = Math.min(Number(field.max) || number, number); };
  set('sim_radius', attack.radius);
  set('sim_length', attack.length);
  set('sim_spread', attack.spread);
  set('simJumps', attack.jumps);
  const center = document.getElementById('simCenter');
  if (center) center.value = attack.center;
}

// ================================================================================================================================================================================================================================================
// entriesOf
// As opções do tipo escolhido do player: [[valor, texto]].

function entriesOf(kind) {
  if (kind === 'spell') return SPELLS.filter(spell => !HIDDEN_SPELL_KINDS.includes(spell.kind)).map(spell => [spell.words, `${spell.name} (${spell.words})`]);
  if (kind === 'rune') return Object.keys(RUNES).map(type => [type, displayName(type)]);
  if (kind === 'wand') return Object.keys(WANDS).map(type => [type, displayName(type)]);
  return listAssets('objetos', asset => asset.pasta === 'municao').map(asset => [asset.id, displayName(asset.id)]);
}

// ================================================================================================================================================================================================================================================
// renderFields
// O formulário depois da escolha Criatura ou Player: os selects que se desdobram.

function renderFields() {
  const keep = Object.fromEntries([...fieldsBox.querySelectorAll('select, input')].map(field => [field.id, field.value]));
  const restore = () => {
    for (const [id, saved] of Object.entries(keep)) {
      const field = document.getElementById(id);
      if (id !== 'simCreature' && field && (!field.options || [...field.options].some(option => option.value === saved))) field.value = saved;
    }
  };
  if (state.who === 'creature') {
    const shape = SHAPES.some(([id]) => id === keep.simShape) ? keep.simShape : 'wave';
    fieldsBox.innerHTML = select('simShape', 'Shape', SHAPES) + shapeFields(shape);
    document.getElementById('simShape').value = shape;
    const element = document.getElementById('simElement');
    if (element) element.value = 'fire';
    const jumps = document.getElementById('simJumps');
    if (jumps) jumps.value = '3';
    restore();
    const users = usersOf(customAttack());
    fieldsBox.insertAdjacentHTML('beforeend', select('simCreature', 'Creature', users.length ? users.map(asset => [asset.id, displayName(asset.id)]) : [['', 'None uses it']]));
    const creature = document.getElementById('simCreature');
    if (users.some(asset => asset.id === keep.simCreature)) creature.value = keep.simCreature;
    return;
  }
  const kind = keep.simKind || 'spell';
  fieldsBox.innerHTML = select('simKind', 'Type', PLAYER_KINDS) + select('simItem', 'Choice', entriesOf(kind));
  restore();
}

// ================================================================================================================================================================================================================================================
// planFor
// O plano da escolha atual: { layout, plan }, ou só layout (sem plano) enquanto não há o que lançar.

function planFor() {
  if (state.who === 'creature') {
    const attack = customAttack();
    return { layout: layoutFor(attack.shape), make: (layout) => planCreatureAttack(attack, layout) };
  }
  const kind = value('simKind');
  const item = value('simItem');
  const layout = layoutFor(null);
  if (kind === 'spell') return { layout, make: (at) => planSpell(SPELLS.find(spell => spell.words === item) || {}, at) };
  if (kind === 'rune') return { layout, make: (at) => planRune(item, at) };
  if (kind === 'wand') return { layout, make: (at) => planWand(item, at) };
  return { layout, make: (at) => planAmmo(item, at) };
}

// ================================================================================================================================================================================================================================================
// castNow
// Lança a escolha atual (tecla Espaço ou botão).

function castNow() {
  const { layout, make } = planFor();
  if (!make) return;
  state.cast = { start: performance.now(), plan: make(layout), layout };
}

// ================================================================================================================================================================================================================================================
// draw
// Desenha uma imagem de sheet (coluna, linha) com o canto de baixo à direita no sqm (x, y), como o jogo.

function drawFrame(asset, column, row, x, y, size = null) {
  const image = loadImage(asset.url || asset);
  if (!image.complete || !image.naturalWidth) return;
  const frame = size || asset.quadro || TILE;
  const rows = Math.max(1, Math.floor(image.naturalHeight / frame));
  const px = (x + PAD) * TILE + TILE - frame;
  const py = (y + PAD) * TILE + TILE - frame;
  ctx.drawImage(image, column * frame, Math.min(row, rows - 1) * frame, frame, frame, px, py, frame, frame);
}

// ================================================================================================================================================================================================================================================
// casterAsset
// A sprite de quem lança: a criatura escolhida ou o player.

function casterAsset() {
  if (state.who === 'creature') return getAsset(value('simCreature')) || getAsset(TARGET);
  return PLAYER_SHEETS.map(id => getAsset(id)).find(Boolean) || null;
}

// ================================================================================================================================================================================================================================================
// frame
// Um quadro da animação: o chão, os campos, quem lança, os alvos, o projétil e os efeitos.

function frame(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  const floor = getAsset(FLOOR);
  const floorImage = floor && loadImage(floor.url);
  for (let y = 0; y < ARENA_HEIGHT; y++) {
    for (let x = 0; x < ARENA_WIDTH; x++) {
      if (floorImage && floorImage.complete && floorImage.naturalWidth) ctx.drawImage(floorImage, 0, 0, TILE, TILE, (x + PAD) * TILE, (y + PAD) * TILE, TILE, TILE);
      else { ctx.fillStyle = '#555a63'; ctx.fillRect((x + PAD) * TILE, (y + PAD) * TILE, TILE, TILE); }
    }
  }
  const cast = state.cast;
  const layout = cast ? cast.layout : planFor().layout;
  for (const field of cast ? cast.plan.fields : []) {
    const asset = getAsset(field.type);
    if (!asset) continue;
    const column = Math.floor((now - cast.start) / FIELD_MS) % (asset.quadros || 1);
    for (const [x, y] of field.tiles) drawFrame(asset, column, 0, x, y);
  }
  const caster = casterAsset();
  const target = getAsset(TARGET);
  if (target) for (const spot of layout.targets) drawFrame(target, 0, ROW.oeste, spot.x, spot.y);
  if (caster) drawFrame(caster, 0, ROW.leste, layout.caster.x, layout.caster.y);
  if (cast) drawCast(cast, now);
  requestAnimationFrame(frame);
}

// ================================================================================================================================================================================================================================================
// drawCast
// Os projéteis (voam até o alvo) e, depois deles, os efeitos de cada sqm.

function drawCast(cast, now) {
  const age = now - cast.start;
  const delay = cast.plan.missiles.length ? MISSILE_MS : 0;
  for (const missile of cast.plan.missiles) {
    const info = MISSILES[missile.kind] || MISSILES.energy;
    const image = loadImage(missileUrl(MISSILES[missile.kind] ? missile.kind : 'energy'));
    if (age >= MISSILE_MS || !image.complete || !image.naturalWidth) continue;
    const t = age / MISSILE_MS;
    const [dx, dy] = missileDirection(missile.to[0] - missile.from[0], missile.to[1] - missile.from[1]);
    const x = missile.from[0] + (missile.to[0] - missile.from[0]) * t;
    const y = missile.from[1] + (missile.to[1] - missile.from[1]) * t;
    ctx.drawImage(image, dx * info.size, dy * info.size, info.size, info.size, (x + PAD) * TILE + TILE - info.size, (y + PAD) * TILE + TILE - info.size, info.size, info.size);
  }
  for (const effect of cast.plan.effects) {
    const info = EFFECTS[effect.name];
    if (!info) continue;
    const column = Math.floor((age - delay) / info.ms);
    if (age < delay || column >= info.frames) continue;
    const image = loadImage(effectUrl(effect.name));
    if (!image.complete || !image.naturalWidth) continue;
    for (const [x, y] of effect.tiles) {
      ctx.drawImage(image, column * info.size, 0, info.size, info.size, (x + PAD) * TILE + TILE - info.size, (y + PAD) * TILE + TILE - info.size, info.size, info.size);
    }
  }
}

// ================================================================================================================================================================================================================================================
// setWho
// Criatura ou Player: marca o botão e refaz o formulário.

function setWho(who) {
  state.who = who;
  state.cast = null;
  for (const button of form.querySelectorAll('[data-who]')) button.classList.toggle('on', button.dataset.who === who);
  fieldsBox.innerHTML = '';
  renderFields();
}

// ================================================================================================================================================================================================================================================
// start

async function start() {
  await loadAssets();
  creatures = listAssets('criaturas').filter(asset => creaturePowers(asset.id).attacks.length).sort((a, b) => displayName(a.id).localeCompare(displayName(b.id)));
  canvas.width = (ARENA_WIDTH + PAD * 2) * TILE;
  canvas.height = (ARENA_HEIGHT + PAD * 2) * TILE;
  for (const button of form.querySelectorAll('[data-who]')) button.addEventListener('click', () => { setWho(button.dataset.who); button.blur(); });
  fieldsBox.addEventListener('change', (event) => {
    state.cast = null;
    const id = event.target.id;
    if (['simShape', 'simElement', 'simField', 'simKind'].includes(id)) renderFields();
    if (id === 'simShape' || id === 'simCreature') loadFrom(value('simCreature'));
    if (document.activeElement) document.activeElement.blur();
  });
  document.getElementById('simCast').addEventListener('click', () => { castNow(); document.getElementById('simCast').blur(); });
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    castNow();
  });
  setWho('creature');
  loadFrom(value('simCreature'));
  requestAnimationFrame(frame);
}

start();
