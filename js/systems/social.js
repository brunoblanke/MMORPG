// js/systems/social.js

import { getLevel } from '../core/geometry.js';
import { findInTree, weightOf, contains } from '../../shared/items.js';
import { displayName } from '../../shared/assets.js';

// O que os players fazem entre si:
//   party: o líder convida, o convidado entra; a XP das criaturas que
//   qualquer um mata é somada e dividida igualmente entre os membros vivos
//   no mesmo andar, até PARTY_RANGE sqm da criatura. Membro não ataca membro.
//   mensagem privada: chega só pra quem tem o nome (e quem mandou vê a dele).
//   VIP: a lista de amigos do player (nomes, guardada nele), com quem está
//   online; avisa quando um deles entra ou sai.
//   troca: cada um põe um item (container vai com o que tem dentro); os dois
//   aceitam e os itens trocam de dono. Mudar a oferta tira os aceites; longe
//   (mais de TRADE_RANGE sqm ou outro andar), a troca é cancelada.
//   PvP: fora da zona segura, player de nível PVP_MIN_LEVEL+ pode atacar
//   outro; atacar quem não tem caveira nem atacou ele antes dá a caveira
//   branca por SKULL_MS. Quem morre com caveira perde tudo o que carrega.

export const PARTY_RANGE = 30;
export const TRADE_RANGE = 2;
export const PVP_MIN_LEVEL = 8;
export const SKULL_MS = 15 * 60 * 1000;
export const VIP_MAX = 50;
export const PRIVATE_MAX_LENGTH = 200;

export class SocialController {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
    this.parties = [];
    this.trades = [];
  }

  // ================================================================================================================================================================================================================================================
  // message

  message(player, text, kind = 'warn') {
    this.sim.emit({ type: 'message', playerId: player.id, text, kind });
  }

  // ================================================================================================================================================================================================================================================
  // byName
  // O player online com esse nome (sem diferenciar maiúsculas).

  byName(name) {
    const wanted = String(name || '').trim().toLowerCase();
    return this.sim.players.find(p => p.name.toLowerCase() === wanted) || null;
  }

  // ================================================================================================================================================================================================================================================
  // partyOf

  partyOf(player) {
    return this.parties.find(party => party.members.includes(player.id)) || null;
  }

  // ================================================================================================================================================================================================================================================
  // sameParty

  sameParty(a, b) {
    const party = this.partyOf(a);
    return !!party && party.members.includes(b.id);
  }

  // ================================================================================================================================================================================================================================================
  // invite
  // O líder (ou quem ainda não tem party) convida outro player sem party.

  invite(player, targetId) {
    const target = this.sim.getPlayer(targetId);
    if (!target || target === player) return;
    if (this.partyOf(target)) return this.message(player, `${target.name} já está numa party.`);
    let party = this.partyOf(player);
    if (party && party.leader !== player.id) return this.message(player, 'Só o líder da party pode convidar.');
    if (!party) {
      party = { leader: player.id, members: [player.id], invited: [] };
      this.parties.push(party);
    }
    if (!party.invited.includes(target.id)) party.invited.push(target.id);
    this.message(player, `Você convidou ${target.name} pra party.`, 'info');
    this.message(target, `${player.name} te convidou pra party. Clique com o botão direito nele pra entrar.`, 'info');
  }

  // ================================================================================================================================================================================================================================================
  // join

  join(player, leaderId) {
    const leader = this.sim.getPlayer(leaderId);
    const party = leader ? this.partyOf(leader) : null;
    if (!party || !party.invited.includes(player.id) || this.partyOf(player)) return;
    party.invited = party.invited.filter(id => id !== player.id);
    party.members.push(player.id);
    for (const id of party.members) {
      const member = this.sim.getPlayer(id);
      if (member) this.message(member, `${player.name} entrou na party.`, 'info');
    }
  }

  // ================================================================================================================================================================================================================================================
  // leave
  // Sai da party; o líder que sai passa a liderança pro próximo. Party com
  // um só membro acaba.

  leave(player) {
    const party = this.partyOf(player);
    if (!party) return;
    party.members = party.members.filter(id => id !== player.id);
    if (party.leader === player.id) party.leader = party.members[0] || null;
    this.message(player, 'Você saiu da party.', 'info');
    for (const id of party.members) {
      const member = this.sim.getPlayer(id);
      if (member) this.message(member, `${player.name} saiu da party.`, 'info');
    }
    if (party.members.length < 2) this.parties = this.parties.filter(p => p !== party);
  }

  // ================================================================================================================================================================================================================================================
  // shareXp
  // gains (Map player → XP da criatura): a parte de cada membro de party vai
  // pro pote da party, dividido entre os membros perto da criatura.

  shareXp(gains, enemy) {
    const result = new Map();
    const pots = new Map();
    for (const [player, xp] of gains) {
      const party = this.partyOf(player);
      if (!party) result.set(player, (result.get(player) || 0) + xp);
      else pots.set(party, (pots.get(party) || 0) + xp);
    }
    for (const [party, xp] of pots) {
      const near = party.members.map(id => this.sim.getPlayer(id)).filter(m => m && m.isAlive() && getLevel(m) === getLevel(enemy) &&
        Math.max(Math.abs(m.x - enemy.x), Math.abs(m.y - enemy.y)) <= PARTY_RANGE);
      const share = near.length ? Math.round(xp / near.length) : 0;
      for (const member of near) result.set(member, (result.get(member) || 0) + share);
    }
    return result;
  }

  // ================================================================================================================================================================================================================================================
  // privateMessage
  // Mensagem só pra quem tem o nome to.

  privateMessage(player, to, text) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, PRIVATE_MAX_LENGTH);
    if (!clean) return;
    const target = this.byName(to);
    if (!target) return this.message(player, `${String(to || '').slice(0, 30)} não está online.`);
    this.message(target, `${player.name}: ${clean}`, 'private');
    if (target !== player) this.message(player, `Para ${target.name}: ${clean}`, 'private');
  }

  // ================================================================================================================================================================================================================================================
  // vipAdd / vipRemove

  vipAdd(player, name) {
    const clean = String(name || '').trim().slice(0, 30);
    player.vip = player.vip || [];
    if (!clean || player.vip.some(n => n.toLowerCase() === clean.toLowerCase())) return;
    if (player.vip.length >= VIP_MAX) return this.message(player, 'Sua lista VIP está cheia.');
    const online = this.byName(clean);
    player.vip.push(online ? online.name : clean);
  }

  vipRemove(player, name) {
    const wanted = String(name || '').toLowerCase();
    player.vip = (player.vip || []).filter(n => n.toLowerCase() !== wanted);
  }

  // ================================================================================================================================================================================================================================================
  // announce
  // Avisa quem tem o player na VIP que ele entrou ou saiu.

  announce(player, online) {
    for (const other of this.sim.players) {
      if (other === player || !(other.vip || []).some(n => n.toLowerCase() === player.name.toLowerCase())) continue;
      this.message(other, `${player.name} ${online ? 'entrou no jogo' : 'saiu do jogo'}.`, 'info');
    }
  }

  // ================================================================================================================================================================================================================================================
  // onLogin / onLogout

  onLogin(player) {
    this.announce(player, true);
  }

  onLogout(player) {
    this.cancelTrade(player, 'saiu do jogo');
    if (this.partyOf(player)) this.leave(player);
    for (const party of this.parties) party.invited = party.invited.filter(id => id !== player.id);
    this.announce(player, false);
  }

  // ================================================================================================================================================================================================================================================
  // tradeOf

  tradeOf(player) {
    return this.trades.find(trade => trade.a === player.id || trade.b === player.id) || null;
  }

  // ================================================================================================================================================================================================================================================
  // tradeOpen
  // Abre a troca com o outro player (perto, no mesmo andar).

  tradeOpen(player, targetId) {
    const target = this.sim.getPlayer(targetId);
    if (!target || target === player) return;
    if (!this.near(player, target)) return this.message(player, 'Chegue mais perto pra trocar.');
    if (this.tradeOf(player) || this.tradeOf(target)) return this.message(player, `${target.name} já está numa troca.`);
    this.trades.push({ a: player.id, b: target.id, offers: { [player.id]: null, [target.id]: null }, accepted: new Set() });
    this.message(target, `${player.name} quer trocar itens com você.`, 'info');
  }

  // ================================================================================================================================================================================================================================================
  // near

  near(a, b) {
    return getLevel(a) === getLevel(b) && Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= TRADE_RANGE;
  }

  // ================================================================================================================================================================================================================================================
  // tradeOffer
  // Põe o item do lugar from (inventário ou container carregado) na troca.

  tradeOffer(player, from) {
    const trade = this.tradeOf(player);
    if (!trade || !from || !['e', 'c'].includes(from.t)) return;
    const src = this.sim.inventory.source(player, from);
    if (src.error || !src.carried) return;
    trade.offers[player.id] = src.item.uid;
    trade.accepted.clear();
  }

  // ================================================================================================================================================================================================================================================
  // tradeAccept
  // Os dois aceitaram: cada item vai pra mochila do outro (precisa caber e
  // ter cap).

  tradeAccept(player) {
    const trade = this.tradeOf(player);
    if (!trade) return;
    trade.accepted.add(player.id);
    if (trade.accepted.size < 2) return;
    const a = this.sim.getPlayer(trade.a);
    const b = this.sim.getPlayer(trade.b);
    const itemA = this.offered(a, trade);
    const itemB = this.offered(b, trade);
    const problem = this.cannotReceive(a, itemB, itemA) || this.cannotReceive(b, itemA, itemB);
    if (problem) {
      trade.accepted.clear();
      for (const p of [a, b]) this.message(p, problem);
      return;
    }
    this.take(a, itemA);
    this.take(b, itemB);
    this.put(a, itemB);
    this.put(b, itemA);
    this.trades = this.trades.filter(t => t !== trade);
    for (const p of [a, b]) this.message(p, 'Troca feita.', 'info');
  }

  // ================================================================================================================================================================================================================================================
  // offered
  // O item que o player pôs na troca, se ele ainda carrega.

  offered(player, trade) {
    const uid = trade.offers[player.id];
    if (!uid) return null;
    const found = findInTree(this.sim.inventory.roots(player), uid);
    return found ? found.item : null;
  }

  // ================================================================================================================================================================================================================================================
  // cannotReceive
  // Por que o player não recebe incoming (dando outgoing), ou null.

  cannotReceive(player, incoming, outgoing) {
    if (!incoming) return null;
    const bag = player.equip.mochila;
    const freeSlot = bag && bag.items && (bag.items.includes(null) || (outgoing && bag.items.includes(outgoing)));
    if (!freeSlot || (outgoing && (outgoing === bag || contains(outgoing, bag)))) return `${player.name} não tem espaço na mochila.`;
    const inventory = this.sim.inventory;
    if (inventory.capUsed(player) - weightOf(outgoing) + weightOf(incoming) > inventory.capMax(player)) return `${player.name} não tem cap pra isso.`;
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // take / put

  take(player, item) {
    if (!item) return;
    const found = findInTree(this.sim.inventory.roots(player), item.uid);
    if (!found) return;
    if (found.parent) found.parent.items[found.index] = null;
    else {
      const key = Object.keys(player.equip).find(k => player.equip[k] === item);
      if (key) player.equip[key] = null;
    }
  }

  put(player, item) {
    if (!item) return;
    const bag = player.equip.mochila;
    bag.items[bag.items.indexOf(null)] = item;
  }

  // ================================================================================================================================================================================================================================================
  // cancelTrade

  cancelTrade(player, why = 'cancelou') {
    const trade = this.tradeOf(player);
    if (!trade) return;
    this.trades = this.trades.filter(t => t !== trade);
    const other = this.sim.getPlayer(trade.a === player.id ? trade.b : trade.a);
    this.message(player, 'Troca cancelada.', 'info');
    if (other) this.message(other, `Troca cancelada: ${player.name} ${why}.`, 'info');
  }

  // ================================================================================================================================================================================================================================================
  // canAttack
  // O player pode atacar o outro: os dois com nível pra PvP, fora da zona
  // segura e de parties diferentes.

  canAttack(player, target) {
    if (!target || target === player || !target.isAlive()) return false;
    if (player.lvl < PVP_MIN_LEVEL || target.lvl < PVP_MIN_LEVEL) return false;
    if (this.sim.world.isInSafeZone(player) || this.sim.world.isInSafeZone(target)) return false;
    return !this.sameParty(player, target);
  }

  // ================================================================================================================================================================================================================================================
  // onPlayerAttack
  // Ataque a outro player: quem ataca sem motivo (o alvo sem caveira e sem
  // ter atacado ele nos últimos SKULL_MS) fica com a caveira branca.

  onPlayerAttack(attacker, victim, now) {
    attacker.pvpAttacked = attacker.pvpAttacked || new Map();
    attacker.pvpAttacked.set(victim.id, now);
    const victimStarted = victim.pvpAttacked && now - (victim.pvpAttacked.get(attacker.id) ?? -Infinity) < SKULL_MS;
    if (this.hasSkull(victim, now) || victimStarted) return;
    if (!this.hasSkull(attacker, now)) this.message(attacker, 'Você atacou um player e ganhou a caveira branca.');
    attacker.skullUntil = now + SKULL_MS;
  }

  // ================================================================================================================================================================================================================================================
  // hasSkull

  hasSkull(player, now = this.sim.time || 0) {
    return (player.skullUntil || 0) > now;
  }

  // ================================================================================================================================================================================================================================================
  // update
  // A cada tick: a caveira de cada player (pro desenho) e as trocas de quem
  // se afastou ou não tem mais o item oferecido.

  update(now) {
    for (const player of this.sim.players) player.skull = this.hasSkull(player, now);
    for (const trade of [...this.trades]) {
      const a = this.sim.getPlayer(trade.a);
      const b = this.sim.getPlayer(trade.b);
      if (!a || !b || !a.isAlive() || !b.isAlive() || !this.near(a, b)) {
        const stay = a && a.isAlive() ? a : b;
        if (stay) this.cancelTrade(stay, 'se afastou');
        else this.trades = this.trades.filter(t => t !== trade);
        continue;
      }
      for (const p of [a, b]) {
        if (trade.offers[p.id] && !this.offered(p, trade)) {
          trade.offers[p.id] = null;
          trade.accepted.clear();
        }
      }
    }
  }

  // ================================================================================================================================================================================================================================================
  // viewFor
  // O que a janela Social e a de troca mostram pro player.

  viewFor(player) {
    const party = this.partyOf(player);
    const invites = this.parties.filter(p => p.invited.includes(player.id)).map(p => this.sim.getPlayer(p.leader)).filter(Boolean);
    const trade = this.tradeOf(player);
    const other = trade ? this.sim.getPlayer(trade.a === player.id ? trade.b : trade.a) : null;
    const describe = (owner) => {
      const item = owner ? this.offered(owner, trade) : null;
      return item ? { item, name: displayName(item.type) } : null;
    };
    return {
      party: party ? party.members.map(id => this.sim.getPlayer(id)).filter(Boolean).map(m => ({
        id: m.id, name: m.name, leader: m.id === party.leader, hp: Math.round(m.currentHp / m.hp * 100), mana: Math.round(m.mana / Math.max(1, m.maxMana) * 100)
      })) : [],
      invites: invites.map(p => ({ id: p.id, name: p.name })),
      vip: (player.vip || []).map(name => ({ name, online: !!this.byName(name) })),
      trade: trade && other ? {
        with: other.name, mine: describe(player), theirs: describe(other),
        myAccept: trade.accepted.has(player.id), theirAccept: trade.accepted.has(other.id)
      } : null
    };
  }
}
