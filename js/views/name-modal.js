// js/views/name-modal.js

import { validateName, validatePassword, normalizeGender, NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH } from '../net/protocol.js';

const STORAGE_KEY = 'playerName';
const GENDER_STORAGE_KEY = 'playerGender';

// Janela que abre ao entrar no jogo pedindo o nome, o gênero e a senha do
// personagem (markup em index.html, #nameModal). Lembra o último nome e gênero
// usados neste navegador (a senha nunca é guardada). Um nome novo define a
// senha dele na primeira vez.

export class NameModal {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor() {
    this.root = document.getElementById('nameModal');
    this.form = document.getElementById('nameForm');
    this.input = document.getElementById('nameInput');
    this.passwordInput = document.getElementById('passwordInput');
    this.error = document.getElementById('nameError');
    this.button = this.form.querySelector('button[type="submit"]');
    this.genderButtons = [...this.form.querySelectorAll('.gender-option')];
    this.input.maxLength = NAME_MAX_LENGTH;
    this.passwordInput.maxLength = PASSWORD_MAX_LENGTH;
    this.input.value = this.loadName();
    this.pending = null;
    this.selectGender(normalizeGender(this.load(GENDER_STORAGE_KEY)));
    this.setLoading(0);

    for (const button of this.genderButtons) {
      button.addEventListener('click', () => {
        this.selectGender(button.dataset.gender);
        this.input.focus();
      });
    }

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
  }

  // ================================================================================================================================================================================================================================================
  // load

  load(key) {
    try {
      return localStorage.getItem(key) || '';
    } catch {
      return '';
    }
  }

  // ================================================================================================================================================================================================================================================
  // save

  save(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      return;
    }
  }

  // ================================================================================================================================================================================================================================================
  // loadName

  loadName() {
    return this.load(STORAGE_KEY);
  }

  // ================================================================================================================================================================================================================================================
  // selectGender

  selectGender(gender) {
    this.gender = normalizeGender(gender);
    for (const button of this.genderButtons) {
      const selected = button.dataset.gender === this.gender;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    }
  }

  // ================================================================================================================================================================================================================================================
  // ask
  // Mostra a janela e resolve com { name, gender, password } (já validados) ao confirmar.

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
    const password = validatePassword(this.passwordInput.value);
    if (password.error) {
      this.showError(password.error);
      return;
    }
    this.input.value = result.name;
    this.showError('');
    this.setBusy(true);
    const resolve = this.pending;
    this.pending = null;
    resolve({ name: result.name, gender: this.gender, password: password.password });
  }

  // ================================================================================================================================================================================================================================================
  // setLoading
  // Enquanto o jogo carrega o botão fica parado mostrando a porcentagem (0 a 1);
  // o nome já pode ser digitado. ask() libera o botão.

  setLoading(fraction) {
    if (this.pending) return;
    this.button.disabled = true;
    this.button.textContent = `Carregando… ${Math.round(Math.min(Math.max(fraction, 0), 1) * 100)}%`;
  }

  // ================================================================================================================================================================================================================================================
  // setBusy

  setBusy(busy) {
    this.input.disabled = busy;
    this.passwordInput.disabled = busy;
    for (const button of this.genderButtons) button.disabled = busy;
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
    this.save(STORAGE_KEY, name);
    this.save(GENDER_STORAGE_KEY, this.gender);
    this.passwordInput.value = '';
    this.root.hidden = true;
  }
}
