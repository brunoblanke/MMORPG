// js/views/simulator-panel.js

import { listAssets, creaturePowers, displayName } from '../../shared/assets.js';
import { SPELLS, RUNES, WANDS } from '../../shared/spells.js';

const CATEGORIES = [
  ['creature', 'Creature attacks'],
  ['spell', 'Player spells'],
  ['rune', 'Runes'],
  ['ammo', 'Ammunition'],
  ['wand', 'Wands and rods']
];
const HIDDEN_SPELL_KINDS = ['conjure', 'ammo'];

// Painel do simulador (simulador.html): escolhe o boneco de treino e a magia
// e lança com o botão ou a barra de espaço, mirando no sqm sob o mouse.

export class SimulatorPanel {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(game) {
    this.game = game;
    this.root = document.getElementById('simPanel');
    this.target = document.getElementById('simTarget');
    this.category = document.getElementById('simCategory');
    this.entry = document.getElementById('simEntry');
    this.cast = document.getElementById('simCast');
    this.creatures = listAssets('criaturas').map(asset => asset.id).sort();
    this.fill(this.target, this.creatures.map(id => [id, displayName(id)]));
    this.fill(this.category, CATEGORIES);
    this.fillEntries();
    this.root.hidden = false;
    this.target.addEventListener('change', () => { this.send({ kind: 'target', id: this.target.value }); this.target.blur(); });
    this.category.addEventListener('change', () => { this.fillEntries(); this.category.blur(); });
    this.entry.addEventListener('change', () => this.entry.blur());
    this.cast.addEventListener('click', () => this.fire());
    window.addEventListener('keydown', (event) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (event.code !== 'Space' || tag === 'TEXTAREA' || tag === 'INPUT') return;
      event.preventDefault();
      this.fire();
    });
    const first = this.creatures.find(id => id.endsWith('/dragon')) || this.creatures[0];
    if (first) {
      this.target.value = first;
      this.send({ kind: 'target', id: first });
    }
  }

  // ================================================================================================================================================================================================================================================
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
    this.entries = this.entriesOf(this.category.value);
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
    const entry = this.entries.find(item => item.value === this.entry.value);
    if (!entry) return;
    const hover = this.game.inputController && this.game.inputController.hoverTile;
    this.send({ ...entry.command, ...(hover ? { x: hover.x, y: hover.y } : {}) });
  }
}
