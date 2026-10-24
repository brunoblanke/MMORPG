// shared/ficha.js

import {
  getAsset, splitType, displayName, objectProps, objectUse, activeAs, startsActive, stairKind, doorState, wallProps, blocksThrow, supportsItems,
  floorBehavior, creatureBehavior, creatureFlies, creatureStats, creaturePowers, creatureLoot, creatureVoices, isFloorType, isStairsType, isHoleType, WALL_PIECES
} from './assets.js';
import { itemInfo } from './items.js';

// A ficha de um objeto (modelo de objetos): tudo no jogo é um objeto com uma aparência, uma camada, uma lista de
// traços (o que ele é) e uma lista de interações (o que acontece quando algo é feito com ele). Pasta, grupo e
// ferramenta do gerador só organizam (organizacao) e nunca mudam o que o objeto faz.
//
// Esta é a leitura única: monta a ficha a partir da receita do gerador (o formato de hoje) e é por ela que o
// jogo, o editor e o gerador passam a perguntar o que o objeto é e faz. Quando as receitas forem convertidas ao
// formato novo, só esta função muda.
//
//   ficha = { id, nome, organizacao: { grupo, pasta }, aparencia: { layout, ... }, camada, tracos: {...}, interacoes: [...] }
//
// Interação = { gatilho, condicoes, efeitos }:
//   gatilho   { tipo: 'clicar' | 'capacidade' | 'pisar' | 'falar' | 'ser-atingido' | 'morrer' | 'item-em-cima' | 'tempo', capacidade? }
//   condicoes { alcance?, nivel?, quest?, chave?, estado?, chance?, tem-item? }  (todas valem, "e")
//   efeitos   [{ tipo, ... }]  (ver EFEITOS)

export const GATILHOS = ['clicar', 'capacidade', 'pisar', 'falar', 'ser-atingido', 'morrer', 'item-em-cima', 'tempo'];

export const CAPACIDADES = ['cavar', 'quebrar', 'cortar', 'colher', 'puxar', 'pescar', 'abrir'];

export const EFEITOS = [
  'alternar-estado', 'definir-estado', 'alimentar', 'curar', 'puxar-de-baixo', 'falar', 'abrir-buraco', 'cair', 'remover', 'trocar-andar', 'teletransportar', 'dar-itens', 'gastar-item', 'soltar-item',
  'mostrar-texto', 'abrir-deposito', 'receber-carta', 'dano', 'estado-de-dano', 'deitar', 'acionar-alvos', 'trancar', 'treinar-skill', 'efeito-visual', 'conversar'
];

export const REBROTE_MS = 120000;

// Os efeitos que se escolhem na ficha (gerador → Interações) e os campos de cada um: texto, numero, item, escolha
// ([valores]), destino (x, y, andar). `alvo` diz em quem o efeito age: 'alvo' (o objeto ou criatura onde a interação
// está) ou 'ator' (quem usou, pisou ou falou).
export const ESQUEMA_EFEITOS = {
  falar: { rotulo: 'Falar (o objeto diz um texto)', campos: [{ chave: 'texto', rotulo: 'Texto', tipo: 'texto' }] },
  'mostrar-texto': { rotulo: 'Mostrar mensagem a quem usou', campos: [{ chave: 'texto', rotulo: 'Texto', tipo: 'texto' }] },
  dano: { rotulo: 'Causar dano', campos: [{ chave: 'valor', rotulo: 'Dano', tipo: 'numero' }, { chave: 'elemento', rotulo: 'Elemento', tipo: 'escolha', opcoes: ['physical', 'fire', 'energy', 'poison', 'ice', 'earth', 'death', 'holy'] }, { chave: 'alvo', rotulo: 'Em quem', tipo: 'escolha', opcoes: ['alvo', 'ator'] }] },
  curar: { rotulo: 'Curar', campos: [{ chave: 'hp', rotulo: 'Vida', tipo: 'numero' }, { chave: 'mana', rotulo: 'Mana', tipo: 'numero' }, { chave: 'alvo', rotulo: 'Em quem', tipo: 'escolha', opcoes: ['ator', 'alvo'] }] },
  'estado-de-dano': { rotulo: 'Aplicar veneno, fogo ou energia', campos: [{ chave: 'estado', rotulo: 'Estado', tipo: 'escolha', opcoes: ['poison', 'fire', 'energy'] }, { chave: 'dano', rotulo: 'Dano por vez', tipo: 'numero' }, { chave: 'ticks', rotulo: 'Vezes', tipo: 'numero' }, { chave: 'alvo', rotulo: 'Em quem', tipo: 'escolha', opcoes: ['alvo', 'ator'] }] },
  'soltar-item': { rotulo: 'Soltar um item ao lado', campos: [{ chave: 'item', rotulo: 'Item', tipo: 'item' }, { chave: 'quantidade', rotulo: 'Quantos', tipo: 'numero' }] },
  'dar-itens': { rotulo: 'Dar um item a quem usou', campos: [{ chave: 'item', rotulo: 'Item', tipo: 'item' }, { chave: 'quantidade', rotulo: 'Quantos', tipo: 'numero' }, { chave: 'umaVez', rotulo: 'Uma vez por player', tipo: 'escolha', opcoes: ['sim', 'nao'] }] },
  'efeito-visual': { rotulo: 'Mostrar um efeito visual', campos: [{ chave: 'nome', rotulo: 'Efeito', tipo: 'efeito' }] },
  teletransportar: { rotulo: 'Teletransportar quem usou', campos: [{ chave: 'destino', rotulo: 'Destino', tipo: 'destino' }] },
  'alternar-estado': { rotulo: 'Alternar normal e ativo', campos: [] },
  'definir-estado': { rotulo: 'Definir o estado', campos: [{ chave: 'valor', rotulo: 'Estado', tipo: 'escolha', opcoes: ['ativo', 'normal'] }, { chave: 'voltaEmMs', rotulo: 'Volta sozinho em (ms, 0 = não)', tipo: 'numero' }] },
  remover: { rotulo: 'Remover o objeto (rebrota)', campos: [{ chave: 'rebroteMs', rotulo: 'Rebrota em (ms, 0 = não)', tipo: 'numero' }] }
};
export const PORTA_FECHA_MS = 3000;

const CAMADAS = { pisos: 'chao', paredes: 'parede', objetos: 'objeto', criaturas: 'criatura' };
const CAPACIDADE_DA_FERRAMENTA = {
  'ferramenta-pa': ['cavar'], 'ferramenta-picareta': ['quebrar', 'cavar'], 'ferramenta-machete': ['cortar'], 'ferramenta-foice': ['colher'],
  'ferramenta-corda': ['puxar'], 'ferramenta-pesca': ['pescar'], 'ferramenta-chave': ['abrir']
};

// ================================================================================================================================================================================================================================================
// normalizarInteracoes
// As interações escritas na receita (propriedades.interacoes): só gatilhos, condições e efeitos do vocabulário, com
// os campos limpos. Cada uma sai marcada como `propria` (feita na ficha, não derivada do Uso).

export function normalizarInteracoes(lista) {
  if (!Array.isArray(lista)) return [];
  const int = (valor, max) => Math.min(max, Math.max(0, Math.floor(Number(valor)) || 0));
  const texto = (valor, max = 200) => String(valor ?? '').trim().slice(0, max);
  const resultado = [];
  for (const bruta of lista.slice(0, 20)) {
    if (!bruta || typeof bruta !== 'object') continue;
    const tipo = GATILHOS.includes(bruta.gatilho && bruta.gatilho.tipo) ? bruta.gatilho.tipo : null;
    if (!tipo) continue;
    const gatilho = { tipo };
    if (tipo === 'capacidade') {
      if (!CAPACIDADES.includes(bruta.gatilho.capacidade)) continue;
      gatilho.capacidade = bruta.gatilho.capacidade;
    }
    const c = bruta.condicoes || {};
    const condicoes = {};
    if (c.alcance !== undefined) condicoes.alcance = int(c.alcance, 12);
    if (c.nivel) condicoes.nivel = int(c.nivel, 1000);
    if (c.quest) condicoes.quest = texto(c.quest, 60);
    if (c.palavra) condicoes.palavra = texto(c.palavra, 60);
    if (c.chance) condicoes.chance = Math.min(100, Math.max(1, int(c.chance, 100)));
    if (c['tem-item']) condicoes['tem-item'] = texto(c['tem-item'], 120);
    const efeitos = [];
    for (const e of (Array.isArray(bruta.efeitos) ? bruta.efeitos : []).slice(0, 12)) {
      const esquema = e && ESQUEMA_EFEITOS[e.tipo];
      if (!esquema) continue;
      const efeito = { tipo: e.tipo };
      for (const campo of esquema.campos) {
        const valor = e[campo.chave];
        if (campo.tipo === 'numero') efeito[campo.chave] = int(valor, 100000);
        else if (campo.tipo === 'escolha') efeito[campo.chave] = campo.opcoes.includes(valor) ? valor : campo.opcoes[0];
        else if (campo.tipo === 'destino') {
          const d = valor || {};
          if (![d.x, d.y, d.z].every(Number.isInteger)) { efeito.invalido = true; continue; }
          efeito[campo.chave] = { x: d.x, y: d.y, z: d.z };
        } else efeito[campo.chave] = texto(valor);
      }
      if (!efeito.invalido) efeitos.push(efeito);
    }
    if (efeitos.length) resultado.push({ gatilho, condicoes, efeitos, propria: true });
  }
  return resultado;
}

// ================================================================================================================================================================================================================================================
// capacidadesDe
// As capacidades de uma ferramenta pelo Uso dela (ferramenta-pa → cavar…).

export function capacidadesDe(uso) {
  return (CAPACIDADE_DA_FERRAMENTA[uso] || []).slice();
}

// ================================================================================================================================================================================================================================================
// fichaDe
// A ficha do tipo ('grupo/pasta/nome' ou 'grupo/pasta/nome#peça'), ou null se a folha não existe.

export function fichaDe(type) {
  const { asset: id, piece } = splitType(type);
  const asset = getAsset(id);
  if (!asset) return null;
  const props = asset.propriedades || {};
  const ficha = {
    id,
    nome: displayName(id),
    organizacao: { grupo: asset.grupo || null, pasta: asset.pasta || null },
    aparencia: aparenciaDe(asset),
    camada: CAMADAS[asset.ferramenta] || 'objeto',
    tracos: {},
    interacoes: []
  };
  colisaoDe(ficha, asset, piece);
  empilhaEItem(ficha, asset, props, piece);
  estadoDe(ficha, id, props, piece);
  equiparEUsar(ficha, id, props);
  vidaEConversa(ficha, id, asset, props);
  transicaoEUso(ficha, id, asset, props);
  pisoDe(ficha, id, props);
  ficha.interacoes.push(...normalizarInteracoes(props.interacoes));
  const proprias = (Array.isArray(props.capacidade) ? props.capacidade : []).filter(c => CAPACIDADES.includes(c));
  if (proprias.length) ficha.tracos.capacidade = [...new Set([...(ficha.tracos.capacidade || []), ...proprias])];
  return ficha;
}

// ================================================================================================================================================================================================================================================
// aparenciaDe
// Só o desenho: o layout da folha (a ferramenta do gerador) e as medidas dela.

function aparenciaDe(asset) {
  const layouts = { pisos: 'piso', paredes: 'pecas-de-parede', objetos: 'bloco', criaturas: 'criatura' };
  const aparencia = { layout: layouts[asset.ferramenta] || 'bloco', quadro: asset.quadro || 32, quadros: asset.quadros || 1 };
  if (asset.msPorQuadro) aparencia.msPorQuadro = asset.msPorQuadro;
  if (Array.isArray(asset.direcoes) && asset.direcoes.length) aparencia.direcoes = asset.direcoes;
  if (asset.sqms > 1) aparencia.sqms = asset.sqms;
  if (Array.isArray(asset.pecas) && asset.pecas.length) aparencia.pecas = asset.pecas;
  return aparencia;
}

// ================================================================================================================================================================================================================================================
// colisaoDe
// Traço colisao: passagem, arremesso e visão. Um conjunto (parede, escada de degraus) tem o valor padrão em
// `conjunto` e cada peça pode ter o dela em `porPeca`. Bloqueio ligado em `empilha.bloqueada` impede empilhar em cima.

function colisaoDe(ficha, asset, piece) {
  const props = asset.propriedades || {};
  if (asset.ferramenta === 'paredes') {
    const pecas = [...new Set([...WALL_PIECES, ...(Array.isArray(asset.pecas) ? asset.pecas : [])])];
    const porPeca = {};
    for (const nome of pecas) {
      const [, passagem] = wallProps(nome);
      porPeca[nome] = { passagem, arremesso: blocksThrow(`${asset.id}#${nome}`), apoia: !!supportsItems(`${asset.id}#${nome}`) };
    }
    ficha.tracos.colisao = { conjunto: { passagem: true, arremesso: blocksThrow(`${asset.id}#x`) }, porPeca };
    if (piece && porPeca[piece]) ficha.tracos.colisao.desta = porPeca[piece];
    return;
  }
  const floor = asset.ferramenta === 'pisos' ? floorBehavior(asset.id) : null;
  const passagem = floor ? floor.blocks : !!props.bloqueia;
  if (passagem || (floor && floor.edgeBlocksThrow)) ficha.tracos.colisao = { conjunto: { passagem, arremesso: floor ? floor.edgeBlocksThrow : false } };
  else ficha.tracos.colisao = { conjunto: { passagem: false, arremesso: false } };
}

// ================================================================================================================================================================================================================================================
// empilhaEItem
// Traço empilha (volume, passo): tudo que tem volume deixa empilhar em cima, a não ser que se bloqueie.
// Traço item: peso, mover e pilha.

function empilhaEItem(ficha, asset, props, piece) {
  const p = objectProps(piece ? `${asset.id}#${piece}` : asset.id);
  if (p.hasVolume) ficha.tracos.empilha = { volume: p.volume, passo: p.climb, apoia: !!supportsItems(piece ? `${asset.id}#${piece}` : asset.id), bloqueada: false };
  if (asset.ferramenta === 'objetos') {
    const info = itemInfo(asset.id);
    if (p.movable || info.weight) ficha.tracos.item = { peso: info.weight, move: p.movable, pilha: info.stack || 0 };
  }
  if (asset.ferramenta === 'criaturas' && creatureFlies(asset.id)) ficha.tracos.animacao = { sempre: true };
  if (asset.msPorQuadro) ficha.tracos.animacao = { ...(ficha.tracos.animacao || {}), quadros: asset.quadros || 1, ms: asset.msPorQuadro };
}

// ================================================================================================================================================================================================================================================
// estadoDe
// Traço estado: todo objeto tem o normal e o ativo; `ativo` é o desenho do ativo (opcional), `comeca` se começa
// ativo. Porta é aberta/fechada pelo mesmo traço.

function estadoDe(ficha, id, props, piece) {
  const type = piece ? `${id}#${piece}` : id;
  const ativo = activeAs(type);
  const porta = doorState(type);
  if (ativo || porta) {
    ficha.tracos.estado = { ativo: ativo ? splitType(ativo).asset : null, comeca: porta ? porta.open : startsActive(type) || props.comecaAtivo === true };
    if (porta) ficha.tracos.estado.tipo = 'porta';
  }
  if (!ativo && !porta) return;
  if (porta) {
    ficha.interacoes.push({ gatilho: { tipo: 'clicar' }, condicoes: { alcance: 1, 'nao-trancada': true, nivel: 'dados.nivel', quest: 'dados.quest' }, efeitos: [{ tipo: 'alternar-estado', fechaSozinhoQuando: 'dados.nivel ou dados.quest', ms: PORTA_FECHA_MS }] });
    ficha.interacoes.push({ gatilho: { tipo: 'capacidade', capacidade: 'abrir' }, condicoes: { alcance: 1, chave: 'dados.chave', estado: 'fechada' }, efeitos: [{ tipo: 'trancar', alternar: true }] });
  }
}

// ================================================================================================================================================================================================================================================
// equiparEUsar
// Traços equipavel, bonus, consome, container e luz.

function equiparEUsar(ficha, id, props) {
  if (ficha.camada !== 'objeto') return;
  const info = itemInfo(id);
  if (info.slot) {
    ficha.tracos.equipavel = { slot: info.slot, atk: info.atk, def: info.def, skill: info.weaponSkill, duasMaos: info.twoHanded, municao: info.ammoType || null };
  }
  const bonus = {};
  if (info.ml) bonus.ml = info.ml;
  if (info.speed) bonus.speed = info.speed;
  if (Object.keys(info.resist || {}).length) bonus.resistencias = info.resist;
  if (info.regen.hp || info.regen.mana) bonus.regen = { hp: info.regen.hp, mana: info.regen.mana, duracao: info.burn };
  if (info.protectsDeath) bonus.protegePerda = true;
  if (info.invisibleWorn) bonus.invisivel = true;
  if (info.def && !ficha.tracos.equipavel) bonus.def = info.def;
  if (Object.keys(bonus).length) ficha.tracos.bonus = bonus;
  if (info.food) {
    ficha.tracos.consome = { alimento: info.food };
    ficha.interacoes.push({ gatilho: { tipo: 'clicar', onde: 'inventario' }, condicoes: {}, efeitos: [{ tipo: 'alimentar', segundos: info.food }] });
  }
  if (info.heal) {
    ficha.tracos.consome = { ...(ficha.tracos.consome || {}), cura: info.heal };
    ficha.interacoes.push({ gatilho: { tipo: 'clicar', onde: 'inventario', mira: true }, condicoes: { alcance: 7 }, efeitos: [{ tipo: 'curar', ...info.heal }, { tipo: 'soltar-item', item: 'itens/liquidos/vial' }] });
  }
  if (info.size) ficha.tracos.container = { espacos: info.size, aceita: info.slot === 'municao' ? 'municao' : null };
  if (info.light) ficha.tracos.luz = { raio: info.light, duracao: info.burn || 0 };
}

// ================================================================================================================================================================================================================================================
// vidaEConversa
// Traços vivo, ia, ataques, morte, fala e conversa (hoje só as criaturas têm).

function vidaEConversa(ficha, id, asset, props) {
  if (asset.ferramenta !== 'criaturas') return;
  const modo = creatureBehavior(id);
  const stats = creatureStats(id);
  const poderes = creaturePowers(id);
  ficha.tracos.vivo = { vida: stats.hp || 0, xp: stats.xp || 0, velocidade: stats.spd || 0, armadura: stats.def || 0, defesa: stats.defense || 0, ataque: stats.atk || 0, resistencias: poderes.resistances };
  ficha.tracos.ia = { modo: modo === 'npc' ? 'passeia' : modo };
  if (poderes.attacks.length || poderes.poison || poderes.summon || poderes.reflect) ficha.tracos.ataques = { lista: poderes.attacks, veneno: poderes.poison, invoca: poderes.summon, reflexo: poderes.reflect };
  ficha.tracos.morte = { loot: creatureLoot(id), cadaver: !!props.cadaver, respawnMs: poderes.respawn };
  const falas = creatureVoices(id);
  if (falas.length) ficha.tracos.fala = { linhas: falas };
  ficha.interacoes.push({ gatilho: { tipo: 'ser-atingido' }, condicoes: {}, efeitos: [{ tipo: 'dano' }] });
  if (modo !== 'npc') return;
  const talk = props.conversa || {};
  const modulos = [];
  if (Array.isArray(talk.topicos) && talk.topicos.length) modulos.push('topicos');
  if ((Array.isArray(talk.vende) && talk.vende.length) || (Array.isArray(talk.compra) && talk.compra.length)) modulos.push('loja');
  if (Array.isArray(talk.missoes) && talk.missoes.length) modulos.push('missoes');
  if (talk.banco) modulos.push('banco');
  if (talk.vocacao) modulos.push('vocacao');
  if (Array.isArray(talk.viagens) && talk.viagens.length) modulos.push('viagens');
  ficha.tracos.conversa = { raio: Number.isFinite(Number(talk.raio)) ? Number(talk.raio) : 2, modulos };
  ficha.interacoes.push({ gatilho: { tipo: 'falar' }, condicoes: { alcance: ficha.tracos.conversa.raio }, efeitos: [{ tipo: 'conversar', modulos }] });
}

// ================================================================================================================================================================================================================================================
// transicaoEUso
// Traços transicao, texto, entrega e capacidade, e as interações de cada Uso do gerador.

function transicaoEUso(ficha, id, asset, props, uso = objectUse(id)) {
  const tracos = ficha.tracos;
  const clicar = (efeitos, condicoes = { alcance: 1 }) => ficha.interacoes.push({ gatilho: { tipo: 'clicar' }, condicoes, efeitos });
  const com = (capacidade, efeitos, condicoes = { alcance: 1 }) => ficha.interacoes.push({ gatilho: { tipo: 'capacidade', capacidade }, condicoes, efeitos });
  if (isStairsType(id)) tracos.transicao = { tipo: 'escada', forma: stairKind(id), quando: 'pisar' };
  if (isHoleType(id)) {
    tracos.transicao = { tipo: 'buraco', quando: 'pisar', destino: 'andar-de-baixo' };
    com('puxar', [{ tipo: 'puxar-de-baixo' }]);
  }
  if (CAPACIDADE_DA_FERRAMENTA[uso]) tracos.capacidade = CAPACIDADE_DA_FERRAMENTA[uso].slice();
  if (uso === 'placa' || uso === 'livro') {
    tracos.texto = { cor: uso === 'placa' ? 'dados.cor' : null };
    clicar([{ tipo: 'mostrar-texto', de: 'dados.texto', como: uso }], uso === 'livro' ? {} : { alcance: 1 });
  } else if (uso === 'bau-quest') {
    tracos.entrega = { itens: 'dados.itens', umaVezPorPlayer: true };
    clicar([{ tipo: 'dar-itens', de: 'dados.itens', umaVezPorPlayer: true }]);
  } else if (uso === 'corda') {
    tracos.transicao = { tipo: 'escada', forma: 'corda', quando: 'capacidade:puxar', destino: 'andar-de-cima' };
    com('puxar', [{ tipo: 'trocar-andar', sentido: 'cima' }]);
  } else if (uso === 'pa' || uso === 'picareta' || uso === 'pa-cai') {
    tracos.transicao = { tipo: 'buraco', quando: 'estado:ativo', destino: 'andar-de-baixo' };
    const efeitos = [{ tipo: 'definir-estado', valor: 'ativo', permanente: true }, { tipo: 'abrir-buraco', sentido: 'baixo' }];
    if (uso === 'pa-cai') efeitos.push({ tipo: 'cair' });
    com('cavar', efeitos);
    com('puxar', [{ tipo: 'puxar-de-baixo' }], { alcance: 1, estado: 'ativo' });
  } else if (uso === 'machete' || uso === 'foice') {
    com(uso === 'machete' ? 'cortar' : 'colher', [{ tipo: 'remover', rebroteMs: REBROTE_MS }, { tipo: 'efeito-visual', nome: 'poff' }]);
  } else if (uso === 'descer') {
    tracos.transicao = { tipo: 'buraco', quando: 'clicar', destino: 'andar-de-baixo' };
    clicar([{ tipo: 'trocar-andar', sentido: 'baixo' }]);
    com('puxar', [{ tipo: 'puxar-de-baixo' }]);
  } else if (uso === 'alavanca') {
    clicar([{ tipo: 'alternar-estado' }, { tipo: 'acionar-alvos', de: 'dados.alvos' }]);
  } else if (uso === 'cama') {
    clicar([{ tipo: 'deitar' }], { alcance: 1, semCombate: true, livre: true });
  } else if (uso === 'deposito') {
    clicar([{ tipo: 'abrir-deposito' }]);
  } else if (uso === 'correio') {
    ficha.interacoes.push({ gatilho: { tipo: 'item-em-cima' }, condicoes: { item: 'postal' }, efeitos: [{ tipo: 'receber-carta' }] });
  } else if (uso === 'teleporte') {
    tracos.transicao = { tipo: 'teleporte', quando: 'pisar', destino: 'dados.destino' };
    ficha.interacoes.push({ gatilho: { tipo: 'pisar' }, condicoes: {}, efeitos: [{ tipo: 'teletransportar', de: 'dados.destino' }, { tipo: 'efeito-visual', nome: 'teleport' }] });
  } else if (!uso && tracos.estado && tracos.estado.tipo !== 'porta' && ficha.camada === 'objeto' && !(tracos.item && tracos.item.move)) {
    clicar([{ tipo: 'alternar-estado' }]);
  }
  if (uso === 'ferramenta-pesca') ficha.tracos.capacidade = ['pescar'];
}

// ================================================================================================================================================================================================================================================
// descreverUso
// O que o Uso faz, em frases (uma por interação), pro painel do gerador. Vazio se o Uso não tem interação.

export function descreverUso(uso) {
  if (!uso) return [];
  const ficha = { camada: 'objeto', tracos: {}, interacoes: [] };
  transicaoEUso(ficha, '', null, {}, uso);
  const quando = (g) => g.tipo === 'capacidade' ? `Ao usar uma ferramenta de ${g.capacidade}` : g.tipo === 'clicar' ? 'Ao clicar' : g.tipo === 'pisar' ? 'Ao pisar' : g.tipo === 'item-em-cima' ? 'Ao jogar um item em cima' : `Ao ${g.tipo}`;
  const efeito = (e) => (ESQUEMA_EFEITOS[e.tipo] ? ESQUEMA_EFEITOS[e.tipo].rotulo : e.tipo.replace(/-/g, ' '));
  return ficha.interacoes.map(i => `${quando(i.gatilho)}: ${i.efeitos.map(efeito).join(', ')}`);
}

// ================================================================================================================================================================================================================================================
// pisoDe
// O que o piso faz vira reação comum: pisar → dano, pescar → peixe, cavar → minhoca.

function pisoDe(ficha, id, props) {
  if (ficha.camada !== 'chao') return;
  const piso = floorBehavior(id);
  if (piso.damage) ficha.interacoes.push({ gatilho: { tipo: 'pisar' }, condicoes: {}, efeitos: [{ tipo: 'dano', porSegundo: piso.damage }] });
  if (piso.fish.length) ficha.interacoes.push({ gatilho: { tipo: 'capacidade', capacidade: 'pescar' }, condicoes: { alcance: 6, 'tem-item': 'isca' }, efeitos: [{ tipo: 'gastar-item', item: 'isca' }, { tipo: 'treinar-skill', skill: 'fishing' }, { tipo: 'soltar-item', dePeixes: piso.fish }] });
  if (piso.worms) ficha.interacoes.push({ gatilho: { tipo: 'capacidade', capacidade: 'cavar' }, condicoes: { alcance: 1, chance: piso.worms }, efeitos: [{ tipo: 'soltar-item', item: 'minhoca' }] });
  if (piso.blocks) ficha.tracos.colisao = { conjunto: { passagem: true, arremesso: false } };
  if (piso.fish.length) ficha.tracos.agua = { peixes: piso.fish };
  if (piso.edgeBlocks) ficha.tracos.bordas = { bloqueia: true, arremesso: piso.edgeBlocksThrow };
}

// ================================================================================================================================================================================================================================================
// reacoesA
// As interações da ficha que reagem à capacidade (cavar, cortar…): o que acontece quando uma ferramenta com essa
// capacidade é usada nesse objeto.

export function reacoesA(ficha, capacidade) {
  return ficha.interacoes.filter(i => i.gatilho.tipo === 'capacidade' && i.gatilho.capacidade === capacidade);
}

// ================================================================================================================================================================================================================================================
// interacoesDe
// As interações do tipo que disparam com o gatilho (e, se pedido, a capacidade). Sem a folha, nenhuma.

export function interacoesDe(type, gatilho, capacidade = null) {
  const ficha = fichaDe(type);
  if (!ficha) return [];
  return ficha.interacoes.filter(i => i.gatilho.tipo === gatilho && (!capacidade || i.gatilho.capacidade === capacidade) && !i.gatilho.onde);
}

// ================================================================================================================================================================================================================================================
// clicavel
// Usar o objeto do mapa (botão direito ou duplo clique) faz algo: tem uma interação de clicar (a porta tem o
// comando dela, useDoor).

export function clicavel(type) {
  return !doorState(type) && interacoesDe(type, 'clicar').length > 0;
}

// ================================================================================================================================================================================================================================================
// pisavel
// Pisar no objeto faz algo (teletransportar, dano…): a lista dos efeitos.

export function efeitosAoPisar(type) {
  return interacoesDe(type, 'pisar').flatMap(i => i.efeitos);
}

// ================================================================================================================================================================================================================================================
// abreParaOAndarDeBaixo
// O objeto dá passagem ao andar de baixo (buraco, bueiro, monte que a pá abre): o topo da escada que cai nele fica fechado.

export function abreParaOAndarDeBaixo(type) {
  const ficha = fichaDe(type);
  return !!ficha && ficha.interacoes.some(i => i.efeitos.some(e => e.tipo === 'abrir-buraco' || (e.tipo === 'trocar-andar' && e.sentido === 'baixo')));
}

// ================================================================================================================================================================================================================================================
// tipoDeDados
// O que o editor pergunta pra esse objeto em cada posição do mapa (✎): 'texto', 'destino', 'alvos', 'itens', 'porta'
// (chave, nível e quest) ou 'chave'; null se não há nada a preencher. Sai das interações e dos traços, não da pasta.

export function tipoDeDados(type) {
  const ficha = fichaDe(type);
  if (!ficha) return null;
  if (doorState(type)) return 'porta';
  const de = new Set(ficha.interacoes.flatMap(i => i.efeitos.map(e => e.de)).filter(Boolean));
  if (de.has('dados.texto')) return 'texto';
  if (de.has('dados.destino')) return 'destino';
  if (de.has('dados.alvos')) return 'alvos';
  if (de.has('dados.itens')) return 'itens';
  if (ficha.tracos.capacidade && ficha.tracos.capacidade.includes('abrir')) return 'chave';
  if (ficha.tracos.container) return 'itens';
  return null;
}
