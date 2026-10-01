// js/systems/npcs.js

import { Npc } from '../models/npc.js';
import { getMapSpawn } from '../../shared/map-format.js';
import { DEFAULT_RADIUS, normalizeSpeech, npcDefFromAsset } from '../../shared/npcs.js';
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
export const FOCUS_IDLE_MS = 120000;
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
      this.npcSays(npc, player, def.bye.reply);
      return;
    }
    const topic = def.topics.find(t => this.hasWord(text, t.words));
    if (topic) this.npcSays(npc, player, topic.reply);
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
  // ficou FOCUS_IDLE_MS calado.

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
        if (!player || this.distanceTo(npc, player) > FOCUS_RANGE || now - since > FOCUS_IDLE_MS) npc.focus.delete(playerId);
      }
      this.wander(npc, now);
    }
  }

  // ================================================================================================================================================================================================================================================
  // wander
  // Um passo pra um sqm vizinho livre, sem escada nem buraco, a até
  // npc.radius do lugar dele; depois uma pausa sorteada. Em conversa, fica
  // parado (virado pra quem fala com ele).

  wander(npc, now) {
    if (npc.radius <= 0 || npc.focus.size > 0 || now < npc.nextWalkAt) return;
    const { movement, world } = this.sim;
    const options = [...DIRECTIONS].sort(() => Math.random() - 0.5);
    for (const [dx, dy] of options) {
      const landing = movement.resolveStep(npc, dx, dy);
      if (!landing || landing.z !== npc.home.z) continue;
      if (Math.max(Math.abs(landing.x - npc.home.x), Math.abs(landing.y - npc.home.y)) > npc.radius) continue;
      if (world.getTransitionAt(landing.x, landing.y, landing.z)) continue;
      movement.applyStep(npc, landing, now);
      npc.direction = npc.moveDirection || npc.direction;
      break;
    }
    npc.nextWalkAt = now + npc.getStepInterval() + WANDER_PAUSE_MIN_MS + Math.random() * (WANDER_PAUSE_MAX_MS - WANDER_PAUSE_MIN_MS);
  }
}
