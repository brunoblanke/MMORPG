// js/views/player-menu.js

import { getLevel } from '../core/geometry.js';

// Botão direito em outro player na tela do jogo: um menu com o que dá pra
// fazer com ele (atacar, party, troca, mensagem privada e VIP). Fecha com
// Esc, clicando fora ou escolhendo uma opção.

export class PlayerMenu {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(game) {
    this.game = game;
    this.el = null;
    document.addEventListener('mousedown', (evt) => {
      if (this.el && !this.el.contains(/** @type {Node} */ (evt.target))) this.close();
    }, true);
    window.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape') this.close();
    });
  }

  // ================================================================================================================================================================================================================================================
  // playerAtMouse
  // O outro player no sqm sob o mouse, no andar do player.

  playerAtMouse() {
    const session = this.game.session;
    const me = this.game.player;
    const tile = this.game.inputController && this.game.inputController.hoverTile;
    if (!session || !me || !tile) return null;
    return session.players.find(p => p.id !== me.id && p.x === tile.x && p.y === tile.y && getLevel(p) === getLevel(me)) || null;
  }

  // ================================================================================================================================================================================================================================================
  // openAt
  // Abre o menu do player sob o mouse; devolve false se não tem ninguém ali.

  openAt(evt) {
    const other = this.playerAtMouse();
    if (!other) return false;
    const me = this.game.player;
    const social = (this.game.session.inventoryView && this.game.session.inventoryView.social) || { party: [], invites: [], vip: [] };
    const inMyParty = social.party.some(m => m.id === other.id);
    const iLead = !social.party.length || social.party.some(m => m.id === me.id && m.leader);
    const options = [];
    if (!inMyParty) options.push(me.target && me.target.id === other.id ? ['Parar de atacar', { type: 'attack', targetId: null }] : ['Atacar', { type: 'attack', targetId: other.id }]);
    if (social.invites.some(i => i.id === other.id)) options.push(['Entrar na party', { type: 'partyJoin', leaderId: other.id }]);
    else if (!inMyParty && iLead) options.push(['Convidar pra party', { type: 'partyInvite', targetId: other.id }]);
    if (social.party.length) options.push(['Sair da party', { type: 'partyLeave' }]);
    options.push(['Trocar itens', { type: 'tradeOpen', targetId: other.id }]);
    options.push(['Mensagem privada', 'message']);
    if (!social.vip.some(v => v.name.toLowerCase() === other.name.toLowerCase())) options.push(['Adicionar à VIP', { type: 'vipAdd', name: other.name }]);
    this.show(evt, other, options);
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // show

  show(evt, other, options) {
    this.close();
    const el = document.createElement('div');
    el.className = 'player-menu';
    const title = document.createElement('div');
    title.className = 'player-menu-title';
    title.textContent = other.name;
    el.appendChild(title);
    for (const [label, action] of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.onclick = () => {
        this.close();
        if (action === 'message') this.game.chatBox.writeTo(other.name);
        else this.game.send(action);
      };
      el.appendChild(btn);
    }
    document.body.appendChild(el);
    el.style.left = `${Math.min(evt.clientX, window.innerWidth - el.offsetWidth - 8)}px`;
    el.style.top = `${Math.min(evt.clientY, window.innerHeight - el.offsetHeight - 8)}px`;
    this.el = el;
  }

  // ================================================================================================================================================================================================================================================
  // close

  close() {
    if (this.el) this.el.remove();
    this.el = null;
  }
}
