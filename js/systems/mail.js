// js/systems/mail.js

import { toPlain, fromPlain } from '../../shared/items.js';
import { DEPOT_SIZE } from './inventory/depot.js';

// Correio: o player diz "!enviar NOME" e arrasta uma carta ou encomenda
// (item postal, gerador → Objetos) pra uma caixa de correio (Uso Correio). O
// item vai pro depósito do destinatário — no jogo ou guardado — que não
// precisa estar por perto.

export const MAIL_COMMAND = '!enviar';

export class MailController {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
  }

  // ================================================================================================================================================================================================================================================
  // message

  message(player, text, kind = 'warn') {
    this.sim.emit({ type: 'message', playerId: player.id, text, kind });
  }

  // ================================================================================================================================================================================================================================================
  // command
  // O player disse "!enviar NOME": guarda pra quem vai o que ele postar.

  command(player, text) {
    const [word, ...rest] = String(text || '').trim().split(/\s+/);
    if ((word || '').toLowerCase() !== MAIL_COMMAND) return false;
    const name = rest.join(' ').trim();
    const target = name ? this.recipient(name) : null;
    if (!target || target.name.toLowerCase() === player.name.toLowerCase()) {
      this.message(player, name ? `Não existe o personagem ${name}.` : 'Diga !enviar e o nome de quem recebe.');
      return true;
    }
    player.mailTo = target.name;
    this.message(player, `Agora jogue a carta ou encomenda na caixa de correio: vai pra ${target.name}.`, 'info');
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // recipient
  // Quem recebe pelo nome: { name, online } (no jogo) ou { name, saved }, ou null.

  recipient(name) {
    const lower = name.toLowerCase();
    const online = this.sim.players.find(p => p.name.toLowerCase() === lower);
    if (online) return { name: online.name, online };
    const saved = this.sim.savedCharacters[lower];
    return saved ? { name: saved.name || name, saved } : null;
  }

  // ================================================================================================================================================================================================================================================
  // send
  // Entrega o item no depósito de quem o player escolheu com !enviar.
  // Devolve true se foi (aí o item sai das mãos dele).

  send(player, item) {
    if (!player.mailTo) {
      this.message(player, 'Diga !enviar e o nome de quem recebe antes de postar.');
      return false;
    }
    const target = this.recipient(player.mailTo);
    if (!target) {
      this.message(player, `Não existe o personagem ${player.mailTo}.`);
      return false;
    }
    if (target.online) {
      const free = target.online.depot.items.indexOf(null);
      if (free < 0) return this.full(player, target.name);
      target.online.depot.items[free] = fromPlain(toPlain(item), () => this.sim.inventory.nextUid());
      this.message(target.online, `${player.name} mandou uma encomenda pro seu depósito.`, 'info');
    } else {
      const depot = Array.isArray(target.saved.depot) ? target.saved.depot : (target.saved.depot = []);
      let free = depot.findIndex(slot => !slot);
      if (free < 0 && depot.length < DEPOT_SIZE) free = depot.length;
      if (free < 0) return this.full(player, target.name);
      depot[free] = toPlain(item);
    }
    this.message(player, `Enviado pra ${target.name}.`, 'info');
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // full

  full(player, name) {
    this.message(player, `O depósito de ${name} está cheio.`);
    return false;
  }
}
