// shared/npcs.js

import { getAsset, displayName, creatureBehavior } from './assets.js';

// NPCs: criados no gerador (Criaturas, comportamento NPC: a conversa fica em
// propriedades.conversa) e postos pelo editor (npcData do mapa).
//
// Uma definição (npcDefFromAsset; a simulação também aceita definições
// prontas em options.npcs): name, creature (folha do gerador; sem ela, a roupa de player
// do gender), at ({ dx, dy, dz }) ou pos ({ x, y, z }), radius (até quantos
// sqm ele passeia), welcome (o que diz a quem chega perto), greet e bye
// ({ words, reply }: começam e encerram a conversa) e topics ([{ words,
// reply }]: respondem durante a conversa). {nome} vira o nome do player. As
// palavras são comparadas sem acento e em minúsculas (normalizeSpeech).

export const GREET_WORDS = ['oi', 'ola', 'oie', 'hi', 'hello', 'bom dia', 'boa tarde', 'boa noite'];
export const BYE_WORDS = ['tchau', 'adeus', 'ate mais', 'bye'];
export const DEFAULT_RADIUS = 2;

// ================================================================================================================================================================================================================================================
// normalizeSpeech
// Minúsculas, sem acento nem pontuação, espaços simples.

export function normalizeSpeech(text) {
  return String(text ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// ================================================================================================================================================================================================================================================
// npcDefFromAsset
// Definição do NPC criado no gerador (type), posto pelo editor em pos; null
// se a folha não existe ou não é de NPC.

export function npcDefFromAsset(type, pos) {
  const asset = getAsset(type);
  if (!asset || creatureBehavior(type) !== 'npc') return null;
  const talk = (asset.propriedades && asset.propriedades.conversa) || {};
  const radius = Math.floor(Number(talk.raio));
  const topics = (Array.isArray(talk.topicos) ? talk.topicos : []).map(topic => ({
    words: String((topic && topic.palavras) || '').split(',').map(normalizeSpeech).filter(Boolean),
    reply: String((topic && topic.resposta) || '').trim()
  })).filter(topic => topic.words.length && topic.reply);
  return {
    id: `${asset.nome || type.split('/').pop()}-${pos.x}-${pos.y}-${pos.z}`,
    name: displayName(type),
    creature: type,
    pos,
    radius: Number.isFinite(radius) && radius >= 0 ? radius : DEFAULT_RADIUS,
    welcome: String(talk.boasVindas || '').trim(),
    greet: { words: GREET_WORDS, reply: String(talk.oi || '').trim() || 'Olá, {nome}!' },
    bye: { words: BYE_WORDS, reply: String(talk.tchau || '').trim() || 'Até mais, {nome}.' },
    topics
  };
}
