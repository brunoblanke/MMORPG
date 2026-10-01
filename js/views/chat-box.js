// js/views/chat-box.js

// Caixa de fala flutuante na base da tela (index.html #chatBox). Enter abre
// a caixa; Enter dentro dela envia (comando say) e devolve o teclado pro
// jogo; Esc fecha sem enviar. A seta no canto também envia.

export class ChatBox {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(game) {
    this.game = game;
    this.form = document.getElementById('chatBox');
    this.input = document.getElementById('chatInput');
    if (!this.form || !this.input) return;
    this.form.addEventListener('submit', (evt) => {
      evt.preventDefault();
      this.send();
    });
    this.input.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' && !evt.shiftKey) {
        evt.preventDefault();
        this.send();
        this.input.blur();
      } else if (evt.key === 'Escape') {
        this.input.blur();
      }
    });
    window.addEventListener('keydown', (evt) => {
      if (evt.key !== 'Enter' || this.isTyping(evt.target) || !this.game.session) return;
      evt.preventDefault();
      this.input.focus();
    });
  }

  // ================================================================================================================================================================================================================================================
  // isTyping
  // O foco está num campo de texto (o teclado é dele, não do jogo).

  isTyping(target) {
    const tag = target && target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  // ================================================================================================================================================================================================================================================
  // send

  send() {
    const text = this.input.value.replace(/\s+/g, ' ').trim();
    this.input.value = '';
    if (!text || !this.game.session) return;
    this.game.send({ type: 'say', text });
  }
}
