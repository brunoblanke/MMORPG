// js/views/chat-box.js

// Caixa de fala flutuante na base da tela (index.html #chatBox). Começar a
// digitar (qualquer letra, número ou símbolo) ou Enter abre a caixa com o
// que foi digitado; as setas continuam andando. Enter dentro dela envia
// (comando say) e devolve o teclado pro jogo; Esc fecha sem enviar. A seta
// no canto também envia. *nome* texto manda a mensagem só pra esse player.

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
      if (this.isTyping(evt.target) || !this.game.session || evt.ctrlKey || evt.metaKey || evt.altKey) return;
      if (evt.key === 'Enter') {
        evt.preventDefault();
        this.input.focus();
      } else if (evt.key.length === 1) {
        this.input.focus();
      }
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
    const privateTo = text.match(/^\*([^*]+)\*\s*(.+)$/);
    if (privateTo) this.game.send({ type: 'privateMessage', to: privateTo[1].trim(), text: privateTo[2] });
    else this.game.send({ type: 'say', text });
  }

  // ================================================================================================================================================================================================================================================
  // writeTo
  // Abre a caixa já com *nome* (mensagem privada pra ele).

  writeTo(name) {
    const input = /** @type {HTMLInputElement} */ (this.input);
    if (!input) return;
    input.value = `*${name}* `;
    input.focus();
  }
}
