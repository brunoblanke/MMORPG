// tests/ficha.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setAssets } from '../shared/assets.js';
import { fichaDe, reacoesA, GATILHOS, CAPACIDADES, EFEITOS } from '../shared/ficha.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { lerSprites } = createRequire(import.meta.url)(path.join(RAIZ, 'gerador', 'sprites.js'));
const sprites = lerSprites(RAIZ);
setAssets(sprites);
const existe = (id) => sprites.some(s => s.id === id);

const gatilhos = (ficha) => ficha.interacoes.map(i => i.gatilho.tipo);
const efeitos = (ficha) => ficha.interacoes.flatMap(i => i.efeitos.map(e => e.tipo));

test('toda receita do gerador vira uma ficha completa e só com gatilhos, capacidades e efeitos conhecidos', () => {
  assert.ok(sprites.length > 100);
  for (const asset of sprites) {
    const ficha = fichaDe(asset.id);
    assert.ok(ficha, asset.id);
    assert.equal(ficha.id, asset.id);
    assert.ok(['chao', 'parede', 'objeto', 'criatura'].includes(ficha.camada), asset.id);
    for (const interacao of ficha.interacoes) {
      assert.ok(GATILHOS.includes(interacao.gatilho.tipo), `${asset.id}: gatilho ${interacao.gatilho.tipo}`);
      if (interacao.gatilho.capacidade) assert.ok(CAPACIDADES.includes(interacao.gatilho.capacidade), `${asset.id}: capacidade ${interacao.gatilho.capacidade}`);
      for (const efeito of interacao.efeitos) assert.ok(EFEITOS.includes(efeito.tipo), `${asset.id}: efeito ${efeito.tipo}`);
    }
  }
  assert.equal(fichaDe('nao/existe/nada'), null);
});

test('pasta e grupo só vão para organizacao', () => {
  const ficha = fichaDe('itens/ferramentas/pick');
  assert.deepEqual(ficha.organizacao, { grupo: 'itens', pasta: 'ferramentas' });
  assert.equal(JSON.stringify(ficha.tracos).includes('ferramentas'), false);
});

test('pá, picareta, machete, foice, corda, vara e chave: a capacidade vem do Uso, não do código de cada uma', () => {
  const caps = { 'itens/ferramentas/shovel': ['cavar'], 'itens/ferramentas/pick': ['quebrar', 'cavar'], 'itens/espadas/machete': ['cortar'], 'itens/ferramentas/scythe': ['colher'], 'itens/ferramentas/rope': ['puxar'], 'itens/ferramentas/fishing-rod': ['pescar'], 'itens/ferramentas/chave-dourada': ['abrir'] };
  for (const [id, esperado] of Object.entries(caps)) {
    if (!existe(id)) continue;
    assert.deepEqual(fichaDe(id).tracos.capacidade, esperado, id);
  }
});

test('mato e plantação cortados somem e rebrotam; monte e buraco da pá reagem a cavar', () => {
  const mato = fichaDe('estrutura/natureza/jungle-grass');
  assert.equal(reacoesA(mato, 'cortar')[0].efeitos[0].tipo, 'remover');
  assert.ok(reacoesA(mato, 'cortar')[0].efeitos[0].rebroteMs > 0);
  const monte = fichaDe('estrutura/entradas/buraco-pedra-fechado');
  const cavar = reacoesA(monte, 'cavar')[0];
  assert.deepEqual(cavar.efeitos.map(e => e.tipo), ['definir-estado', 'abrir-buraco']);
  assert.equal(monte.tracos.estado.ativo, 'estrutura/entradas/buraco-pedra-aberto');
});

test('piso com minhocas e água pescável reagem às ferramentas, como qualquer objeto', () => {
  const agua = fichaDe('estrutura/pisos/agua-1');
  assert.equal(agua.camada, 'chao');
  assert.equal(agua.tracos.colisao.conjunto.passagem, true);
  const grama = Object.keys(sprites).length && sprites.find(s => s.id.startsWith('estrutura/pisos/') && s.propriedades && s.propriedades.minhocas > 0);
  if (grama) assert.equal(reacoesA(fichaDe(grama.id), 'cavar')[0].condicoes.chance, grama.propriedades.minhocas);
});

test('parede: o conjunto tem o padrão e cada peça o dela (porta aberta passa, janela e arco)', () => {
  const parede = fichaDe('estrutura/paredes/pedra-1');
  const { conjunto, porPeca } = parede.tracos.colisao;
  assert.equal(conjunto.passagem, true);
  assert.equal(porPeca.x.passagem, true);
  assert.equal(porPeca['porta-x'].passagem, true);
  assert.equal(porPeca['porta-x-aberta'].passagem, false);
  assert.equal(porPeca['arco-x-oeste'].passagem, false);
  assert.equal(porPeca['janela-x'].arremesso, false);
  assert.equal(fichaDe('estrutura/paredes/pedra-1#porta-x').tracos.colisao.desta.passagem, true);
  const porta = fichaDe('estrutura/paredes/pedra-1#porta-x');
  assert.equal(porta.tracos.estado.tipo, 'porta');
  assert.ok(reacoesA(porta, 'abrir').length === 1 && gatilhos(porta).includes('clicar'));
});

test('balcão deixa passar o arremesso e apoia item; empilha por padrão em tudo que tem altura', () => {
  const balcao = fichaDe('estrutura/balcoes/balcao-1#x');
  assert.equal(balcao.tracos.colisao.desta.arremesso, false);
  assert.equal(balcao.tracos.colisao.desta.apoia, true);
  assert.equal(balcao.tracos.empilha.bloqueada, false);
});

test('NPC: os módulos de conversa saem do que a receita tem; banqueiro e capitão', () => {
  const banqueiro = existe('personagens/npcs/banqueiro') ? fichaDe('personagens/npcs/banqueiro') : null;
  if (banqueiro) {
    assert.ok(banqueiro.tracos.conversa.modulos.includes('banco'));
    assert.ok(gatilhos(banqueiro).includes('falar'));
  }
  const gorn = fichaDe('personagens/npcs/gorn');
  assert.ok(gorn.tracos.conversa.modulos.includes('loja'));
  assert.ok(gorn.tracos.vivo);
});

test('criatura: vivo, ia, ataques e morte; player sem traços de NPC', () => {
  const rato = fichaDe('criaturas/mamiferos/rat');
  assert.ok(rato.tracos.vivo.vida > 0);
  assert.ok(['normal', 'foge'].includes(rato.tracos.ia.modo));
  assert.equal(rato.tracos.conversa, undefined);
  assert.ok(efeitos(rato).includes('dano'));
});

test('teletransporte, placa, baú de quest, alavanca, cama e bueiro viram interações pelo Uso', () => {
  const casos = [
    ['estrutura/teletransportes/teletransporte-1', 'pisar', 'teletransportar'],
    ['decoracao/sinalizacao/placa-baixa', 'clicar', 'mostrar-texto'],
    ['decoracao/baus/bau-quest', 'clicar', 'dar-itens'],
    ['decoracao/alavancas/alavanca-1', 'clicar', 'acionar-alvos'],
    ['decoracao/moveis/cama', 'clicar', 'deitar'],
    ['estrutura/entradas/bueiro', 'clicar', 'trocar-andar']
  ];
  for (const [id, gatilho, efeito] of casos) {
    if (!existe(id)) continue;
    const ficha = fichaDe(id);
    assert.ok(ficha.interacoes.some(i => i.gatilho.tipo === gatilho && i.efeitos.some(e => e.tipo === efeito)), id);
  }
});

test('amuleto da perda e anel de cura entram em bonus; comida e poção em consome', () => {
  if (existe('itens/amuletos-e-colares/amulet-of-loss')) assert.equal(fichaDe('itens/amuletos-e-colares/amulet-of-loss').tracos.bonus.protegePerda, true);
  const anel = fichaDe('itens/aneis/ring-of-healing');
  assert.ok(anel.tracos.bonus.regen.hp > 0);
  assert.ok(fichaDe('itens/comidas/bread').tracos.consome.alimento > 0);
});

test('a receita manda mais que a pasta: espaço, skill, transição e colisão de parede escolhidos na ficha', async () => {
  const { setAssets: usar } = await import('../shared/assets.js');
  const { itemInfo } = await import('../shared/items.js');
  const { isStairsType, isHoleType, blocksThrow, supportsItems } = await import('../shared/assets.js');
  const base = (id, extra, ferramenta = 'objetos') => {
    const [grupo, pasta, nome] = id.split('/');
    return { id, ferramenta, grupo, pasta, nome, url: '/x.png', quadro: 32, quadros: 1, pecas: [], propriedades: extra };
  };
  usar([
    base('itens/espadas/capacete-esquisito', { slot: 'cabeca', skillArma: 'nenhuma', def: 2, move: true }),
    base('itens/espadas/espada-comum', { move: true }),
    base('estrutura/escadas/escada-que-nao-e', { transicao: 'nenhuma' }),
    base('estrutura/entradas/virou-escada', { transicao: 'escada' }),
    base('decoracao/moveis/buraco-na-mesa', { transicao: 'buraco' }),
    { ...base('estrutura/paredes/parede-baixa', { colisao: { arremesso: false, apoia: true } }, 'paredes'), pecas: ['x'] },
    { ...base('estrutura/cercas/cerca-alta', { colisao: { arremesso: true, apoia: false } }, 'paredes'), pecas: ['x'] }
  ]);
  assert.equal(itemInfo('itens/espadas/capacete-esquisito').slot, 'cabeca');
  assert.equal(itemInfo('itens/espadas/capacete-esquisito').weaponSkill, null);
  assert.equal(itemInfo('itens/espadas/espada-comum').slot, 'arma');
  assert.equal(fichaDe('itens/espadas/capacete-esquisito').tracos.equipavel.slot, 'cabeca');
  assert.equal(isStairsType('estrutura/escadas/escada-que-nao-e'), false);
  assert.equal(isStairsType('estrutura/entradas/virou-escada'), true);
  assert.equal(isHoleType('decoracao/moveis/buraco-na-mesa'), true);
  assert.equal(blocksThrow('estrutura/paredes/parede-baixa#x'), false);
  assert.equal(supportsItems('estrutura/paredes/parede-baixa#x'), true);
  assert.equal(blocksThrow('estrutura/cercas/cerca-alta#x'), true);
  setAssets(sprites);
});
