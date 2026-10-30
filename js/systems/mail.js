// js/systems/mail.js

import { toPlain, fromPlain, itemInfo } from '../../shared/items.js';
import { getAsset, splitType } from '../../shared/assets.js';
import { DEPOT_SIZE } from './inventory/depot.js';

// Correio, como no Tibia: a carta em branco leva o destinatário escrito nela (usar abre a janela de escrever: Para e
// mensagem); a encomenda leva uma etiqueta escrita dentro (item com Escrita "etiqueta"). Arrastada pra caixa de correio
// (Uso Correio), vai pro depósito do destinatário — no jogo ou guardado —, que não precisa estar por perto, já
// carimbada (a receita "Enviada vira": a carta e a encomenda enviadas, que não são postais e não podem ser mandadas de
// novo); a carta carimbada guarda quem mandou e a mensagem.

export const MAX_RECIPIENT = 30;
export const MAX_LETTER = 1000;

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
  // write
  // Escreve no item (carta ou etiqueta) o destinatário e, na carta, a mensagem.

  write(item, para, texto) {
    const info = itemInfo(item.type);
    if (!info.writes) return false;
    const name = String(para || '').replace(/\s+/g, ' ').trim().slice(0, MAX_RECIPIENT);
    if (name) item.para = name;
    else delete item.para;
    if (info.writes !== 'carta') return true;
    const text = String(texto || '').slice(0, MAX_LETTER);
    if (text.trim()) item.texto = text;
    else delete item.texto;
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // addressOf
  // O destinatário escrito: o do próprio item (carta, encomenda) ou o da etiqueta dentro da encomenda.

  addressOf(item) {
    if (item.para && itemInfo(item.type).writes) return item.para;
    const label = (item.items || []).find(child => child && child.para && itemInfo(child.type).writes === 'etiqueta');
    return label ? label.para : null;
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
  // Entrega o item, já carimbado, no depósito de quem está escrito nele. Devolve true se foi (aí o item sai das mãos
  // dele). Sem destinatário, num item que se escreve, o navegador pergunta "Para:" (evento askRecipient) e manda de
  // novo o moveInv (retry) depois de escrever.

  send(player, item, retry = null) {
    const info = itemInfo(item.type);
    const address = this.addressOf(item);
    if (!address && info.writes && retry) {
      this.sim.emit({ type: 'askRecipient', playerId: player.id, itemType: item.type, from: retry.from, then: { type: 'moveInv', ...retry } });
      return false;
    }
    if (!address) {
      this.message(player, item.items ? 'Ponha dentro uma etiqueta com o nome de quem recebe.' : 'Escreva na carta o nome de quem recebe.');
      return false;
    }
    const target = this.recipient(address);
    if (!target) {
      this.message(player, `Não existe o personagem ${address}.`);
      return false;
    }
    const plain = toPlain(item);
    if (info.sentAs && getAsset(splitType(info.sentAs).asset)) plain.type = info.sentAs;
    if (info.writes === 'carta') plain.texto = `De: ${player.name}\nPara: ${target.name}\n\n${item.texto || ''}`;
    if (target.online) {
      const free = target.online.depot.items.indexOf(null);
      if (free < 0) return this.full(player, target.name);
      target.online.depot.items[free] = fromPlain(plain, () => this.sim.inventory.nextUid());
      this.message(target.online, `${player.name} mandou uma encomenda pro seu depósito.`, 'info');
    } else {
      const depot = Array.isArray(target.saved.depot) ? target.saved.depot : (target.saved.depot = []);
      let free = depot.findIndex(slot => !slot);
      if (free < 0 && depot.length < DEPOT_SIZE) free = depot.length;
      if (free < 0) return this.full(player, target.name);
      depot[free] = plain;
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
