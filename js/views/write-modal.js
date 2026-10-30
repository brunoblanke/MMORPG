// js/views/write-modal.js

import { itemInfo } from '../../shared/items.js';
import { displayName } from '../../shared/assets.js';

// Janela de escrever (markup em index.html, #writeModal): usar uma carta em branco ou uma etiqueta abre com o
// destinatário (e, na carta, a mensagem) que já está escrito; "Escrever" manda o comando writeItem, Cancelar ou Esc
// fecha (systems/mail.js).

export class WriteModal {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(game) {
    this.game = game;
    this.root = document.getElementById('writeModal');
    this.to = document.getElementById('writeTo');
    this.text = document.getElementById('writeText');
    this.from = null;
    this.then = null;
    document.getElementById('writeForm').addEventListener('submit', (evt) => {
      evt.preventDefault();
      if (this.from) this.game.send({ type: 'writeItem', from: this.from, para: this.to.value, texto: this.text.hidden ? '' : this.text.value });
      if (this.from && this.then && this.to.value.trim()) this.game.send(this.then);
      this.close();
    });
    document.getElementById('writeCancel').addEventListener('click', () => this.close());
    this.root.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape') this.close();
    });
  }

  // ================================================================================================================================================================================================================================================
  // open
  // from = onde está o item (como no useItem); item = o que a tela sabe dele (para e texto já escritos); then = o
  // comando que vai depois de escrever (jogar na caixa de correio de novo, quando ela pediu o destinatário).

  open(from, item, then = null) {
    const letter = itemInfo(item.type).writes === 'carta';
    this.from = from;
    this.then = then;
    document.getElementById('writeTitle').textContent = displayName(item.type);
    this.to.value = item.para || '';
    this.text.value = letter ? item.texto || '' : '';
    this.text.hidden = !letter;
    this.root.hidden = false;
    this.to.focus();
  }

  // ================================================================================================================================================================================================================================================
  // close

  close() {
    this.from = null;
    this.then = null;
    this.root.hidden = true;
  }
}
