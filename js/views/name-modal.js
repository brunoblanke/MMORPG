// js/views/name-modal.js

import { validateName, NAME_MAX_LENGTH } from '../net/protocol.js';

const STORAGE_KEY = 'playerName';

// Janela que abre ao entrar no jogo pedindo o nome do personagem (markup em
// index.html, #nameModal). Lembra o último nome usado neste navegador.

export class NameModal {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor() {
    this.root = document.getElementById('nameModal');
    this.form = document.getElementById('nameForm');
    this.input = document.getElementById('nameInput');
    this.error = document.getElementById('nameError');
    this.button = this.form.querySelector('button');
    this.input.maxLength = NAME_MAX_LENGTH;
    this.input.value = this.loadName();
    this.pending = null;

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
  }

  // ================================================================================================================================================================================================================================================
  // loadName

  loadName() {
    try {
      return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
      return '';
    }
  }

  // ================================================================================================================================================================================================================================================
  // saveName

  saveName(name) {
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {
      return;
    }
  }

  // ================================================================================================================================================================================================================================================
  // ask
  // Mostra a janela e resolve com o nome digitado (já validado) ao confirmar.

  ask() {
    this.root.hidden = false;
    this.setBusy(false);
    this.input.focus();
    this.input.select();
    return new Promise((resolve) => {
      this.pending = resolve;
    });
  }

  // ================================================================================================================================================================================================================================================
  // submit

  submit() {
    if (!this.pending) return;
    const result = validateName(this.input.value);
    if (result.error) {
      this.showError(result.error);
      return;
    }
    this.input.value = result.name;
    this.showError('');
    this.setBusy(true);
    const resolve = this.pending;
    this.pending = null;
    resolve(result.name);
  }

  // ================================================================================================================================================================================================================================================
  // setBusy

  setBusy(busy) {
    this.input.disabled = busy;
    this.button.disabled = busy;
    this.button.textContent = busy ? 'Entrando…' : 'Entrar';
  }

  // ================================================================================================================================================================================================================================================
  // showError

  showError(message) {
    this.error.textContent = message;
  }

  // ================================================================================================================================================================================================================================================
  // close

  close(name) {
    this.saveName(name);
    this.root.hidden = true;
  }
}
