// js/net/passwords.js

import fs from 'node:fs';
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 32;

// Senhas dos personagens (só no servidor): guarda o sal e o hash (scrypt) de
// cada nome, nunca a senha. O primeiro acesso de um nome define a senha dele.

// ================================================================================================================================================================================================================================================
// hashPassword

async function hashPassword(password, salt) {
  return (await scrypt(password, salt, KEY_LENGTH)).toString('hex');
}

export class PasswordStore {

  // ================================================================================================================================================================================================================================================
  // constructor
  // file: onde as senhas ficam gravadas (JSON); sem o arquivo, começa vazio.

  constructor(file) {
    this.file = file;
    this.entries = {};
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (saved && typeof saved === 'object') this.entries = saved;
    } catch {
      this.entries = {};
    }
  }

  // ================================================================================================================================================================================================================================================
  // has

  has(name) {
    return Object.hasOwn(this.entries, name.toLowerCase());
  }

  // ================================================================================================================================================================================================================================================
  // verify

  async verify(name, password) {
    const entry = this.entries[name.toLowerCase()];
    if (!entry) return false;
    const hash = await hashPassword(password, entry.salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(entry.hash, 'hex'));
  }

  // ================================================================================================================================================================================================================================================
  // claim
  // Define a senha de um nome que ainda não tem. Devolve false se alguém
  // chegou antes.

  async claim(name, password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await hashPassword(password, salt);
    if (this.has(name)) return false;
    this.entries[name.toLowerCase()] = { salt, hash };
    this.save();
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // save
  // Grava primeiro num temporário, pra não estragar o arquivo se o servidor
  // cair no meio.

  save() {
    try {
      const temporary = this.file + '.tmp';
      fs.writeFileSync(temporary, JSON.stringify(this.entries, null, 2), { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(temporary, this.file);
    } catch (err) {
      console.error('❌ Erro ao salvar senhas:', err.message);
    }
  }
}

export class LoginGuard {

  // ================================================================================================================================================================================================================================================
  // constructor
  // Depois de maxFailures senhas erradas seguidas na mesma chave, recusa por lockMs.

  constructor({ maxFailures = 5, lockMs = 30000, now = Date.now } = {}) {
    this.maxFailures = maxFailures;
    this.lockMs = lockMs;
    this.now = now;
    this.entries = new Map();
  }

  // ================================================================================================================================================================================================================================================
  // retryIn
  // Quantos ms faltam pra poder tentar de novo (0 se pode).

  retryIn(key) {
    const entry = this.entries.get(key);
    if (!entry || !entry.lockedUntil) return 0;
    const left = entry.lockedUntil - this.now();
    if (left > 0) return left;
    this.entries.delete(key);
    return 0;
  }

  // ================================================================================================================================================================================================================================================
  // fail

  fail(key) {
    const entry = this.entries.get(key) || { count: 0, lockedUntil: 0 };
    entry.count++;
    if (entry.count >= this.maxFailures) entry.lockedUntil = this.now() + this.lockMs;
    this.entries.set(key, entry);
  }

  // ================================================================================================================================================================================================================================================
  // clear

  clear(key) {
    this.entries.delete(key);
  }
}
