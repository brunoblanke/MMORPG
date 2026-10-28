// ferramentas/criar-lenha.js

// Cortar lenha e plantar: cria no gerador as receitas da madeira (itens/materiais/wood, empilhável), da semente
// (itens/plantas-e-ervas/seeds) e da muda (estrutura/natureza/sapling), dá a capacidade "lenhar" aos machados
// (itens/machados: os que têm "axe" no nome e o hatchet) e escreve as reações:
//   árvore + machado → com CHANCE % dá 1 madeira; a cada CORTES cortes cai (efeito QUEDA), dá 1 semente e some de vez
//                      (sai do mapa); madeira e semente vão pra mochila de quem cortou (sem espaço, aos pés dele);
//   semente          → usada com a mira no chão ao lado vira a muda (Planta como);
//   muda             → depois de CRESCE_S segundos no lugar vira uma das NASCEM (sorteada);
//   toco (antigo)    → dá 1 madeira e some.
// Pode rodar de novo: o que já está feito fica como está (a reação antiga da árvore que virava toco é trocada pela
// nova). As folhas saem do gerador: aba Objetos → "Gerar folhas pendentes"; chance, cortes, tempo e o que cai se
// mudam no gerador (Interações de cada receita).
//
// Uso: node ferramentas/criar-lenha.js

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PROJETOS = path.join(RAIZ, 'gerador', 'projetos');
const MADEIRA = 'itens/materiais/wood';
const TOCO = 'estrutura/natureza/tree-stump';
const MUDA = 'estrutura/natureza/sapling';
const QUEDA = 'earth';
const SEMENTE = 'itens/plantas-e-ervas/seeds';
const CHANCE = 40;
const CORTES = 8;
const CRESCE_S = 600;
const ARVORES = [
  'arvore-1', 'arvore-3', 'beech', 'coconut-palm', 'dead-tree', 'dwarf-tree', 'fir-tree', 'old-tree', 'palm', 'pear-tree',
  'pine', 'pinheiro-1', 'plum-tree', 'poplar', 'red-maple', 'snowy-dead-tree', 'willow', 'yellow-maple'
];
const NASCEM = ['arvore-1', 'arvore-3', 'beech', 'dwarf-tree', 'fir-tree', 'old-tree', 'pear-tree', 'pine', 'pinheiro-1', 'plum-tree', 'poplar', 'red-maple', 'willow', 'yellow-maple'];

const RECEITAS = [
  { id: MADEIRA, tibia: 5901, propriedades: { move: true, empilhavel: true, peso: 5 } },
  { id: SEMENTE, tibia: 647, propriedades: { move: true, empilhavel: false, peso: 0.5 } },
  { id: MUDA, tibia: 3748, propriedades: { move: false, empilhavel: false, peso: 0 } }
];

// ================================================================================================================================================================================================================================================
// lerReceita

function lerReceita(arquivo) {
  return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
}

// ================================================================================================================================================================================================================================================
// gravarReceita

function gravarReceita(arquivo, receita) {
  fs.writeFileSync(arquivo, JSON.stringify(receita, null, 2) + '\n');
}

// ================================================================================================================================================================================================================================================
// criarReceitas
// As receitas de RECEITAS que ainda não existem.

function criarReceitas() {
  for (const { id, tibia, propriedades } of RECEITAS) {
    const arquivo = path.join(PROJETOS, `${id}.json`);
    if (fs.existsSync(arquivo)) {
      console.log(`já existe: ${id}`);
      continue;
    }
    const [grupo, pasta, nome] = id.split('/');
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    gravarReceita(arquivo, {
      formato: { quadro: 32, quadros: 1 },
      objeto: { tibia: { id: tibia, variacao: 0 } },
      propriedades: {
        bloqueia: false, altura: false, espacos: 0, atk: 0, def: 0, ml: 0, speed: 0, vidaMin: 0, vidaMax: 0, manaMin: 0, manaMax: 0, alimento: 0,
        ...propriedades
      },
      ferramenta: 'objetos', grupo, pasta, nome
    });
    console.log(`✅ ${id}`);
  }
}

// ================================================================================================================================================================================================================================================
// garantirInteracao
// Põe a interação na receita se ainda não há uma com o mesmo gatilho que faça o efeito marca. Devolve true se mudou.

function garantirInteracao(receita, marca, interacao) {
  const props = receita.propriedades = receita.propriedades || {};
  const lista = Array.isArray(props.interacoes) ? props.interacoes : [];
  const mesma = (i) => i && i.gatilho && i.gatilho.tipo === interacao.gatilho.tipo && i.gatilho.capacidade === interacao.gatilho.capacidade
    && Array.isArray(i.efeitos) && i.efeitos.some(e => e && e.tipo === marca);
  if (lista.some(mesma)) return false;
  props.interacoes = [...lista, interacao];
  return true;
}

// ================================================================================================================================================================================================================================================
// paraMochila
// Madeira e semente vão direto pra mochila de quem cortou (dar-itens; sem espaço, aos pés dele): troca o soltar-item
// antigo delas. Devolve true se mudou.

function paraMochila(receita) {
  let mudou = false;
  for (const interacao of (receita.propriedades && receita.propriedades.interacoes) || []) {
    for (const efeito of (interacao && interacao.efeitos) || []) {
      if (!efeito || efeito.tipo !== 'soltar-item' || ![MADEIRA, SEMENTE].includes(efeito.item)) continue;
      efeito.tipo = 'dar-itens';
      efeito.umaVez = 'nao';
      mudou = true;
    }
  }
  return mudou;
}

// ================================================================================================================================================================================================================================================
// marcar
// Abre a receita, aplica mudar(receita) e grava se mudou.

function marcar(id, mudar) {
  const arquivo = path.join(PROJETOS, `${id}.json`);
  if (!fs.existsSync(arquivo)) return console.log(`não achei: ${id}`);
  const receita = lerReceita(arquivo);
  if (!mudar(receita)) return;
  gravarReceita(arquivo, receita);
  console.log(`✏️  ${id}`);
}

// ================================================================================================================================================================================================================================================
// marcarMachados
// Os machados ganham a capacidade "lenhar".

function marcarMachados() {
  const pasta = path.join(PROJETOS, 'itens', 'machados');
  for (const nome of fs.readdirSync(pasta).filter(n => n.endsWith('.json')).sort()) {
    const base = nome.replace(/\.json$/, '');
    if (!base.includes('axe') && base !== 'hatchet') continue;
    marcar(`itens/machados/${base}`, (receita) => {
      const props = receita.propriedades = receita.propriedades || {};
      const lista = Array.isArray(props.capacidade) ? props.capacidade : [];
      if (lista.includes('lenhar')) return false;
      props.capacidade = [...lista, 'lenhar'];
      return true;
    });
  }
}

// ================================================================================================================================================================================================================================================
// marcarArvores
// Árvore: madeira com CHANCE %; a cada CORTES cai, solta a semente e some. Semente: planta a muda. Muda: vira árvore.
// Toco: madeira e some.

function marcarArvores() {
  const lenhar = { tipo: 'capacidade', capacidade: 'lenhar' };
  for (const nome of ARVORES) {
    marcar(`estrutura/natureza/${nome}`, (receita) => {
      const props = receita.propriedades = receita.propriedades || {};
      const antes = Array.isArray(props.interacoes) ? props.interacoes.length : 0;
      props.interacoes = (props.interacoes || []).filter(i => !(i && Array.isArray(i.efeitos) && i.efeitos.some(e => e && e.tipo === 'trocar-por' && e.item === TOCO)));
      const tirou = props.interacoes.length !== antes;
      const mochila = paraMochila(receita);
      const madeira = garantirInteracao(receita, 'dar-itens', { gatilho: lenhar, condicoes: { alcance: 1, chance: CHANCE }, efeitos: [{ tipo: 'dar-itens', item: MADEIRA, quantidade: 1, umaVez: 'nao' }] });
      const cai = garantirInteracao(receita, 'remover', { gatilho: lenhar, condicoes: { alcance: 1, vezes: CORTES }, efeitos: [{ tipo: 'efeito-visual', nome: QUEDA }, { tipo: 'dar-itens', item: SEMENTE, quantidade: 1, umaVez: 'nao' }, { tipo: 'remover', rebroteMs: 0 }] });
      return tirou || mochila || madeira || cai;
    });
  }
  marcar(TOCO, (receita) => {
    const mochila = paraMochila(receita);
    const some = garantirInteracao(receita, 'remover', { gatilho: lenhar, condicoes: { alcance: 1 }, efeitos: [{ tipo: 'dar-itens', item: MADEIRA, quantidade: 1, umaVez: 'nao' }, { tipo: 'remover', rebroteMs: 0 }] });
    return mochila || some;
  });
  marcar(SEMENTE, (receita) => {
    const props = receita.propriedades = receita.propriedades || {};
    const antes = JSON.stringify(props);
    props.interacoes = (props.interacoes || []).filter(i => !(i && i.gatilho && i.gatilho.tipo === 'tempo'));
    if (!props.interacoes.length) delete props.interacoes;
    props.plantaComo = props.plantaComo || MUDA;
    return JSON.stringify(props) !== antes;
  });
  marcar(MUDA, (receita) => garantirInteracao(receita, 'trocar-por', { gatilho: { tipo: 'tempo' }, condicoes: { idade: CRESCE_S }, efeitos: [{ tipo: 'trocar-por', item: NASCEM.map(n => `estrutura/natureza/${n}`).join(', ') }] }));
}

criarReceitas();
marcarMachados();
marcarArvores();
