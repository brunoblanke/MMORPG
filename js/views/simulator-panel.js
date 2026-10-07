// js/views/simulator-panel.js

import { listAssets, creaturePowers, displayName } from '../../shared/assets.js';
import { SPELLS, RUNES, WANDS } from '../../shared/spells.js';
import { CUSTOM_SHAPES, CUSTOM_FIELDS } from '../systems/simulator.js';

const CATEGORIES = [
  ['custom', 'Build your own'],
  ['creature', 'Creature attacks'],
  ['spell', 'Player spells'],
  ['rune', 'Runes'],
  ['ammo', 'Ammunition'],
  ['wand', 'Wands and rods']
];
const ELEMENTS = ['physical', 'fire', 'energy', 'poison', 'ice', 'earth', 'death', 'holy'];
const CUSTOM_NUMBERS = [['min', 'Min', 60], ['max', 'Max', 110], ['radius', 'Radius', 1], ['length', 'Length', 8], ['spread', 'Spread', 3], ['jumps', 'Players', 3]];
const DUMMY = 'criaturas/humanos/dummy';
const HIDDEN_SPELL_KINDS = ['conjure', 'ammo'];

// Painel do simulador (simulador.html): escolhe a magia
// e lança com o botão ou a tecla F2, mirando no sqm sob o mouse. O boneco de
// treino é sempre a criatura dummy.

export class SimulatorPanel {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(game) {
    this.game = game;
    this.root = document.getElementById('simPanel');
    this.category = document.getElementById('simCategory');
    this.entry = document.getElementById('simEntry');
    this.cast = document.getElementById('simCast');
    this.custom = this.buildCustom();
    this.creatures = listAssets('criaturas').map(asset => asset.id).sort();
    this.fill(this.category, CATEGORIES);
    this.fillEntries();
    this.root.hidden = false;
    this.category.addEventListener('change', () => { this.fillEntries(); this.category.blur(); });
    this.category.value = 'custom';
    this.fillEntries();
    this.entry.addEventListener('change', () => this.entry.blur());
    this.cast.addEventListener('click', () => this.fire());
    window.addEventListener('keydown', (event) => {
      if (event.key !== 'F2') return;
      event.preventDefault();
      this.fire();
    });
    const target = this.creatures.includes(DUMMY) ? DUMMY : this.creatures[0];
    if (target) this.send({ kind: 'target', id: target });
  }

  // ================================================================================================================================================================================================================================================
  // buildCustom
  // Os campos de "Build your own": forma, elemento, centro, campo e os números.

  buildCustom() {
    const box = document.createElement('div');
    box.className = 'sim-custom';
    const select = (id, label, options) => `<label>${label} <select id="${id}">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></label>`;
    const title = (text) => text.charAt(0).toUpperCase() + text.slice(1);
    box.innerHTML = select('simShape', 'Shape', CUSTOM_SHAPES.map(shape => [shape, title(shape)]))
      + select('simElement', 'Element', ELEMENTS.map(element => [element, title(element)]))
      + select('simCenter', 'Center', [['target', 'On the target'], ['self', 'On me']])
      + select('simField', 'Field', CUSTOM_FIELDS.map(field => [field, displayName(field)]))
      + CUSTOM_NUMBERS.map(([key, label, value]) => `<label>${label} <input id="sim_${key}" type="number" min="0" max="5000" value="${value}"></label>`).join('');
    document.getElementById('simCast').before(box);
    box.hidden = false;
    box.querySelector('#simShape').value = 'wave';
    box.querySelector('#simElement').value = 'poison';
    return box;
  }

  // ================================================================================================================================================================================================================================================
  // customCommand
  // O comando da magia montada nos campos.

  customCommand() {
    const read = (id) => this.custom.querySelector(`#${id}`).value;
    const attack = { shape: read('simShape'), element: read('simElement'), center: read('simCenter'), field: read('simField') };
    for (const [key] of CUSTOM_NUMBERS) attack[key] = Number(read(`sim_${key}`));
    return { kind: 'custom', attack };
  }

  // ================================================================================================================================================================================================================================
  // fill
  // Põe as opções [valor, texto] no select.

  fill(select, options) {
    select.innerHTML = options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('');
  }

  // ================================================================================================================================================================================================================================================
  // entriesOf
  // As opções da categoria: [{ value, label, command }].

  entriesOf(category) {
    if (category === 'creature') {
      return this.creatures.flatMap(id => creaturePowers(id).attacks.map((attack, index) => ({
        value: `${id}#${index}`,
        label: `${displayName(id)} — ${this.attackLabel(attack)}`,
        command: { kind: 'creature', id, index }
      })));
    }
    if (category === 'spell') {
      return SPELLS.filter(spell => !HIDDEN_SPELL_KINDS.includes(spell.kind)).map(spell => ({ value: spell.words, label: `${spell.name} (${spell.words})`, command: { kind: 'spell', id: spell.words } }));
    }
    if (category === 'rune') return Object.keys(RUNES).map(type => ({ value: type, label: displayName(type), command: { kind: 'rune', id: type } }));
    if (category === 'wand') return Object.keys(WANDS).map(type => ({ value: type, label: displayName(type), command: { kind: 'wand', id: type } }));
    return listAssets('objetos', asset => asset.pasta === 'municao').map(asset => ({ value: asset.id, label: displayName(asset.id), command: { kind: 'ammo', id: asset.id } }));
  }

  // ================================================================================================================================================================================================================================================
  // attackLabel
  // Ex.: "Wave (fire 100–170)".

  attackLabel(attack) {
    const name = attack.shape.charAt(0).toUpperCase() + attack.shape.slice(1);
    const detail = attack.element ? `${attack.element} ${attack.min}–${attack.max}` : attack.max ? `${attack.min}–${attack.max}` : '';
    return detail ? `${name} (${detail})` : name;
  }

  // ================================================================================================================================================================================================================================================
  // fillEntries

  fillEntries() {
    const custom = this.category.value === 'custom';
    this.custom.hidden = !custom;
    this.entry.parentElement.hidden = custom;
    this.entries = custom ? [] : this.entriesOf(this.category.value);
    this.fill(this.entry, this.entries.map(entry => [entry.value, entry.label]));
  }

  // ================================================================================================================================================================================================================================================
  // send

  send(command) {
    this.game.send({ type: 'simulate', ...command });
  }

  // ================================================================================================================================================================================================================================================
  // fire
  // Lança a escolhida no sqm sob o mouse.

  fire() {
    const entry = this.category.value === 'custom' ? { command: this.customCommand() } : this.entries.find(item => item.value === this.entry.value);
    if (!entry) return;
    const hover = this.game.inputController && this.game.inputController.hoverTile;
    this.send({ ...entry.command, ...(hover ? { x: hover.x, y: hover.y } : {}) });
  }
}
