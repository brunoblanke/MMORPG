// ferramentas/criar-mapa-teste.js

// Gera um mapa de cidade para testar o jogo todo: templo, praça, lojas de todos os NPCs, banco, casas à venda,
// torre com 3 andares, lago de pesca, cemitério, fazenda, teletransportes, buracos, bueiro, pá, corda, alçapão
// e cavernas em dois andares (z -1 e -2) com criaturas.
//
// Uso: node ferramentas/criar-mapa-teste.js [saida.json]   (padrão: TRANSF/mapa-teste.json)
// O arquivo vira o mapa do servidor (data/map.json) ou é aberto no editor. Só entra o que tem folha no gerador.

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { lerSprites } = require('../gerador/sprites.js');

const RAIZ = path.join(__dirname, '..');
const GRID = 250;
const SAIDA_PADRAO = path.join(RAIZ, 'TRANSF', 'mapa-teste.json');

const PEDRA = 'estrutura/paredes/pedra-1';
const MADEIRA = 'estrutura/paredes/madeira-1';
const TIJOLO = 'estrutura/paredes/tijolo-1';
const BALCAO = 'estrutura/balcoes/balcao-1';
const ESCADA = 'estrutura/escadas/escada-madeira-1';
const CORDA = 'estrutura/escadas/sombra-buraco';
const GRAMAS = ['estrutura/pisos/grama-1', 'estrutura/pisos/grama-1', 'estrutura/pisos/grama-1', 'estrutura/pisos/grama-2', 'estrutura/pisos/grama-3', 'estrutura/pisos/grama-4'];
const CHAOS_CAVERNA = ['estrutura/pisos/terra-3', 'estrutura/pisos/terra-3', 'estrutura/pisos/terra-4', 'estrutura/pisos/pedra-4'];

// ================================================================================================================================================================================================================================================
// criarAleatorio
// Gerador com semente: o mesmo mapa sai sempre igual.

function criarAleatorio(semente) {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6D2B79F5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ================================================================================================================================================================================================================================================
// criarCelulas

function criarCelulas() {
  const celulas = {};
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      celulas[`${x},${y}`] = { floor: null, floorTop: null, hole: null, borders: [], objects: [], enemy: null, npc: null, bot: null, spawn: false, safe: false, house: null };
    }
  }
  return celulas;
}

// ================================================================================================================================================================================================================================================
// montarMapa

async function montarMapa() {
  const importar = (...partes) => import(pathToFileURL(path.join(RAIZ, ...partes)).href);
  const assets = await importar('shared', 'assets.js');
  const formato = await importar('shared', 'map-format.js');
  const sprites = lerSprites(RAIZ);
  assets.setAssets(sprites);
  const existe = new Set(sprites.map(s => s.id));
  const aleatorio = criarAleatorio(780);
  const andares = [-2, -1, 0, 1, 2, 3];
  const layers = Object.fromEntries(andares.map(z => [z, criarCelulas()]));
  const ausentes = new Set();

  const celula = (x, y, z) => layers[z][`${x},${y}`];
  const sorteio = (lista) => lista[Math.floor(aleatorio() * lista.length)];
  const base = (tipo) => tipo.split('#')[0];
  const confere = (tipo) => {
    if (existe.has(base(tipo))) return true;
    ausentes.add(base(tipo));
    return false;
  };

  // ================================================================================================================================================================================================================================================
  // retangulo

  function retangulo(x0, y0, x1, y1, fazer) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fazer(x, y);
  }

  // ================================================================================================================================================================================================================================================
  // piso

  function piso(z, x0, y0, x1, y1, tipo) {
    retangulo(x0, y0, x1, y1, (x, y) => {
      if (confere(tipo)) formato.addFloorToCell(celula(x, y, z), typeof tipo === 'function' ? tipo() : tipo);
    });
  }

  // ================================================================================================================================================================================================================================================
  // pisoSorteado

  function pisoSorteado(z, x0, y0, x1, y1, tipos) {
    retangulo(x0, y0, x1, y1, (x, y) => {
      const tipo = sorteio(tipos);
      if (confere(tipo)) formato.addFloorToCell(celula(x, y, z), tipo);
    });
  }

  // ================================================================================================================================================================================================================================================
  // objeto

  function objeto(z, x, y, tipo, dados) {
    if (!confere(tipo)) return;
    celula(x, y, z).objects.push(dados ? { type: tipo, dados } : { type: tipo });
  }

  // ================================================================================================================================================================================================================================================
  // buraco

  function buraco(z, x, y, tipo) {
    if (confere(tipo)) celula(x, y, z).hole = tipo;
  }

  // ================================================================================================================================================================================================================================================
  // npc

  function npc(z, x, y, nome) {
    const tipo = `personagens/npcs/${nome}`;
    if (confere(tipo)) celula(x, y, z).npc = { type: tipo };
  }

  // ================================================================================================================================================================================================================================================
  // criatura

  function criatura(z, x, y, nome, pasta) {
    const tipo = `criaturas/${pasta}/${nome}`;
    if (!confere(tipo)) return;
    celula(x, y, z).enemy = { type: tipo, lvl: 1, spriteSize: (sprites.find(s => s.id === tipo) || {}).quadro || 32 };
  }

  // ================================================================================================================================================================================================================================================
  // criaturasNaSala
  // Espalha n criaturas de cada tipo pelos sqms livres do retângulo.

  function criaturasNaSala(z, x0, y0, x1, y1, lista) {
    for (const [nome, pasta, quantas] of lista) {
      for (let i = 0, tentativas = 0; i < quantas && tentativas < 200; tentativas++) {
        const x = x0 + Math.floor(aleatorio() * (x1 - x0 + 1));
        const y = y0 + Math.floor(aleatorio() * (y1 - y0 + 1));
        const c = celula(x, y, z);
        if (!c.floor || c.enemy || c.npc || c.hole || c.objects.length) continue;
        criatura(z, x, y, nome, pasta);
        i++;
      }
    }
  }

  // ================================================================================================================================================================================================================================================
  // zonaSegura

  function zonaSegura(z, x0, y0, x1, y1) {
    retangulo(x0, y0, x1, y1, (x, y) => { celula(x, y, z).safe = true; });
  }

  // ================================================================================================================================================================================================================================================
  // casa

  function casa(z, x0, y0, x1, y1, nome, preco) {
    retangulo(x0, y0, x1, y1, (x, y) => { celula(x, y, z).house = { name: nome, price: preco }; });
  }

  // ================================================================================================================================================================================================================================================
  // sala
  // Paredes no contorno de um retângulo (x, y, largura, altura); portas e janelas: [lado, deslocamento].

  function sala(z, x, y, largura, altura, parede, portas = [], janelas = []) {
    const direita = x + largura - 1;
    const baixo = y + altura - 1;
    const abertura = (lado, pos) => [...portas.map(p => ['porta', ...p]), ...janelas.map(j => ['janela', ...j])].find(([, l, p]) => l === lado && p === pos);
    const peca = (px, py) => {
      const noTopo = py === y;
      const noFundo = py === baixo;
      const naEsquerda = px === x;
      const naDireita = px === direita;
      if (noTopo && naEsquerda) return 'xy';
      if ((noTopo && naDireita) || (noFundo && (naEsquerda || naDireita))) return 'yx';
      const horizontal = noTopo || noFundo;
      const lado = noTopo ? 'norte' : noFundo ? 'sul' : naEsquerda ? 'oeste' : 'leste';
      const eixo = horizontal ? 'x' : 'y';
      const alvo = abertura(lado, horizontal ? px - x : py - y);
      if (alvo) return `${alvo[0] === 'porta' ? 'porta' : 'janela'}-${eixo}`;
      return eixo;
    };
    retangulo(x, y, direita, baixo, (px, py) => {
      if (px !== x && px !== direita && py !== y && py !== baixo) return;
      objeto(z, px, py, `${parede}#${peca(px, py)}`);
    });
  }

  // ================================================================================================================================================================================================================================================
  // remendo
  // Piso em volta de um ponto, garante chão onde chega buraco, escada ou teletransporte.

  function remendo(z, cx, cy, raio, tipos) {
    pisoSorteado(z, cx - raio, cy - raio, cx + raio, cy + raio, tipos);
  }

  // ================================================================================================================================================================================================================================================
  // gruta
  // Piso irregular de caverna: elipse com bordas sorteadas.

  function gruta(z, cx, cy, rx, ry) {
    for (let y = cy - ry - 2; y <= cy + ry + 2; y++) {
      for (let x = cx - rx - 2; x <= cx + rx + 2; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy < 1 + (aleatorio() - 0.5) * 0.45) formato.addFloorToCell(celula(x, y, z), sorteio(CHAOS_CAVERNA));
      }
    }
  }

  // ================================================================================================================================================================================================================================================
  // corredor
  // Passagem de 3 sqm entre dois pontos, primeiro em x e depois em y, com leve ondulação.

  function corredor(z, x0, y0, x1, y1) {
    let y = y0;
    for (let x = x0; x !== x1; x += Math.sign(x1 - x0)) {
      y += aleatorio() < 0.2 ? Math.sign(aleatorio() - 0.5) : 0;
      y = Math.min(Math.max(y, Math.min(y0, y1) - 1), Math.max(y0, y1) + 1);
      pisoSorteado(z, x, y - 1, x, y + 1, CHAOS_CAVERNA);
    }
    let x = x1;
    for (let yy = y0; yy !== y1; yy += Math.sign(y1 - y0)) {
      x += aleatorio() < 0.2 ? Math.sign(aleatorio() - 0.5) : 0;
      x = Math.min(Math.max(x, x1 - 1), x1 + 1);
      pisoSorteado(z, x - 1, yy, x + 1, yy, CHAOS_CAVERNA);
    }
    pisoSorteado(z, x1 - 1, y1 - 1, x1 + 1, y1 + 1, CHAOS_CAVERNA);
  }

  // ================================================================================================================================================================================================================================================
  // loja
  // Prédio 9×9: porta no meio do lado de baixo ('sul') ou de cima ('norte'); balcão a 3 sqm da porta e os NPCs atrás dele.

  function loja(x, y, lado, nomes, opcoes = {}) {
    const parede = opcoes.parede || PEDRA;
    const portaPos = 4;
    sala(0, x, y, 9, 9, parede, [[lado, portaPos]], [['oeste', 3], ['leste', 3], [lado === 'sul' ? 'norte' : 'sul', 2], [lado === 'sul' ? 'norte' : 'sul', 6]]);
    piso(0, x + 1, y + 1, x + 7, y + 7, opcoes.piso || 'estrutura/pisos/madeira-1');
    const linhaBalcao = lado === 'sul' ? y + 5 : y + 3;
    const linhaNpc = y + 4;
    const atras = lado === 'sul' ? y + 2 : y + 6;
    if (!opcoes.semBalcao) retangulo(x + 1, linhaBalcao, x + 6, linhaBalcao, (px, py) => objeto(0, px, py, BALCAO));
    const colunas = nomes.length === 1 ? [x + 3] : nomes.length === 2 ? [x + 2, x + 5] : [x + 2, x + 4, x + 6];
    nomes.forEach((nome, i) => npc(0, colunas[i], linhaNpc, nome));
    objeto(0, x + 1, atras, 'decoracao/adornos/barrel');
    objeto(0, x + 2, atras, 'decoracao/adornos/crate');
    objeto(0, x + 6, atras, 'decoracao/adornos/box');
    objeto(0, x + 7, atras, 'decoracao/moveis/bookcase');
    objeto(0, x + 1, lado === 'sul' ? y + 7 : y + 1, 'decoracao/iluminacao/lamp');
    objeto(0, x + 7, lado === 'sul' ? y + 7 : y + 1, 'decoracao/iluminacao/lamp');
    const sqmPorta = lado === 'sul' ? y + 9 : y - 1;
    objeto(0, x + 4 + (opcoes.placaDeslocada || 2), sqmPorta, 'decoracao/sinalizacao/placa-baixa', { texto: opcoes.placa || nomes.join(' e ') });
  }

  // ================================================================================================================================================================================================================================================
  // casaAVenda

  function casaAVenda(x, y, lado, nome, preco) {
    sala(0, x, y, 9, 9, MADEIRA, [[lado, 4]], [['oeste', 4], ['leste', 4], [lado === 'sul' ? 'norte' : 'sul', 4]]);
    piso(0, x + 1, y + 1, x + 7, y + 7, 'estrutura/pisos/madeira-2');
    casa(0, x + 1, y + 1, x + 7, y + 7, nome, preco);
    const fundo = lado === 'sul' ? y + 1 : y + 7;
    objeto(0, x + 1, fundo, 'decoracao/moveis/cama');
    objeto(0, x + 6, fundo, 'decoracao/moveis/dresser');
    objeto(0, x + 4, y + 4, 'decoracao/moveis/table');
    objeto(0, x + 3, y + 4, 'decoracao/moveis/wooden-chair');
    objeto(0, x + 5, y + 4, 'decoracao/moveis/wooden-chair');
    objeto(0, x + 7, fundo, 'decoracao/iluminacao/lamp');
    const sqmPorta = lado === 'sul' ? y + 9 : y - 1;
    objeto(0, x + 6, sqmPorta, 'decoracao/sinalizacao/placa-baixa', { texto: `${nome} - à venda por ${preco} moedas de ouro. Dentro dela, diga !comprarcasa.` });
  }

  // ================================================================================================================================================================================================================================================
  // arvores
  // Árvores e plantas em sqms de grama vazios do retângulo.

  function arvores(x0, y0, x1, y1, densidade, tipos) {
    retangulo(x0, y0, x1, y1, (x, y) => {
      const c = celula(x, y, 0);
      if (!c.floor || !/grama/.test((c.floorTop || c.floor).type) || c.objects.length || c.hole || c.npc || c.enemy) return;
      if (aleatorio() < densidade) objeto(0, x, y, sorteio(tipos));
    });
  }

  // ================================================================================================================================================================================================================================================
  // superficie

  function superficie() {
    pisoSorteado(0, 96, 118, 214, 222, GRAMAS);
    piso(0, 140, 167, 171, 186, 'estrutura/pisos/pedra-1');
    piso(0, 153, 143, 157, 214, 'estrutura/pisos/pedra-2');
    piso(0, 100, 182, 210, 184, 'estrutura/pisos/pedra-2');
    piso(0, 175, 165, 177, 171, 'estrutura/pisos/pedra-2');

    sala(0, 149, 156, 13, 13, PEDRA, [['sul', 6]], [['oeste', 6], ['leste', 6], ['norte', 3], ['norte', 9]]);
    piso(0, 150, 157, 160, 167, 'estrutura/pisos/marmore-1');
    piso(0, 155, 157, 155, 167, 'estrutura/pisos/tapete-vermelho');
    npc(0, 152, 159, 'oraculo');
    npc(0, 158, 159, 'guia');
    objeto(0, 150, 157, 'decoracao/estatuas/angel-statue');
    objeto(0, 160, 157, 'decoracao/estatuas/angel-statue');
    objeto(0, 150, 166, 'decoracao/iluminacao/torch-bearer');
    objeto(0, 160, 166, 'decoracao/iluminacao/torch-bearer');
    objeto(0, 153, 169, 'decoracao/sinalizacao/placa-baixa', { texto: 'Templo da cidade de teste. O Oráculo escolhe a vocação; o guia ensina o jogo.' });
    celula(155, 165, 0).spawn = true;

    loja(112, 172, 'sul', ['armeiro', 'armadureiro'], { placa: 'Armeiro e armadureiro: armas, escudos e armaduras.' });
    loja(122, 172, 'sul', ['ferreiro', 'gorn'], { placa: 'Ferreiro e Gorn: equipamentos e ferramentas.' });
    loja(132, 172, 'sul', ['runeiro', 'lily'], { placa: 'Runeiro e Lily: runas, magias e poções.' });
    loja(172, 172, 'sul', ['vendedor', 'joalheira'], { placa: 'Vendedor e joalheira: de tudo um pouco.' });
    loja(182, 172, 'sul', ['taverneiro'], { placa: 'Taverna: comida e bebida.', semBalcao: false });
    loja(192, 172, 'sul', ['banqueiro'], { placa: 'Banco: diga "banco", "depositar", "sacar" ou "transferir". Correio na caixa ao lado.', piso: 'estrutura/pisos/marmore-2' });
    objeto(0, 193, 181, 'decoracao/adornos/mailbox');

    casaAVenda(112, 186, 'norte', 'Casa 1', 2000);
    casaAVenda(122, 186, 'norte', 'Casa 2', 3000);
    casaAVenda(132, 186, 'norte', 'Casa 3', 4000);
    casaAVenda(172, 186, 'norte', 'Casa 4', 2500);
    casaAVenda(182, 186, 'norte', 'Casa 5', 3500);
    casaAVenda(192, 186, 'norte', 'Casa 6', 5000);

    retangulo(114, 158, 132, 166, (x, y) => formato.addFloorToCell(celula(x, y, 0), 'estrutura/pisos/terra-1'));
    retangulo(114, 158, 132, 166, (x, y) => { if (x % 2 === 0 && y % 3 !== 0) objeto(0, x, y, aleatorio() < 0.8 ? 'estrutura/natureza/wheat' : 'estrutura/natureza/sunflower'); });
    npc(0, 123, 168, 'fazendeira');
    objeto(0, 125, 168, 'decoracao/sinalizacao/placa-baixa', { texto: 'Fazenda de teste. Cave a terra com a pá pra achar minhocas.' });

    npc(0, 140, 152, 'cacador');
    arvores(100, 120, 148, 156, 0.12, ['estrutura/natureza/arvore-1', 'estrutura/natureza/pinheiro-1', 'estrutura/natureza/bush', 'estrutura/natureza/mato-1']);

    retangulo(192, 150, 206, 164, (x, y) => formato.addFloorToCell(celula(x, y, 0), 'estrutura/pisos/terra-2'));
    npc(0, 196, 158, 'coveiro');
    for (const [x, y] of [[198, 152], [201, 152], [204, 152], [198, 155], [201, 155], [204, 155], [201, 161], [204, 161]]) objeto(0, x, y, 'estrutura/natureza/tumba');
    objeto(0, 194, 153, 'estrutura/natureza/caixao');
    objeto(0, 195, 162, 'estrutura/natureza/dead-tree');
    objeto(0, 206, 158, 'estrutura/natureza/dead-tree');
    objeto(0, 197, 164, 'decoracao/sinalizacao/placa-baixa', { texto: 'Cemitério.' });

    retangulo(168, 200, 192, 215, (x, y) => formato.addFloorToCell(celula(x, y, 0), 'estrutura/pisos/areia-1'));
    retangulo(171, 203, 189, 212, (x, y) => formato.addFloorToCell(celula(x, y, 0), 'estrutura/pisos/agua-1'));
    objeto(0, 166, 205, 'decoracao/sinalizacao/placa-baixa', { texto: 'Lago de pesca. Use a vara de pescar com a mira na água (precisa de minhoca).' });

    for (const x of [146, 164, 120, 140, 178, 198]) for (const y of [181, 185]) objeto(0, x, y, 'decoracao/iluminacao/poste-luz-1-aceso');
    for (const [x, y] of [[145, 170], [166, 170], [145, 183], [166, 183]]) objeto(0, x, y, 'decoracao/estatuas/statue');
    objeto(0, 160, 174, 'decoracao/sinalizacao/placa-baixa', { texto: 'Teletransporte para a caverna.' });
    objeto(0, 150, 174, 'decoracao/sinalizacao/placa-baixa', { texto: 'Bueiro: use pra descer à caverna.' });

    arvores(96, 118, 214, 222, 0.025, ['estrutura/natureza/arvore-1', 'estrutura/natureza/pinheiro-1', 'estrutura/natureza/bush', 'estrutura/natureza/mato-1', 'estrutura/natureza/stone']);

    criaturasNaSala(0, 100, 124, 148, 146, [['rabbit', 'mamiferos', 4], ['deer', 'mamiferos', 3], ['sheep', 'mamiferos', 3], ['wolf', 'mamiferos', 4], ['boar', 'mamiferos', 3], ['bear', 'mamiferos', 2], ['snake', 'repteis', 2], ['rat', 'mamiferos', 3]]);
    criaturasNaSala(0, 160, 124, 214, 146, [['bandit', 'humanos', 3], ['hunter', 'humanos', 2], ['goblin', 'humanoides', 4], ['orc', 'humanoides', 3], ['wasp', 'vermes', 3]]);
    criaturasNaSala(0, 100, 202, 166, 218, [['wolf', 'mamiferos', 4], ['bear', 'mamiferos', 2], ['spider', 'vermes', 4], ['crab', 'aquaticos', 2]]);
    criaturasNaSala(0, 194, 200, 212, 218, [['troll', 'humanoides', 4], ['minotaur', 'humanoides', 2], ['pirate-cutthroat', 'humanos', 2]]);
    for (const [x, y] of [[104, 140], [106, 140], [108, 140]]) criatura(0, x, y, 'dummy', 'humanos');

    zonaSegura(0, 108, 150, 204, 198);
    for (let z = 1; z <= 3; z++) zonaSegura(z, 160, 140, 190, 170);
  }

  // ================================================================================================================================================================================================================================================
  // torre
  // Torre de 9×9 em z 0..3: cada andar vai 1 sqm pra cima e pra esquerda (o jeito do jogo desenhar os andares).

  function torre() {
    const tx = 172;
    const ty = 156;
    const escadas = [[5, 5], [3, 5], [5, 5]];
    sala(0, tx, ty, 9, 9, TIJOLO, [['sul', 4]], [['norte', 4], ['oeste', 4], ['leste', 4]]);
    piso(0, tx + 1, ty + 1, tx + 7, ty + 7, 'estrutura/pisos/tijolo-1');
    for (let k = 1; k <= 3; k++) {
      const ox = tx - k;
      const oy = ty - k;
      sala(k, ox, oy, 9, 9, TIJOLO, [], [['norte', 4], ['oeste', 4], ['leste', 4], ['sul', 4]]);
      piso(k, ox + 1, oy + 1, ox + 7, oy + 7, 'estrutura/pisos/madeira-3');
    }
    escadas.forEach(([dx, dy], k) => objeto(k, tx - k + dx, ty - k + dy, ESCADA));
    objeto(1, 171 + 1, 155 + 1, 'decoracao/moveis/cama');
    objeto(1, 171 + 6, 155 + 1, 'decoracao/moveis/bookcase');
    objeto(1, 171 + 6, 155 + 6, 'decoracao/iluminacao/lamp');
    objeto(2, 170 + 1, 154 + 1, 'decoracao/moveis/table');
    objeto(2, 170 + 2, 154 + 1, 'decoracao/moveis/wooden-chair');
    objeto(2, 170 + 6, 154 + 6, 'decoracao/iluminacao/lamp');
    objeto(3, 169 + 6, 153 + 1, 'decoracao/baus/bau-quest', { quest: 'torre-teste', itens: [{ tipo: 'itens/valiosos/gold-coin', count: 50 }, { tipo: 'itens/valiosos/small-diamond', count: 2 }, { tipo: 'itens/ferramentas/chave-dourada', count: 1, chave: 1 }] });
    buraco(3, 169 + 2, 153 + 2, 'estrutura/entradas/alcapao-1');
    objeto(3, 169 + 2, 153 + 5, 'decoracao/sinalizacao/placa-baixa', { texto: 'Alçapão no canto: desce direto ao andar de baixo.' });
    objeto(0, 176, 166, 'decoracao/sinalizacao/placa-baixa', { texto: 'Torre de teste: escadas até o 3º andar.' });
  }

  // ================================================================================================================================================================================================================================================
  // cavernas

  function cavernas() {
    gruta(-1, 153, 178, 7, 5);
    gruta(-1, 183, 179, 9, 8);
    gruta(-1, 166, 189, 7, 6);
    gruta(-1, 183, 208, 14, 8);
    corredor(-1, 158, 179, 176, 179);
    corredor(-1, 166, 183, 166, 184);
    corredor(-1, 183, 187, 183, 201);
    corredor(-1, 166, 195, 175, 205);
    gruta(-2, 186, 212, 11, 7);
    gruta(-2, 160, 212, 6, 5);
    corredor(-2, 172, 212, 175, 212);

    remendo(-1, 151, 177, 1, CHAOS_CAVERNA);
    remendo(-1, 163, 186, 1, CHAOS_CAVERNA);
    remendo(-1, 169, 210, 1, CHAOS_CAVERNA);
    remendo(-1, 187, 204, 2, CHAOS_CAVERNA);
    remendo(-2, 189, 211, 1, CHAOS_CAVERNA);
    remendo(-1, 189, 213, 1, CHAOS_CAVERNA);
    remendo(-2, 190, 215, 1, CHAOS_CAVERNA);

    buraco(0, 150, 176, 'estrutura/entradas/bueiro');
    objeto(-1, 151, 177, CORDA);
    buraco(0, 162, 185, 'estrutura/entradas/buraco-pedra-fechado');
    objeto(-1, 163, 186, CORDA);
    buraco(0, 168, 209, 'estrutura/entradas/buraco-1');
    objeto(-1, 169, 210, CORDA);
    buraco(-1, 188, 210, 'estrutura/entradas/buraco-5');
    objeto(-2, 189, 211, CORDA);
    objeto(-2, 190, 215, ESCADA);

    objeto(0, 160, 176, 'estrutura/teletransportes/teletransporte-1', { destino: { x: 187, y: 204, z: -1 } });
    objeto(-1, 186, 204, 'estrutura/teletransportes/teletransporte-2', { destino: { x: 161, y: 176, z: 0 } });

    objeto(-1, 154, 176, 'estrutura/natureza/stalagmites');
    objeto(-1, 184, 177, 'estrutura/natureza/stalagmites');
    objeto(-1, 164, 190, 'estrutura/natureza/stone-pile');
    objeto(-1, 190, 205, 'estrutura/natureza/stalagmites');
    objeto(-2, 195, 209, 'decoracao/baus/bau-quest', { quest: 'caverna-fundo', itens: [{ tipo: 'itens/valiosos/platinum-coin', count: 20 }, { tipo: 'itens/valiosos/red-gem', count: 1 }] });
    objeto(-2, 180, 216, 'estrutura/natureza/stalagmites');

    criaturasNaSala(-1, 146, 173, 160, 183, [['rat', 'mamiferos', 3], ['cave-rat', 'mamiferos', 3]]);
    criaturasNaSala(-1, 174, 172, 192, 187, [['spider', 'vermes', 3], ['bat', 'mortos-vivos', 3], ['snake', 'repteis', 2], ['rotworm', 'vermes', 3]]);
    criaturasNaSala(-1, 159, 183, 173, 195, [['goblin', 'humanoides', 3], ['orc', 'humanoides', 2], ['orc-shaman', 'humanoides', 2], ['orc-warrior', 'humanoides', 2], ['minotaur', 'humanoides', 2]]);
    criaturasNaSala(-1, 170, 200, 196, 216, [['troll', 'humanoides', 3], ['skeleton', 'mortos-vivos', 3], ['ghoul', 'mortos-vivos', 2], ['mummy', 'mortos-vivos', 2], ['minotaur-mage', 'humanoides', 2], ['cyclops', 'gigantes', 2], ['necromancer', 'humanos', 1]]);
    criaturasNaSala(-2, 176, 206, 196, 218, [['dragon', 'dragoes', 2], ['dragon-hatchling', 'dragoes', 2], ['dragon-lord', 'dragoes', 1], ['demon-skeleton', 'mortos-vivos', 2], ['hellhound', 'demonios', 1], ['lich', 'mortos-vivos', 1], ['vampire', 'mortos-vivos', 2], ['bonebeast', 'mortos-vivos', 2]]);
    criaturasNaSala(-2, 154, 208, 166, 216, [['stone-golem', 'constructos', 2], ['gargoyle', 'criaturas-magicas', 2], ['fire-elemental', 'elementais', 2], ['water-elemental', 'elementais', 1]]);
  }

  // ==============================================================================================================================================================================================================================================
  // limpar
  // Tira os objetos (árvores sorteadas) do retângulo, pra construir ali.

  function limpar(x0, y0, x1, y1, z = 0) {
    retangulo(x0, y0, x1, y1, (x, y) => { celula(x, y, z).objects = []; });
  }

  // ==============================================================================================================================================================================================================================================
  // regrasDaPorta
  // Põe as regras (chave, nível, quest) na porta que a sala já criou no sqm.

  function regrasDaPorta(x, y, dados) {
    const porta = celula(x, y, 0).objects.find(o => o.type.includes('#porta-'));
    if (porta) porta.dados = dados;
  }

  // ==============================================================================================================================================================================================================================================
  // saleta
  // Sala 7×6 de pedra com a porta no meio do lado sul, um baú de quest dentro e uma placa fora.

  function saleta(x, y, placa, bau, regras, ladoPorta = 'sul') {
    limpar(x - 1, y - 2, x + 8, y + 7);
    sala(0, x, y, 7, 6, PEDRA, [[ladoPorta, ladoPorta === 'sul' ? 3 : 3]]);
    piso(0, x + 1, y + 1, x + 5, y + 4, 'estrutura/pisos/marmore-3');
    objeto(0, x + 3, y + 2, 'decoracao/baus/bau-quest', bau);
    objeto(0, x + 1, y + 1, 'decoracao/iluminacao/lamp');
    const porta = ladoPorta === 'sul' ? [x + 3, y + 5] : [x, y + 3];
    regrasDaPorta(porta[0], porta[1], regras);
    return porta;
  }

  // ==============================================================================================================================================================================================================================================
  // recursos
  // Os recursos novos: portas com chave, nível e quest, alavanca, ferramentas, mato, viagem por NPC.

  function recursos() {
    limpar(150, 164, 160, 168);
    objeto(0, 152, 166, 'decoracao/baus/bau-quest', { quest: 'ferramentas-1', itens: [{ tipo: 'itens/ferramentas/shovel' }, { tipo: 'itens/ferramentas/rope' }, { tipo: 'itens/ferramentas/pick' }, { tipo: 'itens/ferramentas/fishing-rod' }].map(e => ({ ...e, count: 1 })) });
    objeto(0, 158, 166, 'decoracao/baus/bau-quest', { quest: 'ferramentas-2', itens: [{ tipo: 'itens/espadas/machete', count: 1 }, { tipo: 'itens/ferramentas/scythe', count: 1 }, { tipo: 'itens/produtos-de-criaturas/worm', count: 20 }] });

    const cofre = saleta(134, 150, 'Cofre', { quest: 'cofre-chave', itens: [{ tipo: 'itens/valiosos/platinum-coin', count: 10 }] }, { chave: 1 });
    objeto(0, cofre[0] + 2, cofre[1] + 1, 'decoracao/sinalizacao/placa-baixa', { texto: 'Cofre trancado. A chave dourada (nº 1) está no baú do alto da torre; use a chave na porta pra trancar e destrancar.' });
    const nivel = saleta(142, 150, 'Sala do nível', { quest: 'sala-nivel', itens: [{ tipo: 'itens/valiosos/small-ruby', count: 3 }] }, { nivel: 20 });
    objeto(0, nivel[0] + 2, nivel[1] + 1, 'decoracao/sinalizacao/placa-baixa', { texto: 'Só passa quem tem nível 20 ou mais. A porta fecha sozinha.' });
    const quest = saleta(163, 150, 'Sala da quest', { quest: 'sala-quest', itens: [{ tipo: 'itens/valiosos/small-emerald', count: 3 }] }, { quest: 'torre-teste' });
    objeto(0, quest[0] + 2, quest[1] + 1, 'decoracao/sinalizacao/placa-baixa', { texto: 'Só abre pra quem já pegou o baú do alto da torre.' });

    limpar(181, 155, 192, 163);
    sala(0, 184, 156, 7, 6, PEDRA, [['oeste', 3]]);
    piso(0, 185, 157, 189, 160, 'estrutura/pisos/marmore-3');
    objeto(0, 187, 158, 'decoracao/baus/bau-quest', { quest: 'sala-alavanca', itens: [{ tipo: 'itens/valiosos/small-amethyst', count: 3 }] });
    objeto(0, 182, 160, 'decoracao/alavancas/alavanca-1', { alvos: [{ x: 184, y: 159, z: 0 }] });
    objeto(0, 182, 162, 'decoracao/sinalizacao/placa-baixa', { texto: 'Alavanca: abre e fecha a porta da sala ao lado.' });

    limpar(142, 188, 150, 196);
    pisoSorteado(0, 142, 188, 150, 196, GRAMAS);
    retangulo(143, 189, 149, 195, (x, y) => { if ((x + y) % 2 === 0) objeto(0, x, y, (x + y) % 4 === 0 ? 'estrutura/natureza/jungle-grass' : 'estrutura/natureza/sugar-cane'); });
    objeto(0, 146, 197, 'decoracao/sinalizacao/placa-baixa', { texto: 'Mato: corte com o machete (rebrota em 2 minutos). Trigo da fazenda: foice.' });

    limpar(146, 177, 148, 179);
    npc(0, 147, 178, 'capitao');
    objeto(0, 147, 180, 'decoracao/sinalizacao/placa-baixa', { texto: 'Capitão: diga "viagem" pra ver os destinos.' });
  }

  superficie();
  torre();
  cavernas();
  recursos();

  const mapa = formato.serializeMapFromLayers(andares, layers, GRID);
  return { mapa, ausentes: [...ausentes].sort() };
}

// ================================================================================================================================================================================================================================================
// principal

async function principal() {
  const saida = path.resolve(process.argv[2] || SAIDA_PADRAO);
  const { mapa, ausentes } = await montarMapa();
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  fs.writeFileSync(saida, JSON.stringify(mapa));
  console.log(`Mapa de teste gravado em ${saida}`);
  console.log(`${mapa.objetosData.length} objetos, ${mapa.enemyData.length} criaturas, ${mapa.npcData.length} NPCs, ${mapa.houseData.length} sqms de casas, ${mapa.safeZoneData.length} de zona segura`);
  if (ausentes.length) console.log(`Sem folha no gerador (ficaram de fora): ${ausentes.join(', ')}`);
}

principal();
