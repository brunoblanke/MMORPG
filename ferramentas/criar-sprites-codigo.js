// ferramentas/criar-sprites-codigo.js

// Cria as receitas das sprites desenhadas por código (lista SPRITES). A receita leva "desenho" (modelo, cores e
// argumento de shared/desenho.js) e não tem .png: o jogo e o editor desenham a folha no navegador, em Canvas 2D.
// As propriedades vêm de uma receita parecida (copiaDe) na 1ª vez; depois ficam como estiverem (só o desenho é
// atualizado). Pra mudar um visual ou criar outro: editar SPRITES e rodar de novo.
//
// Uso: node ferramentas/criar-sprites-codigo.js

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const LINHAS = ['sul', 'norte', 'leste', 'oeste', 'cadáver: fresco, apodrecendo, ossos'];
const PECAS_DE_MURO = ['x', 'y', 'xy', 'yx', 'porta-x', 'porta-x-aberta', 'porta-y', 'porta-y-aberta', 'janela-x', 'janela-y'];

const SPRITES = [
  { tipo: 'personagens/players/aventureiro', ferramenta: 'criaturas', copiaDe: 'personagens/players/player-masculino', modelo: 'pessoa', visual: { pele: '#e8b490', cabelo: '#8a4a26', camisa: '#efe4cb', calca: '#7a4e30', calcaLarga: true, sapato: '#4a3222', cinto: '#6b3f22', fivela: '#c9a04a', bolsa: '#8f5a33', mangaCurta: true, golaAberta: true } },
  { tipo: 'personagens/players/aventureira', ferramenta: 'criaturas', copiaDe: 'personagens/players/player-feminino', modelo: 'pessoa', visual: { pele: '#efc29e', cabelo: '#a4502a', camisa: '#1f6f80', vestido: '#1f6f80', painel: '#f2e4c6', barra: '#e39a2c', manga: '#f2e4c6', bufante: true, calca: '#1f6f80', sapato: '#5e3c24', feminino: true } },
  { tipo: 'personagens/npcs/cavaleiro-coroa', ferramenta: 'criaturas', copiaDe: 'personagens/npcs/cacador', modelo: 'humano', visual: { pele: '#e8b490', cabelo: '#6e4426', camisa: '#3a3f4c', calca: '#3a3f4c', sapato: '#5e3c24', equip: { elmo: 'crown', peito: 'crown', pernas: 'crown', botas: 'crown', escudo: 'crown', arma: 'crown' } } },
  { tipo: 'personagens/npcs/cavaleiro-de-placas', ferramenta: 'criaturas', copiaDe: 'personagens/npcs/cacador', modelo: 'guerreiro', visual: { metal: '#a4a9b0', escuro: '#6d727a', chifre: '#585c64', fenda: '#2a2b30', escudo: '#f9b52c', escudoBorda: '#ef7d18', brasao: '#ef7d18', lamina: '#dfe4ea', guarda: '#e8641c', cabo: '#5a3a26' } },
  { tipo: 'personagens/npcs/monge-encapuzado', ferramenta: 'criaturas', copiaDe: 'personagens/npcs/cacador', modelo: 'mago', visual: { pele: '#efb894', tunica: '#4f3e3a', capuz: '#cf3b33', capinha: '#cf3b33', simbolo: '#f5a01c', barba: '#4e3329' } },
  { tipo: 'personagens/npcs/feiticeiro', ferramenta: 'criaturas', copiaDe: 'personagens/npcs/cacador', modelo: 'mago', visual: { pele: '#efb894', tunica: '#f1e3c4', cinto: '#6a4a3a', manto: '#8a7c79', chapeu: '#857774', faixa: '#b23232', fivela: '#e8c34a', barba: '#7a2e2c', barbaComprida: true, cajado: '#a3312d' } },
  { tipo: 'personagens/npcs/cavaleiro-andante', ferramenta: 'criaturas', copiaDe: 'personagens/npcs/cacador', modelo: 'humano', visual: { corpo: { largura: 0.86 }, pele: '#eab08c', cabelo: '#7a3c22', camisa: '#c8cdd4', calca: '#c8cdd4', sapato: '#c8cdd4', bigode: '#8a3a22', morion: '#c8cdd4', equip: { peito: 'prata', pernas: 'prata', botas: 'prata' }, arma: { tipo: 'espada', lamina: '#dfe4ea', cabo: '#5a3426', guarda: '#7a7f88' } } },
  { tipo: 'personagens/npcs/eremita-roxo', ferramenta: 'criaturas', copiaDe: 'personagens/npcs/cacador', modelo: 'mago', visual: { pele: '#efb894', tunica: '#4a3a52', capuz: '#6b5a78', manto: '#6b5a78', rasgado: true, barba: '#e9e6e0', barbaComprida: true, cajado: '#5a3a2e' } },
  { tipo: 'personagens/npcs/rei', ferramenta: 'criaturas', copiaDe: 'personagens/npcs/cacador', modelo: 'mago', visual: { largura: 1.3, pele: '#efb894', tunica: '#b0302c', capinha: '#c49a6c', capinhaAte: 18, barraPelo: '#c49a6c', cabelo: '#5a3a26', coroa: '#f2b62a', barba: '#5a3a26', luvas: '#3a3030', espada: { lamina: '#cfd5dc', cabo: '#4a3a32' } } },
  { tipo: 'personagens/npcs/carrasco', ferramenta: 'criaturas', copiaDe: 'personagens/npcs/cacador', modelo: 'humano', visual: { corpo: { largura: 1.12, grossura: 1.1 }, pele: '#eab08c', cabelo: '#2a2226', camisa: '#eab08c', musculoso: true, calca: '#3a3040', sapato: '#4a3428', cinto: '#2c2a2e', fivela: '#9aa0a8', luvas: '#5a4038', capuzFechado: '#3b3539', capinha: '#3b3539', arma: { tipo: 'machado', cabo: '#8a5a3a', lamina: '#b9c0c8' } } },
  { tipo: 'personagens/npcs/cavaleiro-negro', ferramenta: 'criaturas', copiaDe: 'personagens/npcs/cacador', modelo: 'guerreiro', visual: { metal: '#4a4446', escuro: '#383234', espinhos: '#8a8f96', fenda: '#2a2628', grade: '#a2a7ae', brasao: '#6e7680', lamina: '#cfd5dc', guarda: '#6e7680', cabo: '#3a2e2a' } },
  { tipo: 'personagens/npcs/mercador-barbudo', ferramenta: 'criaturas', copiaDe: 'personagens/npcs/cacador', modelo: 'humano', visual: { corpo: { largura: 1.22, barriga: 2.6 }, pele: '#efb894', cabelo: '#6a4a32', barba: '#8a5a3e', camisa: '#5f6a3a', mangaCurta: true, calca: '#9a7450', calcaLarga: true, sapato: '#5a3a26', cinto: '#4a3428', casaco: '#b0302c', avental: '#8a5a3a', medalhao: '#f2a21c' } },
  { tipo: 'personagens/npcs/arqueiro-encapuzado', ferramenta: 'criaturas', copiaDe: 'personagens/npcs/cacador', modelo: 'humano', visual: { corpo: { largura: 0.84, grossura: 0.86 }, pele: '#eab08c', cabelo: '#6a4a32', camisa: '#3e8a86', calca: '#5a4a6a', sapato: '#6b7a3a', cinto: '#4a3428', fivela: '#9aa0a8', capuz: '#6b7a3a', capinha: '#6b7a3a' } },
  { tipo: 'personagens/npcs/monge-negro', ferramenta: 'criaturas', copiaDe: 'personagens/npcs/cacador', modelo: 'mago', visual: { pele: '#efb894', tunica: '#2e2a2c', capuz: '#2e2a2c', barba: '#e9e6e0', barbaComprida: true } },
  { tipo: 'personagens/npcs/barbaro', ferramenta: 'criaturas', copiaDe: 'personagens/npcs/cacador', modelo: 'humano', visual: { corpo: { largura: 1.14, grossura: 1.12 }, pele: '#eab08c', cabelo: '#9a5a32', barba: '#9a5a32', camisa: '#eab08c', musculoso: true, calca: '#5a4034', sapato: '#3a2c26', cinto: '#3a2c26', fivela: '#9aa0a8', bandoleira: '#4a3428', bracadeiras: '#8a9098', arma: { tipo: 'machado', cabo: '#6a4a32', lamina: '#c3c9d0' } } },
  { tipo: 'criaturas/mamiferos/lobo-cinzento', ferramenta: 'criaturas', copiaDe: 'criaturas/mamiferos/wolf', modelo: 'lobo', visual: { pelo: '#8a8782', barriga: '#b9b5ad', olho: '#f2d23c' } },
  { tipo: 'estrutura/natureza/carvalho', ferramenta: 'objetos', copiaDe: 'estrutura/natureza/pine', modelo: 'arvore', quadro: 64 },
  { tipo: 'estrutura/natureza/arbusto-de-frutas', ferramenta: 'objetos', copiaDe: 'estrutura/natureza/bush', modelo: 'arbusto', quadro: 32 },
  { tipo: 'estrutura/natureza/capim-florido', ferramenta: 'objetos', copiaDe: 'estrutura/natureza/mato-1', modelo: 'capim', quadro: 32, propriedades: { bloqueia: false } },
  { tipo: 'estrutura/paredes/muro-de-pedra', ferramenta: 'paredes', copiaDe: 'estrutura/paredes/pedra-1', modelo: 'parede', quadro: 64 },
  { tipo: 'decoracao/adornos/caixote', ferramenta: 'objetos', copiaDe: 'decoracao/moveis/harp', modelo: 'caixote', quadro: 32 },
  { tipo: 'decoracao/adornos/barril', ferramenta: 'objetos', copiaDe: 'decoracao/moveis/harp', modelo: 'barril', quadro: 32 },
  { tipo: 'decoracao/iluminacao/poste', ferramenta: 'objetos', copiaDe: 'decoracao/moveis/harp', modelo: 'poste', quadro: 64, propriedades: { move: false, ativoComo: 'decoracao/iluminacao/poste-aceso' } },
  { tipo: 'decoracao/iluminacao/poste-aceso', ferramenta: 'objetos', copiaDe: 'decoracao/moveis/harp', modelo: 'poste', argumento: true, quadro: 64, propriedades: { move: false, luz: 6, ativoComo: 'decoracao/iluminacao/poste' } }
];

// ================================================================================================================================================================================================================================================
// receitaDe
// A receita do sprite: a que já existe (só o desenho é atualizado) ou uma nova com as propriedades da parecida.

function receitaDe(sprite) {
  const arquivo = path.join(RAIZ, 'gerador', 'projetos', `${sprite.tipo}.json`);
  const [grupo, pasta, nome] = sprite.tipo.split('/');
  const desenho = { modelo: sprite.modelo, ...(sprite.visual ? { visual: sprite.visual } : {}), ...(sprite.argumento !== undefined ? { argumento: sprite.argumento } : {}) };
  if (fs.existsSync(arquivo)) return { ...JSON.parse(fs.readFileSync(arquivo, 'utf8')), desenho };
  const parecida = JSON.parse(fs.readFileSync(path.join(RAIZ, 'gerador', 'projetos', `${sprite.copiaDe}.json`), 'utf8'));
  const formato = sprite.ferramenta === 'criaturas' ? { quadro: 64, quadros: 9, linhas: LINHAS }
    : sprite.ferramenta === 'paredes' ? { ...parecida.formato, quadro: 64, colunas: 4, pecas: PECAS_DE_MURO } : { quadro: sprite.quadro, quadros: 1 };
  return {
    formato,
    desenho,
    ...(sprite.ferramenta === 'criaturas' ? { cadaver: { fresco: { desenho: true }, apodrecendo: { desenho: true }, ossos: { desenho: true } } } : {}),
    ...(sprite.ferramenta === 'paredes' ? { pecas: Object.fromEntries(PECAS_DE_MURO.map(peca => [peca, { desenho: true }])) } : {}),
    ...(parecida.colisao ? { colisao: parecida.colisao } : {}),
    propriedades: { ...parecida.propriedades, ...(sprite.propriedades || {}) },
    ferramenta: sprite.ferramenta,
    grupo,
    pasta,
    nome
  };
}

// ================================================================================================================================================================================================================================================
// principal

function principal() {
  for (const sprite of SPRITES) {
    const arquivo = path.join(RAIZ, 'gerador', 'projetos', `${sprite.tipo}.json`);
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    fs.writeFileSync(arquivo, JSON.stringify(receitaDe(sprite), null, 2));
    console.log(`✅ ${sprite.tipo}`);
  }
}

principal();
