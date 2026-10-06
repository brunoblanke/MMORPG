// ferramentas/cidade-teste.js

// Constrói no data/map.json a Cidade de Testes: uma ilha a oeste da ilha inicial,
// ligada a ela por uma ponte, com tudo o que o jogo tem pra testar: os 6 NPCs
// (vocação, loja, missões, guia), baús com os kits de cada vocação, praça e
// templo (zona segura), campos de fogo, veneno e energia, piso de dano, buracos
// (bueiro, pá, corda, entradas), escadas (reta e normal) com casas à venda,
// postes de luz, camas, placas, livro, cemitério, fazenda e um zoológico com as
// criaturas do gerador. Rodar de novo refaz a cidade (apaga o que ela pôs antes).
//
// Uso: node ferramentas/cidade-teste.js [url das folhas]
// (o servidor do jogo tem que estar rodando; padrão http://localhost:8000/api/sprites)

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const RAIZ = path.join(__dirname, '..');
const MAPA = path.join(RAIZ, 'data', 'map.json');
const ILHA = { x0: 70, y0: 220, x1: 156, y1: 247 };
const TERRA = { x0: 74, y0: 221, x1: 153, y1: 243 };
const PONTE = { x0: 154, x1: 176, ys: [228, 229] };

const AGUA = 'estrutura/pisos/piso-agua-1';
const GRAMA = 'estrutura/pisos/piso-grama-1';
const CALCADA = 'estrutura/pisos/piso-paralelepipedo';
const MADEIRA = 'estrutura/pisos/piso-madeira-2';
const MADEIRA_PONTE = 'estrutura/pisos/piso-madeira-3';
const PEDRA = 'estrutura/pisos/piso-pedra-branca';
const PRETA = 'estrutura/pisos/piso-pedra-preta';
const TAPETE_AZUL = 'estrutura/pisos/piso-tapete-azul';
const TAPETE_VERMELHO = 'estrutura/pisos/piso-tapete-vermelho';
const ACIDO = 'estrutura/pisos/piso-acido-1';
const AREIA = 'estrutura/pisos/piso-areia-1';
const PALHA = 'estrutura/pisos/piso-palha-4';
const MUSGO = 'estrutura/pisos/piso-musgo-1';
const TERRA_PISO = 'estrutura/pisos/piso-terra-2';
const PAREDE = 'estrutura/paredes/parede-madeira-1';
const TIJOLO = 'estrutura/paredes/parede-tijolos-1';
const CERCA = 'estrutura/cercas/cerca-2';
const POSTE = 'decoracao/iluminacao/poste-luz-1';
const PLACA = 'decoracao/sinalizacao/placa-baixa-2';
const BAU = 'decoracao/baus/bau-quest';
const ESCADA_RETA = 'estrutura/escadas/escada-madeira-reta-1';
const ESCADA = 'estrutura/escadas/escada-madeira-1';
const ENTRADA_ESCADA = 'estrutura/entradas/entrada-madeira-2';
const CORDA = 'estrutura/escadas/sombra-buraco';

// ================================================================================================================================================================================================================================================
// criarCidade
// O estado da cidade: células por andar, e as listas de NPCs, inimigos, zona
// segura e casas. Cada célula tem floor, floorTop, hole, borders e objects,
// como as do editor (shared/floor-borders.js lê assim).

function criarCidade(lib) {
  const andares = new Map();
  const cidade = { andares, npcs: [], inimigos: [], seguras: [], casas: [], escadas: [], seq: lib.seqInicial, lib };
  cidade.celula = (z, x, y) => {
    if (!andares.has(z)) andares.set(z, {});
    const camada = andares.get(z);
    const chave = `${x},${y}`;
    if (!camada[chave]) camada[chave] = { floor: null, floorTop: null, hole: null, borders: [], objects: [] };
    return camada[chave];
  };
  return cidade;
}

// ================================================================================================================================================================================================================================================
// piso
// Põe um piso no sqm (o 2º vira o de cima); trocar apaga os que já estavam.

function piso(cidade, z, x, y, tipo, trocar = false) {
  const celula = cidade.celula(z, x, y);
  if (trocar) {
    celula.floor = null;
    celula.floorTop = null;
  }
  cidade.lib.addFloorToCell(celula, tipo, cidade.seq++);
}

// ================================================================================================================================================================================================================================================
// preencher
// Piso em todo o retângulo.

function preencher(cidade, z, x0, y0, x1, y1, tipo, trocar = true) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) piso(cidade, z, x, y, tipo, trocar);
}

// ================================================================================================================================================================================================================================================
// objeto
// Parede, árvore, item ou o que for: vai pra pilha do sqm com os dados.

function objeto(cidade, z, x, y, tipo, extra = {}) {
  const celula = cidade.celula(z, x, y);
  const item = { type: tipo };
  if (extra.count > 1) item.count = extra.count;
  if (extra.dados) item.dados = extra.dados;
  celula.objects.push(item);
  return item;
}

// ================================================================================================================================================================================================================================================
// buraco
// Entrada (buraco, bueiro, monte de pá) no sqm.

function buraco(cidade, z, x, y, tipo) {
  cidade.celula(z, x, y).hole = tipo;
}

// ================================================================================================================================================================================================================================================
// escada
// Escada (reta ou normal) no sqm; o destino o jogo calcula.

function escada(cidade, z, x, y, tipo) {
  cidade.celula(z, x, y).objects.push({ type: tipo });
}

// ================================================================================================================================================================================================================================================
// placa
// Placa baixa virada pro sul, com o texto e a cor.

function placa(cidade, z, x, y, texto, cor = 'info') {
  objeto(cidade, z, x, y, `${PLACA}#sul`, { dados: { texto, cor } });
}

// ================================================================================================================================================================================================================================================
// parede
// Peça de parede (x, y, xy, yx, porta-x, janela-y…).

function parede(cidade, z, x, y, base, peca) {
  objeto(cidade, z, x, y, `${base}#${peca}`);
}

// ================================================================================================================================================================================================================================================
// predio
// Prédio de paredes (o desenho do jogo: pilar yx em cima à esquerda, xy embaixo
// à direita) com piso dentro e embaixo das paredes. aberturas: { 'x,y': peça }
// no lugar da parede (porta, janela, arco). Devolve o interior.

function predio(cidade, z, x0, y0, x1, y1, base, chao, aberturas = {}) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      piso(cidade, z, x, y, chao, true);
      const borda = x === x0 || x === x1 || y === y0 || y === y1;
      if (!borda) continue;
      let peca = aberturas[`${x},${y}`];
      if (!peca) {
        if (x === x0 && y === y0) peca = 'yx';
        else if (x === x1 && y === y1) peca = 'xy';
        else if (y === y0 || y === y1) peca = 'x';
        else peca = 'y';
      }
      parede(cidade, z, x, y, base, peca);
    }
  }
  return { x0: x0 + 1, y0: y0 + 1, x1: x1 - 1, y1: y1 - 1 };
}

// ================================================================================================================================================================================================================================================
// cercado
// Cerca em volta do retângulo (a parede de cerca, sem piso), com portões (portas
// da cerca) nos sqms pedidos.

function cercado(cidade, z, x0, y0, x1, y1, portoes = []) {
  const portao = new Set(portoes.map(([x, y]) => `${x},${y}`));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!(x === x0 || x === x1 || y === y0 || y === y1)) continue;
      let peca = y === y0 || y === y1 ? 'x' : 'y';
      if (portao.has(`${x},${y}`)) peca = `porta-${peca}`;
      else if (x === x0 && y === y0) peca = 'yx';
      else if (x === x1 && y === y1) peca = 'xy';
      parede(cidade, z, x, y, CERCA, peca);
    }
  }
}

// ================================================================================================================================================================================================================================================
// arvores
// Árvores e pinheiros nos pontos (alternando).

function arvores(cidade, pontos) {
  pontos.forEach(([x, y], i) => objeto(cidade, 0, x, y, i % 3 === 1 ? 'estrutura/natureza/pinheiro-1' : i % 3 === 2 ? 'estrutura/natureza/mato-1' : 'estrutura/natureza/arvore-1'));
}

// ================================================================================================================================================================================================================================================
// campos
// Linha de campos (fire-field, poison-field, energy-field) a partir de (x, y).

function campos(cidade, x, y, quantidade, tipo, passo = 1) {
  for (let i = 0; i < quantidade; i++) objeto(cidade, 0, x + i * passo, y, `itens/itens-encantados/${tipo}`);
}

// ================================================================================================================================================================================================================================================
// inimigos
// Criaturas do gerador no mapa: [tipo, nível, x, y, z].

function inimigos(cidade, lista) {
  for (const [tipo, nivel, x, y, z = 0] of lista) cidade.inimigos.push([x, y, z, nivel, (cidade.lib.getAsset(tipo) || {}).quadro || 32, tipo]);
}

// ================================================================================================================================================================================================================================================
// zonaSegura
// Sqms da zona segura do retângulo.

function zonaSegura(cidade, z, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cidade.seguras.push([x, y, z]);
}

// ================================================================================================================================================================================================================================================
// casaAVenda
// Sqms da casa (o dono compra com !comprarcasa dentro dela).

function casaAVenda(cidade, z, x0, y0, x1, y1, nome, preco) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cidade.casas.push([x, y, z, nome, preco]);
}

// ================================================================================================================================================================================================================================================
// casaDeDoisAndares
// Casa com escada reta (sobe com duplo clique) ou normal (sobe ao pisar): o andar
// de cima é o de baixo deslocado 1 sqm pra cima e pra esquerda, como no editor.

function casaDeDoisAndares(cidade, x0, y0, x1, y1, base, escadaTipo, escadaX, escadaY, porta, nome, preco) {
  const reta = escadaTipo === ESCADA_RETA;
  const aberturas = { [`${porta[0]},${porta[1]}`]: 'porta-x' };
  aberturas[`${x0 + 1},${y1}`] = 'janela-x';
  const dentro = predio(cidade, 0, x0, y0, x1, y1, base, MADEIRA, aberturas);
  escada(cidade, 0, escadaX, escadaY, escadaTipo);
  const topoX = escadaX - 1;
  const topoY = escadaY - 1;
  const cima = predio(cidade, 1, x0 - 1, y0 - 1, x1 - 1, y1 - 1, base, MADEIRA, { [`${x0 + 1},${y0 - 1}`]: 'janela-x' });
  if (reta) {
    piso(cidade, 1, topoX, topoY, MADEIRA, true);
    buraco(cidade, 1, topoX, topoY, ENTRADA_ESCADA);
  } else {
    const celula = cidade.celula(1, topoX, topoY);
    celula.floor = null;
    celula.floorTop = null;
  }
  casaAVenda(cidade, 0, dentro.x0, dentro.y0, dentro.x1, dentro.y1, nome, preco);
  casaAVenda(cidade, 1, cima.x0, cima.y0, cima.x1, cima.y1, nome, preco);
  return { dentro, cima, topoX, topoY };
}

// ================================================================================================================================================================================================================================================
// bordas
// Refaz as bordas de piso do andar nos sqms tocados.

function bordas(cidade) {
  for (const [z, camada] of cidade.andares) {
    const vazios = cidade.lib.getStairTopKeys(cidade.andares.get(z - 1), z - 1);
    for (const chave of Object.keys(camada)) {
      const [x, y] = chave.split(',').map(Number);
      if (z === 0 && x > ILHA.x1) continue;
      camada[chave].borders = cidade.lib.computeCellBorders(camada, x, y, vazios);
    }
  }
}

// ================================================================================================================================================================================================================================================
// montarTerreno
// Água em volta, grama na ilha, a ponte, os caminhos, o rio de calçada e as
// árvores soltas.

function montarTerreno(cidade) {
  preencher(cidade, 0, ILHA.x0, ILHA.y0, ILHA.x1, ILHA.y1, AGUA);
  preencher(cidade, 0, TERRA.x0, TERRA.y0, TERRA.x1, TERRA.y1, GRAMA);
  for (let x = PONTE.x0; x <= ILHA.x1; x++) for (const y of PONTE.ys) piso(cidade, 0, x, y, AGUA, true);
  for (let x = PONTE.x0; x <= PONTE.x1; x++) for (const y of PONTE.ys) piso(cidade, 0, x, y, MADEIRA_PONTE);
  preencher(cidade, 0, 97, 227, 153, 231, CALCADA);
  preencher(cidade, 0, 97, 221, 98, 243, CALCADA);
  preencher(cidade, 0, 120, 227, 137, 233, CALCADA);
}

// ================================================================================================================================================================================================================================================
// montarPraca
// Praça com fogueira e postes, o templo com o oráculo (zona segura) e o guia.

function montarPraca(cidade) {
  const dentro = predio(cidade, 0, 122, 221, 133, 226, TIJOLO, PEDRA, { '127,226': 'porta-x', '128,226': 'arco-x-oeste', '125,221': 'janela-x', '130,221': 'janela-x', '122,223': 'janela-y', '133,223': 'janela-y' });
  preencher(cidade, 0, 124, 222, 131, 225, TAPETE_AZUL, false);
  preencher(cidade, 0, 127, 222, 128, 225, TAPETE_VERMELHO, false);
  cidade.npcs.push(['personagens/npcs/oraculo', 127, 222, 0]);
  placa(cidade, 0, 126, 224, 'Templo: fale com o Oráculo. Diga "knight", "paladin", "sorcerer" ou "druid" no nível 8 e depois "sim".', 'info');
  objeto(cidade, 0, 123, 222, `${POSTE}`);
  objeto(cidade, 0, 132, 222, `${POSTE}`);
  zonaSegura(cidade, 0, dentro.x0, dentro.y0, dentro.x1, dentro.y1);
  zonaSegura(cidade, 0, 120, 227, 137, 233);
  objeto(cidade, 0, 128, 230, 'decoracao/iluminacao/fogueira');
  for (const [x, y] of [[121, 227], [136, 227], [121, 233], [136, 233]]) objeto(cidade, 0, x, y, POSTE);
  cidade.npcs.push(['personagens/npcs/guia', 131, 229, 0]);
  placa(cidade, 0, 125, 229, 'Praça: zona segura. O Guia explica andar, combate, itens, poções, escadas e ferramentas.', 'info');
  placa(cidade, 0, 134, 231, 'Placas vermelhas avisam de perigo; as azuis e verdes explicam cada lugar da cidade.', 'blue');
  arvores(cidade, [[120, 234], [137, 234], [118, 223], [119, 226], [139, 233], [138, 226]]);
}

// ================================================================================================================================================================================================================================================
// montarLoja
// Loja do vendedor com balcão e itens à mostra.

function montarLoja(cidade) {
  predio(cidade, 0, 139, 221, 146, 226, PAREDE, MADEIRA, { '142,226': 'porta-x', '140,226': 'janela-x', '145,226': 'janela-x', '139,223': 'janela-y' });
  for (let x = 140; x <= 145; x++) objeto(cidade, 0, x, 224, `decoracao/moveis/balcao#sul`);
  cidade.npcs.push(['personagens/npcs/vendedor', 143, 223, 0]);
  placa(cidade, 0, 141, 225, 'Loja do Vendedor: diga "oi" e depois "oferta" ou "vender". Ele vende corda, pá, tocha e poção e compra equipamentos.', 'info');
  for (const [x, tipo] of [[140, 'itens/ferramentas/rope'], [141, 'itens/ferramentas/shovel'], [142, 'itens/fontes-de-luz/torch'], [143, 'itens/liquidos/health-potion'], [144, 'itens/comidas/bread'], [145, 'itens/comidas/ham']]) objeto(cidade, 0, x, 222, tipo);
  objeto(cidade, 0, 145, 223, 'itens/recipientes/backpack-azul', { dados: { itens: [{ tipo: 'itens/valiosos/gold-coin', count: 100 }, { tipo: 'itens/valiosos/platinum-coin', count: 20 }, { tipo: 'itens/liquidos/mana-potion', count: 5 }] } });
}

// ================================================================================================================================================================================================================================================
// montarCasas
// Duas casas à venda: a de escada reta e a de escada normal, com cama, livro e baú.

function montarCasas(cidade) {
  const a = casaDeDoisAndares(cidade, 147, 221, 153, 226, PAREDE, ESCADA_RETA, 152, 224, [150, 226], 'Casa de teste A', 100);
  objeto(cidade, 0, 150, 223, 'decoracao/moveis/cama#oeste');
  objeto(cidade, 0, 149, 224, 'itens/livros/livro-1', { dados: { texto: 'Casa de teste A. Compre com !comprarcasa, convide com !convidar nome, tire com !tirar nome, largue com !deixarcasa e veja o dono com !casa. A escada daqui é reta: use com duplo clique.' } });
  objeto(cidade, 1, 147, 222, `${BAU}#sul`, { dados: { quest: 'cidade-teste/casa-a', itens: [{ tipo: 'itens/valiosos/platinum-coin', count: 10 }] } });
  placa(cidade, 0, 151, 227, 'Casa de teste A (100 gp): escada reta, 2 andares.', 'info');
  const b = casaDeDoisAndares(cidade, 147, 231, 153, 236, PAREDE, ESCADA, 151, 234, [150, 231], 'Casa de teste B', 50);
  objeto(cidade, 0, 149, 233, 'decoracao/moveis/cama#oeste');
  objeto(cidade, 1, 148, 233, 'decoracao/moveis/cama-palha#norte');
  placa(cidade, 0, 151, 230, 'Casa de teste B (50 gp): escada normal, sobe ao pisar.', 'info');
  return { a, b };
}

// ================================================================================================================================================================================================================================================
// montarArsenal
// Armazém com os baús de quest: um por vocação, mais ferramentas, runas e itens
// das missões. Cada player pega uma vez de cada.

function montarArsenal(cidade) {
  predio(cidade, 0, 139, 231, 146, 236, TIJOLO, PEDRA, { '142,231': 'porta-x', '140,236': 'janela-x', '145,236': 'janela-x', '139,233': 'janela-y' });
  const baus = [
    ['mochila', [['itens/recipientes/backpack-azul'], ['itens/recipientes/backpack-verde']]],
    ['knight', [['itens/espadas/sword'], ['itens/armaduras/studded-armor'], ['itens/capacetes/brass-helmet'], ['itens/escudos/studded-shield'], ['itens/calcas/leather-legs'], ['itens/botas/leather-boots']]],
    ['paladin', [['itens/distancia/crossbow'], ['itens/municao/arrow', 50], ['itens/distancia/spear', 2], ['itens/armaduras/scale-armor'], ['itens/capacetes/brass-helmet'], ['itens/amuletos-e-colares/stone-skin-amulet']]],
    ['sorcerer', [['itens/wands/wand-of-inferno'], ['itens/armaduras/blue-robe'], ['itens/spellbooks/spellbook'], ['itens/runas/blank-rune', 5], ['itens/liquidos/mana-potion', 10], ['itens/aneis/might-ring']]],
    ['druid', [['itens/rods/terra-rod'], ['itens/armaduras/red-robe'], ['itens/spellbooks/spellbook'], ['itens/runas/blank-rune', 5], ['itens/liquidos/mana-potion', 10], ['itens/aneis/life-ring']]],
    ['ferramentas', [['itens/ferramentas/rope'], ['itens/ferramentas/shovel'], ['itens/fontes-de-luz/torch'], ['itens/liquidos/health-potion', 10], ['itens/valiosos/gold-coin', 100], ['itens/valiosos/platinum-coin', 20]]],
    ['runas', [['itens/runas/sudden-death-rune'], ['itens/runas/great-fireball-rune'], ['itens/runas/explosion-rune'], ['itens/runas/magic-wall-rune'], ['itens/runas/heavy-magic-missile-rune'], ['itens/runas/ultimate-healing-rune']]],
    ['campos', [['itens/runas/fire-field-rune'], ['itens/runas/poison-field-rune'], ['itens/runas/energy-field-rune'], ['itens/runas/fireball-rune'], ['itens/runas/blank-rune', 5]]],
    ['missoes', [['itens/comidas/cheese', 5], ['itens/produtos-de-criaturas/bone', 5], ['itens/comidas/bread'], ['itens/machados/axe'], ['itens/clavas/mace']]]
  ];
  baus.forEach(([nome, itens], i) => {
    const x = 140 + (i % 6);
    const y = i < 6 ? 233 : 235;
    objeto(cidade, 0, x, y, `${BAU}#sul`, { dados: { quest: `cidade-teste/${nome}`, itens: itens.map(([tipo, count]) => ({ tipo, count: count || 1 })) } });
  });
  placa(cidade, 0, 144, 234, 'Arsenal: abra primeiro o baú das mochilas e troque a sua; depois um baú por vocação, ferramentas, runas, campos e missões. A mochila e a capacidade enchem: equipe e guarde entre um baú e outro. Cada baú abre uma vez por player.', 'info');
}

// ================================================================================================================================================================================================================================================
// montarCampos
// Pátio dos campos: fogo, veneno e energia, piso de ácido (dano por segundo),
// veneno no chão e paredes mágicas.

function montarCampos(cidade) {
  preencher(cidade, 0, 99, 221, 118, 226, AREIA);
  cercado(cidade, 0, 99, 221, 118, 226, [[108, 226], [109, 226]]);
  placa(cidade, 0, 110, 222, 'Pátio dos campos: fogo, veneno e energia machucam quem pisa. O piso de ácido tira vida por segundo. Teste as runas de campo e a magic wall.', 'danger');
  preencher(cidade, 0, 102, 222, 105, 222, ACIDO, false);
  preencher(cidade, 0, 108, 225, 115, 225, ACIDO, false);
  campos(cidade, 101, 223, 6, 'fire-field');
  campos(cidade, 108, 223, 5, 'poison-field');
  campos(cidade, 114, 223, 4, 'energy-field');
  campos(cidade, 101, 225, 3, 'fire-field', 2);
  campos(cidade, 108, 225, 3, 'poison-field', 2);
  campos(cidade, 114, 225, 2, 'energy-field', 2);
  for (const x of [107, 113]) objeto(cidade, 0, x, 224, 'estrutura/natureza/veneno');
  for (const x of [104, 105, 106]) objeto(cidade, 0, x, 224, 'itens/itens-encantados/magic-wall');
  for (const [x, tipo] of [[115, 'fire-field-rune'], [116, 'poison-field-rune'], [117, 'energy-field-rune']]) objeto(cidade, 0, x, 222, `itens/runas/${tipo}`);
  objeto(cidade, 0, 100, 222, POSTE);
  objeto(cidade, 0, 117, 225, POSTE);
}

// ================================================================================================================================================================================================================================================
// montarBuracos
// Pátio dos buracos e a caverna embaixo: cada buraco leva pro sqm (+1, +1) do
// andar de baixo, onde fica uma marca de corda pra voltar com a corda. Uma
// escada reta leva da caverna de volta ao pátio.

function montarBuracos(cidade) {
  preencher(cidade, 0, 99, 232, 118, 243, TERRA_PISO);
  cercado(cidade, 0, 99, 232, 118, 243, [[108, 232], [109, 232]]);
  placa(cidade, 0, 101, 235, 'Pátio dos buracos. Bueiro: duplo clique desce. Buraco aberto: pise e caia. Monte de terra: use a pá (um deles te derruba). Embaixo, a corda numa marca sobe de volta.', 'blue');
  const buracos = [
    [102, 237, 'estrutura/entradas/bueiro'],
    [105, 237, 'estrutura/entradas/buraco-pedra-aberto'],
    [108, 237, 'estrutura/entradas/entrada-terra-1'],
    [111, 237, 'estrutura/entradas/entrada-palha-1'],
    [114, 237, 'estrutura/entradas/entrada-madeira-3'],
    [102, 240, 'estrutura/entradas/buraco-pedra-fechado'],
    [105, 240, 'estrutura/entradas/buraco-pedra-fechado'],
    [108, 240, 'estrutura/entradas/tumba-buraco'],
    [111, 240, 'estrutura/entradas/tumba-buraco'],
    [114, 240, 'estrutura/entradas/bueiro']
  ];
  preencher(cidade, -1, 100, 234, 119, 244, PRETA);
  for (const [x, y, tipo] of buracos) {
    buraco(cidade, 0, x, y, tipo);
    escada(cidade, -1, x + 1, y + 1, CORDA);
  }
  objeto(cidade, 0, 101, 234, 'itens/ferramentas/rope');
  objeto(cidade, 0, 102, 234, 'itens/ferramentas/shovel');
  objeto(cidade, 0, 103, 234, 'itens/fontes-de-luz/torch');
  escada(cidade, -1, 117, 242, ESCADA_RETA);
  piso(cidade, 0, 116, 241, MADEIRA, true);
  buraco(cidade, 0, 116, 241, ENTRADA_ESCADA);
  piso(cidade, 0, 116, 242, MADEIRA, true);
  placa(cidade, 0, 117, 238, 'A escada reta que sobe da caverna sai aqui, ao sul do alçapão de madeira.', 'info');
  for (const [x, y] of [[104, 242], [109, 242], [112, 239], [106, 239], [115, 236]]) objeto(cidade, -1, x, y, 'estrutura/natureza/pedra-1-base');
  objeto(cidade, -1, 103, 236, 'itens/fontes-de-luz/torch');
  objeto(cidade, -1, 113, 242, 'itens/fontes-de-luz/torch');
  inimigos(cidade, [['criaturas/mortos-vivos/skeleton', 5, 106, 237, -1], ['criaturas/mortos-vivos/bat', 3, 110, 241, -1], ['criaturas/vermes/rotworm', 5, 113, 238, -1], ['criaturas/vermes/spider', 3, 107, 243, -1], ['criaturas/mortos-vivos/ghoul', 10, 116, 239, -1]]);
}

// ================================================================================================================================================================================================================================================
// montarArena
// Zoológico: o cercado fácil e o difícil, com as criaturas do gerador, e o
// caçador na entrada.

function montarArena(cidade) {
  preencher(cidade, 0, 75, 222, 95, 228, MUSGO);
  cercado(cidade, 0, 74, 221, 96, 229, [[96, 225], [96, 226]]);
  preencher(cidade, 0, 75, 234, 95, 242, PRETA);
  cercado(cidade, 0, 74, 233, 96, 243, [[96, 237], [96, 238]]);
  placa(cidade, 0, 98, 224, 'Zoológico fácil: ratos, gatos, cervos, ovelhas, aranhas, cobras, morcegos, esqueletos, trolls, orcs, lobos, ursos… Bom pra subir de nível.', 'info');
  placa(cidade, 0, 98, 236, 'Zoológico difícil: minotauro, ciclope, elfo, banshee, elemental, aranha gigante, vampiro, dragão e demônio. Cuidado!', 'danger');
  cidade.npcs.push(['personagens/npcs/cacador', 98, 227, 0]);
  inimigos(cidade, [
    ['criaturas/mamiferos/rat', 1, 77, 223], ['criaturas/mamiferos/rat', 1, 79, 227], ['criaturas/mamiferos/cat', 1, 82, 224], ['criaturas/mamiferos/deer', 1, 85, 227],
    ['criaturas/mamiferos/deer', 5, 88, 223], ['criaturas/mamiferos/sheep', 1, 90, 227], ['criaturas/mamiferos/black-sheep', 5, 92, 223],
    ['criaturas/vermes/spider', 2, 78, 225], ['criaturas/vermes/spider', 5, 81, 227], ['criaturas/vermes/spider', 5, 84, 223], ['criaturas/vermes/wasp', 5, 87, 225],
    ['criaturas/vermes/rotworm', 5, 90, 224], ['criaturas/repteis/snake', 2, 93, 227], ['criaturas/repteis/snake', 2, 76, 227], ['criaturas/mortos-vivos/bat', 1, 80, 224],
    ['criaturas/mortos-vivos/skeleton', 1, 83, 226], ['criaturas/mortos-vivos/skeleton', 5, 86, 226], ['criaturas/humanoides/troll', 5, 89, 226], ['criaturas/humanoides/troll', 5, 93, 225],
    ['criaturas/humanoides/orc', 8, 91, 228], ['criaturas/humanoides/dwarf', 8, 94, 223], ['criaturas/mamiferos/wolf', 8, 77, 225], ['criaturas/mamiferos/bear', 10, 82, 228],
    ['criaturas/mortos-vivos/ghoul', 10, 85, 224], ['criaturas/humanoides/minotaur', 15, 79, 236], ['criaturas/gigantes/cyclops', 25, 83, 238], ['criaturas/humanoides/elf-arcanist', 20, 87, 236],
    ['criaturas/mortos-vivos/banshee', 20, 91, 238], ['criaturas/elementais/fire-elemental', 30, 94, 236], ['criaturas/vermes/giant-spider', 30, 78, 240], ['criaturas/mortos-vivos/vamp', 42, 82, 241],
    ['criaturas/criaturas-magicas/beholder', 35, 86, 240], ['criaturas/dragoes/dragon', 40, 90, 241], ['criaturas/demonios/demon', 100, 93, 240]
  ]);
}

// ================================================================================================================================================================================================================================================
// montarCemiterio
// Cemitério do coveiro: tumbas, caixões e esqueletos.

function montarCemiterio(cidade) {
  preencher(cidade, 0, 121, 236, 136, 242, MUSGO);
  cercado(cidade, 0, 120, 235, 137, 243, [[128, 235], [129, 235]]);
  placa(cidade, 0, 126, 237, 'Cemitério: o Coveiro quer ossos e esqueletos mortos. Diga "oi" e "ossos" ou "esqueletos".', 'warn');
  cidade.npcs.push(['personagens/npcs/coveiro', 129, 238, 0]);
  for (const [x, y] of [[123, 238], [125, 241], [132, 238], [134, 241], [135, 238]]) objeto(cidade, 0, x, y, 'estrutura/natureza/tumba');
  objeto(cidade, 0, 123, 241, 'estrutura/natureza/caixao#norte');
  objeto(cidade, 0, 136, 240, 'estrutura/natureza/caixao#norte');
  objeto(cidade, 0, 130, 242, 'itens/plantas-e-ervas/grave-flower');
  objeto(cidade, 0, 131, 242, 'itens/plantas-e-ervas/grave-flower');
  objeto(cidade, 0, 128, 241, 'decoracao/iluminacao/fogueira');
  inimigos(cidade, [['criaturas/mortos-vivos/skeleton', 3, 124, 239], ['criaturas/mortos-vivos/skeleton', 3, 133, 240], ['criaturas/mortos-vivos/skeleton', 5, 126, 242], ['criaturas/mortos-vivos/skeleton', 5, 134, 237], ['criaturas/mortos-vivos/bat', 1, 129, 240]]);
}

// ================================================================================================================================================================================================================================================
// montarFazenda
// Fazenda da fazendeira: cercado de palha com ovelhas, ratos e queijos no chão.

function montarFazenda(cidade) {
  preencher(cidade, 0, 140, 239, 152, 242, PALHA);
  cercado(cidade, 0, 139, 238, 153, 243, [[139, 240], [139, 241]]);
  placa(cidade, 0, 141, 237, 'Fazenda: a Fazendeira precisa de queijos e de ratos mortos.', 'info');
  cidade.npcs.push(['personagens/npcs/fazendeira', 146, 240, 0]);
  for (const x of [141, 143, 149, 151]) objeto(cidade, 0, x, 241, 'itens/comidas/cheese');
  objeto(cidade, 0, 150, 240, 'itens/comidas/cheese');
  inimigos(cidade, [['criaturas/mamiferos/sheep', 1, 142, 240], ['criaturas/mamiferos/sheep', 1, 144, 242], ['criaturas/mamiferos/black-sheep', 5, 150, 242], ['criaturas/mamiferos/rat', 1, 141, 242], ['criaturas/mamiferos/rat', 3, 148, 242], ['criaturas/mamiferos/rat', 1, 152, 240]]);
}

// ================================================================================================================================================================================================================================================
// montarPontes
// A placa da entrada da cidade.

function montarPontes(cidade) {
  placa(cidade, 0, 152, 227, 'Bem-vindo à Cidade de Testes! Praça a oeste, loja e casas aqui, arsenal ao sul, zoológico no fim da rua.', 'blue');
}

// ================================================================================================================================================================================================================================================
// montar
// Monta tudo e devolve a cidade.

function montar(cidade) {
  montarTerreno(cidade);
  montarPraca(cidade);
  montarLoja(cidade);
  montarCasas(cidade);
  montarArsenal(cidade);
  montarCampos(cidade);
  montarBuracos(cidade);
  montarArena(cidade);
  montarCemiterio(cidade);
  montarFazenda(cidade);
  montarPontes(cidade);
  arvores(cidade, [[76, 231], [78, 230], [85, 231], [92, 231], [119, 227], [119, 231], [139, 228], [153, 237], [140, 237], [100, 230]]);
  bordas(cidade);
  return cidade;
}

// ================================================================================================================================================================================================================================================
// entradasDaCidade
// As entradas do map.json: { objetos, transicoes, npcs, inimigos, seguras, casas }.

function entradasDaCidade(cidade) {
  const { lib } = cidade;
  const objetos = [];
  const transicoes = [];
  const andares = [...cidade.andares.keys()].sort((a, b) => a - b);
  for (const z of andares) {
    const camada = cidade.andares.get(z);
    const chaves = Object.keys(camada).sort((a, b) => {
      const [ax, ay] = a.split(',').map(Number);
      const [bx, by] = b.split(',').map(Number);
      return ay - by || ax - bx;
    });
    for (const chave of chaves) {
      const [x, y] = chave.split(',').map(Number);
      const celula = camada[chave];
      if (celula.floor) objetos.push([celula.floor.type, x, y, z, 0, false, false, false, celula.floor.seq]);
      if (celula.floorTop) objetos.push([celula.floorTop.type, x, y, z, 0, false, false, false, celula.floorTop.seq]);
      if (celula.hole) objetos.push([celula.hole, x, y, z, 0, false, false, false]);
      for (const borda of celula.borders) objetos.push([lib.borderEntryType(borda), x, y, z, 0, false, false, false]);
      let altura = 0;
      for (const obj of celula.objects) {
        if (lib.isStairsType(obj.type)) {
          const alvo = lib.getStairTarget(x, y, z, lib.stairKind(obj.type), lib.objectDirection(obj.type) || 'norte');
          transicoes.push([obj.type, x, y, z, 'up', alvo.x, alvo.y]);
          continue;
        }
        const props = lib.objectProps(obj.type);
        const item = lib.isItemType(obj.type);
        const degrau = item ? altura : 0;
        const entrada = [obj.type, x, y, z, degrau, props.movable, props.hasVolume, props.blocksMovement];
        if (item && props.hasVolume) altura++;
        if ((obj.count && obj.count > 1) || obj.dados) entrada.push(null, obj.count > 1 ? obj.count : null);
        if (obj.dados) entrada.push(obj.dados);
        objetos.push(entrada);
      }
    }
  }
  return { objetos, transicoes, npcs: cidade.npcs, inimigos: cidade.inimigos, seguras: cidade.seguras, casas: cidade.casas };
}

// ================================================================================================================================================================================================================================================
// dentroDaCidade
// O sqm é da ilha da cidade ou da ponte que a liga à ilha inicial?

function dentroDaCidade(x, y, z) {
  const naIlha = x >= ILHA.x0 && x <= ILHA.x1 && y >= ILHA.y0 && y <= ILHA.y1;
  const naPonte = x >= PONTE.x0 && x <= PONTE.x1 && PONTE.ys.includes(y) && z === 0;
  return naIlha || naPonte;
}

// ================================================================================================================================================================================================================================================
// aplicar
// Tira do mapa o que a cidade pôs antes e põe a nova. Nas células da ponte que
// já eram da ilha inicial (água), só tira o piso de madeira dela. As bordas de
// água nas duas pontas da ponte saem, porque borda de água barra a passagem.

function aplicar(mapa, entradas) {
  const ehDaCidade = (tipo, x, y, z) => {
    const naIlha = x >= ILHA.x0 && x <= ILHA.x1 && y >= ILHA.y0 && y <= ILHA.y1;
    if (naIlha) return true;
    const naPonte = x >= PONTE.x0 && x <= PONTE.x1 && PONTE.ys.includes(y) && z === 0 && tipo === MADEIRA_PONTE;
    return naPonte;
  };
  const margemDaPonte = new Set(['157,228', '157,229', '177,228', '177,229']);
  const bordaNaMargem = (tipo, x, y, z) => z === 0 && tipo.startsWith('Border:') && tipo.includes('piso-agua-1') && margemDaPonte.has(`${x},${y}`);
  mapa.objetosData = mapa.objetosData.filter(([tipo, x, y, z]) => !ehDaCidade(tipo, x, y, z) && !bordaNaMargem(tipo, x, y, z));
  mapa.transicoesData = mapa.transicoesData.filter(([, x, y, z]) => !dentroDaCidade(x, y, z));
  mapa.npcData = mapa.npcData.filter(([, x, y, z]) => !dentroDaCidade(x, y, z));
  mapa.enemyData = mapa.enemyData.filter(([x, y, z]) => !dentroDaCidade(x, y, z));
  mapa.safeZoneData = mapa.safeZoneData.filter(([x, y, z]) => !dentroDaCidade(x, y, z));
  mapa.houseData = mapa.houseData.filter(([x, y, z]) => !dentroDaCidade(x, y, z));
  mapa.objetosData.push(...entradas.objetos);
  mapa.transicoesData.push(...entradas.transicoes);
  mapa.npcData.push(...entradas.npcs);
  mapa.enemyData.push(...entradas.inimigos);
  mapa.safeZoneData.push(...entradas.seguras);
  mapa.houseData.push(...entradas.casas);
}

// ================================================================================================================================================================================================================================================
// carregarBiblioteca
// As funções do jogo (shared/) com as folhas do gerador já carregadas.

async function carregarBiblioteca(urlFolhas) {
  const compartilhado = (nome) => import(pathToFileURL(path.join(RAIZ, 'shared', nome)).href);
  const assets = await compartilhado('assets.js');
  const resposta = await fetch(urlFolhas);
  if (!resposta.ok) throw new Error(`Não deu pra ler as folhas em ${urlFolhas} (${resposta.status}).`);
  assets.setAssets((await resposta.json()).sprites);
  const formato = await compartilhado('map-format.js');
  const bordas = await compartilhado('floor-borders.js');
  const escadas = await compartilhado('stairs.js');
  return { ...assets, ...bordas, ...escadas, addFloorToCell: formato.addFloorToCell };
}

// ================================================================================================================================================================================================================================================
// conferirTipos
// Todo tipo usado na cidade existe no gerador? Devolve os que faltam.

function conferirTipos(entradas, lib) {
  const faltando = new Set();
  const conferir = (tipo) => {
    if (typeof tipo !== 'string' || tipo.startsWith('Border:')) return;
    if (!lib.getAsset(lib.splitType(tipo).asset)) faltando.add(tipo);
  };
  entradas.objetos.forEach(([tipo, , , , , , , , , , dados]) => {
    conferir(tipo);
    if (dados && Array.isArray(dados.itens)) dados.itens.forEach(item => conferir(item.tipo));
  });
  entradas.transicoes.forEach(([tipo]) => conferir(tipo));
  entradas.npcs.forEach(([tipo]) => conferir(tipo));
  entradas.inimigos.forEach(inimigo => conferir(inimigo[5]));
  return [...faltando];
}

// ================================================================================================================================================================================================================================================
// principal

async function principal() {
  const url = process.argv[2] || 'http://localhost:8000/api/sprites';
  const lib = await carregarBiblioteca(url);
  const mapa = JSON.parse(fs.readFileSync(MAPA, 'utf8'));
  let seqInicial = 1;
  for (const entrada of mapa.objetosData) if (Number.isFinite(entrada[8])) seqInicial = Math.max(seqInicial, entrada[8] + 1);
  const cidade = montar(criarCidade({ ...lib, seqInicial }));
  const entradas = entradasDaCidade(cidade);
  const faltando = conferirTipos(entradas, lib);
  if (faltando.length) {
    console.error(`❌ Faltam no gerador: ${faltando.join(', ')}`);
    process.exit(1);
  }
  aplicar(mapa, entradas);
  fs.writeFileSync(MAPA, JSON.stringify(mapa, null, 2), 'utf8');
  console.log(`✅ Cidade de Testes: ${entradas.objetos.length} objetos, ${entradas.transicoes.length} escadas, ${entradas.npcs.length} NPCs, ${entradas.inimigos.length} criaturas, ${entradas.casas.length} sqms de casas.`);
}

principal().catch(erro => {
  console.error(`❌ ${erro.message}`);
  process.exit(1);
});
