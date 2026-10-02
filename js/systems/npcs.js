// js/systems/npcs.js

import { Npc } from '../models/npc.js';
import { getMapSpawn } from '../../shared/map-format.js';
import { DEFAULT_RADIUS, YES_WORDS, NO_WORDS, TRADE_WORDS, SELL_WORDS, MAX_SELL, VOCATION_LINES, SHOP_LINES, normalizeSpeech, npcDefFromAsset, fillLine } from '../../shared/npcs.js';
import { buy, sell } from './trade.js';
import { VOCATIONS, VOCATION_LEVEL } from '../../shared/vocations.js';
import { getLevel } from '../core/geometry.js';
import { directionFromDelta } from '../utils/helpers.js';

// Fala e NPCs: o que um player diz (comando say) vira o evento speech, que
// todos veem em cima de quem falou. NPC perto escuta: dá boas-vindas a quem
// chega, conversa por palavras-chave (shared/npcs.js) e esquece quem se
// afastou ou ficou calado. Fora de conversa, ele passeia em volta do lugar
// dele (radius), um passo de cada vez, com pausas.

export const SPEECH_MAX_LENGTH = 120;
export const HEAR_RANGE = 4;
export const WELCOME_RANGE = 3;
export const FOCUS_RANGE = HEAR_RANGE;
export const FOCUS_IDLE_MS = 30000;
export const WELCOME_COOLDOWN_MS = 60000;
export const REPLY_DELAY_MS = 400;
export const WANDER_PAUSE_MIN_MS = 1500;
export const WANDER_PAUSE_MAX_MS = 4000;
const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];

export class NpcController {

  // ================================================================================================================================================================================================================================================
  // constructor
  // Os NPCs postos no mapa pelo editor (npcData: [tipo, x, y, z], criados no
  // gerador) e os de defs, cada um no sqm livre mais perto do lugar dele.

  constructor(sim, defs) {
    this.sim = sim;
    const placed = (sim.mapData.npcData || []).map(([type, x, y, z]) => npcDefFromAsset(type, { x, y, z: z || 0 })).filter(Boolean);
    const all = [...defs, ...placed];
    this.defs = new Map(all.map(def => [def.id, def]));
    const spawn = getMapSpawn(sim.mapData, { x: 132, y: 145, z: 0 });
    sim.npcs = all.map(def => {
      const at = def.pos || { x: spawn.x + def.at.dx, y: spawn.y + def.at.dy, z: spawn.z + (def.at.dz || 0) };
      const z = at.z;
      const spot = sim.findFreeSpot(at.x, at.y, z);
      const npc = new Npc({ id: `npc-${def.id}`, defId: def.id, name: def.name, gender: def.gender, creature: def.creature, x: spot.x, y: spot.y, z, step: spot.step });
      npc.focus = new Map();
      npc.nearby = new Set();
      npc.welcomed = new Map();
      npc.choosing = new Map();
      npc.offering = new Map();
      npc.home = { x: spot.x, y: spot.y, z };
      npc.homeX = spot.x;
      npc.homeY = spot.y;
      npc.radius = def.radius ?? DEFAULT_RADIUS;
      npc.nextWalkAt = 0;
      sim.world.addCreature(npc);
      return npc;
    });
  }

  // ================================================================================================================================================================================================================================================
  // hasWord
  // A mensagem (normalizada) tem alguma das palavras (ou expressões) da lista.

  hasWord(text, words) {
    const padded = ` ${text} `;
    return words.some(word => padded.includes(` ${word} `));
  }

  // ================================================================================================================================================================================================================================================
  // distanceTo

  distanceTo(npc, player) {
    if (getLevel(npc) !== getLevel(player)) return Infinity;
    return Math.max(Math.abs(npc.x - player.x), Math.abs(npc.y - player.y));
  }

  // ================================================================================================================================================================================================================================================
  // speak
  // Evento speech: o texto aparece em cima de quem falou, no sqm onde estava.

  speak(speaker, text) {
    this.sim.emit({ type: 'speech', speakerId: speaker.id, name: speaker.name, text, x: speaker.x, y: speaker.y, z: speaker.z || 0, npc: !!speaker.isNpc });
  }

  // ================================================================================================================================================================================================================================================
  // npcSays
  // O NPC responde um instante depois (a fala do player aparece antes).

  npcSays(npc, player, text) {
    const line = text.replace(/\{nome\}/g, player.name);
    this.sim.schedule((this.sim.time || 0) + REPLY_DELAY_MS, () => this.speak(npc, line));
  }

  // ================================================================================================================================================================================================================================================
  // playerSays
  // Comando say: limpa o texto, mostra a fala e passa pros NPCs que ouvem.

  playerSays(player, raw) {
    const text = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, SPEECH_MAX_LENGTH);
    if (!text) return;
    this.speak(player, text);
    const heard = normalizeSpeech(text);
    for (const npc of this.sim.npcs) {
      if (this.distanceTo(npc, player) <= HEAR_RANGE) this.hear(npc, player, heard);
    }
  }

  // ================================================================================================================================================================================================================================================
  // hear
  // Sem conversa: só o cumprimento começa uma. Em conversa: tchau encerra;
  // um tópico responde; o resto ele ignora.

  hear(npc, player, text) {
    const def = this.defs.get(npc.defId);
    if (!def) return;
    const talking = npc.focus.has(player.id);
    if (!talking) {
      if (!this.hasWord(text, def.greet.words)) return;
      npc.focus.set(player.id, this.sim.time || 0);
      this.face(npc, player);
      this.npcSays(npc, player, def.greet.reply);
      return;
    }
    npc.focus.set(player.id, this.sim.time || 0);
    this.face(npc, player);
    if (this.hasWord(text, def.bye.words)) {
      npc.focus.delete(player.id);
      npc.choosing.delete(player.id);
      npc.offering.delete(player.id);
      this.npcSays(npc, player, def.bye.reply);
      return;
    }
    if (def.vocation && this.talkVocation(npc, def, player, text)) return;
    if (((def.shop && def.shop.length) || (def.buys && def.buys.length)) && this.talkShop(npc, def, player, text)) return;
    const topic = def.topics.find(t => this.hasWord(text, t.words));
    if (topic) this.npcSays(npc, player, topic.reply);
  }

  // ================================================================================================================================================================================================================================================
  // talkVocation
  // NPC de vocação: o nome de uma (knight, paladin, sorcerer, druid) pede a
  // confirmação; sim dá a vocação (só a quem tem o nível VOCATION_LEVEL e
  // ainda não tem nenhuma), faz do destino a nova casa do player e o leva
  // pra lá; não desiste. Devolve true se a fala era dessa conversa.

  talkVocation(npc, def, player, text) {
    const lines = def.vocationLines || Object.fromEntries(Object.entries(VOCATION_LINES).map(([k, v]) => [k, v.text]));
    const pending = npc.choosing.get(player.id);
    if (pending && this.hasWord(text, YES_WORDS)) {
      npc.choosing.delete(player.id);
      this.npcSays(npc, player, fillLine(lines.aceito, { vocacao: VOCATIONS[pending].name }));
      player.setVocation(pending);
      const dest = def.vocation.destination;
      if (dest) this.sim.schedule((this.sim.time || 0) + REPLY_DELAY_MS * 2, () => {
        npc.focus.delete(player.id);
        this.sim.teleportPlayer(player, dest.x, dest.y, dest.z, { home: true });
      });
      return true;
    }
    if (pending && this.hasWord(text, NO_WORDS)) {
      npc.choosing.delete(player.id);
      this.npcSays(npc, player, lines.desistiu);
      return true;
    }
    const key = Object.keys(VOCATIONS).find(k => this.hasWord(text, VOCATIONS[k].words));
    if (!key) return false;
    if (player.vocation !== 'none') {
      this.npcSays(npc, player, fillLine(lines.jaTem, { vocacao: VOCATIONS[player.vocation].name }));
    } else if (player.lvl < VOCATION_LEVEL) {
      this.npcSays(npc, player, fillLine(lines.nivel, { nivel: VOCATION_LEVEL }));
    } else {
      npc.choosing.set(player.id, key);
      this.npcSays(npc, player, fillLine(lines.confirmar, { vocacao: VOCATIONS[key].name }));
    }
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // talkShop
  // NPC que vende ou compra: oferta (trade, loja…) lista o que ele vende e o
  // que compra; vender (ou sell) com o nome de um item que ele compra, e a
  // quantidade se quiser (vender 5 queijos), pede a confirmação com o preço;
  // o nome de um item que ele vende (ou as palavras dele no gerador) também;
  // sim fecha (trade.js → buy, sell), não desiste. Devolve true se a fala
  // era dessa conversa.

  talkShop(npc, def, player, text) {
    const lines = def.shopLines || Object.fromEntries(Object.entries(SHOP_LINES).map(([k, v]) => [k, v.text]));
    const shop = def.shop || [];
    const buys = def.buys || [];
    const pending = npc.offering.get(player.id);
    if (pending && this.hasWord(text, YES_WORDS)) {
      npc.offering.delete(player.id);
      if (pending.amount) {
        const result = sell(this.sim, player, pending.type, pending.price, pending.amount);
        this.npcSays(npc, player, fillLine(result === 'ok' ? lines.comprado : lines.semItem, { item: pending.name, quantidade: pending.amount }));
        return true;
      }
      const result = buy(this.sim, player, pending.type, pending.price);
      const replies = { ok: lines.vendido, money: lines.semDinheiro, bag: lines.semMochila, space: lines.semEspaco, cap: lines.semCap };
      this.npcSays(npc, player, fillLine(replies[result], { item: pending.name, preco: pending.price }));
      return true;
    }
    if (pending && this.hasWord(text, NO_WORDS)) {
      npc.offering.delete(player.id);
      this.npcSays(npc, player, lines.desistiu);
      return true;
    }
    const selling = this.hasWord(text, SELL_WORDS) ? buys.find(entry => this.hasWord(text, entry.words)) : null;
    if (selling) {
      const number = Number((text.match(/\b\d+\b/) || [])[0]);
      const amount = Number.isInteger(number) && number > 0 ? Math.min(number, MAX_SELL) : 1;
      npc.offering.set(player.id, { ...selling, amount });
      this.npcSays(npc, player, fillLine(lines.confirmarCompra, { item: selling.name, quantidade: amount, preco: selling.price * amount }));
      return true;
    }
    const item = shop.find(entry => this.hasWord(text, entry.words));
    if (item) {
      npc.offering.set(player.id, item);
      this.npcSays(npc, player, fillLine(lines.confirmar, { item: item.name, preco: item.price }));
      return true;
    }
    if (this.hasWord(text, TRADE_WORDS) || this.hasWord(text, SELL_WORDS)) {
      const list = (entries) => entries.map(entry => `${entry.name} (${entry.price} moedas)`).join(', ');
      const replies = [];
      if (shop.length) replies.push(fillLine(lines.lista, { lista: list(shop) }));
      if (buys.length) replies.push(fillLine(lines.listaCompra, { lista: list(buys) }));
      this.npcSays(npc, player, replies.join(' '));
      return true;
    }
    return false;
  }

  // ================================================================================================================================================================================================================================================
  // face
  // O NPC vira pro player com quem fala.

  face(npc, player) {
    const dx = Math.sign(player.x - npc.x);
    const dy = Math.sign(player.y - npc.y);
    if (dx || dy) npc.direction = directionFromDelta(dx, dy);
  }

  // ================================================================================================================================================================================================================================================
  // update
  // A cada tick: boas-vindas a quem acabou de chegar perto (no máximo uma
  // vez por WELCOME_COOLDOWN_MS) e fim da conversa de quem se afastou ou
  // ficou FOCUS_IDLE_MS calado (ele se despede, como no tchau).

  update(now) {
    for (const npc of this.sim.npcs) {
      const def = this.defs.get(npc.defId);
      const near = new Set();
      for (const player of this.sim.players) {
        const dist = this.distanceTo(npc, player);
        if (dist <= WELCOME_RANGE) near.add(player.id);
        if (dist <= WELCOME_RANGE && !npc.nearby.has(player.id) && def && def.welcome) {
          const last = npc.welcomed.get(player.id);
          if (last === undefined || now - last >= WELCOME_COOLDOWN_MS) {
            npc.welcomed.set(player.id, now);
            this.face(npc, player);
            this.npcSays(npc, player, def.welcome);
          }
        }
      }
      npc.nearby = near;
      for (const [playerId, since] of npc.focus) {
        const player = this.sim.getPlayer(playerId);
        if (!player) {
          npc.focus.delete(playerId);
          npc.choosing.delete(playerId);
          npc.offering.delete(playerId);
        } else if (this.distanceTo(npc, player) > FOCUS_RANGE || now - since > FOCUS_IDLE_MS) {
          npc.focus.delete(playerId);
          npc.choosing.delete(playerId);
          npc.offering.delete(playerId);
          if (def) this.npcSays(npc, player, def.bye.reply);
        }
      }
      this.wander(npc, now);
    }
  }

  // ================================================================================================================================================================================================================================================
  // wander
  // Um passo pra um sqm vizinho livre, sem escada nem buraco, dentro do
  // círculo de raio npc.radius em volta do lugar dele (isInWanderArea);
  // depois uma pausa sorteada. Em conversa, fica parado (virado pra quem
  // fala com ele).

  wander(npc, now) {
    if (npc.radius <= 0 || npc.focus.size > 0 || now < npc.nextWalkAt) return;
    const { movement, world } = this.sim;
    const options = [...DIRECTIONS].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of options) {
      const landing = movement.resolveStep(npc, dx, dy);
      if (!landing || landing.z !== npc.home.z) continue;
      if (!npc.isInWanderArea(landing.x, landing.y)) continue;
      if (world.getTransitionAt(landing.x, landing.y, landing.z)) continue;
      movement.applyStep(npc, landing, now);
      npc.direction = npc.moveDirection || npc.direction;
      break;
    }
    npc.nextWalkAt = now + npc.getStepInterval() + WANDER_PAUSE_MIN_MS + Math.random() * (WANDER_PAUSE_MAX_MS - WANDER_PAUSE_MIN_MS);
  }
}
