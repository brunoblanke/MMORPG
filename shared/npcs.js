// shared/npcs.js

import { getAsset, displayName, creatureBehavior } from './assets.js';

// NPCs. Os do mapa são criados no gerador (Criaturas, comportamento NPC: a
// conversa fica em propriedades.conversa) e postos pelo editor (npcData do
// mapa); os de NPC_DEFS são fixos no código, com a posição em relação ao
// spawn (at).
//
// Uma definição: name, creature (folha do gerador; sem ela, a roupa de player
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

export const NPC_DEFS = [
  {
    id: 'guia',
    name: 'Guia',
    gender: 'male',
    at: { dx: -1, dy: -1 },
    radius: 2,
    welcome: 'Bem-vindo, aventureiro!',
    greet: {
      words: GREET_WORDS,
      reply: 'Olá, {nome}! Posso falar sobre andar, combate, itens, comida, poções, escadas e ferramentas.'
    },
    bye: {
      words: BYE_WORDS,
      reply: 'Até mais, {nome}. Boa aventura!'
    },
    topics: [
      { words: ['andar', 'mover', 'movimento', 'caminhar'], reply: 'Clique no chão pra andar até lá, ou use W, A, S, D (Q, E, Z e C nas diagonais).' },
      { words: ['combate', 'atacar', 'ataque', 'lutar', 'luta'], reply: 'Clique numa criatura pra atacar. No inventário, um ícone liga seguir o alvo e o outro o auto ataque.' },
      { words: ['itens', 'item', 'loot', 'mochila', 'bag'], reply: 'Arraste os itens pro inventário. Duplo clique ou botão direito abre bolsas e corpos. Shift + clique mostra o que é.' },
      { words: ['comida', 'comer', 'fome'], reply: 'Comer recupera vida e mana aos poucos. Duplo clique ou botão direito na comida.' },
      { words: ['pocoes', 'pocao', 'potion', 'potions', 'curar'], reply: 'Clique na poção e depois em você ou em outro aventureiro. Errou o alvo, o líquido cai no chão.' },
      { words: ['escadas', 'escada', 'subir', 'descer', 'bueiro'], reply: 'Escadas sobem e descem ao pisar. Bueiros e alçapões se usam com duplo clique ou botão direito.' },
      { words: ['ferramentas', 'ferramenta', 'corda', 'pa'], reply: 'Use a corda nas marcas de corda pra subir e a pá nos montes de terra pra abrir um buraco.' },
      { words: ['nome', 'quem', 'trabalho'], reply: 'Sou o Guia. Recebo os aventureiros que chegam por aqui.' }
    ]
  }
];
