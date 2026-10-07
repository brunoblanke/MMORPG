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
// buys (igual): o que ele compra (talkShop). quests: as missões que ele dá
// (questsFrom; js/systems/quests.js). {nome} vira o nome do player. As
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
  queVender: { label: 'Ao dizer vender', text: 'O que você quer me vender? Eu compro: {lista}.' },
  confirmarCompra: { label: 'Pergunta (venda do player)', text: 'Quer me vender {quantidade} {item} por {preco} moedas de ouro? (sim / não)' },
  comprado: { label: 'Comprado', text: 'Negócio fechado!' },
  semItem: { label: 'Player sem o item', text: 'Você não tem {quantidade} {item}.' }
};
// Falas das missões: {progresso} vira o quanto falta (ex.: 3/5 rat) e
// {missao} o nome da missão.
export const QUEST_LINES = {
  aceitou: { label: 'Ao aceitar', text: 'Ótimo! Volte quando terminar.' },
  desistiu: { label: 'Ao dizer não', text: 'Tudo bem, quem sabe outra hora.' },
  falta: { label: 'Ainda não terminou', text: 'Você ainda não terminou: {progresso}.' },
  pronto: { label: 'Ao entregar', text: 'Muito obrigado, {nome}! Aqui está sua recompensa.' },
  feita: { label: 'Já feita', text: 'Você já me ajudou com isso. Obrigado!' }
};
export const MAX_QUEST_AMOUNT = 1000;

// Banqueiro (gerador → NPC → É banqueiro): saldo, depositar, sacar,
// transferir pra outro personagem e trocar moedas. {saldo} é o saldo do
// player, {quantidade} o valor e {destino} o nome de quem recebe.
export const BALANCE_WORDS = ['saldo', 'balance', 'extrato'];
export const DEPOSIT_WORDS = ['depositar', 'deposit', 'guardar'];
export const WITHDRAW_WORDS = ['sacar', 'withdraw', 'retirar'];
export const TRANSFER_WORDS = ['transferir', 'transfer', 'transferencia'];
export const CHANGE_WORDS = ['trocar', 'change', 'troco'];
export const ALL_WORDS = ['tudo', 'all', 'todo'];
export const BANK_WORDS = ['banco', 'conta', 'bank', 'ajuda', 'help'];
export const MAX_BANK = 100000000;
export const BANK_LINES = {
  ajuda: { label: 'Ao falar do banco', text: 'Posso mostrar seu saldo, depositar, sacar, transferir ou trocar suas moedas.' },
  saldo: { label: 'Saldo', text: 'Seu saldo é de {saldo} moedas de ouro.' },
  confirmarDeposito: { label: 'Pergunta (depósito)', text: 'Quer depositar {quantidade} moedas de ouro? (sim / não)' },
  depositado: { label: 'Depositado', text: 'Pronto, depositei {quantidade}. Seu saldo agora é de {saldo}.' },
  semDinheiro: { label: 'Sem moedas consigo', text: 'Você não tem essa quantia com você.' },
  confirmarSaque: { label: 'Pergunta (saque)', text: 'Quer sacar {quantidade} moedas de ouro? (sim / não)' },
  sacado: { label: 'Sacado', text: 'Aqui estão {quantidade} moedas. Seu saldo agora é de {saldo}.' },
  semSaldo: { label: 'Sem saldo', text: 'Seu saldo não chega a essa quantia.' },
  confirmarTransferencia: { label: 'Pergunta (transferência)', text: 'Quer transferir {quantidade} moedas de ouro para {destino}? (sim / não)' },
  transferido: { label: 'Transferido', text: 'Pronto, transferi {quantidade} moedas para {destino}.' },
  semDestino: { label: 'Destino desconhecido', text: 'Não conheço ninguém com o nome {destino}.' },
  trocado: { label: 'Moedas trocadas', text: 'Pronto, troquei suas moedas.' },
  semQuantia: { label: 'Sem quantia', text: 'Diga quanto, por exemplo: depositar 100, ou depositar tudo.' },
  desistiu: { label: 'Ao dizer não', text: 'Tudo bem.' }
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
    shopLines: linesFrom(SHOP_LINES, talk.falasVenda),
    quests: questsFrom(talk.missoes, asset.nome || type.split('/').pop()),
    questLines: linesFrom(QUEST_LINES, talk.falasMissao),
    bank: !!talk.banco,
    bankLines: linesFrom(BANK_LINES, talk.falasBanco)
  };
}

// ================================================================================================================================================================================================================================================
// questsFrom
// As missões do NPC (gerador → Missões): [{ id, name, words, ask, kind
// ('item': trazer amount do target; 'kill': matar amount da criatura
// target), target, amount, reward ({ type, count } ou null), xp, money }].
// O id junta o NPC e o nome da missão (é o que fica guardado no player).

function questsFrom(list, npcName) {
  if (!Array.isArray(list)) return [];
  const int = (value, max) => Math.min(max, Math.max(0, Math.floor(Number(value)) || 0));
  return list.filter(e => e && typeof e.nome === 'string' && e.nome.trim() && ['item', 'matar'].includes(e.tipo) &&
    typeof e.alvo === 'string' && getAsset(splitType(e.alvo).asset)).map(e => {
    const name = e.nome.trim().slice(0, 60);
    const words = String(e.palavras || '').split(',').map(normalizeSpeech).filter(Boolean);
    const reward = e.recompensa && typeof e.recompensa.tipo === 'string' && getAsset(splitType(e.recompensa.tipo).asset)
      ? { type: e.recompensa.tipo, count: Math.max(1, int(e.recompensa.count, 100)) }
      : null;
    return {
      id: `${npcName}/${normalizeSpeech(name)}`,
      name,
      words: [...new Set([...words, normalizeSpeech(name)])].filter(Boolean),
      ask: String(e.pedido || '').trim() || `Pode me ajudar com ${name}? (sim / não)`,
      kind: e.tipo === 'matar' ? 'kill' : 'item',
      target: e.alvo,
      amount: Math.max(1, int(e.quantidade, MAX_QUEST_AMOUNT)),
      reward,
      xp: int(e.xp, 10000000),
      money: int(e.moedas, 10000000)
    };
  });
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
