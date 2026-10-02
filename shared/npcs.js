// shared/npcs.js

import { getAsset, displayName, creatureBehavior, splitType } from './assets.js';

// NPCs: criados no gerador (Criaturas, comportamento NPC: a conversa fica em
// propriedades.conversa) e postos pelo editor (npcData do mapa).
//
// Uma definição (npcDefFromAsset; a simulação também aceita definições
// prontas em options.npcs): name, creature (folha do gerador; sem ela, a roupa de player
// do gender), at ({ dx, dy, dz }) ou pos ({ x, y, z }), radius (até quantos
// sqm ele passeia), welcome (o que diz a quem chega perto), greet e bye
// ({ words, reply }: começam e encerram a conversa) e topics ([{ words,
// reply }]: respondem durante a conversa). vocation ({ destination }): ele
// dá a vocação a quem tem o nível 8 e leva pro destino (js/systems/npcs.js →
// talkVocation). shop ([{ type, price, name, words }]): o que ele vende;
// buys (igual): o que ele compra (talkShop). {nome} vira o nome do player. As
// palavras são comparadas sem acento e em minúsculas (normalizeSpeech).

export const GREET_WORDS = ['oi', 'ola', 'oie', 'hi', 'hello', 'bom dia', 'boa tarde', 'boa noite'];
export const BYE_WORDS = ['tchau', 'adeus', 'ate mais', 'bye'];
export const DEFAULT_RADIUS = 2;
export const YES_WORDS = ['sim', 'yes', 's'];
export const NO_WORDS = ['nao', 'no', 'n'];
export const TRADE_WORDS = ['oferta', 'ofertas', 'trade', 'loja', 'vende', 'vendas', 'comprar', 'compra'];
export const SELL_WORDS = ['vender', 'vendo', 'sell'];
export const MAX_SELL = 100;

// Falas da escolha de vocação e da venda (gerador → Falas; vazio = estas).
// {nome} vira o nome do player, {vocacao} a vocação, {nivel} o nível
// mínimo, {item} o item, {preco} o preço, {quantidade} quantos e {lista} o
// que ele vende ou compra.
export const VOCATION_LINES = {
  nivel: { label: 'Sem o nível', text: 'Você precisa chegar ao nível {nivel} pra escolher sua vocação.' },
  jaTem: { label: 'Já tem vocação', text: 'Você já é {vocacao}.' },
  confirmar: { label: 'Pergunta', text: 'Quer mesmo ser {vocacao}? Essa escolha não tem volta. (sim / não)' },
  aceito: { label: 'Ao dizer sim', text: 'Que assim seja, {vocacao} {nome}!' },
  desistiu: { label: 'Ao dizer não', text: 'Pense bem e volte quando decidir.' }
};
export const SHOP_LINES = {
  lista: { label: 'Oferta', text: 'Eu vendo: {lista}.' },
  confirmar: { label: 'Pergunta', text: 'Quer comprar {item} por {preco} moedas de ouro? (sim / não)' },
  vendido: { label: 'Vendido', text: 'Aqui está. Obrigado!' },
  semDinheiro: { label: 'Sem dinheiro', text: 'Você não tem dinheiro suficiente.' },
  semMochila: { label: 'Sem mochila', text: 'Você precisa de uma mochila pra levar isso.' },
  semEspaco: { label: 'Sem espaço', text: 'Você não tem espaço na mochila.' },
  semCap: { label: 'Sem cap', text: 'Você não tem capacidade pra carregar isso.' },
  desistiu: { label: 'Ao dizer não', text: 'Tudo bem.' },
  listaCompra: { label: 'O que compra', text: 'Eu compro: {lista}.' },
  confirmarCompra: { label: 'Pergunta (venda do player)', text: 'Quer me vender {quantidade} {item} por {preco} moedas de ouro? (sim / não)' },
  comprado: { label: 'Comprado', text: 'Negócio fechado!' },
  semItem: { label: 'Player sem o item', text: 'Você não tem {quantidade} {item}.' }
};

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
    topics,
    vocation: talk.vocacao ? { destination: validDestination(talk.vocacao.destino) } : null,
    vocationLines: linesFrom(VOCATION_LINES, talk.falasVocacao),
    shop: shopFrom(talk.vende),
    buys: shopFrom(talk.compra),
    shopLines: linesFrom(SHOP_LINES, talk.falasVenda)
  };
}

// ================================================================================================================================================================================================================================================
// linesFrom
// As falas do gerador por cima das padrão (defaults): { chave: texto }.

function linesFrom(defaults, saved) {
  const lines = {};
  for (const [key, { text }] of Object.entries(defaults)) {
    const own = saved && typeof saved[key] === 'string' ? saved[key].trim() : '';
    lines[key] = own || text;
  }
  return lines;
}

// ================================================================================================================================================================================================================================================
// fillLine
// Troca {chave} pelos valores (o {nome} fica pro npcSays).

export function fillLine(text, values) {
  return text.replace(/\{(\w+)\}/g, (all, key) => (key in values ? String(values[key]) : all));
}

// ================================================================================================================================================================================================================================================
// shopFrom
// O que o NPC vende ou compra (gerador → Vende, Compra): [{ type, price,
// name, words }]; as palavras são as do gerador mais o nome do item. Só
// itens que existem.

function shopFrom(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(e => e && typeof e.tipo === 'string' && getAsset(splitType(e.tipo).asset) && Number(e.preco) >= 0).map(e => {
    const name = displayName(e.tipo);
    const words = String(e.palavras || '').split(',').map(normalizeSpeech).filter(Boolean);
    return { type: e.tipo, price: Math.floor(Number(e.preco)), name, words: [...new Set([...words, normalizeSpeech(name)])].filter(Boolean) };
  });
}

// ================================================================================================================================================================================================================================================
// validDestination
// { x, y, z } inteiros, ou null.

function validDestination(dest) {
  if (!dest || ![dest.x, dest.y, dest.z].every(Number.isInteger)) return null;
  return { x: dest.x, y: dest.y, z: dest.z };
}
