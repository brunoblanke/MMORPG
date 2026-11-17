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
  { tipo: 'personagens/players/aventureiro', ferramenta: 'criaturas', copiaDe: 'personagens/players/player-masculino', modelo: 'humano', visual: { pele: '#e8b490', cabelo: '#8a4a26', camisa: '#efe4cb', calca: '#7a4e30', calcaLarga: true, sapato: '#4a3222', cinto: '#6b3f22', fivela: '#c9a04a', bolsa: '#8f5a33', mangaCurta: true, golaAberta: true } },
  { tipo: 'personagens/players/aventureira', ferramenta: 'criaturas', copiaDe: 'personagens/players/player-feminino', modelo: 'humano', visual: { pele: '#efc29e', cabelo: '#a4502a', camisa: '#1f6f80', vestido: '#1f6f80', painel: '#f2e4c6', barra: '#e39a2c', manga: '#f2e4c6', bufante: true, calca: '#1f6f80', sapato: '#5e3c24', feminino: true } },
  { tipo: 'personagens/npcs/cavaleiro-coroa', ferramenta: 'criaturas', copiaDe: 'personagens/npcs/cacador', modelo: 'humano', visual: { pele: '#e8b490', cabelo: '#6e4426', camisa: '#3a3f4c', calca: '#3a3f4c', sapato: '#5e3c24', equip: { elmo: 'crown', peito: 'crown', pernas: 'crown', botas: 'crown', escudo: 'crown', arma: 'crown' } } },
  { tipo: 'personagens/npcs/cavaleiro-de-placas', ferramenta: 'criaturas', copiaDe: 'personagens/npcs/cacador', modelo: 'guerreiro', visual: { metal: '#a4a9b0', escuro: '#6d727a', chifre: '#585c64', fenda: '#2a2b30', escudo: '#f9b52c', escudoBorda: '#ef7d18', brasao: '#ef7d18', lamina: '#dfe4ea', guarda: '#e8641c', cabo: '#5a3a26' } },
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
